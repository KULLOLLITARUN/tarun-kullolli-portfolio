// Time-of-day idle moods for Kairo, from the visitor's local hour (0-23).
// Each one is a short, occasional bit of body language, never a bubble.
export function moodForHour(h) {
  if (h >= 22 || h < 5) return 'late' // a yawn and sleepier eyelids
  if (h >= 5 && h < 11) return 'morning' // a stretch
  if (h >= 12 && h < 14) return 'lunch' // a glance at the wrist
  return null
}

// How long each bit lasts, and roughly how often it comes round (ms).
export const IDLE = {
  late: { dur: 2800, every: 40000 },
  morning: { dur: 2200, every: 60000 },
  lunch: { dur: 2400, every: 60000 },
}
