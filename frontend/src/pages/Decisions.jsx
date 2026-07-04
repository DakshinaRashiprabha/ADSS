import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { StatTile, HBarChart } from '../components/charts'

export default function Decisions() {
  const [searchParams] = useSearchParams()
  const level = searchParams.get('level')
  const [data, setData] = useState(null)
  const [group, setGroup] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (level) return
    api.decisions().then(setData).catch((e) => setError(e.message))
  }, [level])

  useEffect(() => {
    if (!level) {
      setGroup(null)
      return
    }
    api.groupDecisions(level).then(setGroup).catch((e) => setError(e.message))
  }, [level])

  if (error) return <div className="error-box">{error}</div>

  // Group view: only this group's decisions — the overall analysis lives on the home page.
  if (level) {
    if (!group) return <div className="loading">Computing decisions…</div>
    return <GroupDecisions group={group} />
  }

  if (!data) return <div className="loading">Computing decisions…</div>

  const { summary, key_findings, score_gaps, model, recommendations } = data

  return (
    <>
      <h2 className="section-title">Decisions & Insights</h2>
      <p className="section-sub">
        Evidence-based findings and recommendations generated from the survey data and the trained model.
      </p>

      <div className="grid">
        <div className="card">
          <h3>Responses analyzed</h3>
          <StatTile value={summary.total_responses} caption="survey responses" />
        </div>
        <div className="card">
          <h3>Average aptitude score</h3>
          <StatTile value={summary.average_score} caption={`out of 5 · ${summary.high_performer_pct}% are high performers (4+)`} />
        </div>
        <div className="card">
          <h3>Score inequality (Gini)</h3>
          <StatTile value={summary.score_gini} caption="0 = perfect equality, 1 = maximal inequality" />
        </div>
      </div>

      <h2 className="section-title">Key findings</h2>
      <div style={{ marginTop: 12 }}>
        {key_findings.map((f, i) => (
          <div className="finding" key={i}>{f}</div>
        ))}
      </div>

      <h2 className="section-title">Performance gaps by factor</h2>
      <p className="section-sub">
        Average aptitude score per group. Larger gaps between a factor's best and worst groups indicate
        stronger inequality along that dimension.
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

      {model && !model.error && (
        <>
          <h2 className="section-title">What drives high performance? (ML model)</h2>
          <p className="section-sub">
            {model.algorithm} predicting {model.target?.toLowerCase()} — trained on {model.n_samples} responses,
            cross-validated accuracy {model.cv_accuracy != null ? `${Math.round(model.cv_accuracy * 100)}%` : '—'}
            {model.baseline_accuracy != null ? ` (baseline ${Math.round(model.baseline_accuracy * 100)}%)` : ''}.
          </p>
          <div className="card wide">
            <h3>Feature importance</h3>
            <HBarChart
              data={model.feature_importances.slice(0, 10).map((f) => ({
                label: f.label,
                count: f.importance,
                percentage: Math.round(f.importance * 1000) / 10,
              }))}
            />
          </div>
        </>
      )}

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

function GroupDecisions({ group }) {
  return (
    <>
      <h2 className="section-title">Decisions for {group.education_level}</h2>
      <p className="section-sub">
        Specific to the {group.group_size} respondents in this qualification group.
      </p>

      <div className="grid">
        <div className="card">
          <h3>Group average score</h3>
          <StatTile
            value={group.average_score ?? '—'}
            caption={`out of 5 · ${group.high_performer_pct}% high performers`}
            delta={
              group.average_score != null && group.overall_average != null
                ? `${group.average_score >= group.overall_average ? '+' : ''}${(group.average_score - group.overall_average).toFixed(2)} vs overall (${group.overall_average})`
                : null
            }
            deltaGood={group.average_score >= group.overall_average}
          />
        </div>
        <div className="card wide" style={{ gridColumn: 'auto / span 2' }}>
          <h3>Top barriers in this group</h3>
          <HBarChart
            data={group.top_barriers.map((b) => ({
              label: b.need,
              count: b.affected_pct,
              percentage: b.affected_pct,
            }))}
            colors="ramp"
          />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {group.key_findings.map((f, i) => (
          <div className="finding" key={i}>{f}</div>
        ))}
      </div>

      <div className="grid">
        {group.recommendations.map((r, i) => (
          <div className="card wide rec-card" key={i}>
            <span className={`rec-badge ${r.priority.toLowerCase()}`}>{r.priority}</span>
            <div className="rec-body">
              <h4>{r.recommendation}</h4>
              <p>
                Issue: {r.issue} — affects {r.affected_pct}% of this group.
              </p>
              <div className="rec-evidence">{r.evidence}</div>
            </div>
          </div>
        ))}
        {group.recommendations.length === 0 && (
          <p className="section-sub">
            No intervention thresholds crossed for this group — it is comparatively well-resourced.
          </p>
        )}
      </div>
    </>
  )
}
