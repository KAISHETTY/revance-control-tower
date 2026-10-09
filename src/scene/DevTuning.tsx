import { useThree } from "@react-three/fiber";
import { useControls } from "leva";
import { useEffect } from "react";
import type { PerspectiveCamera } from "three";

/** Dev-only tuning panel (leva), opened with ?leva=1. Never bundled in production. */
export default function DevTuning() {
  const { camera, gl, invalidate } = useThree();
  const { fov, exposure } = useControls("Scene", { fov: { value: 38, min: 20, max: 70 }, exposure: { value: 1, min: 0.3, max: 2 } });
  useEffect(() => {
    (camera as PerspectiveCamera).fov = fov;
    camera.updateProjectionMatrix();
    gl.toneMappingExposure = exposure;
    invalidate();
  }, [fov, exposure, camera, gl, invalidate]);
  return null;
}
