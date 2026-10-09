import { domAnimation, LazyMotion, MotionConfig } from "framer-motion";
import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { TooltipProvider } from "./components/ui/tooltip";
import { MINUTES_PER_SECOND } from "./sim/tick";
import { useAlerts } from "./store/derived";
import { useWorld, type Tab } from "./store/useWorld";
import { AlertFeed } from "./ui/AlertFeed";
import { DetailPanel } from "./ui/DetailPanel";
import { Headline } from "./ui/Headline";
import { KpiStrip } from "./ui/KpiStrip";
import { TopBar } from "./ui/TopBar";
import { Viewport } from "./ui/Viewport";
import { cn } from "./lib/cn";

// Panels that are not visible at first paint load on demand to keep the shell small.
const OrdersPanel = lazy(() => import("./ui/OrdersPanel").then((m) => ({ default: m.OrdersPanel })));
const OrderDrawer = lazy(() => import("./ui/OrdersPanel").then((m) => ({ default: m.OrderDrawer })));
const LotsPanel = lazy(() => import("./ui/LotsPanel").then((m) => ({ default: m.LotsPanel })));
const HowItWorks = lazy(() => import("./ui/HowItWorks").then((m) => ({ default: m.HowItWorks })));
const WhyThis = lazy(() => import("./ui/WhyThis").then((m) => ({ default: m.WhyThis })));
const CommandPalette = lazy(() => import("./ui/CommandPalette"));

const TICK_MS = 500;

function PanelFallback() {
  return <div className="skeleton m-3 h-40 rounded-lg" aria-label="Loading" />;
}

/** Ctrl/Cmd+K toggles the command palette. */
function usePaletteHotkey() {
  const setOpen = useWorld((s) => s.setPaletteOpen);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useWorld.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

/** Drives the simulation: speed x 5 simulated minutes per real second, in whole-minute steps. */
function useSimClock() {
  const speed = useWorld((s) => s.speed);
  const advance = useWorld((s) => s.advance);
  useEffect(() => {
    if (speed === 0) return;
    let carry = 0;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      carry += (speed * MINUTES_PER_SECOND * TICK_MS) / 1000;
      const whole = Math.floor(carry);
      if (whole > 0) {
        carry -= whole;
        advance(whole);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [speed, advance]);
}

function SidePanel() {
  const tab = useWorld((s) => s.tab);
  const setTab = useWorld((s) => s.setTab);
  const alerts = useAlerts();
  const high = alerts.filter((a) => a.severity === "high").length;
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex h-full min-h-0 flex-col">
      <TabsList aria-label="Panels" className="no-scrollbar overflow-x-auto">
        <TabsTrigger value="alerts" data-testid="tab-alerts">
          Alerts
          <span className={cn("tabular rounded-full px-1.5 text-[10px] font-bold", high ? "bg-bad/20 text-bad" : "bg-panel-2 text-muted")}>
            {alerts.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="orders" data-testid="tab-orders">
          Orders
        </TabsTrigger>
        <TabsTrigger value="lots" data-testid="tab-lots">
          Lots
        </TabsTrigger>
        <TabsTrigger value="why" data-testid="tab-why">
          Why this, for Revance
        </TabsTrigger>
        <TabsTrigger value="how" data-testid="tab-how">
          How it works
        </TabsTrigger>
      </TabsList>
      <TabsContent value="alerts">
        <AlertFeed />
      </TabsContent>
      <TabsContent value="orders">
        <Suspense fallback={<PanelFallback />}>
          <OrdersPanel />
        </Suspense>
      </TabsContent>
      <TabsContent value="lots">
        <Suspense fallback={<PanelFallback />}>
          <LotsPanel />
        </Suspense>
      </TabsContent>
      <TabsContent value="why">
        <Suspense fallback={<PanelFallback />}>
          <WhyThis />
        </Suspense>
      </TabsContent>
      <TabsContent value="how">
        <Suspense fallback={<PanelFallback />}>
          <HowItWorks />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}

export default function App() {
  const theme = useWorld((s) => s.theme);
  const tab = useWorld((s) => s.tab);
  const orderDrawer = useWorld((s) => s.orderDrawer);
  const paletteOpen = useWorld((s) => s.paletteOpen);
  useSimClock();
  usePaletteHotkey();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0a0f1c" : "#eef2f7");
  }, [theme]);

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300}>
          <div className="flex min-h-dvh flex-col lg:h-dvh">
            <TopBar />
            <Headline />
            <KpiStrip />
            <main className="flex flex-1 flex-col gap-3 px-3 pb-3 sm:px-4 lg:min-h-0 lg:flex-row">
              <section
                id="map"
                aria-label="Map"
                className="relative h-[54dvh] min-h-[320px] scroll-mt-2 overflow-hidden rounded-xl border border-line lg:h-auto lg:min-h-0 lg:flex-1"
              >
                <Viewport />
                <DetailPanel />
              </section>
              <aside
                aria-label="Alerts, orders and lots"
                className={cn(
                  "flex h-[78dvh] min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-panel lg:h-auto",
                  tab === "orders" ? "lg:w-[600px] xl:w-[640px]" : "lg:w-[410px] xl:w-[440px]",
                )}
              >
                <SidePanel />
              </aside>
            </main>
            <Suspense fallback={null}>
              {orderDrawer ? <OrderDrawer /> : null}
              {paletteOpen ? <CommandPalette /> : null}
            </Suspense>
            <Toaster theme={theme} position="top-center" richColors closeButton />
          </div>
        </TooltipProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
