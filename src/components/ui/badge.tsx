import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type Tone = "ok" | "warn" | "bad" | "info" | "muted" | "accent";

const tones: Record<Tone, string> = {
  ok: "bg-ok/15 text-ok ring-ok/30",
  warn: "bg-warn/15 text-warn ring-warn/30",
  bad: "bg-bad/15 text-bad ring-bad/30",
  info: "bg-info/15 text-info ring-info/30",
  muted: "bg-panel-2 text-muted ring-line",
  accent: "bg-accent/15 text-accent ring-accent/30",
};

export function Badge({ tone = "muted", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
