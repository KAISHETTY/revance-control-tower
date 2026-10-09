import { Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { COLD_RANGE_C } from "../engine/coldchain";

/** Temperature trend for a cold room, last 12 simulated hours. Lazy-loaded with Recharts. */
export default function Sparkline({ values, setpoint }: { values: number[]; setpoint: number }) {
  const data = values.map((v, i) => ({ i, v }));
  const min = Math.min(COLD_RANGE_C.min - 1, ...values);
  const max = Math.max(COLD_RANGE_C.max + 2, ...values);
  return (
    <div
      className="h-28 w-full"
      role="img"
      aria-label={`Temperature trend from ${values[0]?.toFixed(1)} to ${values.at(-1)?.toFixed(1)} degrees`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -24 }}>
          <YAxis domain={[Math.floor(min), Math.ceil(max)]} tick={{ fontSize: 10, fill: "var(--muted)" }} tickCount={4} />
          <ReferenceArea y1={COLD_RANGE_C.min} y2={COLD_RANGE_C.max} fill="var(--ok)" fillOpacity={0.08} />
          <ReferenceLine y={setpoint} stroke="var(--muted)" strokeDasharray="3 3" />
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(1)}°C`, "Temp"]}
            labelFormatter={(i) => `${Math.round(((values.length - 1 - Number(i)) * 15) / 60)}h ago`}
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }}
          />
          <Line type="monotone" dataKey="v" stroke="var(--info)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
