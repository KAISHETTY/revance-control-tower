import { CheckCircle2, CircleHelp, CircleSlash, Newspaper } from "lucide-react";
import type { ReactNode } from "react";
import { PUBLIC_PRIORITIES, QUESTIONS } from "./content";
import { PublicTag } from "./PublicTag";

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-panel-2/40 p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <span className="text-accent" aria-hidden>
          {icon}
        </span>
        {title}
      </h3>
      <div className="mt-2 text-sm leading-snug text-muted">{children}</div>
    </section>
  );
}

/** One scannable screen: why this prototype, for this company, and what it is not. */
export function WhyThis() {
  return (
    <div
      className="scrollbar-thin h-full space-y-3 overflow-y-auto px-3 py-3"
      data-testid="why-this"
      tabIndex={0}
      role="region"
      aria-label="Why this, for Revance"
    >
      <Section icon={<Newspaper className="h-4 w-4" />} title="What I read in your public priorities">
        <ul className="space-y-1.5">
          {PUBLIC_PRIORITIES.map((p) => (
            <li key={p} className="flex flex-wrap items-center gap-x-1 text-fg">
              {p}
              <PublicTag />
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={<CheckCircle2 className="h-4 w-4" />} title="What this prototype shows">
        <ul className="list-disc space-y-1 pl-5">
          <li>One view across sites, orders, shipments, invoices and lots.</li>
          <li>Mismatches between the sales side, the warehouse and finance, priced in dollars.</li>
          <li>Alerts that point to the exact truck, dock, room, bay or lot.</li>
        </ul>
      </Section>

      <Section icon={<CircleSlash className="h-4 w-4" />} title="What it is not">
        <ul className="list-disc space-y-1 pl-5">
          <li>Not connected to anything.</li>
          <li>Synthetic data: every number, order, lot, price and customer is made up.</li>
          <li>I do not know your real workflows.</li>
        </ul>
      </Section>

      <Section icon={<CircleHelp className="h-4 w-4" />} title="Questions I would ask before building anything real">
        <ol className="list-decimal space-y-1 pl-5 text-fg">
          {QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
