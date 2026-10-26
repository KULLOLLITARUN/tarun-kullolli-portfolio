import { Bloom, EffectComposer } from '@react-three/postprocessing'

// A soft glow on the brightest particles (the name, stars, Kairo's halo). Loaded lazily and only
// on wide screens without reduced motion (ParticleScene.jsx), so phones never download it.
export default function Glow() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.55} luminanceSmoothing={0.25} radius={0.7} />
    </EffectComposer>
  )
}
