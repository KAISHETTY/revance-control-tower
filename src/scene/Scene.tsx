import { Instances } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Vector3, type DirectionalLight } from "three";
import { usePrefersReducedMotion, useIsCoarsePointer } from "../lib/hooks";
import { getAlerts } from "../store/derived";
import { useWorld } from "../store/useWorld";
import type { ObjectKind, World } from "../sim/types";
import { CameraRig } from "./CameraRig";
import { SCENE_DARK, SCENE_LIGHT } from "./colors";
import { Ground } from "./Ground";
import { WHEEL_GEO, stdMat } from "./interactive";
import { anchorFor } from "./anchors";
import { AlertMarkers } from "./Labels";
import { LabelProjector, ScreenLabels } from "./ScreenLabels";
import { focusFor, networkFocus, siteFocus, truckPose, type Focus } from "./layout";
import { Site3D } from "./Site3D";
import { Truck3D } from "./Truck3D";

const Effects = lazy(() => import("./Effects").then((m) => ({ default: m.Effects })));
const DevTuning =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get("leva") === "1" ? lazy(() => import("./DevTuning")) : null;

const SLOW_FRAME_MS = 40;

function currentFocus(): Focus {
  const s = useWorld.getState();
  if (s.selection) {
    const f = focusFor(s.world, s.selection);
    if (f) return f;
  }
  if (s.view === "network") return networkFocus();
  return siteFocus(s.world.sites.find((x) => x.id === s.view)!);
}

function Lights({ focus, shadows, mapSize, light }: { focus: Focus; shadows: boolean; mapSize: number; light: boolean }) {
  const sun = useRef<DirectionalLight>(null);
  const network = focus.distance > 120;
  useLayoutEffect(() => {
    const l = sun.current;
    if (!l) return;
    l.position.set(focus.x + 40, 80, focus.z + 30);
    l.target.position.set(focus.x, 0, focus.z);
    l.target.updateMatrixWorld();
    const ext = network ? 150 : 55;
    const cam = l.shadow.camera;
    cam.left = -ext;
    cam.right = ext;
    cam.top = ext;
    cam.bottom = -ext;
    cam.near = 1;
    cam.far = 260;
    cam.updateProjectionMatrix();
    l.shadow.needsUpdate = true;
  }, [focus, network]);
  return (
    <>
      <hemisphereLight args={[light ? "#ffffff" : "#c7d7ff", light ? "#b8c4d6" : "#1b2433", light ? 1.1 : 0.9]} />
      <ambientLight intensity={light ? 0.35 : 0.25} />
      <directionalLight
        ref={sun}
        intensity={light ? 2.0 : 1.7}
        color="#fff4e6"
        castShadow={shadows}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  );
}

/**
 * Watches frame time; if the device is slow it first drops to low graphics,
 * then to the 2D map. Disabled with ?perf=off (used by tests on software GPUs).
 */
function PerfMonitor({ active }: { active: boolean }) {
  const lowGraphics = useWorld((s) => s.lowGraphics);
  const setLowGraphics = useWorld((s) => s.setLowGraphics);
  const setRenderMode = useWorld((s) => s.setRenderMode);
  const enabled = useMemo(() => new URLSearchParams(window.location.search).get("perf") !== "off", []);
  const window_ = useRef({ elapsed: 0, frames: 0, total: 0 });
  useEffect(() => {
    window_.current = { elapsed: 0, frames: 0, total: 0 };
  }, [lowGraphics, active]);
  useFrame((_, dt) => {
    const ms = dt * 1000;
    const perf = (window.__cctPerf ??= { samples: [] });
    perf.samples.push(ms);
    if (perf.samples.length > 900) perf.samples.shift();
    if (!enabled || !active) return;
    const w = window_.current;
    w.elapsed += dt;
    if (w.elapsed < 1.5) return; // warm-up: shader compiles and first uploads
    w.frames += 1;
    w.total += ms;
    if (w.elapsed < 5) return;
    const avg = w.total / Math.max(1, w.frames);
    window_.current = { elapsed: 0, frames: 0, total: 0 };
    if (avg <= SLOW_FRAME_MS) return;
    if (!useWorld.getState().lowGraphics) {
      setLowGraphics(true);
      toast.info("Switched to low graphics to keep things smooth on this device.");
    } else {
      setRenderMode("2d", "slow");
    }
  });
  return null;
}

/** Lets end-to-end tests find where an object is drawn on screen. */
function SceneBridge() {
  const { camera, gl } = useThree();
  useEffect(() => {
    const v = new Vector3();
    window.__cctScene = {
      project: (kind: ObjectKind, id: string) => {
        const world: World = useWorld.getState().world;
        const p = anchorFor(world, { kind, id });
        if (!p) return null;
        // Aim at the body of the object rather than the marker above it.
        v.set(p[0], kind === "truck" ? 2 : kind === "bay" ? 1.5 : 1, p[2]).project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
      },
    };
    return () => {
      delete window.__cctScene;
    };
  }, [camera, gl]);
  return null;
}

declare global {
  interface Window {
    __cctScene?: { project: (kind: ObjectKind, id: string) => { x: number; y: number } | null };
    __cctPerf?: { samples: number[] };
  }
}

function World3D({ reducedMotion, mobile }: { reducedMotion: boolean; mobile: boolean }) {
  const world = useWorld((s) => s.world);
  const theme = useWorld((s) => s.theme);
  const low = useWorld((s) => s.lowGraphics);
  const speed = useWorld((s) => s.speed);
  const nonce = useWorld((s) => s.flyNonce);
  const palette = theme === "light" ? SCENE_LIGHT : SCENE_DARK;
  const alerts = getAlerts(world);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- focus is recomputed only when a fly-to is requested
  const focus = useMemo(() => currentFocus(), [nonce]);
  const trucks = world.sites.flatMap((s) => s.trucks.map((t) => ({ t, s })));

  return (
    <>
      <color attach="background" args={[palette.background]} />
      {!low ? <fog attach="fog" args={[palette.fog, 380, 900]} /> : null}
      <Lights focus={focus} shadows={!low} mapSize={mobile ? 1024 : 2048} light={theme === "light"} />
      <Ground world={world} alerts={alerts} palette={palette} low={low} />
      {world.sites.map((s) => (
        <Site3D key={s.id} site={s} world={world} palette={palette} reducedMotion={reducedMotion} />
      ))}
      <Instances limit={trucks.length * 6 + 12} geometry={WHEEL_GEO} material={stdMat("#111827", { roughness: 0.9 })} castShadow>
        {trucks.map(({ t, s }) => (
          <Truck3D
            key={t.id}
            truck={t}
            pose={truckPose(world, t, s)}
            scale={t.location === "road" ? 1.7 : 1}
            reducedMotion={reducedMotion}
          />
        ))}
      </Instances>
      <AlertMarkers world={world} alerts={alerts} reducedMotion={reducedMotion} />
      <LabelProjector />
      <CameraRig focus={focus} nonce={nonce} reducedMotion={reducedMotion} />
      <PerfMonitor active={speed !== 0} />
      <SceneBridge />
      {!low ? (
        <Suspense fallback={null}>
          <Effects mobile={mobile} />
        </Suspense>
      ) : null}
      {DevTuning ? (
        <Suspense fallback={null}>
          <DevTuning />
        </Suspense>
      ) : null}
    </>
  );
}

export default function Scene() {
  const reducedMotion = usePrefersReducedMotion();
  const mobile = useIsCoarsePointer();
  const speed = useWorld((s) => s.speed);
  const low = useWorld((s) => s.lowGraphics);
  const select = useWorld((s) => s.select);
  const { pos } = useMemo(() => {
    const f = networkFocus();
    return { pos: new Vector3(f.x + 70, f.distance * 0.7, f.z + 140) };
  }, []);

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows={!low ? "percentage" : false}
        dpr={[1, low ? 1.25 : 2]}
        frameloop={speed === 0 ? "demand" : "always"}
        camera={{ position: pos.toArray(), fov: 38, near: 2, far: 1800 }}
        gl={{ antialias: !low, powerPreference: "high-performance" }}
        onPointerMissed={() => select(null)}
        aria-label="3D view of the network"
        data-testid="scene-canvas"
        style={{ touchAction: "none" }}
      >
        <World3D reducedMotion={reducedMotion} mobile={mobile} />
      </Canvas>
      <ScreenLabels />
    </div>
  );
}
