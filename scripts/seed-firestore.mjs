import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { zimbabweBusinesses } from "../data/zimbabwe-businesses.js";
import { defaultHelpResources, defaultRoleTemplates } from "../data/production-seed.js";
import { groceryCatalogTemplates } from "../data/catalog-templates.js";
import { DEFAULT_PLATFORM_SETTINGS } from "../lib/platform-defaults.js";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "denzeltinashe-spotly";
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!clientEmail || !privateKey) {
  console.error("Missing FIREBASE_ADMIN_CLIENT_EMAIL or FIREBASE_ADMIN_PRIVATE_KEY.");
  process.exit(1);
}

const app = getApps()[0] || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
const db = getFirestore(app);

async function writeChunks(collectionName, records) {
  for (let start = 0; start < records.length; start += 400) {
    const batch = db.batch();
    records.slice(start, start + 400).forEach((record) => {
      batch.set(db.collection(collectionName).doc(record.id), { ...record, seeded: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    await batch.commit();
    console.log(`${collectionName}: ${Math.min(start + 400, records.length)}/${records.length}`);
  }
}

await db.collection("platformSettings").doc("global").set({ ...DEFAULT_PLATFORM_SETTINGS, seededAt: FieldValue.serverTimestamp() }, { merge: true });
await writeChunks("businesses", zimbabweBusinesses);
await writeChunks("roleTemplates", defaultRoleTemplates);
await writeChunks("helpResources", defaultHelpResources);
await writeChunks("catalogTemplates", groceryCatalogTemplates);
console.log("Spotly seed complete.");
