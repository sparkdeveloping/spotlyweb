export function CustomerPageSkeleton({ compact = false }) {
  return <div className="min-h-screen bg-[var(--background)] text-[var(--text)]" aria-busy="true" aria-label="Loading Spotly">
    <div className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="v7-skeleton h-10 w-28 rounded-[12px]" />
        <div className="v7-skeleton hidden h-11 min-w-0 flex-1 rounded-[12px] sm:block lg:max-w-[420px]" />
        <div className="mx-auto hidden gap-2 lg:flex"><div className="v7-skeleton h-10 w-20 rounded-[12px]" /><div className="v7-skeleton h-10 w-24 rounded-[12px]" /><div className="v7-skeleton h-10 w-20 rounded-[12px]" /></div>
        <div className="ml-auto flex gap-2"><div className="v7-skeleton hidden h-10 w-24 rounded-[12px] sm:block" /><div className="v7-skeleton h-10 w-10 rounded-[12px]" /><div className="v7-skeleton h-10 w-10 rounded-full" /></div>
      </div>
    </div>
    <main className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-12">
      <div className="v7-skeleton h-4 w-28 rounded-full" />
      <div className="v7-skeleton mt-4 h-10 w-[58%] max-w-lg rounded-[12px]" />
      <div className="v7-skeleton mt-3 h-5 w-[72%] max-w-xl rounded-[10px]" />
      <div className={compact ? "mt-8 space-y-3" : "mt-8 grid gap-4 lg:grid-cols-[1.15fr_.85fr]"}>
        {compact ? [0,1,2,3].map((item) => <div key={item} className="flex items-center gap-4 border-b border-[var(--border-subtle)] py-4"><div className="v7-skeleton h-14 w-14 rounded-[16px]" /><div className="min-w-0 flex-1"><div className="v7-skeleton h-4 w-2/5 rounded-[10px]" /><div className="v7-skeleton mt-3 h-3 w-3/5 rounded-[10px]" /></div></div>) : <><div className="v7-skeleton min-h-[292px] rounded-[24px]" /><div className="grid grid-cols-2 gap-3">{[0,1,2,3].map((item) => <div key={item} className="v7-skeleton min-h-[138px] rounded-[24px]" />)}</div></>}
      </div>
    </main>
  </div>;
}

export function CustomerContentSkeleton({ rows = 4 }) {
  return <div className="py-3" aria-busy="true" aria-label="Loading content">
    <div className="v7-skeleton h-4 w-28 rounded-full" />
    <div className="v7-skeleton mt-4 h-10 w-[52%] max-w-lg rounded-[12px]" />
    <div className="v7-skeleton mt-3 h-4 w-[70%] max-w-xl rounded-[10px]" />
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: rows }, (_, item) => <div key={item}><div className="v7-skeleton aspect-[1.28/1] rounded-[16px]" /><div className="v7-skeleton mt-3 h-4 w-2/3 rounded-[10px]" /><div className="v7-skeleton mt-2 h-3 w-1/2 rounded-[10px]" /></div>)}</div>
  </div>;
}
