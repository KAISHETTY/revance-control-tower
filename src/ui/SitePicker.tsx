import { useWorld, type ViewMode } from "../store/useWorld";
import { cn } from "../lib/cn";

const OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "network", label: "Network" },
  { value: "NASH", label: "Nashville" },
  { value: "JCTY", label: "Johnson City" },
  { value: "NWK", label: "Newark" },
];

export function SitePicker({ className }: { className?: string }) {
  const view = useWorld((s) => s.view);
  const setView = useWorld((s) => s.setView);
  return (
    <div role="radiogroup" aria-label="Site" className={cn("no-scrollbar flex overflow-x-auto rounded-lg bg-panel-2 p-0.5", className)}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={view === o.value}
          onClick={() => setView(o.value)}
          className={cn(
            "h-8 shrink-0 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-colors",
            view === o.value ? "bg-panel text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
