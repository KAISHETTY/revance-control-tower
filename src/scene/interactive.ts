import type { ThreeEvent } from "@react-three/fiber";
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial } from "three";
import type { ObjectRef } from "../sim/types";
import { useWorld } from "../store/useWorld";

/** Click, hover and highlight state for any clickable 3D object. */
export function useInteractive(ref: ObjectRef, alsoSelectedWhen?: (sel: ObjectRef) => boolean) {
  const select = useWorld((s) => s.select);
  const setHovered = useWorld((s) => s.setHovered);
  const hovered = useWorld((s) => s.hovered === ref.id);
  const selected = useWorld(
    (s) => !!s.selection && ((s.selection.kind === ref.kind && s.selection.id === ref.id) || (alsoSelectedWhen?.(s.selection) ?? false)),
  );
  return {
    hovered,
    selected,
    highlighted: hovered || selected,
    handlers: {
      onClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        select(ref);
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(ref.id);
        document.body.style.cursor = "pointer";
      },
      onPointerOut: () => {
        setHovered(null);
        document.body.style.cursor = "";
      },
    },
  };
}

/** Shared unit geometries and materials, created once to keep allocations and draw setup low. */
export const UNIT_BOX = new BoxGeometry(1, 1, 1);
export const WHEEL_GEO = new CylinderGeometry(0.45, 0.45, 0.35, 14).rotateZ(Math.PI / 2);

const matCache = new Map<string, MeshStandardMaterial>();
export function stdMat(
  color: string,
  opts: { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number } = {},
) {
  const key = `${color}|${opts.roughness ?? 0.7}|${opts.metalness ?? 0.05}|${opts.emissive ?? ""}|${opts.emissiveIntensity ?? 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.7,
      metalness: opts.metalness ?? 0.05,
      emissive: opts.emissive ?? "#000000",
      emissiveIntensity: opts.emissiveIntensity ?? 0,
    });
    matCache.set(key, m);
  }
  return m;
}

export const ACCENT = "#5eead4";

/** Smallest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  const d = (((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return d - Math.PI;
}
