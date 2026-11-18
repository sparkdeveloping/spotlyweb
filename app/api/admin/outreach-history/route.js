import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { noStore, audit } from "@/lib/nxt-server";
import {
  FIELD_ARCHIVE_KEY, OUTREACH_CLASSIFICATIONS,
  fieldArchiveProspectId, fieldArchiveMessageId, fieldArchiveStatus,
  cleanHistoricalSnippet, safeHistoricalDate
} from "@/lib/outreach-history-policy.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const short = z.string().trim().max(280);
const date = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]);
const message = z.object({
  index: z.number().int().min(0).max(1000),
  direction: z.enum(["outbound", "inbound"]),
  sender: short,
  text: z.string().max(5000),
  date, localTime: z.string().max(18)
}).strict();
const row = z.object({
  sourceId: z.string().regex(/^OUT-\d{3,4}$/),
  name: z.string().trim().min(2).max(240),
  phone: z.string().max(80),
  sourceFile: z.string().max(350),
  classification: z.enum(OUTREACH_CLASSIFICATIONS),
  firstContact: date, lastActivity: date, lastReply: date,
  nextAction: z.string().max(600),
  grouping: z.string().max(130),
  sourceAttachments: z.array(z.string().max(180)).max(25),
  outgoing: z.number().int().min(0).max(200), incoming: z.number().int().min(0).max(200),
  messages: z.array(message).max(200)
}).strict();
const requestSchema = z.object({
  action: z.literal("import_historical_outreach"),
  archiveKey: z.literal(FIELD_ARCHIVE_KEY),
  creditedAgent: z.object({name: z.string().trim().min(2).max(130),email: z.string().email().max(180)}).strict(),
  rows: z.array(row).min(1).max(4),
  confirmPrivateImport: z.literal(true)
}).strict().refine(x => new Set(x.rows.map(r => r.sourceId)).size === x.rows.length, {message:"Duplicate archive IDs in batch"});
function denied(message, code=403) {throw Object.assign(new Error(message), {status:code});}
const INTERNAL_ADMINS=new Set(["admin","super_admin","platform_admin"]);

export async function POST(request) {
  try {
    const actor=await authenticateRequest(request);
    if (!(actor.profile?.roles||[]).some(role=>INTERNAL_ADMINS.has(role))) denied("Only an internal Spotly administrator can import historical outreach.");
    const length=Number(request.headers.get("content-length")||0);
    if(length>350_000)denied("Reduce the import to four conversations per batch.",413);
    const input=requestSchema.parse(await request.json());
    await enforceRateLimit(request,{key:"admin_historical_outreach_import",limit:40,windowMs:60_000,identity:actor.uid});
    const {db}=getAdminServices();
    // Attribution describes the person's historical work. It is NOT a Firebase identity or role assignment.
    // No inferred staff ID, merchant ownership, or live business status is written.
    const now=FieldValue.serverTimestamp();
    const ids=input.rows.map(r=>fieldArchiveProspectId(r.sourceId));
    const existing=await db.getAll(...ids.map(id=>db.collection("nxtProspects").doc(id)));
    const totalMessages=input.rows.reduce((count,r)=>count+r.messages.length,0);
    if(totalMessages>400)denied("Too many messages in one import batch; use smaller batches.",413);
    const messageRefs=input.rows.flatMap(r=>r.messages.map(m=>({ref:db.collection("nxtInteractions").doc(fieldArchiveMessageId(r.sourceId,m.index)),row:r,m})));
    const knownMessages=messageRefs.length ? await db.getAll(...messageRefs.map(x=>x.ref)) : [];
    const batch=db.batch();
    let prospectsCreated=0, messagesCreated=0, alreadyPresent=0;
    for (let i=0;i<input.rows.length;i++) {
      const r=input.rows[i];
      if(r.messages.some(m=>!safeHistoricalDate(m.date))) denied(`Source ${r.sourceId} has an invalid historical message date.`,400);
      if(r.messages.length!==r.outgoing+r.incoming) denied(`Message counts do not reconcile for ${r.sourceId}.`,400);
      const historicalAttribution={name:input.creditedAgent.name,email:input.creditedAgent.email,
        basis:"user-confirmed WhatsApp archive",linkedToStaffUid:false};
      if(existing[i].exists){
        if(existing[i].data()?.importDataset!==FIELD_ARCHIVE_KEY || existing[i].data()?.sourceId!==r.sourceId)
          denied(`Source ${r.sourceId} conflicts with another CRM record; review manually.`,409);
        alreadyPresent++;continue;}
      batch.create(db.collection("nxtProspects").doc(ids[i]),{
        name:r.name,phone:r.phone,category:"",country:"ZW",city:"",contactName:"",source:"field_whatsapp_archive_2026_11_18",sourceId:r.sourceId,
        sourceFile:r.sourceFile,sourceAttachmentNames:r.sourceAttachments,sourceNote:"Original WhatsApp outreach export; contact and organization identity require review.",
        status:fieldArchiveStatus(r.classification),sourceClassification:r.classification,
        nextAction:cleanHistoricalSnippet(r.nextAction,600),businessGrouping:r.grouping,
        duplicateReviewRequired:true,marketingConsent:"unverified",contactSuppressed:fieldArchiveStatus(r.classification)==="do_not_contact",
        firstContactDate:safeHistoricalDate(r.firstContact),lastActivityDate:safeHistoricalDate(r.lastActivity),lastReplyDate:safeHistoricalDate(r.lastReply),
        historicalMessageCounts:{outgoing:r.outgoing,incoming:r.incoming},outreachAttribution:historicalAttribution,
        importedBy:actor.uid,importedByEmail:actor.email||"",importDataset:FIELD_ARCHIVE_KEY,
        assigneeUid:"",businessId:"",public:false,claimStatus:"unclaimed",verificationStatus:"unverified",
        createdBy:actor.uid,createdAt:now,updatedAt:now
      });prospectsCreated++;
    }
    // If an archive prospect exists but its history was only partly imported, fill missing messages
    // idempotently; never rewrite or take ownership of an existing CRM prospect.
    for(let i=0;i<messageRefs.length;i++){
      const {ref,row:r,m}=messageRefs[i];
      if(knownMessages[i].exists)continue;
      const attribution={name:input.creditedAgent.name,email:input.creditedAgent.email,basis:"user-confirmed WhatsApp archive"};
      batch.create(ref,{
        prospectId:fieldArchiveProspectId(r.sourceId),kind:"historical_contact",channel:"whatsapp",
        outcome:m.direction==="outbound"?"sent":"replied",direction:m.direction,
        actorUid:null,actorEmail:m.direction==="outbound"?attribution.email:"",
        externalSender:m.direction==="inbound"?m.sender:"",outreachAttribution:attribution,
        sourceSender:m.sender,note:cleanHistoricalSnippet(m.text),sourceLocalDate:m.date,sourceLocalTime:m.localTime,
        sourceMessageIndex:m.index,sourceId:r.sourceId,importDataset:FIELD_ARCHIVE_KEY,
        createdAt:now,occurredAt:null,importedBy:actor.uid
      });messagesCreated++;
    }
    if(prospectsCreated||messagesCreated)await batch.commit();
    await audit(db,actor,"admin.historical_outreach_import","nxtProspects",FIELD_ARCHIVE_KEY,
      {sourceIds:input.rows.map(r=>r.sourceId),prospectsCreated,messagesCreated,alreadyPresent,
        creditedAgentEmail:input.creditedAgent.email,verifiedAccountLink:false});
    return noStore({ok:true,examined:input.rows.length,prospectsCreated,messagesCreated,alreadyPresent,
      note:"Private outreach history only. No existing records were overwritten, and no business was approved or published."});
  } catch(error) {return apiError(error);}
}
