import { Bloom, EffectComposer, SMAA, Vignette } from "@react-three/postprocessing";

/**
 * Subtle bloom (only bright, un-tonemapped alert markers and lamps glow) and a
 * soft vignette. SMAA instead of multisampled targets keeps it cheap; bloom
 * runs at half resolution.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.1} intensity={0.7} resolutionScale={0.5} />
      <Vignette offset={0.3} darkness={0.45} />
      <SMAA />
    </EffectComposer>
  );
}
