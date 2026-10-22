import Link from "next/link";
import { ArrowRight, BookOpenCheck, BriefcaseBusiness, CircleHelp, CreditCard, Headphones, ShieldCheck, Store, Truck, UsersRound } from "lucide-react";

const routes=[
  {title:"Businesses and ownership",icon:Store,description:"Every registered business, who created it, approved owners, source, publication, verification and next action.",href:"/business-register",action:"Find a business"},
  {title:"Review and approve",icon:ShieldCheck,description:"Claims, launch/location evidence, escalations and Driver applications. These queues contain auditable decisions.",href:"/work",action:"Open review inbox"},
  {title:"Support desk",icon:Headphones,description:"Respond to cases, assign agents, triage urgency, add private notes, inspect related orders and escalate.",href:"/work?view=support",action:"Open support"},
  {title:"Marketplace and content",icon:BriefcaseBusiness,description:"Business record editing, organization hierarchy, catalogue quality and imported directory sources.",href:"/marketplace",action:"Manage marketplace"},
  {title:"Spotly Assist",icon:Store,description:"Independent purchase requests: source research, coverage, menu checking and shopper operations. These are not merchant-owned listings.",href:"/assist",action:"Operate Assist"},
  {title:"Ride, Send and Drivers",icon:Truck,description:"Driver application review, location and safety eligibility, dispatch readiness and operating controls.",href:"/mobility",action:"Manage mobility"},
  {title:"Finance",icon:CreditCard,description:"Payment exceptions, merchant settlements, refunds and Driver payments. Finance decisions are not made by changing directory flags.",href:"/money",action:"Open money"},
  {title:"People and access",icon:UsersRound,description:"Customer identities, employee roles, staff access, suspension and onboarding.",href:"/team",action:"Manage people"},
  {title:"Platform and launch",icon:CircleHelp,description:"Service rollout gates, email/routing integrations, secrets, platform diagnostics and audit history.",href:"/system",action:"Review system"}
];
const stages=[
  ["1. Discovered or created","A business can appear as an unclaimed directory record. Visibility does not imply merchant endorsement or the ability to accept payments."],
  ["2. Ownership claim","A submitted claim requests evidence review. A creator UID identifies who entered a record, not necessarily who owns that business."],
  ["3. Identity and locations","Verification and correct branches must be reviewed through the claim/location workflow. A verified account alone is insufficient."],
  ["4. Launch review","Merchant checkout, catalogues and fulfilment require separate readiness checks. Admin verifies actual evidence."],
  ["5. Operating business","Orders, settlements, support and quality monitoring take place in their workspaces. Suspensions remain auditable."],
];
export function AdminOperationsGuide(){
  return <main className="mx-auto max-w-[1430px] px-4 py-8 sm:px-6">
    <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Spotly internal handbook</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight">How Spotly Admin works</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary">The Admin dashboard is an operations workspace, not a single approval screen. Start with an entity, identify its current state, then open the corresponding workflow to take action. These links point to the actual live modules.</p>
    <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{routes.map(({title,icon:Icon,description,href,action})=><Link key={title} href={href} className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent)] hover:shadow-card"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-5 w-5"/></span><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-secondary">{description}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">{action}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1"/></span></Link>)}</section>
    <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"><div className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-[var(--accent)]"/><h2 className="text-xl font-semibold">The business lifecycle</h2></div><ol className="mt-5 space-y-5">{stages.map(([title,detail])=><li key={title} className="border-l-2 border-[var(--accent)] pl-4"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-secondary">{detail}</p></li>)}</ol></div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"><h2 className="text-xl font-semibold">Frequently confused concepts</h2><dl className="mt-4 space-y-5 text-sm">{[
        ["Created by","The account that entered the record. It can be an operator or importer—not a verified business owner."],
        ["Owner","An account granted business or organization authority through an approved workflow."],
        ["Claim pending","Someone requested ownership. The business is not automatically verified."],
        ["Published directory","Customers may discover the venue, but it might not support ordering, booking or payment."],
        ["Spotly Assist","Independent shopping, with price/substitution checks, not a direct merchant partnership."],
        ["Verified merchant","Identity evidence and business relationship approved. Transaction readiness is a separate check."],
        ["Support resolved","The conversation is handled. It does not automatically reverse a refund, safety hold, claim or merchant suspension."],
        ["Dashboard counts","Some older dashboards use bounded live subscriptions. Use server-backed views for paginated searches instead of assuming the first screen includes every record."]
      ].map(([term,description])=><div key={term}><dt className="font-semibold">{term}</dt><dd className="mt-1 leading-6 text-secondary">{description}</dd></div>)}</dl></div>
    </section>
  </main>;
}
