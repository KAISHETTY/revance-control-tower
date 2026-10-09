import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";

/** Subtle bloom (only bright, un-tonemapped alert markers glow) and a soft vignette. */
export function Effects({ mobile }: { mobile: boolean }) {
  return (
    <EffectComposer multisampling={mobile ? 0 : 4}>
      <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.1} intensity={0.7} />
      <Vignette offset={0.3} darkness={0.45} />
    </EffectComposer>
  );
}
