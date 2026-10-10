import { useEffect, useState } from 'react'
import type { LatLon } from './lib/geo'
import { sampleProfile, type TerrainProfile } from './lib/terrain'

export type TerrainState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; profile: TerrainProfile }

/** Fetches terrain along a→b (debounced) and re-fetches when the endpoints change or `retry` bumps. */
export function useTerrain(a: LatLon, b: LatLon, retry: number): TerrainState {
  const [state, setState] = useState<TerrainState>({ status: 'loading' })
  const key = `${a.lat.toFixed(5)},${a.lon.toFixed(5)};${b.lat.toFixed(5)},${b.lon.toFixed(5)};${retry}`
  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    const timer = setTimeout(() => {
      sampleProfile(a, b).then(
        (profile) => live && setState({ status: 'ready', profile }),
        (e: unknown) => live && setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
      )
    }, 350)
    return () => {
      live = false
      clearTimeout(timer)
    }
    // key encodes a and b
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}
