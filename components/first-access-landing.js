"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, Check, ChevronDown, Compass, Copy, HeartHandshake, LockKeyhole, MapPin, MessageCircle, ShieldCheck, Sparkles, Store, Ticket, Users, Wrench } from "lucide-react";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { authenticatedFetch, publicApiFetch } from "@/lib/api-client";
import { getFirebaseClient } from "@/lib/firebase";
import { FIRST_ACCESS_INTERESTS, normalizeAttribution } from "@/lib/first-access";

const serviceItems = [
  { key: "bite", label: "Bite", detail: "The food you love",  },
  { key: "shopper", label: "Shopper", detail: "Everyday essentials",  },
  { key: "ride", label: "Ride", detail: "Move around your city",  },
  { key: "live", label: "Live", detail: "Discover what's on",  },
  { key: "send", label: "Send", detail: "Get it delivered",  },
  { key: "book", label: "Book", detail: "Save your seat",  }
];
const suggestedCities = ["Harare", "Bulawayo", "Chitungwiza", "Mutare", "Gweru", "Masvingo", "Victoria Falls", "Other city"];
function readAttribution() {
  const params = new URLSearchParams(window.location.search);
  const fresh = normalizeAttribution({
    utm_source: params.get("utm_source") || "", utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "", utm_content: params.get("utm_content") || "",
    utm_term: params.get("utm_term") || "", via: params.get("via") || params.get("ref") || "",
    referrer: document.referrer || ""
  });
  const key = "spotly-first-access-attribution-v1";
  try {
    const old = JSON.parse(sessionStorage.getItem(key) || "null");
    const hasFresh = [...params.keys()].some((item) => item.startsWith("utm_") || ["via", "ref"].includes(item));
    const stored = { first: old?.first || fresh, last: hasFresh || !old ? fresh : old.last };
    sessionStorage.setItem(key, JSON.stringify(stored));
    return stored;
  } catch { return fresh; }
}
function AcquisitionEvent({ onAttribution }) {
  useEffect(() => {
    const attribution = readAttribution();
    onAttribution(attribution);
    try {
      if (navigator.doNotTrack === "1" || sessionStorage.getItem("spotly-first-access-viewed")) return;
      sessionStorage.setItem("spotly-first-access-viewed", "1");
    } catch { return; }
    publicApiFetch("/api/public/launch-event", { method: "POST", body: JSON.stringify({ event: "view", attribution: attribution.last || {} }) }).catch(() => null);
  }, [onAttribution]);
  return null;
}
function Countdown({ target }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const diff = Math.max(0, new Date(target).getTime() - now);
  if (!Number.isFinite(diff)) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000) % 24;
  const minutes = Math.floor(diff / 60000) % 60;
  const seconds = Math.floor(diff / 1000) % 60;
  return <div className="fa-countdown" aria-label="Countdown to launch">{[[days, "days"], [hours, "hours"], [minutes, "mins"], [seconds, "secs"]].map(([number, unit]) => <div key={unit}><strong>{String(number).padStart(2, "0")}</strong><span>{unit}</span></div>)}</div>;
}
export function FirstAccessLanding({ maintenance = false }) {
  const { user, profile, createAccount, authReady } = useAuth();
  const { settings } = usePlatform();
  const [attribution, setAttribution] = useState({});
  const [form, setForm] = useState({ name: "", email: "", password: "", city: "", interests: [], priorityInterest: "", audience: "customer", timeframe: "", phone: "", consent: false, marketingOptIn: false });
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const createdAccount = useRef(null);
  const started = useRef(false);
  const fieldRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [featuredService, setFeaturedService] = useState("bite");
  const signedIn = Boolean(user && !user.isAnonymous);
  const countdownVisible = settings?.launch?.countdownVisible === true && Boolean(settings?.launch?.countdownTarget);
  const attributionCallback = useRef(setAttribution).current;
  const inviteLink = useMemo(() => result?.inviteCode ? `https://spotlyafrica.com/?via=${encodeURIComponent(result.inviteCode)}` : "", [result]);

  useEffect(() => {
    if (signedIn) setForm((old) => ({ ...old, name: old.name || profile?.displayName || user.displayName || "", email: user.email || old.email }));
  }, [signedIn, user?.email, user?.displayName, profile?.displayName]);
  function begin() {
    if (!started.current) {
      started.current = true;
      if (navigator.doNotTrack !== "1") publicApiFetch("/api/public/launch-event", { method: "POST", body: JSON.stringify({ event: "signup_start", attribution: attribution.last || {} }) }).catch(() => null);
    }
    setStep(1);
    window.setTimeout(() => fieldRef.current?.focus(), 50);
  }
  function toggleInterest(id) {
    setForm((old) => {
      const interests = old.interests.includes(id) ? old.interests.filter((i) => i !== id) : [...old.interests, id].slice(0, 3);
      return { ...old, interests, priorityInterest: interests.includes(old.priorityInterest) ? old.priorityInterest : interests[0] || "" };
    });
  }
  async function submit(e) {
    e.preventDefault(); setError("");
    if (!form.consent) { setError("Please accept the Terms and Privacy Policy to continue."); return; }
    if (!signedIn && !createdAccount.current && form.password.length < 8) { setError("Choose a password with at least 8 characters."); return; }
    setLoading(true);
    try {
      let account = user && !user.isAnonymous ? user : createdAccount.current;
      if (!account) {
        const signup = await createAccount({ email: form.email, password: form.password, displayName: form.name });
        account = signup.user;
        createdAccount.current = account;
      }
      const values = { ...form, name: form.name || account.displayName || "Spotly member", email: account.email,
        password: undefined, consent: true, source: "first_access", attribution: attribution.last || {}, firstAttribution: attribution.first || {} };
      const saved = await authenticatedFetch("/api/public/waitlist", { method: "POST", body: JSON.stringify(values) });
      if (!saved.accountLinked) throw new Error("Your account was created, but the registration is not linked yet. Please retry.");
      setResult(saved);
    } catch (err) {
      const current = getFirebaseClient()?.auth?.currentUser;
      if (!createdAccount.current && current && !current.isAnonymous && current.email?.toLowerCase() === form.email.trim().toLowerCase()) createdAccount.current = current;
      setError(err?.message || "Registration could not be completed. You can retry without creating another account.");
    } finally { setLoading(false); }
  }
  function share() {
    if (!inviteLink) return;
    navigator.clipboard?.writeText(inviteLink).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2500); }).catch(() => setError("Your browser could not copy the link."));
  }

  return <div className="fa-site">
    <AcquisitionEvent onAttribution={attributionCallback} />
    <header className="fa-header"><div className="fa-container fa-header-inner"><Link href="/" className="fa-brand" aria-label="Spotly homepage"><Image src="/api/branding/assets/primary_horizontal_on_light.svg" alt="Spotly" width={160} height={61} priority className="fa-wordmark" /></Link><div className="fa-header-right"><a href="#explore" className="fa-nav-explore">Explore Spotly</a><Link href={signedIn ? "/account" : "/login"} className="fa-link">{signedIn ? "My account" : "Sign in"} <ArrowRight size={15} /></Link></div></div></header>
    <main><section className="fa-hero"><div className="fa-container fa-hero-grid"><div className="fa-hero-copy"><div className="fa-launch-note">A new way to experience your city</div><h1>Your city.<br />So much <span>closer.</span></h1><p className="fa-lead">Good things are coming together. Food, shopping, rides, places, experiences and more — all in one home for Zimbabwe.</p><p className="fa-sublead">Create your Spotly account today. Tell us what you're most excited for. Be among the first to know when your city opens up.</p>{countdownVisible && <Countdown target={settings.launch.countdownTarget} />}<div className="fa-showcase" aria-label="Explore Spotly services"><div className="fa-showcase-stage"><div className="fa-showcase-ambient" /><Image src={`/api/branding/assets/${featuredService}_horizontal_on_light.svg`} alt={`Spotly ${featuredService}`} width={760} height={250} className="fa-showcase-logo" unoptimized /></div><div className="fa-showcase-tabs">{serviceItems.map((item) => <button type="button" aria-label={`Preview Spotly ${item.label}`} aria-pressed={featuredService === item.key} key={item.key} onClick={() => setFeaturedService(item.key)} className={featuredService === item.key ? "selected" : ""}>{item.label}</button>)}</div></div><div className="fa-hero-actions"><button type="button" className="fa-primary" onClick={begin}>Claim First Access <ArrowRight size={18} /></button><span><ShieldCheck size={15} /> No charge. No commitment.</span></div><div className="fa-proof"><span className="fa-proof-stars">✳</span> Built for Zimbabwe. Made for everyday life.</div></div><div className="fa-panel" id="first-access"><div className="fa-panel-mark"><span className="fa-live-dot" /> SPOTLY FIRST ACCESS <span>01 / 02</span></div>{result ? <div className="fa-success" aria-live="polite"><div className="fa-success-icon"><Check size={32} /></div><p className="fa-card-kicker">YOU'RE ON THE INSIDE</p><h2>You're in. Welcome to what’s next.</h2><p>Your Spotly account is ready. Visit your Spotly account to confirm your email (or resend a verification link). We'll reach out when your city and chosen services are ready.</p><div className="fa-success-info"><span>Your First Access ID</span><strong>{result.inviteCode?.toUpperCase()}</strong></div><button className="fa-primary fa-full" onClick={share}><Copy size={16} />{copied ? "Copied!" : "Invite someone to Spotly"}</button><Link href="/account" className="fa-text-link">View my account <ArrowRight size={15} /></Link></div> : <><p className="fa-card-kicker">BE THERE FROM THE START</p><h2>Get your spot.</h2><p className="fa-card-desc">One account. Your city. Your kind of Spotly.</p><form onSubmit={(event) => { if (step < 2) { event.preventDefault(); if (!form.name.trim()) { setError("Enter your name to continue."); return; } if (!signedIn && !createdAccount.current && form.password.length < 8) { setError("Choose a password with at least 8 characters."); return; } setError(""); setStep(2); return; } submit(event); }} noValidate>{step === 0 && !signedIn ? <><label className="fa-label" htmlFor="fa-email">Your email address</label><input ref={fieldRef} id="fa-email" autoComplete="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" className="fa-input" /><button type="button" className="fa-primary fa-full" onClick={() => { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError("Enter a valid email to continue."); return; } setError(""); begin(); }}>Continue <ArrowRight size={17} /></button><p className="fa-small-note"><LockKeyhole size={13} /> Your email stays with Spotly.</p></> : <><div className="fa-form-stack">{step < 2 ? <><label className="fa-field"><span>Your name</span><input ref={fieldRef} className="fa-input" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" autoComplete="name" /></label><label className="fa-field"><span>Email address</span><input className="fa-input" required type="email" maxLength={254} disabled={signedIn || Boolean(createdAccount.current)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" autoComplete="email" /></label>{!signedIn && !createdAccount.current && <label className="fa-field"><span>Create your password</span><input className="fa-input" type="password" minLength={8} required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8 characters minimum" /></label>}<label className="fa-field"><span>Your city <em>Optional</em></span><select className="fa-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}><option value="">Select a city</option>{suggestedCities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label></> : <><div className="fa-field"><span>What are you most excited for? <em>Pick up to 3</em></span><div className="fa-interests">{FIRST_ACCESS_INTERESTS.map(([id, label]) => <button key={id} type="button" aria-pressed={form.interests.includes(id)} className={form.interests.includes(id) ? "fa-choice active" : "fa-choice"} onClick={() => toggleInterest(id)}>{form.interests.includes(id) && <Check size={13} />}{label}</button>)}</div></div><button type="button" className="fa-more-toggle" onClick={() => setDetailOpen((v) => !v)} aria-expanded={detailOpen}>Help us tailor your launch <ChevronDown size={16} className={detailOpen ? "fa-flip" : ""} /></button>{detailOpen && <div className="fa-more-fields"><label className="fa-field"><span>I'm here as a</span><select className="fa-input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}><option value="customer">Customer</option><option value="business">Business owner / partner</option><option value="driver">Driver / delivery partner</option></select></label><label className="fa-field"><span>When would you use Spotly?</span><select className="fa-input" value={form.timeframe} onChange={(e) => setForm({ ...form, timeframe: e.target.value })}><option value="">Prefer not to say</option><option value="asap">As soon as it's available</option><option value="this_month">Within the first month</option><option value="exploring">Just curious</option></select></label><label className="fa-field"><span>WhatsApp / phone <em>Optional</em></span><input className="fa-input" inputMode="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+263 …" /></label></div>}<label className="fa-check"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} /><span>I accept the <Link href="/terms" target="_blank">Terms</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link> and agree to receive updates relating to my First Access request.</span></label><label className="fa-check"><input type="checkbox" checked={form.marketingOptIn} onChange={(e) => setForm({ ...form, marketingOptIn: e.target.checked })} /><span>I'd also like marketing news and offers from Spotly. Optional.</span></label></>}</div>{step === 2 && <button type="button" className="fa-more-toggle" onClick={() => setStep(1)}>Back to my details</button>}<button type="submit" className="fa-primary fa-full" disabled={loading || !authReady}>{step < 2 ? "Continue to preferences" : loading ? "Creating your access…" : signedIn ? "Confirm my First Access" : "Create account & join"} <ArrowRight size={17} /></button><p className="fa-small-note"><ShieldCheck size={13} /> Already have a Spotly account? <Link href="/login">Sign in</Link>.</p></>}{error && <div className="fa-error" role="alert">{error}</div>}</form></>}<div className="fa-card-footer"><LockKeyhole size={14} /> Your details are handled securely. We don't sell your data.</div></div></div><div className="fa-hero-glow" aria-hidden="true" /></section>
    <section className="fa-services" id="explore"><div className="fa-container"><div className="fa-section-head"><div><p className="fa-section-kicker">ONE HOME FOR YOUR CITY</p><h2>A little bit of everything. <span>More of what matters.</span></h2></div><p>Tell us what you want first. Your interest helps decide where we go next.</p></div><div className="fa-service-grid">{serviceItems.map((service) => <div className="fa-service" key={service.key}><div className="fa-service-identity"><Image src={`/api/branding/assets/${service.key}_horizontal_on_light.svg`} alt={`Spotly ${service.label}`} width={760} height={250} unoptimized /></div><div><h3>Spotly {service.label}</h3><p>{service.detail}</p></div><ArrowRight size={17} /></div>)}</div></div></section>
    <section className="fa-why"><div className="fa-container fa-why-grid"><div><p className="fa-section-kicker">WHY FIRST ACCESS?</p><h2>We grow with the people who'll use it.</h2><p>Spotly is preparing a thoughtful rollout, city by city. You'll help us understand which services and places matter most before we open up.</p><button type="button" className="fa-why-link" onClick={begin}>Be part of the first wave <ArrowRight size={17} /></button></div><div className="fa-why-benefits"><div><MapPin size={23} /><strong>Your city, your priorities</strong><span>Let us know where Spotly should show up for you.</span></div><div><Users size={23} /><strong>First to hear</strong><span>Get the news when access is ready — no public launch date promised yet.</span></div><div><HeartHandshake size={23} /><strong>Made around real needs</strong><span>Your preferences shape the services we prioritize.</span></div></div></div></section></main>
    <footer className="fa-footer"><div className="fa-container fa-footer-inner"><Link href="/" className="fa-brand"><Image src="/api/branding/assets/primary_horizontal_on_light.svg" alt="Spotly" width={126} height={48} className="fa-wordmark" /></Link><span>Zimbabwe, this is just the beginning.</span><nav><Link href="/branding">Brand & media</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link><Link href="https://business.spotlyafrica.com">For businesses</Link></nav></div></footer>
  </div>;
}

export function MaintenanceLanding() {
  return <main className="fa-site fa-maintenance"><div className="fa-maintenance-card"><Image src="/api/branding/assets/primary_horizontal_on_light.svg" alt="Spotly" width={170} height={70} /><div className="fa-maintenance-tag"><Wrench size={15} /> PLATFORM MAINTENANCE</div><h1>Making Spotly better, behind the scenes.</h1><p>We're completing important work on the platform. Some customer features are temporarily unavailable. Your account, support and business onboarding remain accessible.</p><div className="fa-maintenance-actions"><Link href="/account" className="fa-primary">My Spotly account <ArrowRight size={17} /></Link><Link className="fa-secondary" href="/support">Contact support</Link></div><div className="fa-maintenance-foot"><BadgeCheck size={17} /> Thanks for being part of what we're building.</div></div></main>;
}
