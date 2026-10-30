import { cn } from "@/lib/cn";

/** Solid silhouettes at a consistent 24px grid, designed for Spotly navigation. */
const PATHS = {
  home: <path d="M3.2 10.1 11 3.5a1.55 1.55 0 0 1 2 0l7.8 6.6c.36.3.55.74.55 1.21V19a2.35 2.35 0 0 1-2.35 2.35h-4.8v-6.2a1.1 1.1 0 0 0-1.1-1.1h-2.2a1.1 1.1 0 0 0-1.1 1.1v6.2H5A2.35 2.35 0 0 1 2.65 19v-7.7c0-.47.2-.91.55-1.2Z" />,
  search: <path fillRule="evenodd" d="M10.6 2.6a8 8 0 1 0 4.93 14.3l4.73 4.74a1.4 1.4 0 0 0 1.98-1.98l-4.74-4.73A8 8 0 0 0 10.6 2.6Zm0 2.8a5.2 5.2 0 1 0 0 10.4 5.2 5.2 0 0 0 0-10.4Z" clipRule="evenodd" />,
  activity: <><path d="M9.2 2.25h5.6a1.35 1.35 0 0 1 0 2.7H9.2a1.35 1.35 0 1 1 0-2.7Zm7.3 2.45 1.65-1.1a1.3 1.3 0 1 1 1.45 2.15L18.2 6.7A9.55 9.55 0 1 1 12 4.25c1.66 0 3.15.32 4.5.95Z"/><path d="M12 7.2a1.2 1.2 0 0 0-1.2 1.2v4.4c0 .32.13.63.36.85l2.7 2.7a1.2 1.2 0 1 0 1.7-1.7l-2.36-2.35V8.4A1.2 1.2 0 0 0 12 7.2Z" fill="var(--surface)" /></>,
  saved: <path d="M12 21.4a1.8 1.8 0 0 1-1.18-.44C5.3 16.1 2.2 13.36 2.2 9.8A6.35 6.35 0 0 1 8.55 3.5c1.4 0 2.55.48 3.45 1.43a4.75 4.75 0 0 1 3.45-1.43A6.35 6.35 0 0 1 21.8 9.8c0 3.56-3.1 6.3-8.62 11.16a1.8 1.8 0 0 1-1.18.44Z" />,
  profile: <><circle cx="12" cy="8.1" r="4.45" /><path d="M3 19.65C3 16.1 6.7 14 12 14s9 2.1 9 5.65c0 1.1-.92 1.85-2.1 1.85H5.1c-1.18 0-2.1-.75-2.1-1.85Z" /></>
};
export function SpotlyNavIcon({ name, className }) {
  return <svg viewBox="0 0 24 24" className={cn("h-5 w-5", className)} fill="currentColor" aria-hidden="true" focusable="false">{PATHS[name] || PATHS.home}</svg>;
}
