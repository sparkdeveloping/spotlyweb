import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);

// Execute the real route handlers with an isolated Firestore and payment provider.
export function routeHarness(root, injected = {}) {
  const records = new Map(), counters = { payments: 0 }, cache = new Map();
  let actor = { uid: 'customer-one', email: 'customer@example.com' }, next = 0;
  const ref = path => ({ path, id: path.split('/').at(-1), get: async () => snapshot(path),
    collection: name => collection(path + '/' + name),
    create: async value => { if (records.has(path)) throw Object.assign(new Error('exists'), {code:6}); records.set(path,value); },
    update: async patch => records.set(path,{...records.get(path),...patch}),
    set: async (value, options) => records.set(path,options?.merge?{...records.get(path),...value}:value) });
  const snapshot = path => ({ id:path.split('/').at(-1), ref:ref(path), exists:records.has(path), data:()=>records.get(path) });
  function collection(path, filters = [], max = Infinity) {
    return { path, doc: id => ref(path + '/' + (id || `auto-${++next}`)),
      where: (field, op, value) => collection(path,[...filters,[field,op,value]],max),
      limit: amount => collection(path,filters,amount),
      get: async () => { const docs=[...records.keys()].filter(key=>key.startsWith(path+'/')&&key.slice(path.length+1).indexOf('/')<0).map(snapshot).filter(doc=>filters.every(([field,op,value])=>op==='=='&&doc.data()[field]===value)).slice(0,max); return {docs,size:docs.length}; },
      add: async value => { const r=ref(path+`/auto-${++next}`); await r.create(value); return r; } };
  }
  const db = { collection, getAll: async (...refs)=>Promise.all(refs.map(r=>r.get())),
    runTransaction: async fn => { const writes=[]; let writing=false; const tx={
      get: async r => { if(writing)throw new Error('Firestore read after write'); return r.get(); },
      create: (r,value)=>{writing=true;writes.push(()=>r.create(value));},
      update: (r,value)=>{writing=true;writes.push(()=>r.update(value));},
      set: (r,value,options)=>{writing=true;writes.push(()=>r.set(value,options));} };
      const result=await fn(tx); for(const write of writes)await write(); return result; } };
  const mocks = {
    'server-only': {},
    'firebase-admin/firestore': { FieldValue:{serverTimestamp:()=>({toDate:()=>new Date()})} },
    '@/lib/firebase-admin': { authenticateRequest:async()=>actor, verifyAppCheckRequest:async()=>{}, getAdminServices:()=>({db,messaging:{},auth:{}}), apiError:error=>Response.json({ok:false,error:error.message},{status:error.status||500}) },
    '@/lib/rate-limit-server': { enforceRateLimit:async()=>({remaining:10}) },
    '@/lib/customer-launch-server': { requireCustomerLaunchAccess:async()=>{} },
    '@/lib/directory-publication-server': {unclaimedPublicationEnabled:async()=>true},
    '@/lib/notification-server': {notifyRoleAudience:async()=>{},notifyUser:async()=>{}},
    '@/lib/paynow-server': {paynowCredentialsConfigured:async()=>true,createPaynow:async()=>({createPayment:()=>({add(){}}),send:async()=>{counters.payments++;return{success:true,pollUrl:'https://www.paynow.co.zw/Interface/CheckPayment/?guid=mock',redirectUrl:'https://www.paynow.co.zw/Payment/Confirm?mock=1'};}})},
    ...injected
  };
  function esmToCommonJS(source) {
    let moduleIndex = 0;
    const exports = new Set();
    const tail = [];
    const namedBindings = (content) => content.split(",").map(item => item.trim()).filter(Boolean).map(item => {
      const match = item.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (!match) throw new Error(`Unsupported import/export binding: ${item}`);
      return match[2] ? `${match[1]}: ${match[2]}` : match[1];
    }).join(", ");

    source = source.replace(/import\s+["']([^"']+)["'];?/g, (_all, specifier) => `require(${JSON.stringify(specifier)});`);
    source = source.replace(/import\s+([\s\S]*?)\s+from\s+["']([^"']+)["'];?/g, (_all, clause, specifier) => {
      const temp = `__imported_${moduleIndex++}`;
      clause = clause.trim();
      if (clause.startsWith("{")) return `const { ${namedBindings(clause.slice(1, -1))} } = require(${JSON.stringify(specifier)});`;
      if (clause.startsWith("* as ")) return `const ${clause.slice(5).trim()} = require(${JSON.stringify(specifier)});`;
      const comma = clause.indexOf(",");
      if (comma >= 0) {
        const defaultName = clause.slice(0, comma).trim();
        const rest = clause.slice(comma + 1).trim();
        let code = `const ${temp} = require(${JSON.stringify(specifier)}); const ${defaultName} = ${temp}.default ?? ${temp};`;
        if (rest.startsWith("{")) code += ` const { ${namedBindings(rest.slice(1, -1))} } = ${temp};`;
        else if (rest.startsWith("* as ")) code += ` const ${rest.slice(5).trim()} = ${temp};`;
        else throw new Error(`Unsupported mixed import: ${clause}`);
        return code;
      }
      return `const ${temp} = require(${JSON.stringify(specifier)}); const ${clause} = ${temp}.default ?? ${temp};`;
    });
    source = source.replace(/export\s+\*\s+from\s+["']([^"']+)["'];?/g, (_all, specifier) => `Object.assign(exports, require(${JSON.stringify(specifier)}));`);
    source = source.replace(/export\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];?/g, (_all, bindings, specifier) => {
      const temp = `__reexported_${moduleIndex++}`;
      const statements = [`const ${temp} = require(${JSON.stringify(specifier)});`];
      for (const item of bindings.split(",").map(value => value.trim()).filter(Boolean)) {
        const match = item.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (!match) throw new Error(`Unsupported re-export binding: ${item}`);
        statements.push(`exports.${match[2] || match[1]} = ${temp}.${match[1]};`);
      }
      return statements.join(" ");
    });
    source = source.replace(/export\s+\{([^}]+)\};?/g, (_all, bindings) => {
      for (const item of bindings.split(",").map(value => value.trim()).filter(Boolean)) {
        const match = item.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (!match) throw new Error(`Unsupported export binding: ${item}`);
        tail.push(`exports.${match[2] || match[1]} = ${match[1]};`);
      }
      return "";
    });
    source = source.replace(/export\s+(async\s+function|function|class)\s+([A-Za-z_$][\w$]*)/g, (_all, kind, name) => { exports.add(name); return `${kind} ${name}`; });
    source = source.replace(/export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/g, (_all, kind, name) => { exports.add(name); return `${kind} ${name}`; });
    source = source.replace(/export\s+default\s+/g, "exports.default = ");
    for (const name of exports) tail.push(`exports.${name} = ${name};`);
    return source + "\n" + tail.join("\n");
  }

  class ZodError extends Error {
    constructor(message = "Invalid input") { super(message); this.name = "ZodError"; }
    flatten() { return { formErrors: [this.message], fieldErrors: {} }; }
  }
  class Schema {
    constructor(parse) { this._parse = parse; }
    parse(value) { try { return this._parse(value); } catch (error) { if (error instanceof ZodError) throw error; throw new ZodError(error?.message); } }
    safeParse(value) { try { return { success: true, data: this.parse(value) }; } catch (error) { return { success: false, error }; } }
    optional() { const inner=this; return new Schema(value => value === undefined ? undefined : inner.parse(value)); }
    nullable() { const inner=this; return new Schema(value => value === null ? null : inner.parse(value)); }
    default(fallback) { const inner=this; return new Schema(value => inner.parse(value === undefined ? (typeof fallback === "function" ? fallback() : fallback) : value)); }
    refine(check, params) { const inner=this; return new Schema(value => { const parsed=inner.parse(value); if (!check(parsed)) throw new ZodError(typeof params === "string" ? params : params?.message); return parsed; }); }
    transform(fn) { const inner=this; return new Schema(value => fn(inner.parse(value))); }
    strict() { return this; }
    passthrough() { return this; }
    positive() { const inner=this; return new Schema(value => { const parsed=inner.parse(value); if (!(parsed > 0)) throw new ZodError(); return parsed; }); }
    datetime() { const inner=this; return new Schema(value => { const parsed=inner.parse(value); if (typeof parsed !== "string" || !Number.isFinite(Date.parse(parsed))) throw new ZodError(); return parsed; }); }
    min(limit) { const inner=this; return new Schema(value => { const parsed=inner.parse(value); if ((typeof parsed === "number" ? parsed : parsed?.length) < limit) throw new ZodError(); return parsed; }); }
    max(limit) { const inner=this; return new Schema(value => { const parsed=inner.parse(value); if ((typeof parsed === "number" ? parsed : parsed?.length) > limit) throw new ZodError(); return parsed; }); }
    int() { const inner=this; return new Schema(value => { const parsed=inner.parse(value); if (!Number.isInteger(parsed)) throw new ZodError(); return parsed; }); }
    finite() { const inner=this; return new Schema(value => { const parsed=inner.parse(value); if (!Number.isFinite(parsed)) throw new ZodError(); return parsed; }); }
    regex(pattern) { const inner=this; return new Schema(value => { const parsed=inner.parse(value); if (!pattern.test(parsed)) throw new ZodError(); return parsed; }); }
    trim() { const inner=this; return new Schema(value => inner.parse(value).trim()); }
    url() { const inner=this; return new Schema(value => { const parsed=inner.parse(value); try { new URL(parsed); } catch { throw new ZodError(); } return parsed; }); }
  }
  const z = {
    ZodError,
    string: () => new Schema(value => { if (typeof value !== "string") throw new ZodError(); return value; }),
    number: () => new Schema(value => { if (typeof value !== "number" || Number.isNaN(value)) throw new ZodError(); return value; }),
    boolean: () => new Schema(value => { if (typeof value !== "boolean") throw new ZodError(); return value; }),
    unknown: () => new Schema(value => value),
    any: () => new Schema(value => value),
    literal: expected => new Schema(value => { if (value !== expected) throw new ZodError(); return value; }),
    enum: values => new Schema(value => { if (!values.includes(value)) throw new ZodError(); return value; }),
    array: schema => { const base=new Schema(value => { if (!Array.isArray(value)) throw new ZodError(); return value.map(item => schema.parse(item)); }); return base; },
    object: shape => {
      let strict = false;
      const schema = new Schema(value => {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new ZodError();
        if (strict && Object.keys(value).some(key => !Object.hasOwn(shape,key))) throw new ZodError();
        const output = {};
        for (const [key, child] of Object.entries(shape)) { const parsed=child.parse(value[key]); if (parsed !== undefined) output[key]=parsed; }
        return output;
      });
      schema.strict = () => { strict = true; return schema; };
      schema.passthrough = () => schema;
      schema.extend = extra => z.object({ ...shape, ...extra });
      return schema;
    },
    record: (_key, valueSchema) => new Schema(value => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new ZodError(); return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,(valueSchema || _key).parse(item)])); }),
    union: schemas => new Schema(value => { for (const schema of schemas) { const result=schema.safeParse(value); if (result.success) return result.data; } throw new ZodError(); }),
    discriminatedUnion: (_key, schemas) => new Schema(value => { for (const schema of schemas) { const result=schema.safeParse(value); if (result.success) return result.data; } throw new ZodError(); })
  };
  mocks.zod = { z, ZodError };
  function load(file){
    file=resolve(root,file);if(!existsSync(file))file+='.js';if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    const code=esmToCommonJS(readFileSync(file,'utf8'));
    const localRequire=specifier=>{if(Object.hasOwn(mocks,specifier))return mocks[specifier];if(specifier.startsWith('@/'))return load(specifier.slice(2));if(specifier.startsWith('.'))return load(resolve(dirname(file),specifier));return require(specifier);};
    let run; try { run=vm.runInThisContext(`(function(require,module,exports,Response,Request){${code}\n})`,{filename:file}); } catch(error) { error.message += ` [transformed ${file}]`; throw error; } run(localRequire,module,module.exports,Response,Request);return module.exports;
  }
  return {load,db,records,counters,setActor:value=>{actor=value;},request:body=>new Request('https://spotly.example/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})};
}
