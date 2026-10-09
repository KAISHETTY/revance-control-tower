import { Clock } from "lucide-react";
import { simClockParts } from "../lib/clock";
import { useWorld } from "../store/useWorld";

/** Simulated clock readout. */
export function Timeline() {
  const today = useWorld((s) => s.world.today);
  const startHour = useWorld((s) => s.world.startHour);
  const clock = useWorld((s) => s.world.clockMinutes);
  const { date, time } = simClockParts(today, startHour, clock);
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted" aria-label={`Simulated time ${date} ${time}`} data-testid="sim-clock">
      <Clock className="h-3.5 w-3.5" aria-hidden />
      <span className="hidden sm:inline">{date}</span>
      <span className="tabular font-mono text-fg">{time}</span>
    </div>
  );
}
