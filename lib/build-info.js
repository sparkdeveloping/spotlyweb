export const BUILD_INFO = Object.freeze({
  version: process.env.NEXT_PUBLIC_APP_VERSION || "5.5.0-business-lifecycle",
  commit: process.env.NEXT_PUBLIC_BUILD_COMMIT || "local",
  date: process.env.NEXT_PUBLIC_BUILD_DATE || "not-set",
  environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development"
});

export function buildLabel() {
  const shortCommit = BUILD_INFO.commit && BUILD_INFO.commit !== "local" ? BUILD_INFO.commit.slice(0, 8) : "local";
  return `${BUILD_INFO.version} · ${shortCommit}`;
}
