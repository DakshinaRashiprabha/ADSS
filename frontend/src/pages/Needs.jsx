import { useEffect, useState } from 'react'
import { api } from '../api'
import { HBarChart, LEVEL_COLORS } from '../components/charts'

export default function Needs() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.needs().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="error-box">{error}</div>
  if (!data) return <div className="loading">Loading needs analysis…</div>

  return (
    <>
      <h2 className="section-title">Needs &amp; Requirements</h2>
      <p className="section-sub">
        Resource gaps per qualification group — the share of each group affected by each barrier.
        This is what each group needs support with, ranked by severity.
      </p>

      <div className="grid">
        {data.groups
          .filter((g) => g.group_size > 0)
          .map((g) => (
            <div className="card wide" key={g.education_level}>
              <h3>
                <span className="section-level-dot" style={{ background: LEVEL_COLORS[g.education_level] }} />
                {g.education_level} <span className="order-no">— {g.group_size} respondents</span>
              </h3>
              <HBarChart
                data={g.needs.map((n) => ({
                  label: n.need,
                  count: n.affected_pct,
                  percentage: n.affected_pct,
                }))}
              />
            </div>
          ))}
      </div>
    </>
  )
}
