import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const babel = require('@babel/core');

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
    '@/lib/paynow-server': {createPaynow:async()=>({createPayment:()=>({add(){}}),send:async()=>{counters.payments++;return{success:true,pollUrl:'https://www.paynow.co.zw/Interface/CheckPayment/?guid=mock',redirectUrl:'https://www.paynow.co.zw/Payment/Confirm?mock=1'};}})},
    ...injected
  };
  const esmToCommonJS = ({types:t})=>({visitor:{
    ImportDeclaration(path){ const node=path.node, source=node.source.value;
      if(!node.specifiers.length){path.replaceWith(t.expressionStatement(t.callExpression(t.identifier('require'),[t.stringLiteral(source)])));return;}
      const temp=path.scope.generateUidIdentifier('imported');
      const statements=[t.variableDeclaration('const',[t.variableDeclarator(temp,t.callExpression(t.identifier('require'),[t.stringLiteral(source)]))])];
      for(const spec of node.specifiers){ const value=t.isImportNamespaceSpecifier(spec)?temp:t.memberExpression(temp,t.identifier(t.isImportDefaultSpecifier(spec)?'default':spec.imported.name)); statements.push(t.variableDeclaration('const',[t.variableDeclarator(spec.local,value)])); }
      path.replaceWithMultiple(statements);
    },
    ExportDefaultDeclaration(path){path.replaceWith(t.expressionStatement(t.assignmentExpression('=',t.memberExpression(t.identifier('exports'),t.identifier('default')),path.node.declaration)));},
    ExportNamedDeclaration(path){const node=path.node,assign=name=>t.expressionStatement(t.assignmentExpression('=',t.memberExpression(t.identifier('exports'),t.identifier(name)),t.identifier(name)));
      if(node.declaration){const names=t.isVariableDeclaration(node.declaration)?node.declaration.declarations.map(d=>d.id.name):[node.declaration.id.name];path.replaceWithMultiple([node.declaration,...names.map(assign)]);}
      else path.replaceWithMultiple(node.specifiers.map(spec=>t.expressionStatement(t.assignmentExpression('=',t.memberExpression(t.identifier('exports'),t.identifier(spec.exported.name)),node.source?t.memberExpression(t.callExpression(t.identifier('require'),[node.source]),t.identifier(spec.local.name)):t.identifier(spec.local.name)))));
    }
  }});
  function load(file){
    file=resolve(root,file);if(!existsSync(file))file+='.js';if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    const code=babel.transformSync(readFileSync(file,'utf8'),{configFile:false,babelrc:false,compact:true,plugins:[esmToCommonJS]}).code;
    const localRequire=specifier=>{if(Object.hasOwn(mocks,specifier))return mocks[specifier];if(specifier.startsWith('@/'))return load(specifier.slice(2));if(specifier.startsWith('.'))return load(resolve(dirname(file),specifier));return require(specifier);};
    const run=vm.runInThisContext(`(function(require,module,exports,Response,Request){${code}\n})`,{filename:file});run(localRequire,module,module.exports,Response,Request);return module.exports;
  }
  return {load,db,records,counters,setActor:value=>{actor=value;},request:body=>new Request('https://spotly.example/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})};
}
