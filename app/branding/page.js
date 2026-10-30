import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { BRAND_COLORS } from "@/lib/spotly-brand-assets";

export const metadata = {
  title:"Brand & Media Resources",
  description:"Official Spotly logos and brand assets for press, partners and collaborators, including Spotly Business, Driver and service brands.",
  alternates:{canonical:"/branding"},
  openGraph:{title:"Spotly Brand & Media Resources",description:"Official logos, colors and partnership media resources.",url:"https://spotlyafrica.com/branding"}
};

const url = (name) => `/api/branding/assets/${name}.svg`;
const identities = [
  {id:"primary",name:"Spotly",note:"The main brand for company, customer and general collaboration materials.",color:BRAND_COLORS.primary},
  {id:"business",name:"Spotly Business",note:"For business owners, merchants and business product partnerships.",color:BRAND_COLORS.business},
  {id:"driver",name:"Spotly Driver",note:"For drivers, delivery partners and driver product communication.",color:BRAND_COLORS.driver}
];
const services = ["bite","shopper","book","live","ride","send"];
const palette = [
  ["Spotly Purple",BRAND_COLORS.primary],["Business Green",BRAND_COLORS.business],["Driver Blue",BRAND_COLORS.driver],
  ["Bite Orange",BRAND_COLORS.bite],["Shopper Green",BRAND_COLORS.shopper],["Book Purple",BRAND_COLORS.book],
  ["Live Pink",BRAND_COLORS.live],["Ride Blue",BRAND_COLORS.ride],["Send Violet",BRAND_COLORS.send],
  ["Spotly Navy",BRAND_COLORS.navy]
];
function Download({name,label="Download SVG"}) {
  return <a href={url(name)+"?download=1"} download className="inline-flex rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold hover:border-[var(--accent)] focus-visible:outline-offset-4">{label}</a>;
}
export default function BrandingPage(){
  return <main className="min-h-screen bg-[var(--background)] text-[var(--text)]">
    <header className="border-b border-[var(--border-subtle)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" aria-label="Spotly home"><BrandLockup className="h-12 w-[126px]" /></Link>
        <nav className="flex items-center gap-4 text-sm font-semibold"><Link href="/">Home</Link><Link href="/support">Contact</Link></nav>
      </div>
    </header>
    <div className="mx-auto max-w-6xl space-y-14 px-5 py-12 sm:px-8 sm:py-16">
      <section className="grid items-end gap-6 md:grid-cols-[1fr_auto]"><div><p className="text-sm font-bold uppercase tracking-[.16em] text-[var(--accent)]">Official Spotly resources</p><h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Brand & Media</h1><p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-2)]">Approved brand assets for the organizations, journalists and creators working with Spotly. Download a complete partner kit or choose an individual identity.</p></div><a href="/api/branding/download" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#6657D9] px-6 py-3 text-sm font-bold text-white hover:bg-[#5949CA]">Download partner kit (.zip)</a></section>
      <section aria-labelledby="brand-identities"><h2 id="brand-identities" className="text-2xl font-bold">Brand identities</h2><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Use a full lockup when the name needs to be legible. Choose the standalone symbol when space is limited.</p><div className="mt-6 grid gap-5 lg:grid-cols-3">{identities.map(({id,name,color,note})=><article key={id} className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)]"><div className="flex h-40 items-center justify-center bg-white p-6" style={{borderTop:`5px solid ${color}`}}><img src={url(id+"_horizontal_on_light")} alt={name+" logo"} width={280} height={112} className="max-h-28 w-full object-contain" /></div><div className="space-y-3 p-5"><h3 className="text-lg font-bold">{name}</h3><p className="min-h-16 text-sm leading-6 text-[var(--text-2)]">{note}</p><div className="flex flex-wrap gap-2"><Download name={id+"_horizontal_on_light"} label="Full logo"/><Download name={id+"_symbol_color"} label="Icon only"/></div></div></article>)}</div></section>
      <section aria-labelledby="service-identities"><h2 id="service-identities" className="text-2xl font-bold">Service identities</h2><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">The approved names are Bite, Shopper, Book, Live, Ride and Send.</p><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{services.map(id=><article key={id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4"><div className="flex h-28 items-center justify-center rounded-xl bg-white p-4" style={{borderBottom:`4px solid ${BRAND_COLORS[id]}`}}><img src={url(id+"_horizontal_on_light")} alt={"Spotly "+id} width={260} height={90} className="h-full max-w-full object-contain" /></div><div className="mt-4 flex items-center justify-between gap-2"><strong className="text-sm capitalize">{id}</strong><Download name={id+"_horizontal_on_light"}/></div></article>)}</div></section>
      <section aria-labelledby="color-palette"><h2 id="color-palette" className="text-2xl font-bold">Official colors</h2><p className="mt-2 text-sm text-[var(--text-2)]">These are brand values. Accessibility-adjusted colors are used for interface controls where necessary.</p><div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-5">{palette.map(([name,value])=><div key={name} className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]"><div className="h-20" style={{backgroundColor:value}}/><div className="p-3"><div className="text-sm font-semibold">{name}</div><code className="mt-1 block text-sm text-[var(--text-2)]">{value}</code></div></div>)}</div></section>
      <section aria-labelledby="brand-guidelines" className="grid gap-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 sm:p-9 md:grid-cols-2"><div><h2 id="brand-guidelines" className="text-2xl font-bold">Usage guidelines</h2><ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-[var(--text-2)]"><li>Allow generous space around the logo.</li><li>Never distort, recolor or redraw official marks.</li><li>Use each identity only for the relevant product or service.</li><li>Keep sufficient contrast; these horizontal assets are designed for light backgrounds.</li><li>Obtain permission before implying a sponsorship or endorsement.</li></ul></div><div><h2 className="text-2xl font-bold">Need another format?</h2><p className="mt-4 text-sm leading-7 text-[var(--text-2)]">For press kits, print applications, dark-mode artwork and special projects, contact Spotly. Files include outlined vector lettering; commercial font software is not part of the public download.</p><Link className="mt-5 inline-flex rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold hover:border-[var(--accent)]" href="/support">Contact Spotly</Link></div></section>
    </div><footer className="border-t border-[var(--border-subtle)] bg-[var(--surface)]"><div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-5 py-6 text-xs text-[var(--text-2)] sm:px-8"><span>© {new Date().getFullYear()} Spotly. Official brand resources.</span><nav className="flex gap-5"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link></nav></div></footer>
  </main>;
}
