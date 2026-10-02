// Tiny shared state so the chat (DOM) can drive the face (WebGL) without re-renders.
export const faceState = {
  thinking: false, // eyes glance up while an answer is prepared
  talking: false, // mouth moves while an answer is typed out
}
