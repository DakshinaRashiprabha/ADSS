/* Sri Lanka district choropleth (choropleth = sequential single-hue ramp;
   the lightest step recedes toward the surface = fewest responses).
   Built from geoBoundaries LKA ADM2 (ODbL) — self-contained SVG, no map library. */

import { useMemo, useState } from 'react'
import geo from '../assets/lk_districts.geojson?raw'

const FOCUS_DISTRICT = 'Ampara'

// 5-step sequential ramp (light -> dark) + zero state
const STEPS = ['var(--seq-150)', 'var(--seq-250)', 'var(--seq-350)', 'var(--seq-450)', 'var(--seq-650)']
const ZERO_FILL = 'var(--grid)'

const W = 420
const H = 640
const PAD = 14

function districtName(feature) {
  return feature.properties.shapeName.replace(/ District$/, '')
}

function useProjected() {
  return useMemo(() => {
    const gj = JSON.parse(geo)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    const eachRing = (feature, fn) => {
      const g = feature.geometry
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
      polys.forEach((poly) => poly.forEach(fn))
    }
    gj.features.forEach((f) =>
      eachRing(f, (ring) =>
        ring.forEach(([x, y]) => {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }),
      ),
    )
    const scale = Math.min((W - 2 * PAD) / (maxX - minX), (H - 2 * PAD) / (maxY - minY))
    const px = ([x, y]) => [PAD + (x - minX) * scale, H - PAD - (y - minY) * scale]

    return gj.features.map((f) => {
      let d = ''
      let cx = 0, cy = 0, n = 0
      eachRing(f, (ring) => {
        d += ring
          .map((pt, i) => {
            const [X, Y] = px(pt)
            if (i % 3 === 0 || i === ring.length - 1) {
              cx += X; cy += Y; n++
              return `${i === 0 ? 'M' : 'L'}${X.toFixed(1)},${Y.toFixed(1)}`
            }
            return ''
          })
          .join('')
        d += 'Z'
      })
      return { name: districtName(f), d, centroid: [cx / n, cy / n] }
    })
  }, [])
}

export default function DistrictMap({ stats, selected, onSelect }) {
  const shapes = useProjected()
  const [hover, setHover] = useState(null)

  const byName = Object.fromEntries((stats ?? []).map((s) => [s.district, s]))
  const maxCount = Math.max(...(stats ?? []).map((s) => s.count), 1)

  const fillFor = (name) => {
    const s = byName[name]
    if (!s || !s.count) return ZERO_FILL
    const idx = Math.min(STEPS.length - 1, Math.floor((s.count / maxCount) * STEPS.length))
    return STEPS[idx]
  }

  const focus = shapes.find((s) => s.name === FOCUS_DISTRICT)

  return (
    <div className="map-layout">
      <svg viewBox={`0 0 ${W} ${H}`} className="lk-map" role="img" aria-label="Survey responses by district of Sri Lanka">
        {shapes.map((s) => {
          const st = byName[s.name]
          return (
            <path
              key={s.name}
              d={s.d}
              className={`district ${selected === s.name ? 'selected' : ''} ${hover === s.name ? 'hovered' : ''}`}
              style={{ fill: fillFor(s.name) }}
              onMouseEnter={() => setHover(s.name)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(s.name)}
            >
              <title>{`${s.name}: ${st?.count ?? 0} responses${st?.average_score != null ? ` · avg score ${st.average_score}/5` : ''}`}</title>
            </path>
          )
        })}
        {focus && (
          <>
            <path d={focus.d} className="district-focus-ring" />
            <text x={focus.centroid[0]} y={focus.centroid[1] - 14} className="focus-label" textAnchor="middle">
              ★ Ampara
            </text>
          </>
        )}
      </svg>

      <div className="map-side">
        <div className="map-legend">
          <span className="legend-title">Responses</span>
          <span className="legend-chip" style={{ background: ZERO_FILL }} /> 0
          {STEPS.map((c, i) => (
            <span key={i} className="legend-step">
              <span className="legend-chip" style={{ background: c }} />
              {i === STEPS.length - 1 ? `≤${maxCount}` : ''}
            </span>
          ))}
        </div>
        <p className="map-hint">
          Hover a district for its numbers; click to see its profile. ★ Ampara is the focus district of this study.
        </p>
        <table className="data">
          <thead>
            <tr>
              <th>District</th>
              <th>Responses</th>
              <th>Avg score</th>
            </tr>
          </thead>
          <tbody>
            {(stats ?? []).map((s) => (
              <tr
                key={s.district}
                className={selected === s.district ? 'row-selected' : ''}
                onClick={() => onSelect?.(s.district)}
                style={{ cursor: 'pointer' }}
              >
                <td>{s.district === FOCUS_DISTRICT ? `★ ${s.district}` : s.district}</td>
                <td>{s.count}</td>
                <td>{s.average_score ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
