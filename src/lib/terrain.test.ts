import { describe, expect, it } from 'vitest'
import { bilinear, decodeTerrarium, lonLatToPixel, pickZoom, pixelMeters, sampleProfile, TILE, tilesFor, type TileLoader } from './terrain'

describe('terrain', () => {
  it('decodes Terrarium pixels', () => {
    expect(decodeTerrarium(128, 0, 0)).toBe(0)
    expect(decodeTerrarium(131, 232, 128)).toBeCloseTo(1000.5, 6)
    expect(decodeTerrarium(127, 255, 0)).toBe(-1)
    expect(decodeTerrarium(0, 0, 0)).toBe(-32768)
  })
  it('maps lon/lat to Web Mercator pixels', () => {
    const o = lonLatToPixel({ lat: 0, lon: 0 }, 1)
    expect(o.x).toBeCloseTo(256, 6)
    expect(o.y).toBeCloseTo(256, 6)
    const w = lonLatToPixel({ lat: 0, lon: -180 }, 3)
    expect(w.x).toBe(0)
    // Kyiv at z10 lies in tile 598/354 (OSM slippy-map convention)
    const k = lonLatToPixel({ lat: 50.45, lon: 30.5234 }, 10)
    expect(Math.floor(k.x / TILE)).toBe(598)
    expect(Math.floor(k.y / TILE)).toBe(345)
  })
  it('pixel size is about 4.78 m at z15 on the equator and shrinks with latitude', () => {
    expect(pixelMeters(0, 15)).toBeCloseTo(4.777, 2)
    expect(pixelMeters(60, 15)).toBeCloseTo(2.389, 2)
  })
  it('interpolates bilinearly between pixel centres', () => {
    const get = (ix: number, iy: number) => ix * 10 + iy * 100
    expect(bilinear(100.5, 50.5, get)).toBeCloseTo(100 * 10 + 50 * 100, 9)
    expect(bilinear(101, 51, get)).toBeCloseTo(100.5 * 10 + 50.5 * 100, 9)
  })
  it('picks a coarser zoom for longer paths', () => {
    const a = { lat: 48, lon: 24 }
    const short = pickZoom(a, { lat: 48.05, lon: 24.05 })
    const long = pickZoom(a, { lat: 49.5, lon: 26 })
    expect(short).toBeGreaterThan(long)
    expect(tilesFor([a], 10).length).toBeGreaterThanOrEqual(1)
  })
  it('samples a profile across tile borders from a synthetic ramp', async () => {
    // elevation = global pixel column, so it must equal x - 0.5 at every sample
    const ramp: TileLoader = async (_z, x) => {
      const t = new Float32Array(TILE * TILE)
      for (let r = 0; r < TILE; r++) for (let c = 0; c < TILE; c++) t[r * TILE + c] = x * TILE + c
      return t
    }
    const a = { lat: 48, lon: 24 }
    const b = { lat: 48.05, lon: 24.2 }
    const p = await sampleProfile(a, b, ramp)
    expect(p.samples.length).toBeGreaterThanOrEqual(64)
    expect(p.samples[0].d).toBe(0)
    for (const s of p.samples) {
      expect(s.elev).toBeCloseTo(lonLatToPixel(s, p.zoom).x - 0.5, 3)
    }
    expect(p.samples.at(-1)!.d).toBeGreaterThan(14000)
  })
})
