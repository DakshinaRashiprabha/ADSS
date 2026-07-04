/* Lightweight chart components following the dataviz mark specs:
   thin marks (<=24px), 4px rounded data-ends, hairline baselines,
   2px surface gaps between pie segments, text in ink tokens,
   tooltips via title, legend for every multi-color chart.

   Color rules:
   - Nominal categories (gender, device, yes/no) -> fixed categorical slots,
     assigned per entity and reused consistently across the whole app.
   - Ordered categories (income, hours, distance, ratings) -> one-hue
     sequential ramp, light = low, dark = high.
*/

// Each qualification level's signature color — a heat->cool progression that
// reads as educational advancement. Validated for CVD in both modes.
export const LEVEL_COLORS = {
  'Below G.C.E. O/L': 'var(--series-6)', // red
  'G.C.E. O/L': 'var(--series-8)', // orange
  'G.C.E. A/L': 'var(--series-3)', // yellow
  'Diploma / NVQ': 'var(--series-2)', // teal
  "Bachelor's Degree": 'var(--series-1)', // blue
  'Postgraduate (Masters/PhD)': 'var(--series-7)', // magenta
}

// Fixed entity -> color assignments (color follows the entity, never its rank)
const ENTITY_COLORS = {
  'Female': 'var(--series-5)',
  'Male': 'var(--series-2)',
  'Yes': 'var(--series-4)',
  'No': 'var(--series-6)',
  'Smartphone': 'var(--series-3)',
  'Laptop / Desktop': 'var(--series-1)',
  'None': 'var(--text-muted)',
  ...LEVEL_COLORS,
}

const RAMP = ['var(--seq-150)', 'var(--seq-250)', 'var(--seq-350)', 'var(--seq-450)', 'var(--seq-550)', 'var(--seq-650)']

export function entityColor(label, i) {
  return ENTITY_COLORS[label] ?? `var(--series-${(i % 6) + 1})`
}

// n colors from the light->dark ramp, spread across its range
export function rampColors(n) {
  if (n <= 1) return ['var(--seq-450)']
  return Array.from({ length: n }, (_, i) => RAMP[Math.round((i * (RAMP.length - 1)) / (n - 1))])
}

export function StatTile({ value, caption, delta, deltaGood }) {
  return (
    <div>
      <div className="stat-value">{value}</div>
      {caption && <div className="stat-caption">{caption}</div>}
      {delta && <div className={`stat-delta ${deltaGood ? 'up' : 'down'}`}>{delta}</div>}
    </div>
  )
}

/* colors: 'entity' | 'ramp' | undefined (single-hue blue) */
export function HBarChart({ data, colors }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  const ramp = colors === 'ramp' ? rampColors(data.length) : null
  return (
    <div>
      {data.map((d, i) => (
        <div className="hbar-row" key={d.label} title={`${d.label}: ${d.count} respondents (${d.percentage}%)`}>
          <span className="hbar-label">{d.label}</span>
          <div className="hbar-track">
            <div
              className="hbar-fill"
              style={{
                width: `${(d.count / max) * 100}%`,
                background: colors === 'entity' ? entityColor(d.label, i) : ramp ? ramp[i] : undefined,
              }}
            />
          </div>
          <span className="hbar-value">{d.percentage}%</span>
        </div>
      ))}
      {data.length === 0 && <div className="stat-caption">No data for this group.</div>}
    </div>
  )
}

export function ColumnChart({ data, colors }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  const ramp = colors === 'ramp' ? rampColors(data.length) : null
  return (
    <div>
      <div className="colchart">
        {data.map((d, i) => (
          <div className="col" key={d.label} title={`${d.label}: ${d.count} (${d.percentage}%)`}>
            {d.count > 0 && <span className="col-value">{d.count}</span>}
            <div
              className="col-fill"
              style={{ height: `${(d.count / max) * 100}%`, background: ramp ? ramp[i] : undefined }}
            />
          </div>
        ))}
      </div>
      <div className="colchart-labels">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

export function RatingChart({ summary, unit }) {
  if (!summary) return null
  return (
    <div>
      <div className="avg-line">
        Average: <strong>{summary.average ?? '—'}</strong> / 5 {unit && <span>({unit})</span>}
      </div>
      <ColumnChart data={summary.distribution} colors="ramp" />
    </div>
  )
}

/* Donut pie: part-to-whole for <=6 nominal categories.
   2px surface-color gap between segments; legend carries identity + values
   (identity is never color-alone). */
export function PieChart({ data }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (!total) return <div className="stat-caption">No data for this group.</div>

  const R = 56
  const STROKE = 26
  const C = 2 * Math.PI * R
  let offset = 0
  const segments = data
    .filter((d) => d.count > 0)
    .map((d, i) => {
      const frac = d.count / total
      const seg = { ...d, frac, dash: frac * C, offset, color: entityColor(d.label, i) }
      offset += frac * C
      return seg
    })

  return (
    <div className="pie-wrap">
      <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label="Distribution donut chart">
        <g transform="translate(75,75) rotate(-90)">
          {segments.map((s) => (
            <circle
              key={s.label}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={`${Math.max(s.dash - 2, 0.5)} ${C - Math.max(s.dash - 2, 0.5)}`}
              strokeDashoffset={-s.offset}
            >
              <title>{`${s.label}: ${s.count} (${s.percentage}%)`}</title>
            </circle>
          ))}
        </g>
      </svg>
      <div className="pie-legend">
        {segments.map((s) => (
          <div className="pie-legend-row" key={s.label}>
            <span className="pie-swatch" style={{ background: s.color }} />
            <span className="pct">{s.percentage}%</span>
            <span className="lbl">
              {s.label} ({s.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
