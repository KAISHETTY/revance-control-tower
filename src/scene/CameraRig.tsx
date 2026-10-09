import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ElementRef } from "react";
import { Vector3 } from "three";
import { useWorld } from "../store/useWorld";
import type { Focus } from "./layout";

const ELEVATION = Math.PI / 4;
const AZIMUTH = 0.35;
const DURATION = 1.1;

interface Flight {
  fromPos: Vector3;
  toPos: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
  t: number;
}

/**
 * Camera position for a focus at ~45 degrees. Distances are tuned for a 16:10
 * viewport; narrower screens pull back. In portrait, the network view turns so
 * the three sites stack top to bottom instead of shrinking side by side. When
 * the desktop detail card covers the left of the map, the target shifts so the
 * object sits right of center.
 */
function cameraFor(focus: Focus, aspect: number, panelOpen: boolean): { pos: Vector3; target: Vector3 } {
  const portraitNetwork = aspect < 1 && focus.distance >= 200;
  const azimuth = portraitNetwork ? 1.4 : AZIMUTH;
  const d = portraitNetwork ? focus.distance * 1.3 : Math.min(620, focus.distance * Math.max(1, 1.6 / Math.max(0.4, aspect)));
  const target = new Vector3(focus.x, 0, focus.z);
  if (portraitNetwork) target.z -= 10;
  if (panelOpen) {
    const shift = d * 0.22;
    target.x -= Math.cos(azimuth) * shift;
    target.z += Math.sin(azimuth) * shift;
  }
  const pos = new Vector3(
    target.x + Math.sin(azimuth) * Math.cos(ELEVATION) * d,
    Math.sin(ELEVATION) * d,
    target.z + Math.cos(azimuth) * Math.cos(ELEVATION) * d,
  );
  return { pos, target };
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Orbit controls with limits (never below the ground) plus a smooth fly-to
 * whenever `nonce` changes. Reduced motion snaps instead of animating.
 */
export function CameraRig({ focus, nonce, reducedMotion }: { focus: Focus; nonce: number; reducedMotion: boolean }) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const { camera, size, invalidate } = useThree();
  const flight = useRef<Flight | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const panelOpen = !!useWorld.getState().selection && window.matchMedia("(min-width: 1024px)").matches;
    const { pos, target } = cameraFor(focus, size.width / Math.max(1, size.height), panelOpen);
    if (first.current || reducedMotion) {
      camera.position.copy(pos);
      c.target.copy(target);
      c.update();
      first.current = false;
      flight.current = null;
    } else {
      flight.current = { fromPos: camera.position.clone(), toPos: pos, fromTarget: c.target.clone(), toTarget: target, t: 0 };
    }
    invalidate();
    // Only fly when asked to; resizing alone should not move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  useFrame((_, dt) => {
    const f = flight.current;
    const c = controls.current;
    if (!f || !c) return;
    f.t = Math.min(1, f.t + dt / DURATION);
    const k = ease(f.t);
    camera.position.lerpVectors(f.fromPos, f.toPos, k);
    c.target.lerpVectors(f.fromTarget, f.toTarget, k);
    // Arc slightly upward mid-flight for a smoother, game-like move.
    camera.position.y += Math.sin(Math.PI * k) * f.fromPos.distanceTo(f.toPos) * 0.08;
    c.update();
    if (f.t >= 1) flight.current = null;
    invalidate();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={0.12}
      maxPolarAngle={1.22}
      minDistance={8}
      maxDistance={680}
      screenSpacePanning={false}
      onStart={() => {
        flight.current = null;
      }}
    />
  );
}
