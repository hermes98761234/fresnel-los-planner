import { EARTH_R } from './geo'

export const C = 299792458

/** Wavelength in metres for a frequency in MHz. */
export const wavelength = (fMHz: number) => C / (fMHz * 1e6)

/** Radius (m) of the n-th Fresnel zone at distances d1, d2 (m) from the two ends. */
export function fresnelRadius(n: number, fMHz: number, d1: number, d2: number): number {
  const d = d1 + d2
  if (d <= 0 || d1 <= 0 || d2 <= 0) return 0
  return Math.sqrt((n * wavelength(fMHz) * d1 * d2) / d)
}

/** Earth bulge (m) at distances d1, d2 (m) from the ends for effective-radius factor k. */
export function earthBulge(d1: number, d2: number, k: number, radius = EARTH_R): number {
  return (d1 * d2) / (2 * k * radius)
}

/** Free-space path loss in dB for a distance in metres and frequency in MHz. */
export function fspl(dMeters: number, fMHz: number): number {
  return 20 * Math.log10(dMeters / 1000) + 20 * Math.log10(fMHz) + 32.44
}
