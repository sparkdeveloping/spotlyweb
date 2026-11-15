import { z } from 'zod';
import { authenticateRequest, getAdminServices, apiError, verifyAppCheckRequest } from '@/lib/firebase-admin';
import { enforceRateLimit } from '@/lib/rate-limit-server';
import { publicKnowledgeRecord, selectSupportKnowledge, inspectSupportQuestion, assistantPrompt, verifiedAssistantReply, fallbackAssistantReply, supportCategory } from '@/lib/spotly-support-assistant.mjs';

export const runtime = 'nodejs';
const inputSchema = z.object({ question: z.string().trim().min(4).max(500) }).strict();
const responseHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
let publicCache = { until: 0, items: [] };

async function publishedHelp(db) {
  if (process.env.SPOTLY_SUPPORT_ASSISTANT_PUBLIC_KB !== 'true') return [];
  if (Date.now() < publicCache.until) return publicCache.items;
  // Only the publicly published, public-audience fields. No customer or admin records.
  const snap = await db.collection('helpResources').where('audience', 'array-contains', 'public').limit(40).get();
  const items = snap.docs.map((doc) => publicKnowledgeRecord(doc.id, doc.data())).filter(Boolean);
  publicCache = { until: Date.now() + 5 * 60_000, items };
  return items;
}

async function callWorkersAI(question, sources) {
  const account = process.env.SPOTLY_CLOUDFLARE_ACCOUNT_ID || '';
  const token = process.env.SPOTLY_CLOUDFLARE_AI_TOKEN || '';
  if (!/^[a-f0-9]{32}$/i.test(account) || !token) return null;
  // A fixed, publicly documented model ID. Never use client-provided provider/URL/model.
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/meta/llama-3.1-8b-instruct`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: assistantPrompt(question, sources), max_tokens: 180, temperature: 0.2 }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('inference_unavailable');
  const body = await response.json();
  if (body.success !== true) throw new Error('inference_unavailable');
  return body.result?.response || null;
}

export async function POST(request) {
  try {
    // No auth, quota, database reads or inference when the feature is off.
    if (process.env.SPOTLY_SUPPORT_ASSISTANT_ENABLED !== 'true') {
      return Response.json({ ok: false, error: 'Spotly Assistant is not available yet. You can contact support instead.' }, { status: 503, headers: responseHeaders });
    }
    // Do not weaken App Check to accommodate a convenience feature.
    await verifyAppCheckRequest(request, { required: true });
    const user = await authenticateRequest(request);
    const { question } = inputSchema.parse(await request.json());
    await enforceRateLimit(request, { key: `lx10-assistant-user:${user.uid}`, limit: 12, windowMs: 60 * 60_000 });
    await enforceRateLimit(request, { key: 'lx10-assistant-global', identity: 'global', limit: 120, windowMs: 24 * 60 * 60_000 });
    if (user?.firebase?.sign_in_provider === 'anonymous') {
      await enforceRateLimit(request, { key: 'lx10-assistant-guest-network', limit: 80, windowMs: 60 * 60_000 });
    }
    const check = inspectSupportQuestion(question);
    const topic = supportCategory(question);
    if (!check.safe) {
      return Response.json({ ok: true, answer: check.guidance, sources: [], handoff: true, category: topic, provider: 'none' }, { headers: responseHeaders });
    }
    let published = [];
    try { published = await publishedHelp(getAdminServices().db); }
    catch { /* An unavailable knowledge source must never block human support. */ }
    const sources = selectSupportKnowledge(question, published);
    if (!sources.length) {
      return Response.json({ ok: true, answer: fallbackAssistantReply(), sources: [], handoff: true, category: topic, provider: 'none' }, { headers: responseHeaders });
    }
    let answer = fallbackAssistantReply(sources), provider = 'approved-guidance';
    if (process.env.SPOTLY_SUPPORT_ASSISTANT_PROVIDER === 'cloudflare') {
      try {
        // Additional daily budget ceiling before any external model is called.
        await enforceRateLimit(request, { key: 'lx10-assistant-cloudflare-daily', identity: 'global', limit: 40, windowMs: 24 * 60 * 60_000 });
        const generated = await callWorkersAI(question, sources);
        if (generated) { answer = verifiedAssistantReply(generated, sources); provider = 'cloudflare'; }
      } catch { /* Approved guidance is a zero-inference-cost fallback. No raw prompts in logs. */ }
    }
    return Response.json({ ok: true, answer, sources: sources.map(({ id, title, href }) => ({ id, title, href })), handoff: false, category: topic, provider }, { headers: responseHeaders });
  } catch (error) {
    return apiError(error, 'Assistant could not respond. Contact Spotly Support for help.');
  }
}
