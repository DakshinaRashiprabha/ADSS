import { useEffect, useState } from 'react'
import { api } from '../api'
import { StatTile, HBarChart, ColumnChart, PieChart } from '../components/charts'

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token'))

  const login = (t) => {
    localStorage.setItem('admin_token', t)
    setToken(t)
  }
  const logout = () => {
    localStorage.removeItem('admin_token')
    setToken(null)
  }

  if (!token) return <AdminLogin onLogin={login} />
  return <AdminDashboard onLogout={logout} />
}

function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await api.adminLogin(username, password)
      onLogin(r.token)
    } catch {
      setError('Invalid username or password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h3>Admin login</h3>
        <p className="section-sub" style={{ marginBottom: 16 }}>
          Sign in to access the admin dashboard.
        </p>
        <form className="support-form" onSubmit={submit}>
          <label>
            Username
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus autoComplete="username" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          <div>
            <button type="submit" className="nav-btn primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
        {error && <div className="error-box">{error}</div>}
      </div>
    </div>
  )
}

function AdminDashboard({ onLogout }) {
  const [tab, setTab] = useState('analytics')
  const [data, setData] = useState(null)
  const [support, setSupport] = useState([])
  const [error, setError] = useState(null)

  const guard = (e) => {
    // Session token expired or server restarted -> back to login
    if (String(e.message).includes('401')) onLogout()
    else setError(e.message)
  }

  const load = () => api.adminSummary().then(setData).catch(guard)
  const loadSupport = () => api.adminSupport().then(setSupport).catch(guard)
  useEffect(() => {
    load()
    loadSupport()
  }, [])

  const setStatus = async (id, status) => {
    try {
      await api.adminSupportStatus(id, status)
      await loadSupport()
    } catch (e) {
      guard(e)
    }
  }

  const pendingCount = support.filter((r) => r.status === 'pending').length

  return (
    <>
      <h2 className="section-title">Admin Dashboard</h2>
      <p className="section-sub">Dataset health, ingestion pipeline, model status, and support requests.</p>

      <div className="tab-row" style={{ alignItems: 'center' }}>
        <button className={`tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>
          Analytics
        </button>
        <button className={`tab ${tab === 'support' ? 'active' : ''}`} onClick={() => setTab('support')}>
          Support
          {pendingCount > 0 && <span className="tab-count">{pendingCount} pending</span>}
        </button>
        <button className="nav-btn" style={{ marginLeft: 'auto' }} onClick={onLogout}>
          Log out
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {tab === 'analytics' ? (
        <AnalyticsTab data={data} reload={load} onError={guard} />
      ) : (
        <SupportTab support={support} onStatus={setStatus} />
      )}
    </>
  )
}

function AnalyticsTab({ data, reload, onError }) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const runIngest = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const r = await api.adminIngest()
      setNotice(`Ingestion (${r.source}): ${r.rows_seen} rows seen, ${r.rows_inserted} new, ${r.rows_skipped} already present.`)
      await reload()
    } catch (e) {
      onError(e)
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
      await reload()
    } catch (e) {
      onError(e)
    } finally {
      setBusy(false)
    }
  }

  if (!data) return <div className="loading">Loading admin dashboard…</div>

  const { dataset, model, ingest_logs, sheet_sync } = data

  return (
    <>
      <div className="pill-row">
        <button className="nav-btn" onClick={runIngest} disabled={busy}>
          {busy ? 'Working…' : 'Sync data now'}
        </button>
        <button className="nav-btn" onClick={retrain} disabled={busy}>
          Retrain model
        </button>
      </div>
      {notice && <div className="finding">{notice}</div>}

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

function SupportTab({ support, onStatus }) {
  const [selectedId, setSelectedId] = useState(null)
  const selected = selectedId != null ? support.find((r) => r.id === selectedId) : null

  if (selected) {
    return <SupportDetail request={selected} onBack={() => setSelectedId(null)} onStatus={onStatus} />
  }

  return (
    <div className="card wide" style={{ marginTop: 20 }}>
      <h3>Support requests</h3>
      <p className="section-sub" style={{ margin: '4px 0 12px' }}>
        Submitted from the Comments tab. Click a request to view its full details.
        Approved requests are shown publicly under "Support required".
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>Name</th>
              <th>Requirements</th>
              <th>Proof</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {support.map((r) => (
              <tr key={r.id} className="row-click" onClick={() => setSelectedId(r.id)}>
                <td>{r.created_at.replace('T', ' ').slice(0, 16)}</td>
                <td>{r.name}</td>
                <td style={{ maxWidth: 380 }}>
                  {r.description.length > 90 ? `${r.description.slice(0, 90)}…` : r.description}
                </td>
                <td>{r.has_document ? '📎' : '—'}</td>
                <td><span className={`status-badge ${r.status}`}>{r.status}</span></td>
              </tr>
            ))}
            {support.length === 0 && (
              <tr><td colSpan={5}>No support requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SupportDetail({ request: r, onBack, onStatus }) {
  const isImage = /\.(png|jpe?g|gif|webp|bmp)$/i.test(r.document_name ?? '')

  return (
    <div className="card wide" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="nav-btn" onClick={onBack}>← Back to requests</button>
        <span className={`status-badge ${r.status}`}>{r.status}</span>
      </div>

      <h3 style={{ fontSize: 18, color: 'var(--text-primary)' }}>{r.name}</h3>
      <table className="data" style={{ maxWidth: 640, marginTop: 12 }}>
        <tbody>
          <tr><td>Submitted</td><td>{r.created_at.replace('T', ' ').slice(0, 19)}</td></tr>
          <tr><td>Contact number</td><td>{r.contact_no}</td></tr>
          <tr><td>Address</td><td>{r.address}</td></tr>
        </tbody>
      </table>

      <h3 style={{ marginTop: 20 }}>Requirements</h3>
      <p style={{ whiteSpace: 'pre-wrap', maxWidth: 720 }}>{r.description}</p>

      <h3 style={{ marginTop: 20 }}>Proof document</h3>
      {r.has_document ? (
        <>
          <p>
            <a href={`/api/support/${r.id}/document`} target="_blank" rel="noreferrer">
              Open {r.document_name}
            </a>
          </p>
          {isImage && (
            <img
              src={`/api/support/${r.id}/document`}
              alt={`Proof from ${r.name}`}
              style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 8, border: '1px solid var(--border)', marginTop: 8 }}
            />
          )}
        </>
      ) : (
        <p className="section-sub">No document attached.</p>
      )}

      <div className="pill-row" style={{ marginTop: 24 }}>
        {r.status !== 'approved' && (
          <button className="nav-btn primary" onClick={() => onStatus(r.id, 'approved')}>
            Approve — publish under "Support required"
          </button>
        )}
        {r.status !== 'rejected' && (
          <button className="nav-btn" onClick={() => onStatus(r.id, 'rejected')}>Reject</button>
        )}
        {r.status !== 'pending' && (
          <button className="nav-btn" onClick={() => onStatus(r.id, 'pending')}>Reset to pending</button>
        )}
      </div>
    </div>
  )
}
