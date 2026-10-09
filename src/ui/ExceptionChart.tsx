import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EXCEPTION_LABELS, EXCEPTION_TYPES, type ExceptionType, type ReconSummary } from "../engine/reconcile";
import { formatMoney } from "../lib/format";

/** Dollars at risk by exception type. Bars are clickable filters. Lazy-loaded with Recharts. */
export default function ExceptionChart({
  summary,
  onPick,
  active,
}: {
  summary: ReconSummary;
  onPick: (t: ExceptionType) => void;
  active: ExceptionType | "all";
}) {
  const data = EXCEPTION_TYPES.map((t) => ({
    type: t,
    label: EXCEPTION_LABELS[t],
    dollars: Math.round(summary.byType[t].dollars),
    count: summary.byType[t].count,
  }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.dollars - a.dollars);
  return (
    <div className="h-40 w-full" role="img" aria-label="Dollars at risk by exception type">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barCategoryGap={3}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={196}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "var(--panel-2)" }}
            formatter={(v, _n, p) => [`${formatMoney(Number(v))} · ${(p.payload as { count: number }).count} orders`, "At risk"]}
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }}
          />
          <Bar
            dataKey="dollars"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            onClick={(d) => onPick((d as unknown as { type: ExceptionType }).type)}
            label={{ position: "right", fontSize: 10, fill: "var(--muted)", formatter: (v: unknown) => formatMoney(Number(v)) }}
          >
            {data.map((d) => (
              <Cell key={d.type} cursor="pointer" fill={active === "all" || active === d.type ? "var(--accent)" : "var(--line)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
