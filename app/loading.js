export default function Loading() {
  return <div className="flex min-h-screen items-center justify-center bg-[var(--background)]"><div className="flex flex-col items-center gap-4"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border)] border-t-violet" /><p className="text-sm text-secondary">Loading Spotly…</p></div></div>;
}
