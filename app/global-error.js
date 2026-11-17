"use client";

import { useEffect, useRef, useState } from "react";
import { reportBoundaryIncident } from "@/lib/client-incidents";
import { portalForHostname, spotlyPortalUrl } from "@/lib/spotly-domains";

export default function GlobalError({ error, reset }) {
  const seen = useRef(null);
  const [reference, setReference] = useState(null);
  const [localCustomerOrigin, setLocalCustomerOrigin] = useState(false);
  useEffect(() => {
    setLocalCustomerOrigin(["localhost", "127.0.0.1"].includes(window.location.hostname) || portalForHostname(window.location.hostname) === "customer");
  }, []);
  useEffect(() => {
    if (seen.current === error) return;
    seen.current = error;
    let active = true;
    setReference(null);
    reportBoundaryIncident(error, "global-boundary").then((ref) => { if (active) setReference(ref); });
    return () => { active = false; };
  }, [error]);
  const supportHref = process.env.NEXT_PUBLIC_SPOTLY_TICKETS_ENABLED === "true"
    ? (reference ? `https://tickets.spotlyafrica.com/?incident=${encodeURIComponent(reference)}` : "https://tickets.spotlyafrica.com/")
    : (localCustomerOrigin ? "/support" : spotlyPortalUrl("customer", "/support"));
  const homeHref = localCustomerOrigin ? "/" : spotlyPortalUrl("customer");
  return <html lang="en"><body style={{ margin: 0, fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif", background: "#0b0d12", color: "#f7f8fb" }}>
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }} role="alert">
      <section style={{ maxWidth: 520, textAlign: "center" }}>
        <div style={{ width: 52, height: 52, margin: "0 auto", borderRadius: 16, display: "grid", placeItems: "center", background: "#6657D9", fontWeight: 800, fontSize: 23 }}>S</div>
        <h1 style={{ margin: "24px 0 0", fontSize: 29, letterSpacing: "-0.03em" }}>This screen couldn't load.</h1>
        <p style={{ margin: "12px auto 0", color: "#b8bfcc", lineHeight: 1.6 }}>Try again. If you were booking, ordering or paying, check Activity before submitting another request.</p>
        {reference && <p style={{ fontSize: 12, color: "#b8bfcc", marginTop: 12 }}>Support reference: {reference}</p>}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={reset} style={{ border: 0, borderRadius: 12, padding: "12px 18px", background: "#6657D9", color: "white", fontWeight: 700, cursor: "pointer" }}>Try again</button>
          <a href={supportHref} style={{ border: "1px solid #303542", borderRadius: 12, padding: "12px 18px", background: "transparent", color: "white", fontWeight: 700, textDecoration: "none" }}>Contact support</a>
          <a href={homeHref} style={{ padding: "12px 6px", color: "#b8bfcc" }}>Go home</a>
        </div>
      </section>
    </main>
  </body></html>;
}
