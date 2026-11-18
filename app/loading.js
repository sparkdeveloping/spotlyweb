import Image from "next/image";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--text)]" aria-busy="true" aria-label="Loading Spotly">
      <div className="border-b border-[var(--border-subtle)] bg-[var(--surface)]">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <Image src="/brand/pwa/primary/icon-32.png" alt="" width={32} height={32} />
          <span className="text-[17px] font-semibold">Spotly</span>
          <span className="ml-auto v7-skeleton h-9 w-20 rounded-xl" aria-hidden="true" />
        </div>
      </div>
      <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6">
        <p className="text-sm text-[var(--text-2)]" role="status" aria-live="polite">Opening Spotly…</p>
        <div className="mt-5 v7-skeleton h-10 w-56 max-w-full rounded-xl" aria-hidden="true" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {[0,1,2].map((item) => <div key={item} className="v7-skeleton h-48 rounded-[24px]" />)}
        </div>
      </div>
    </main>
  );
}
