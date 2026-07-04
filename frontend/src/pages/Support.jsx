import { useEffect, useState } from 'react'
import { api } from '../api'

const EMPTY = { name: '', contact_no: '', address: '', description: '' }

export default function Support() {
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(0) // remounts the file input to clear it
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const [approved, setApproved] = useState(null)

  const loadApproved = () => api.supportApproved().then(setApproved).catch(() => setApproved([]))
  useEffect(() => { loadApproved() }, [])

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (file) fd.append('document', file)
      await api.supportSubmit(fd)
      setForm(EMPTY)
      setFile(null)
      setFileKey((k) => k + 1)
      setNotice('Thank you — your request has been submitted and is awaiting admin review.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h2 className="section-title">Comments & Support Requests</h2>
      <p className="section-sub">
        Describe what you or your community need — equipment, connectivity, learning resources, facilities.
        Requests are reviewed by an administrator; approved requests appear publicly below.
      </p>

      <div className="card wide">
        <h3>Submit a request</h3>
        <form className="support-form" onSubmit={submit}>
          <label>
            Name
            <input type="text" value={form.name} onChange={set('name')} required maxLength={128} placeholder="Your full name" />
          </label>
          <label>
            Contact number
            <input type="tel" value={form.contact_no} onChange={set('contact_no')} required maxLength={32} placeholder="07X XXX XXXX" />
          </label>
          <label>
            Address
            <input type="text" value={form.address} onChange={set('address')} required maxLength={256} placeholder="Village / town, district" />
          </label>
          <label>
            Describe the requirements
            <textarea value={form.description} onChange={set('description')} required rows={5} placeholder="What support is needed, for whom, and why" />
          </label>
          <label>
            Supporting document (optional — image, PDF, etc., max 10 MB)
            <input key={fileKey} type="file" onChange={(e) => setFile(e.target.files[0] ?? null)} />
          </label>
          <div>
            <button type="submit" className="nav-btn primary" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
        {notice && <div className="finding" style={{ marginTop: 12 }}>{notice}</div>}
        {error && <div className="error-box">{error}</div>}
      </div>

      <h2 className="section-title">Support required</h2>
      <p className="section-sub">Requests reviewed and approved by the administrators.</p>
      {approved === null && <div className="loading">Loading…</div>}
      {approved !== null && approved.length === 0 && (
        <p className="section-sub">No approved requests yet.</p>
      )}
      <div className="grid">
        {(approved ?? []).map((r) => (
          <div className="card wide rec-card" key={r.id}>
            <span className="rec-badge medium">Support</span>
            <div className="rec-body">
              <h4>{r.name}</h4>
              <p>{r.description}</p>
              <div className="support-meta">
                <span>📍 {r.address}</span>
                <span>📞 {r.contact_no}</span>
              </div>
              <div className="rec-evidence">
                Submitted {r.created_at.replace('T', ' ').slice(0, 16)}
                {r.has_document && (
                  <>
                    {' · '}
                    <a href={`/api/support/${r.id}/document`} target="_blank" rel="noreferrer">
                      View proof ({r.document_name})
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
