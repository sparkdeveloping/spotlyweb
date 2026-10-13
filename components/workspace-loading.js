export function WorkspacePageSkeleton({ role = "business" }) {
  return <div className={`min-h-screen bg-[var(--background)] text-[var(--text)] workspace-${role}`} aria-busy="true" aria-label={`Loading Spotly ${role}`}>
    <div className="flex min-h-screen">
      <aside className="hidden w-[248px] shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface)] lg:block">
        <div className="flex h-[72px] items-center px-5"><div className="v7-skeleton h-10 w-28 rounded-[12px]" /></div>
        <div className="space-y-2 px-3 pt-3">{[0,1,2,3,4,5].map((item) => <div key={item} className="v7-skeleton h-11 w-full rounded-[12px]" />)}</div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex h-[72px] items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 sm:px-6"><div className="v7-skeleton h-9 w-9 rounded-[12px] lg:hidden" /><div className="v7-skeleton h-5 w-40 rounded-[10px]" /><div className="ml-auto v7-skeleton h-10 w-10 rounded-full" /></div>
        <main className="mx-auto max-w-[1540px] px-4 py-6 sm:px-6"><div className="v7-skeleton h-4 w-28 rounded-full" /><div className="v7-skeleton mt-4 h-10 w-[46%] max-w-lg rounded-[12px]" /><div className="v7-skeleton mt-3 h-4 w-[64%] max-w-xl rounded-[10px]" /><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0,1,2,3].map((item) => <div key={item} className="v7-skeleton h-32 rounded-[16px]" />)}</div><div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_.8fr]"><div className="v7-skeleton h-[420px] rounded-[16px]" /><div className="v7-skeleton h-[420px] rounded-[16px]" /></div></main>
      </div>
    </div>
  </div>;
}
