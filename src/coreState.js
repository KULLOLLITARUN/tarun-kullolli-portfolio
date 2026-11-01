// Which look the AI-core orb should have, from the chat's shared face state (chat/faceState.js).
// Annoyed beats thinking, thinking beats talking, and everything else is a calm idle.
export function coreStateName(face) {
  if (face.mood >= 2) return 'annoyed'
  if (face.thinking) return 'thinking'
  if (face.talking) return 'talking'
  return 'idle'
}

// How each look moves: spin speed, size, talking pulse, red tint, jitter and streak length.
export const CORE_STATES = {
  idle: { speed: 0.45, scale: 1, pulse: 0, red: 0, jitter: 0, smear: 0.1 },
  thinking: { speed: 2.6, scale: 0.9, pulse: 0.1, red: 0, jitter: 0, smear: 1.1 },
  talking: { speed: 0.8, scale: 1, pulse: 1, red: 0, jitter: 0, smear: 0.3 },
  annoyed: { speed: 1.5, scale: 0.95, pulse: 0.3, red: 1, jitter: 1, smear: 0.7 },
}
