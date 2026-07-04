import { useEffect, useState } from 'react'
import { api } from '../api'
import DistrictMap from '../components/DistrictMap'
import { StatTile, HBarChart } from '../components/charts'

export default function MapPage() {
  const [stats, setStats] = useState(null)
  const [selected, setSelected] = useState('Ampara')
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.districts().then(setStats).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!selected) return
    api.overview(selected).then(setProfile).catch((e) => setError(e.message))
  }, [selected])

  if (error) return <div className="error-box">{error}</div>
  if (!stats) return <div className="loading">Loading map…</div>

  const sel = stats.find((s) => s.district === selected)

  return (
    <>
      <h2 className="section-title">Response coverage by district</h2>
      <p className="section-sub">
        Survey reach across Sri Lanka's 25 districts, with Ampara — the focus district of this study — highlighted.
        The stronger the blue, the more responses a district contributed.
      </p>

      <div className="card wide">
        <DistrictMap stats={stats} selected={selected} onSelect={setSelected} />
      </div>

      {selected && (
        <>
          <h2 className="section-title">{selected} district profile</h2>
          <div className="grid">
            <div className="card">
              <h3>Responses from {selected}</h3>
              <StatTile
                value={sel?.count ?? 0}
                caption={profile ? `of ${stats.reduce((a, s) => a + s.count, 0)} total responses` : ''}
              />
            </div>
            <div className="card">
              <h3>Average aptitude score</h3>
              <StatTile value={sel?.average_score ?? '—'} caption="out of 5, this district only" />
            </div>
            <div className="card">
              <h3>Qualification mix in {selected}</h3>
              {profile ? (
                <HBarChart
                  data={profile.levels
                    .filter((l) => l.count > 0)
                    .map((l) => ({ label: l.education_level, count: l.count, percentage: l.percentage }))}
                  colors="entity"
                />
              ) : (
                <div className="stat-caption">Loading…</div>
              )}
            </div>
          </div>
          {(sel?.count ?? 0) < 10 && (
            <p className="section-sub" style={{ marginTop: 12 }}>
              Note: {selected} currently has {sel?.count ?? 0} responses — district-level figures with small samples
              are indicative, not statistically robust. Collect more responses to firm them up.
            </p>
          )}
        </>
      )}
    </>
  )
}
