/**
 * Colors for the 3D scene, one set per appearance.
 * Light is a porcelain diorama on a pale table; dark is graphite with soft light.
 */
export const PALETTES = {
  light: {
    bg: 0xd3d9e5, tile: 0xf6f8fc, plinth: 0xb3bdce, wall: 0xaebace, ink: 0x1b2230,
    accent: 0x0fb596, warn: 0xe5533d, amber: 0xf0a21a, blue: 0x4c82f7,
    body: 0x2b323e, face: 0x0c1016, shadow: 0.3, sun: 3.0, hemi: 0.4, env: 0.6, exposure: 0.95,
    heatMix: 0.7, glow: 0.55
  },
  dark: {
    bg: 0x0b0f15, tile: 0x1c2330, plinth: 0x141a24, wall: 0x2f3a4d, ink: 0x05070a,
    accent: 0x4fdcc0, warn: 0xff8a78, amber: 0xffd37a, blue: 0x8db4ff,
    body: 0xe9eef7, face: 0x0b0e14, shadow: 0.5, sun: 1.5, hemi: 0.28, env: 0.28, exposure: 1.05,
    heatMix: 0.55, glow: 1.0
  }
};
