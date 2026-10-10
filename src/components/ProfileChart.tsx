import { useEffect, useRef, useState } from 'react'
import type { Analysis } from '../lib/profile'
import { distUnit, fromLen, lenUnit, toDist, toLen, type Unit } from '../lib/model'
import { niceTicks } from '../lib/ticks'
import type { T } from '../i18n'

interface Props {
  analysis: Analysis
  unit: Unit
  hover: number | null
  onHover: (i: number | null) => void
  t: T
}

const H = 380
const M = { l: 58, r: 16, t: 14, b: 36 }

export default function ProfileChart({ analysis, unit, hover, onHover, t }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(900)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(280, el.clientWidth)))
    ro.observe(el)
    setW(Math.max(280, el.clientWidth))
    return () => ro.disconnect()
  }, [])

  const { points, total } = analysis
  const pw = w - M.l - M.r
  const ph = H - M.t - M.b
  let lo = Infinity
  let hi = -Infinity
  for (const p of points) {
    lo = Math.min(lo, p.terrain, p.los - p.f1)
    hi = Math.max(hi, p.terrain, p.los + p.f1)
  }
  const pad = (hi - lo) * 0.06 || 5
  lo = Math.min(lo - pad, points[0].ground - pad)
  hi += pad
  const x = (d: number) => M.l + (total > 0 ? (d / total) * pw : 0)
  const y = (z: number) => M.t + ph - ((z - lo) / (hi - lo)) * ph
  const f = (n: number) => n.toFixed(1)
  const line = (fn: (p: (typeof points)[number]) => number) => points.map((p, i) => `${i ? 'L' : 'M'}${f(x(p.d))} ${f(y(fn(p)))}`).join('')
  const rev = (fn: (p: (typeof points)[number]) => number) => [...points].reverse().map((p) => `L${f(x(p.d))} ${f(y(fn(p)))}`).join('')

  const yTicks = niceTicks(toLen(lo, unit), toLen(hi, unit), 6).map((v) => fromLen(v, unit))
  const xTicks = niceTicks(0, toDist(total, unit), Math.max(3, Math.floor(pw / 90))).map((v) => (unit === 'metric' ? v * 1000 : v * 1609.344))

  // Colour the terrain where the path is blocked (red) or inside 60% of the first zone (amber).
  const seg: { d: string; cls: string }[] = []
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    const q = points[i - 1]
    const c = Math.min(p.clearance, q.clearance)
    const pct = Math.min(Number.isNaN(p.clearancePct) ? Infinity : p.clearancePct, Number.isNaN(q.clearancePct) ? Infinity : q.clearancePct)
    const cls = c < 0 ? 'seg-block' : pct < 0.6 ? 'seg-warn' : ''
    if (cls) seg.push({ d: `M${f(x(q.d))} ${f(y(q.terrain))}L${f(x(p.d))} ${f(y(p.terrain))}`, cls })
  }

  const hp = hover !== null ? points[hover] : null
  const first = points[0]
  const last = points[points.length - 1]
  const lu = t(lenUnit(unit))
  const du = t(distUnit(unit))

  const pick = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const d = ((e.clientX - r.left) / r.width) * total
    let best = 0
    let bd = Infinity
    points.forEach((p, i) => {
      const dd = Math.abs(p.d - d)
      if (dd < bd) {
        bd = dd
        best = i
      }
    })
    onHover(best)
  }

  return (
    <div ref={box} className="chart">
      <svg width={w} height={H} role="img" aria-label={t('Terrain profile with line of sight and first Fresnel zone')}>
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={M.l} x2={M.l + pw} y1={y(v)} y2={y(v)} className="gridline" />
            <text x={M.l - 6} y={y(v) + 4} textAnchor="end" className="tick">{Math.round(toLen(v, unit))}</text>
          </g>
        ))}
        {xTicks.map((v) => (
          <g key={`x${v}`}>
            <line x1={x(v)} x2={x(v)} y1={M.t} y2={M.t + ph} className="gridline" />
            <text x={x(v)} y={H - M.b + 16} textAnchor="middle" className="tick">{+toDist(v, unit).toFixed(2)}</text>
          </g>
        ))}
        <text x={M.l + pw / 2} y={H - 4} textAnchor="middle" className="tick">{t('Distance ({0})', du)}</text>
        <text transform={`translate(12 ${M.t + ph / 2}) rotate(-90)`} textAnchor="middle" className="tick">{t('Elevation ({0})', lu)}</text>

        <path d={`${line((p) => p.los + p.f1)}${rev((p) => p.los - p.f1)}Z`} className="fz-fill" />
        <path d={`${line((p) => p.los + 0.6 * p.f1)}${rev((p) => p.los - 0.6 * p.f1)}Z`} className="fz60" />
        <path d={`${line((p) => p.terrain)}L${f(x(total))} ${f(M.t + ph)}L${f(x(0))} ${f(M.t + ph)}Z`} className="terrain-fill" />
        <path d={line((p) => p.terrain)} className="terrain-line" />
        {seg.map((s, i) => <path key={i} d={s.d} className={s.cls} />)}
        <path d={line((p) => p.los)} className="los-line" />

        <line x1={x(0)} x2={x(0)} y1={y(first.terrain)} y2={y(first.los)} className="mast" />
        <line x1={x(total)} x2={x(total)} y1={y(last.terrain)} y2={y(last.los)} className="mast" />
        <text x={x(0) + 4} y={y(first.los) - 6} className="endlabel">A</text>
        <text x={x(total) - 4} y={y(last.los) - 6} textAnchor="end" className="endlabel">B</text>

        {hp && (
          <g>
            <line x1={x(hp.d)} x2={x(hp.d)} y1={M.t} y2={M.t + ph} className="cursor" />
            <circle cx={x(hp.d)} cy={y(hp.terrain)} r={4} className="cursor-dot" />
          </g>
        )}
        <rect x={M.l} y={M.t} width={pw} height={ph} fill="transparent" onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => onHover(null)} style={{ touchAction: 'pan-y' }} />
      </svg>
      <div className="legend">
        <span><i className="sw sw-los" />{t('Line of sight')}</span>
        <span><i className="sw sw-fz" />{t('1st Fresnel zone')}</span>
        <span><i className="sw sw-60" />{t('60% of zone')}</span>
        <span><i className="sw sw-terrain" />{t('Terrain + earth curvature')}</span>
        <span><i className="sw sw-warn" />{t('Inside 60% zone')}</span>
        <span><i className="sw sw-block" />{t('Blocked')}</span>
      </div>
    </div>
  )
}
