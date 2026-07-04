import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { HBarChart, LEVEL_COLORS } from '../components/charts'

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!target) return
    let start
    let raf
    const tick = (t) => {
      if (start === undefined) start = t
      const p = Math.min((t - start) / duration, 1)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

export default function Home() {
  const [overview, setOverview] = useState(null)
  const [districtCount, setDistrictCount] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.overview().then(setOverview).catch((e) => setError(e.message))
    api.districts().then((d) => setDistrictCount(d.length)).catch(() => {})
  }, [])

  const total = useCountUp(overview?.total_responses)

  return (
    <>
      <section className="hero rise">
        <div className="hero-orb o1" />
        <div className="hero-orb o2" />
        <div className="hero-orb o3" />
        <div className="hero-inner">
          <h1>An Automated Decision Support System for Analyzing and Optimizing Intellectual Inequality</h1>
          <p>
            Survey-driven analysis of how socio-economic conditions shape aptitude performance —
            with data-backed decisions for every education level.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="num">{total || '—'}</div>
              <div className="cap">survey responses</div>
            </div>
            <div className="hero-stat">
              <div className="num">6</div>
              <div className="cap">qualification levels</div>
            </div>
            <div className="hero-stat">
              <div className="num">{districtCount ?? '—'}</div>
              <div className="cap">districts covered</div>
            </div>
          </div>
        </div>
      </section>

      <h2 className="section-title rise" style={{ '--d': '360ms' }}>
        Explore by educational qualification
      </h2>
      <p className="section-sub rise" style={{ '--d': '400ms' }}>
        Select a group to open its full 14-point analysis and group-specific decisions.
      </p>

      <div className="qual-grid">
        {(overview?.levels ?? []).map((l, i) => (
          <Link
            key={l.education_level}
            to={`/group?level=${encodeURIComponent(l.education_level)}`}
            className="qual-card rise"
            style={{ '--d': `${420 + i * 70}ms`, '--qc': LEVEL_COLORS[l.education_level] }}
          >
            <span className="view">→</span>
            <h4>
              <span className="level-dot" />
              {l.education_level}
            </h4>
            <div className="big">{l.count}</div>
            <div className="sub">{l.percentage}% of respondents</div>
            <div className="qual-meter">
              <div className="qual-meter-fill" style={{ width: `${l.percentage}%` }} />
            </div>
            <div className="score-line">
              Avg aptitude: <strong>{l.average_score ?? '—'}</strong> / 5
            </div>
          </Link>
        ))}
      </div>

      {error && <div className="error-box">{error}</div>}

      <OverallDecisions />
    </>
  )
}

function OverallDecisions() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.decisions().then(setData).catch(() => {})
  }, [])

  if (!data) return null
  const { score_gaps, recommendations } = data

  return (
    <>
      <h2 className="section-title">Performance gaps by factor</h2>
      <p className="section-sub">
        Across all groups: average aptitude score per group. Larger gaps between a factor's best and
        worst groups indicate stronger inequality along that dimension.
      </p>
      <div className="grid">
        {score_gaps.map((g) => (
          <div className="card" key={g.attribute}>
            <h3>
              {g.factor} <span className="order-no">— gap {g.gap} pts</span>
            </h3>
            <HBarChart
              data={g.groups.map((grp) => ({
                label: grp.label,
                count: grp.average_score,
                percentage: grp.average_score,
              }))}
            />
          </div>
        ))}
      </div>

      <h2 className="section-title">Recommendations</h2>
      <div className="grid">
        {recommendations.map((r, i) => (
          <div className="card wide rec-card" key={i}>
            <span className={`rec-badge ${r.priority.toLowerCase()}`}>{r.priority}</span>
            <div className="rec-body">
              <h4>{r.recommendation}</h4>
              <p>
                Issue: {r.issue} — affects ~{r.affected_pct}% of respondents (group-size weighted).
              </p>
              <div className="rec-evidence">{r.evidence}</div>
            </div>
          </div>
        ))}
        {recommendations.length === 0 && (
          <p className="section-sub">No thresholds crossed — no interventions recommended on current data.</p>
        )}
      </div>
    </>
  )
}
