/** Mean Earth radius in metres (spherical model, matches 1° latitude = 111.195 km). */
export const EARTH_R = 6371000

export interface LatLon {
  lat: number
  lon: number
}

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** Great-circle distance in metres (haversine). */
export function haversine(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function toVec(p: LatLon): [number, number, number] {
  const la = rad(p.lat)
  const lo = rad(p.lon)
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
}

/** Point at fraction f (0..1) along the great circle from a to b. */
export function interpolate(a: LatLon, b: LatLon, f: number): LatLon {
  const va = toVec(a)
  const vb = toVec(b)
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]))
  const om = Math.acos(dot)
  if (om < 1e-7) return { lat: a.lat, lon: a.lon }
  const s = Math.sin(om)
  const wa = Math.sin((1 - f) * om) / s
  const wb = Math.sin(f * om) / s
  const x = wa * va[0] + wb * vb[0]
  const y = wa * va[1] + wb * vb[1]
  const z = wa * va[2] + wb * vb[2]
  return { lat: deg(Math.atan2(z, Math.hypot(x, y))), lon: deg(Math.atan2(y, x)) }
}
