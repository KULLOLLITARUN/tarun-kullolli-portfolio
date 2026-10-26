// A hop with squash and stretch for Kairo, as a pose for progress k (0 to 1) and height h (px):
// crouch (anticipation), stretch tall in the air, squash on landing, one small rebound.
// Returns the body offset y (negative is up) and the vertical scale sy; k outside 0..1 is at rest.
const bump = (k, from, len) => Math.sin(Math.PI * Math.min(1, Math.max(0, (k - from) / len)))

export function jumpPose(k, h) {
  if (!(k > 0 && k < 1)) return { y: 0, sy: 1 }
  const crouch = bump(k, 0, 0.3)
  const air = bump(k, 0.15, 0.45)
  const land = bump(k, 0.6, 0.2)
  const rebound = bump(k, 0.8, 0.2)
  return {
    y: h * (0.3 * crouch - air + 0.15 * land - 0.05 * rebound),
    sy: 1 - 0.09 * crouch + 0.07 * air - 0.1 * land + 0.03 * rebound,
  }
}

// One step of a damped spring (angle x in degrees, speed v) that the body's motion kicks, so
// loose parts (bells, knob) lag behind it, overshoot a little and settle. Pure; returns a new state.
export function springStep(s, kick, dt, k, c, limit = 14) {
  const v = s.v + kick
  const v2 = v + (-k * s.x - c * v) * dt
  const x2 = Math.max(-limit, Math.min(limit, s.x + v2 * dt))
  return { x: x2, v: v2 }
}
