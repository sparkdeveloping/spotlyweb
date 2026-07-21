import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return <main className="portal-gradient flex min-h-screen items-center justify-center px-4"><div className="max-w-md text-center"><Image src="/brand/spotly.png" alt="Spotly" width={96} height={96} className="mx-auto h-24 w-24 rounded-[28px] object-cover" /><p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-violet">404</p><h1 className="mt-3 text-4xl font-bold tracking-[-0.04em]">This spot does not exist.</h1><p className="mt-4 leading-7 text-secondary">The page may have moved, or the link may be incomplete.</p><Link href="/" className="mt-7 inline-flex h-[52px] items-center justify-center rounded-2xl bg-violet px-6 font-semibold text-white">Return to Spotly</Link></div></main>;
}
