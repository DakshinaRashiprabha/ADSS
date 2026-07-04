async function get(path) {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  quizQuestions: () => get('/api/quiz/questions'),
  quizSubmit: (answers) => post('/api/quiz/submit', { answers }),
}
