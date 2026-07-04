import { useEffect, useState } from 'react'
import { api } from '../api'
import { StatTile, HBarChart, ColumnChart, PieChart } from '../components/charts'

export default function Admin() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const load = () => api.adminSummary().then(setData).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  const runIngest = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const r = await api.adminIngest()
      setNotice(`Ingestion (${r.source}): ${r.rows_seen} rows seen, ${r.rows_inserted} new, ${r.rows_skipped} already present.`)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const retrain = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const m = await api.adminRetrain()
      setNotice(`Model retrained on ${m.n_samples} samples — CV accuracy ${Math.round((m.cv_accuracy ?? 0) * 100)}%.`)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (error && !data) return <div className="error-box">{error}</div>
  if (!data) return <div className="loading">Loading admin dashboard…</div>

  const { dataset, model, ingest_logs, sheet_sync } = data

  return (
    <>
      <h2 className="section-title">Admin Dashboard</h2>
      <p className="section-sub">Dataset health, ingestion pipeline, and model status.</p>

      <div className="pill-row">
        <button className="nav-btn" onClick={runIngest} disabled={busy}>
          {busy ? 'Working…' : 'Sync data now'}
        </button>
        <button className="nav-btn" onClick={retrain} disabled={busy}>
          Retrain model
        </button>
      </div>
      {notice && <div className="finding">{notice}</div>}
      {error && <div className="error-box">{error}</div>}

      <div className="grid">
        <div className="card">
          <h3>Total responses</h3>
          <StatTile value={dataset.total_responses} caption={`avg age ${dataset.average_age}`} />
        </div>
        <div className="card">
          <h3>Average aptitude score</h3>
          <StatTile value={dataset.average_score} caption="out of 5" />
        </div>
        <div className="card">
          <h3>Google Sheet sync</h3>
          <StatTile
            value={sheet_sync.configured ? 'On' : 'Off'}
            caption={
              sheet_sync.configured
                ? `every ${sheet_sync.interval_minutes} min`
                : 'not configured — using local CSV source'
            }
          />
        </div>

        <div className="card">
          <h3>Score distribution</h3>
          <ColumnChart data={dataset.score_distribution} colors="ramp" />
        </div>
        <div className="card">
          <h3>Education levels</h3>
          <HBarChart data={dataset.education_levels} colors="entity" />
        </div>
        <div className="card">
          <h3>Gender</h3>
          <PieChart data={dataset.gender} />
        </div>
        <div className="card">
          <h3>Current status</h3>
          <HBarChart data={dataset.current_status} />
        </div>
        <div className="card">
          <h3>Districts</h3>
          <HBarChart data={dataset.districts.slice(0, 10)} />
        </div>

        {model && !model.error && (
          <div className="card">
            <h3>Model</h3>
            <table className="data">
              <tbody>
                <tr><td>Algorithm</td><td>{model.algorithm}</td></tr>
                <tr><td>Target</td><td>{model.target}</td></tr>
                <tr><td>Samples</td><td>{model.n_samples}</td></tr>
                <tr><td>CV accuracy</td><td>{model.cv_accuracy != null ? `${Math.round(model.cv_accuracy * 100)}%` : '—'}</td></tr>
                <tr><td>Baseline</td><td>{model.baseline_accuracy != null ? `${Math.round(model.baseline_accuracy * 100)}%` : '—'}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="card wide">
          <h3>Ingestion history</h3>
          <table className="data">
            <thead>
              <tr>
                <th>When (UTC)</th>
                <th>Source</th>
                <th>Rows seen</th>
                <th>Inserted</th>
                <th>Skipped (duplicates)</th>
              </tr>
            </thead>
            <tbody>
              {ingest_logs.map((l, i) => (
                <tr key={i}>
                  <td>{l.ran_at.replace('T', ' ').slice(0, 19)}</td>
                  <td>{l.source}</td>
                  <td>{l.rows_seen}</td>
                  <td>{l.rows_inserted}</td>
                  <td>{l.rows_skipped}</td>
                </tr>
              ))}
              {ingest_logs.length === 0 && (
                <tr><td colSpan={5}>No ingestion runs yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
