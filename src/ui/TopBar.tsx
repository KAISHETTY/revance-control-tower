import { Box, Command, Layers, Moon, Pause, RefreshCw, Snowflake, Sparkles, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Tip } from "../components/ui/tooltip";
import { cn } from "../lib/cn";
import { useWorld, type Speed } from "../store/useWorld";
import { SitePicker } from "./SitePicker";
import { Timeline } from "./Timeline";

const SPEEDS: { value: Speed; label: string; aria: string }[] = [
  { value: 0, label: "", aria: "Pause simulation" },
  { value: 1, label: "1x", aria: "Run at 1x speed" },
  { value: 5, label: "5x", aria: "Run at 5x speed" },
  { value: 20, label: "20x", aria: "Run at 20x speed" },
];

function SimControls() {
  const speed = useWorld((s) => s.speed);
  const setSpeed = useWorld((s) => s.setSpeed);
  return (
    <div role="radiogroup" aria-label="Simulation speed" className="flex rounded-lg bg-panel-2 p-0.5">
      {SPEEDS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={speed === o.value}
          aria-label={o.aria}
          data-testid={`speed-${o.value}`}
          onClick={() => setSpeed(o.value)}
          className={cn(
            "flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors",
            speed === o.value ? "bg-panel text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg",
          )}
        >
          {o.value === 0 ? <Pause className="h-3.5 w-3.5" aria-hidden /> : o.label}
        </button>
      ))}
    </div>
  );
}

export function TopBar() {
  const renderMode = useWorld((s) => s.renderMode);
  const renderReason = useWorld((s) => s.renderReason);
  const setRenderMode = useWorld((s) => s.setRenderMode);
  const lowGraphics = useWorld((s) => s.lowGraphics);
  const setLowGraphics = useWorld((s) => s.setLowGraphics);
  const theme = useWorld((s) => s.theme);
  const setTheme = useWorld((s) => s.setTheme);
  const regenerate = useWorld((s) => s.regenerate);
  const seed = useWorld((s) => s.world.seed);
  const setPaletteOpen = useWorld((s) => s.setPaletteOpen);

  const webglMissing = renderReason === "no-webgl";

  return (
    <header className="border-b border-line bg-panel">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Snowflake className="h-4.5 w-4.5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm leading-tight font-semibold tracking-tight sm:text-base">Revance Control Tower</h1>
            <p className="truncate text-[11px] leading-tight text-muted">Unofficial prototype built from public information</p>
          </div>
          <span className="hidden rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn ring-1 ring-warn/30 ring-inset sm:inline">
            Synthetic data
          </span>
        </div>

        <SitePicker className="order-3 w-full lg:order-none lg:ml-4 lg:w-auto" />

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          <Timeline />
          <SimControls />
          <Tip label={renderMode === "3d" ? "Switch to 2D map" : webglMissing ? "3D is not available on this device" : "Switch to 3D"}>
            <Button
              size="icon"
              variant="ghost"
              aria-label={renderMode === "3d" ? "Switch to 2D map" : "Switch to 3D view"}
              aria-pressed={renderMode === "2d"}
              data-testid="toggle-2d"
              disabled={webglMissing}
              onClick={() => setRenderMode(renderMode === "3d" ? "2d" : "3d")}
            >
              {renderMode === "3d" ? <Layers className="h-4 w-4" /> : <Box className="h-4 w-4" />}
            </Button>
          </Tip>
          <Tip label={lowGraphics ? "Turn on high graphics" : "Low graphics (no shadows or effects)"}>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Low graphics"
              aria-pressed={lowGraphics}
              className={cn(lowGraphics && "text-warn")}
              onClick={() => setLowGraphics(!lowGraphics)}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </Tip>
          <Tip label={theme === "dark" ? "Light theme" : "Dark theme"}>
            <Button
              size="icon"
              variant="ghost"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </Tip>
          <Tip label={`Regenerate world (seed ${seed})`}>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Regenerate world"
              data-testid="regenerate"
              onClick={() => {
                regenerate();
                toast.success(`New synthetic world generated (seed ${seed + 1})`);
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </Tip>
          <Tip label="Search everything (Ctrl/Cmd + K)">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Open command palette"
              className="hidden sm:inline-flex"
              onClick={() => setPaletteOpen(true)}
            >
              <Command className="h-4 w-4" />
            </Button>
          </Tip>
        </div>
      </div>
    </header>
  );
}
