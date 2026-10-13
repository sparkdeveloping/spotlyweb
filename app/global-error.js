"use client";

export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif", background: "#0b0d12", color: "#f7f8fb" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ maxWidth: 520, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, margin: "0 auto", borderRadius: 18, display: "grid", placeItems: "center", background: "#6657D9", fontWeight: 800, fontSize: 24 }}>S</div>
            <h1 style={{ margin: "24px 0 0", fontSize: 30, letterSpacing: "-0.03em" }}>Spotly could not load this screen.</h1>
            <p style={{ margin: "12px auto 0", color: "#b8bfcc", lineHeight: 1.6 }}>Your request was not intentionally repeated. Retry once, or return to Spotly if the problem continues.</p>
            <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <button onClick={reset} style={{ border: 0, borderRadius: 12, padding: "12px 18px", background: "#6657D9", color: "white", fontWeight: 700, cursor: "pointer" }}>Try again</button>
              <button onClick={() => { window.location.href = "/"; }} style={{ border: "1px solid #303542", borderRadius: 12, padding: "12px 18px", background: "transparent", color: "white", fontWeight: 700, cursor: "pointer" }}>Go home</button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
