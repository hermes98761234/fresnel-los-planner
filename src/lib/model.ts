import type { LatLon } from './geo'

export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'
export type Unit = 'metric' | 'imperial'
export type FUnit = 'MHz' | 'GHz'

export interface AppState {
  a: LatLon
  b: LatLon
  /** Antenna heights above ground, in the current unit (m or ft). */
  hA: number
  hB: number
  freq: number
  fUnit: FUnit
  /** Effective earth radius factor. */
  k: number
  unit: Unit
  lang: Lang
  theme: Theme
}

export interface Preset {
  name: string
  a: LatLon
  b: LatLon
  /** Metres. */
  hA: number
  hB: number
  freq: number
  fUnit: FUnit
}

export const PRESETS: Preset[] = [
  { name: 'Twin Peaks to Mount Tamalpais, 5.8 GHz', a: { lat: 37.7544, lon: -122.4477 }, b: { lat: 37.9235, lon: -122.5965 }, hA: 10, hB: 10, freq: 5.8, fUnit: 'GHz' },
  { name: 'Hoverla to Petros, 868 MHz', a: { lat: 48.1601, lon: 24.5002 }, b: { lat: 48.1034, lon: 24.4281 }, hA: 5, hB: 5, freq: 868, fUnit: 'MHz' },
  { name: 'Uetliberg to Pfannenstiel, 2.4 GHz', a: { lat: 47.3495, lon: 8.4905 }, b: { lat: 47.3047, lon: 8.687 }, hA: 20, hB: 20, freq: 2.4, fUnit: 'GHz' },
  { name: 'Flat farmland near Kyiv, 433 MHz', a: { lat: 50.3, lon: 30.6 }, b: { lat: 50.4, lon: 30.9 }, hA: 15, hB: 15, freq: 433, fUnit: 'MHz' },
]

export const M_PER_FT = 0.3048
export const M_PER_MI = 1609.344
export const toLen = (m: number, u: Unit) => (u === 'metric' ? m : m / M_PER_FT)
export const fromLen = (v: number, u: Unit) => (u === 'metric' ? v : v * M_PER_FT)
export const toDist = (m: number, u: Unit) => (u === 'metric' ? m / 1000 : m / M_PER_MI)
export const lenUnit = (u: Unit) => (u === 'metric' ? 'm' : 'ft')
export const distUnit = (u: Unit) => (u === 'metric' ? 'km' : 'mi')
export const freqMHz = (s: Pick<AppState, 'freq' | 'fUnit'>) => (s.fUnit === 'GHz' ? s.freq * 1000 : s.freq)
export const round1 = (v: number) => Math.round(v * 10) / 10

export function applyPreset(s: AppState, p: Preset): AppState {
  return { ...s, a: p.a, b: p.b, hA: round1(toLen(p.hA, s.unit)), hB: round1(toLen(p.hB, s.unit)), freq: p.freq, fUnit: p.fUnit }
}

export function defaultState(): AppState {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return applyPreset(
    { a: PRESETS[0].a, b: PRESETS[0].b, hA: 10, hB: 10, freq: 5.8, fUnit: 'GHz', k: 4 / 3, unit: 'metric', lang: nav.toLowerCase().startsWith('uk') ? 'uk' : 'en', theme: 'auto' },
    PRESETS[0],
  )
}

const KEY = 'fresnel-los-planner:v1'

const isLL = (p: unknown): p is LatLon => {
  const o = p as LatLon
  return !!o && Number.isFinite(o.lat) && Number.isFinite(o.lon) && Math.abs(o.lat) <= 85 && Math.abs(o.lon) <= 180
}

/** Merges stored JSON over the defaults, dropping anything malformed. */
export function parseState(raw: string | null): AppState {
  const d = defaultState()
  if (!raw) return d
  try {
    const o = JSON.parse(raw) as Partial<AppState>
    const num = (v: unknown, lo: number, hi: number, fb: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : fb)
    return {
      a: isLL(o.a) ? o.a : d.a,
      b: isLL(o.b) ? o.b : d.b,
      hA: num(o.hA, 0, 10000, d.hA),
      hB: num(o.hB, 0, 10000, d.hB),
      freq: num(o.freq, 0.001, 1e6, d.freq),
      fUnit: o.fUnit === 'MHz' || o.fUnit === 'GHz' ? o.fUnit : d.fUnit,
      k: num(o.k, 0.3, 10, d.k),
      unit: o.unit === 'imperial' ? 'imperial' : 'metric',
      lang: o.lang === 'uk' || o.lang === 'en' ? o.lang : d.lang,
      theme: o.theme === 'light' || o.theme === 'dark' || o.theme === 'auto' ? o.theme : d.theme,
    }
  } catch {
    return d
  }
}

export function loadState(): AppState {
  try {
    return parseState(localStorage.getItem(KEY))
  } catch {
    return defaultState()
  }
}

export function saveState(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}
