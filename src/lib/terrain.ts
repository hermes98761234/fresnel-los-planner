import { haversine, interpolate, type LatLon } from './geo'

export const TILE = 256
const MAX_LAT = 85.0511287798

/** AWS Open Data terrain tiles (Mapzen Terrarium encoding), served with CORS headers. */
export const tileUrl = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`

/** Terrarium encoding: elevation in metres = R*256 + G + B/256 - 32768. */
export const decodeTerrarium = (r: number, g: number, b: number) => r * 256 + g + b / 256 - 32768

/** Global pixel coordinates (float) of a point at zoom z (Web Mercator). */
export function lonLatToPixel(p: LatLon, z: number): { x: number; y: number } {
  const n = TILE * 2 ** z
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, p.lat))
  const s = Math.sin((lat * Math.PI) / 180)
  return { x: ((p.lon + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n }
}

/** Ground size of one terrain pixel in metres at latitude/zoom. */
export const pixelMeters = (lat: number, z: number) =>
  (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (TILE * 2 ** z)

export type PixelGetter = (ix: number, iy: number) => number

/** Bilinear elevation at global pixel coords (pixel centres sit at +0.5). */
export function bilinear(x: number, y: number, get: PixelGetter): number {
  const u = x - 0.5
  const v = y - 0.5
  const i = Math.floor(u)
  const j = Math.floor(v)
  const fx = u - i
  const fy = v - j
  const top = get(i, j) * (1 - fx) + get(i + 1, j) * fx
  const bot = get(i, j + 1) * (1 - fx) + get(i + 1, j + 1) * fx
  return top * (1 - fy) + bot * fy
}

/** Evenly spaced points on the great circle from a to b, n >= 2 points incl. both ends. */
export function pathPoints(a: LatLon, b: LatLon, n: number): LatLon[] {
  return Array.from({ length: n }, (_, i) => interpolate(a, b, i / (n - 1)))
}

function tileKeysFor(points: LatLon[], z: number): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>()
  const size = 2 ** z
  for (const p of points) {
    const { x, y } = lonLatToPixel(p, z)
    const u = Math.floor(x - 0.5)
    const v = Math.floor(y - 0.5)
    for (const ix of [u, u + 1]) {
      for (const iy of [v, v + 1]) {
        const tx = (((Math.floor(ix / TILE) % size) + size) % size) as number
        const ty = Math.max(0, Math.min(size - 1, Math.floor(iy / TILE)))
        out.set(`${tx}/${ty}`, { x: tx, y: ty })
      }
    }
  }
  return out
}

/** Unique tiles (incl. bilinear neighbours) needed to sample the given points at zoom z. */
export const tilesFor = (points: LatLon[], z: number) => [...tileKeysFor(points, z).values()]

/** Highest zoom (<= maxZ) whose tile count along the path stays within maxTiles. */
export function pickZoom(a: LatLon, b: LatLon, maxTiles = 24, maxZ = 14, minZ = 5): number {
  const pts = pathPoints(a, b, 120)
  for (let z = maxZ; z > minZ; z--) if (tilesFor(pts, z).length <= maxTiles) return z
  return minZ
}

export type TileLoader = (z: number, x: number, y: number) => Promise<Float32Array>

const cache = new Map<string, Promise<Float32Array>>()

/** Fetches a terrain PNG and decodes it on a canvas. Cached for the session. */
export const loadTile: TileLoader = (z, x, y) => {
  const key = `${z}/${x}/${y}`
  let p = cache.get(key)
  if (!p) {
    p = new Promise<Float32Array>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = c.height = TILE
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) return reject(new Error('Canvas unavailable'))
        ctx.drawImage(img, 0, 0)
        const px = ctx.getImageData(0, 0, TILE, TILE).data
        const out = new Float32Array(TILE * TILE)
        for (let i = 0; i < out.length; i++) out[i] = decodeTerrarium(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])
        resolve(out)
      }
      img.onerror = () => reject(new Error(`Terrain tile ${key} failed to load`))
      img.src = tileUrl(z, x, y)
    })
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return p
}

export interface TerrainSample extends LatLon {
  /** Distance from point A along the path, metres. */
  d: number
  /** Ground elevation above sea level, metres. */
  elev: number
}

export interface TerrainProfile {
  samples: TerrainSample[]
  zoom: number
  /** Ground size of a terrain pixel at the path midpoint, metres. */
  resolution: number
}

/** Samples ground elevation along the great circle a→b. */
export async function sampleProfile(a: LatLon, b: LatLon, load: TileLoader = loadTile): Promise<TerrainProfile> {
  const total = haversine(a, b)
  const zoom = pickZoom(a, b)
  const mid = interpolate(a, b, 0.5)
  const res = pixelMeters(mid.lat, zoom)
  const n = Math.max(64, Math.min(500, Math.ceil(total / res)))
  const pts = pathPoints(a, b, n)
  const tiles = tilesFor(pts, zoom)
  const loaded = new Map<string, Float32Array>()
  await Promise.all(tiles.map(async (t) => loaded.set(`${t.x}/${t.y}`, await load(zoom, t.x, t.y))))
  const size = 2 ** zoom
  const get: PixelGetter = (ix, iy) => {
    const tx = (((Math.floor(ix / TILE) % size) + size) % size) as number
    const iyc = Math.max(0, Math.min(size * TILE - 1, iy))
    const ty = Math.floor(iyc / TILE)
    const data = loaded.get(`${tx}/${ty}`)
    if (!data) return 0
    const cx = (((ix % TILE) + TILE) % TILE) as number
    return data[(iyc - ty * TILE) * TILE + cx]
  }
  const samples = pts.map((p, i) => {
    const { x, y } = lonLatToPixel(p, zoom)
    return { lat: p.lat, lon: p.lon, d: (total * i) / (n - 1), elev: bilinear(x, y, get) }
  })
  return { samples, zoom, resolution: res }
}
