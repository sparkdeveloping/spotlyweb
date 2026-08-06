import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Privacy notice", description: "How Spotly handles account, business, order, and support information." };

const sections = [
  ["Information Spotly uses", "Account and contact details, business and location information, order or booking activity, payment status, support conversations, device and service diagnostics, and information you choose to provide during verification."],
  ["Why it is used", "To provide the requested Spotly service, verify access, prepare and track transactions, support customers and businesses, prevent misuse, improve reliability, and meet operational or legal obligations."],
  ["Who can see it", "Information is limited to the people, businesses, service providers, and authorized Spotly staff who need it for the relevant task. Spotly does not ask for passwords, one-time codes, or payment PINs in support chat."],
  ["How long it is kept", "Records are kept for as long as they are needed for the service, dispute handling, security, finance, verification, or applicable record-keeping requirements. Retention periods will be reviewed as the pilot expands."],
  ["Your choices", "You can update account information, change notification choices, request a copy of your information, or ask for account closure through Spotly Support. Some records may need to be retained where an active transaction, dispute, security issue, or legal requirement applies."],
  ["Contact", "Use the Spotly Support page for a privacy question, information request, correction, or account-closure request."]
];

export default function PrivacyPage() {
  return <main className="min-h-screen bg-[#fffdf9] px-4 py-10 text-ink sm:px-6"><div className="mx-auto max-w-3xl"><header className="flex items-center justify-between border-b pb-6"><Link href="/" className="flex items-center gap-3"><Image src="/brand/spotly.svg" alt="Spotly" width={42} height={42} /><span className="font-semibold">Spotly</span></Link><Link href="/support?topic=privacy" className="text-sm font-semibold text-violet">Privacy help</Link></header><div className="py-10"><p className="text-sm font-semibold text-violet">Your information</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.04em]">Privacy notice</h1><p className="mt-5 text-base leading-8 text-secondary">This notice explains the information Spotly uses while the platform is in pilot and how to ask questions or exercise available choices.</p><p className="mt-3 text-sm text-tertiary">Last updated 6 August 2026</p><div className="mt-10 divide-y border-y">{sections.map(([title, body]) => <section key={title} className="py-6"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-3 text-sm leading-7 text-secondary">{body}</p></section>)}</div><div className="mt-8 flex flex-wrap gap-3"><Link href="/support?topic=privacy" className="inline-flex h-12 items-center rounded-xl bg-violet px-5 text-sm font-semibold text-white">Contact Spotly Support</Link><Link href="/" className="inline-flex h-12 items-center rounded-xl border px-5 text-sm font-semibold">Return home</Link></div></div></div></main>;
}
