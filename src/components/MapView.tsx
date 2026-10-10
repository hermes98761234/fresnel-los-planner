import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLon } from '../lib/geo'

interface Props {
  a: LatLon
  b: LatLon
  hover: LatLon | null
  /** Bumps whenever the view should refit to the path. */
  fitKey: number
  label: string
  onClick: (p: LatLon) => void
  onMove: (which: 'a' | 'b', p: LatLon) => void
}

const pin = (letter: string, cls: string) => L.divIcon({ className: '', html: `<div class="pin ${cls}">${letter}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] })
const ll = (p: LatLon): L.LatLngExpression => [p.lat, p.lon]

export default function MapView({ a, b, hover, fitKey, label, onClick, onMove }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const cb = useRef({ onClick, onMove })
  const layers = useRef<{ map: L.Map; ma: L.Marker; mb: L.Marker; line: L.Polyline; dot: L.CircleMarker } | null>(null)
  const latest = useRef({ a, b })
  useEffect(() => {
    cb.current = { onClick, onMove }
    latest.current = { a, b }
  })

  useEffect(() => {
    const map = L.map(el.current!, { zoomControl: true, worldCopyJump: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    const { a: pa, b: pb } = latest.current
    const ma = L.marker(ll(pa), { draggable: true, icon: pin('A', 'pin-a'), title: 'A' }).addTo(map)
    const mb = L.marker(ll(pb), { draggable: true, icon: pin('B', 'pin-b'), title: 'B' }).addTo(map)
    const line = L.polyline([ll(pa), ll(pb)], { color: '#2563eb', weight: 3, dashArray: '8 6' }).addTo(map)
    const dot = L.circleMarker(ll(pa), { radius: 6, color: '#fff', weight: 2, fillColor: '#dc2626', fillOpacity: 1, interactive: false })
    const sync = () => line.setLatLngs([ma.getLatLng(), mb.getLatLng()])
    ma.on('drag', sync)
    mb.on('drag', sync)
    ma.on('dragend', () => cb.current.onMove('a', { lat: ma.getLatLng().lat, lon: ma.getLatLng().lng }))
    mb.on('dragend', () => cb.current.onMove('b', { lat: mb.getLatLng().lat, lon: mb.getLatLng().lng }))
    map.on('click', (e: L.LeafletMouseEvent) => cb.current.onClick({ lat: e.latlng.lat, lon: ((((e.latlng.lng + 180) % 360) + 360) % 360) - 180 }))
    map.fitBounds(L.latLngBounds([ll(pa), ll(pb)]), { padding: [40, 40] })
    layers.current = { map, ma, mb, line, dot }
    return () => {
      map.remove()
      layers.current = null
    }
  }, [])

  useEffect(() => {
    const l = layers.current
    if (!l) return
    l.ma.setLatLng(ll(a))
    l.mb.setLatLng(ll(b))
    l.line.setLatLngs([ll(a), ll(b)])
  }, [a, b])

  useEffect(() => {
    const l = layers.current
    if (!l || fitKey === 0) return
    l.map.fitBounds(L.latLngBounds([ll(latest.current.a), ll(latest.current.b)]), { padding: [40, 40] })
  }, [fitKey])

  useEffect(() => {
    const l = layers.current
    if (!l) return
    if (hover) {
      l.dot.setLatLng(ll(hover))
      if (!l.map.hasLayer(l.dot)) l.dot.addTo(l.map)
    } else l.dot.remove()
  }, [hover])

  return <div ref={el} className="map" role="application" aria-label={label} />
}
