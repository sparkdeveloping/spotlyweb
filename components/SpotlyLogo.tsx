import Image from "next/image";

export function SpotlyLogo({ showWordmark = true }: { showWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-10 w-10 overflow-hidden rounded-2xl bg-spotly-700 shadow-green">
        <Image src="/spotly-mark.svg" alt="Spotly" fill priority sizes="40px" />
      </div>
      {showWordmark ? <span className="text-2xl font-extrabold tracking-tight text-ink">spotly</span> : null}
    </div>
  );
}
