'use client';

import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, Headphones, Send, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/firebase-provider';
import { authenticatedFetch } from '@/lib/api-client';

const enabled = process.env.NEXT_PUBLIC_SPOTLY_SUPPORT_ASSISTANT_ENABLED === 'true';

function friendlyFailure(error) {
  if (error?.status === 429) return 'The assistant has reached its request limit. You can still contact our support team.';
  if (error?.status === 401 || error?.status === 403) return 'We could not verify this session. Refresh the page or contact support.';
  return 'The assistant is unavailable right now. You can send a request to the support team instead.';
}

/** Questions and answers remain in this browser component; no chat history is written to Firestore. */
export function SpotlySupportAssistant({ onHumanSupport }) {
  const { user, ensureAnonymousSession } = useAuth();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(false);
  if (!enabled) return null;

  async function ask(event) {
    event.preventDefault();
    const query = question.trim();
    if (query.length < 4 || requestRef.current) return;
    requestRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (!user?.uid) await ensureAnonymousSession();
      const result = await authenticatedFetch('/api/support/assistant', {
        method: 'POST', cache: 'no-store', body: JSON.stringify({ question: query })
      });
      setAnswer({ question: query, text: result.answer, sources: result.sources || [], handoff: result.handoff, category: result.category || 'general' });
      setQuestion('');
    } catch (reason) { setError(friendlyFailure(reason)); }
    finally { requestRef.current = false; setBusy(false); }
  }

  function handoff() {
    onHumanSupport?.(answer?.category || 'general', answer?.question || question.trim());
  }

  return <section aria-label="Ask Spotly Assistant" className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--accent)]">Spotly Assistant · AI</p><h2 className="mt-1 text-xl font-semibold tracking-tight">A little help, right away.</h2><p className="mt-2 text-sm leading-6 text-secondary">Ask about using Spotly, or message someone from our team. Answers come from approved public guides—not your private account or live orders.</p></div>
    </div>
    <form onSubmit={ask} className="mt-5 flex flex-col gap-2 sm:flex-row">
      <label htmlFor="spotly-assistant-question" className="sr-only">Your question for Spotly Assistant</label>
      <input id="spotly-assistant-question" type="text" value={question} minLength={4} maxLength={500} disabled={busy} onChange={(event) => setQuestion(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" placeholder="How do I track my delivery?" />
      <button type="submit" disabled={busy || question.trim().length < 4} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-50">{busy ? 'Finding an answer…' : 'Ask Spotly'}<Send className="h-4 w-4" /></button>
    </form>
    {answer ? <div className="mt-5 border-t border-[var(--border-subtle)] pt-5" aria-live="polite">
      <p className="text-xs font-semibold text-secondary">You asked: {answer.question}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{answer.text}</p>
      {answer.sources.length ? <div className="mt-4 flex flex-wrap gap-2">{answer.sources.map((source) => <a key={source.id} href={source.href} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold"><BookOpen className="h-3.5 w-3.5" />{source.title}</a>)}</div> : null}
    </div> : null}
    {error ? <p role="alert" className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
      <p className="max-w-md text-xs leading-5 text-secondary">Do not enter passwords, PINs, card details, private locations or account references. AI can make mistakes.</p>
      <button type="button" onClick={handoff} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"><Headphones className="h-4 w-4" />Message human support <ArrowRight className="h-4 w-4" /></button>
    </div>
  </section>;
}
