// Which look the canvas orb (components/KairoOrb.jsx) should have, from the chat's shared face
// state (chat/faceState.js): thinking while an answer is prepared, speaking while it is typed out.
export function orbStateName(face) {
  if (face.thinking) return 'thinking'
  if (face.talking) return 'speaking'
  return 'idle'
}
