import { SpotlyLogo } from "./SpotlyLogo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-white py-10">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-5 sm:flex-row sm:items-center lg:px-8">
        <SpotlyLogo />
        <p className="text-sm font-semibold text-slateSoft">© 2026 Spotly. Everything you love, all in one spot.</p>
      </div>
    </footer>
  );
}
