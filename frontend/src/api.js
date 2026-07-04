function authHeaders() {
  const token = localStorage.getItem('admin_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function get(path) {
  const res = await fetch(path, { headers: authHeaders() })
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json()
}

export const api = {
  overview: (district) => get(`/api/overview${district ? `?district=${encodeURIComponent(district)}` : ''}`),
  analysis: (level, district) =>
    get(`/api/analysis?level=${encodeURIComponent(level)}${district ? `&district=${encodeURIComponent(district)}` : ''}`),
  decisions: () => get('/api/decisions'),
  groupDecisions: (level) => get(`/api/decisions/group?level=${encodeURIComponent(level)}`),
  needs: () => get('/api/needs'),
  districts: () => get('/api/districts'),
  adminSummary: () => get('/api/admin/summary'),
  adminIngest: () => post('/api/admin/ingest'),
  adminRetrain: () => post('/api/admin/retrain'),
  supportApproved: () => get('/api/support/approved'),
  supportSubmit: async (formData) => {
    const res = await fetch('/api/support', { method: 'POST', body: formData })
    if (!res.ok) throw new Error(`API /api/support failed: ${res.status}`)
    return res.json()
  },
  adminLogin: (username, password) => post('/api/admin/login', { username, password }),
  adminSupport: () => get('/api/admin/support'),
  adminSupportStatus: (id, status) => post(`/api/admin/support/${id}/status`, { status }),
}
