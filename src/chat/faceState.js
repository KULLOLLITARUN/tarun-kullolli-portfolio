// Tiny shared state so the chat (DOM) can drive the face (WebGL) without re-renders.
export const faceState = {
  thinking: false, // eyes glance up while an answer is prepared
  talking: false, // mouth moves while an answer is typed out
  mood: 0, // off-topic questions in a row, capped at 3 (1 confused, 2 annoyed, 3 grumpy)
  moodAt: 0, // when the mood last changed (it cools down one level after a quiet spell)
  relief: 0, // when a good question followed a bad mood (a happy hop)
}

// Track one answered question: off-topic ones raise the mood, a good one clears it.
export function noteAnswer(offTopic) {
  const now = performance.now()
  if (offTopic) faceState.mood = Math.min(3, faceState.mood + 1)
  else {
    if (faceState.mood > 0) faceState.relief = now
    faceState.mood = 0
  }
  faceState.moodAt = now
}
