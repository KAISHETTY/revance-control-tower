import { FlaskConical } from "lucide-react";

export function Banner() {
  return (
    <div role="note" className="flex items-center justify-center gap-2 bg-warn/15 px-3 py-1 text-center text-[12px] font-medium text-warn">
      <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>Prototype on synthetic data. Not connected to any real system.</span>
    </div>
  );
}
