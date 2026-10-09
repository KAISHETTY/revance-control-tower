import { ChevronRight, Info, RotateCcw } from "lucide-react";
import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import Fallback2D from "../scene/Fallback2D";
import { DOCK_COLORS, EXPIRY_COLORS } from "../scene/colors";
import { siteName } from "../sim/lookup";
import { useWorld } from "../store/useWorld";

const Scene = lazy(() => import("../scene/Scene"));

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function SceneSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-label="Loading 3D view">
      <div className="skeleton absolute inset-0 opacity-60" />
      <p className="relative text-sm text-muted">Loading 3D view…</p>
    </div>
  );
}

function Legend() {
  const [open, setOpen] = useState(false);
  const swatch = (c: string) => <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c }} aria-hidden />;
  return (
    <div className="pointer-events-auto absolute right-2 bottom-2 hidden text-[11px] lg:block">
      {open ? (
        <div className="w-48 space-y-1.5 rounded-lg border border-line bg-panel/90 p-2.5 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Legend</span>
            <button type="button" className="text-muted hover:text-fg" onClick={() => setOpen(false)}>
              Hide
            </button>
          </div>
          <p className="text-muted">Pallets by lot expiry</p>
          <div className="grid grid-cols-2 gap-1">
            <span className="flex items-center gap-1">{swatch(EXPIRY_COLORS.ok)} OK</span>
            <span className="flex items-center gap-1">{swatch(EXPIRY_COLORS.warning)} ≤ 90 days</span>
            <span className="flex items-center gap-1">{swatch(EXPIRY_COLORS.critical)} ≤ 30 days</span>
            <span className="flex items-center gap-1">{swatch(EXPIRY_COLORS.expired)} Expired</span>
          </div>
          <p className="text-muted">Dock pads</p>
          <div className="grid grid-cols-3 gap-1">
            <span className="flex items-center gap-1">{swatch(DOCK_COLORS.free)} Free</span>
            <span className="flex items-center gap-1">{swatch(DOCK_COLORS.occupied)} In use</span>
            <span className="flex items-center gap-1">{swatch(DOCK_COLORS.blocked)} Blocked</span>
          </div>
          <p className="text-muted">White trucks with a blue unit are reefers. Pulsing markers are open alerts.</p>
        </div>
      ) : (
        <Button size="sm" variant="subtle" className="bg-panel/90 backdrop-blur" onClick={() => setOpen(true)}>
          <Info className="h-3.5 w-3.5" aria-hidden /> Legend
        </Button>
      )}
    </div>
  );
}

export function Viewport() {
  const renderMode = useWorld((s) => s.renderMode);
  const renderReason = useWorld((s) => s.renderReason);
  const setRenderMode = useWorld((s) => s.setRenderMode);
  const view = useWorld((s) => s.view);
  const setView = useWorld((s) => s.setView);
  const resetView = useWorld((s) => s.resetView);
  const world = useWorld((s) => s.world);

  useEffect(() => {
    if (renderReason === "no-webgl")
      toast.info("3D is not available on this device, so you are seeing the 2D map. Everything else works the same.");
    if (renderReason === "slow")
      toast.info("This device was struggling with 3D, so the app switched to the 2D map. You can switch back from the top bar.");
  }, [renderReason]);

  return (
    <div className="absolute inset-0">
      {renderMode === "3d" ? (
        <SceneBoundary onError={() => setRenderMode("2d", "no-webgl")}>
          <Suspense fallback={<SceneSkeleton />}>
            <Scene />
          </Suspense>
        </SceneBoundary>
      ) : (
        <Fallback2D />
      )}

      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
        <nav
          aria-label="Map location"
          className="pointer-events-auto flex items-center gap-1 rounded-lg border border-line bg-panel/85 px-2 py-1 text-xs shadow backdrop-blur"
        >
          <button
            type="button"
            className={view === "network" ? "font-semibold" : "text-muted hover:text-fg"}
            onClick={() => setView("network")}
          >
            Network
          </button>
          {view !== "network" ? (
            <>
              <ChevronRight className="h-3 w-3 text-muted" aria-hidden />
              <span className="font-semibold" data-testid="breadcrumb-site">
                {siteName(world, view)}
              </span>
            </>
          ) : null}
          <span className="ml-1 rounded bg-panel-2 px-1.5 py-0.5 text-[10px] text-muted" data-testid="render-mode">
            {renderMode === "3d" ? "3D" : "2D map"}
          </span>
        </nav>
        <Button
          size="sm"
          variant="subtle"
          className="pointer-events-auto bg-panel/85 shadow backdrop-blur"
          onClick={resetView}
          data-testid="reset-view"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset view
        </Button>
      </div>
      <Legend />
    </div>
  );
}
