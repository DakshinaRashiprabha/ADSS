import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { StatTile, HBarChart, RatingChart, ColumnChart, PieChart, LEVEL_COLORS } from '../components/charts'

// The 14-point analysis, in the exact order required by the specification.
const SECTIONS = [
  { key: 'percentage', no: 1, title: 'Percentage of dataset' },
  { key: 'gender', no: 2, title: 'Gender demographics' },
  { key: 'english_proficiency', no: 3, title: 'English proficiency' },
  { key: 'parents_education', no: 4, title: "Parents' education" },
  { key: 'study_space', no: 5, title: 'Study environment (quiet space at home)' },
  { key: 'income', no: 6, title: 'Monthly household income' },
  { key: 'primary_device', no: 7, title: 'Primary learning device' },
  { key: 'internet_quality', no: 8, title: 'Internet quality' },
  { key: 'study_hours', no: 9, title: 'Daily study hours (online)' },
  { key: 'software_literacy', no: 10, title: 'Software literacy' },
  { key: 'library_distance', no: 11, title: 'Library accessibility (distance)' },
  { key: 'external_resources', no: 12, title: 'External resources (paid platforms / tuition)' },
  { key: 'extracurricular', no: 13, title: 'Extracurricular engagement' },
  { key: 'performance_score', no: 14, title: 'Performance score (aptitude, out of 5)' },
]

const FEATURES = [
  {
    to: '/admin',
    icon: '📊',
    title: 'Admin Dashboard',
    text: 'Dataset health, ingestion pipeline, ML model metrics, and data sync controls.',
  },
  {
    to: '/try-questions',
    icon: '🧠',
    title: 'Try Questions',
    text: 'Answer the same five aptitude questions as respondents and see your percentile.',
  },
  {
    to: '/needs',
    icon: '🎯',
    title: 'Needs & Requirements',
    text: 'Resource gaps per qualification group — what each group needs most.',
  },
  {
    to: '/map',
    icon: '🗺️',
    title: 'District Map',
    text: 'Survey coverage across Sri Lanka, with the Ampara focus district highlighted.',
  },
]

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
  const [searchParams, setSearchParams] = useSearchParams()
  const [overview, setOverview] = useState(null)
  const [districtCount, setDistrictCount] = useState(null)
  const level = searchParams.get('level')
  const setLevel = (l) => setSearchParams({ level: l })
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const analysisRef = useRef(null)

  useEffect(() => {
    api.overview().then(setOverview).catch((e) => setError(e.message))
    api.districts().then((d) => setDistrictCount(d.length)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!level) return
    setLoading(true)
    api
      .analysis(level)
      .then((a) => {
        setAnalysis(a)
        setError(null)
        setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [level])

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

      <div className="feature-grid">
        {FEATURES.map((f, i) => (
          <Link to={f.to} className="feature-card rise" style={{ '--d': `${120 + i * 90}ms` }} key={f.to}>
            <div className="icon">{f.icon}</div>
            <h4>{f.title}</h4>
            <p>{f.text}</p>
            <span className="go">Open →</span>
          </Link>
        ))}
      </div>

      <h2 className="section-title rise" style={{ '--d': '360ms' }}>
        Explore by educational qualification
      </h2>
      <p className="section-sub rise" style={{ '--d': '400ms' }}>
        Select a group to load its full 14-point analysis and group-specific decisions.
      </p>

      <div className="qual-grid">
        {(overview?.levels ?? []).map((l, i) => (
          <button
            key={l.education_level}
            className={`qual-card rise ${level === l.education_level ? 'active' : ''}`}
            style={{ '--d': `${420 + i * 70}ms`, '--qc': LEVEL_COLORS[l.education_level] }}
            onClick={() => setLevel(l.education_level)}
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
          </button>
        ))}
      </div>

      {error && <div className="error-box">{error}</div>}
      {loading && !analysis && <div className="loading">Loading analysis…</div>}

      <div ref={analysisRef}>
        {analysis && (
          <div style={{ opacity: loading ? 0.5 : 1 }}>
            <h2 className="section-title">
              <span className="section-level-dot" style={{ background: LEVEL_COLORS[analysis.education_level] }} />
              {analysis.education_level}
            </h2>
            <p className="section-sub">
              {analysis.group_size} of {analysis.dataset_size} respondents
            </p>
            <div className="grid">
              {SECTIONS.map((s) => (
                <SectionCard key={s.key} section={s} data={analysis.sections[s.key]} />
              ))}
            </div>

            <div className="decisions-cta">
              <Link to={`/decisions?level=${encodeURIComponent(analysis.education_level)}`} className="nav-btn primary">
                Decisions for {analysis.education_level} →
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function SectionCard({ section, data }) {
  return (
    <div className={`card ${section.key === 'performance_score' ? 'wide' : ''}`}>
      <h3>
        <span className="order-no">{section.no}.</span>
        {section.title}
      </h3>
      <SectionBody sectionKey={section.key} data={data} />
    </div>
  )
}

function SectionBody({ sectionKey, data }) {
  if (!data) return <div className="stat-caption">No data.</div>

  switch (sectionKey) {
    case 'percentage':
      return (
        <StatTile
          value={`${data.value}%`}
          caption={`${data.count} of ${data.total} respondents hold this qualification`}
        />
      )
    // part-to-whole identity splits -> pie (each entity keeps its fixed color)
    case 'gender':
    case 'study_space':
    case 'primary_device':
      return <PieChart data={data} />
    // ordered categories -> light->dark ramp (color encodes the level)
    case 'parents_education':
    case 'income':
    case 'study_hours':
    case 'library_distance':
    case 'external_resources':
    case 'extracurricular':
      return <HBarChart data={data} colors="ramp" />
    case 'english_proficiency':
    case 'internet_quality':
    case 'software_literacy':
      return <RatingChart summary={data} unit="self-rated 1–5" />
    case 'performance_score': {
      const diff = data.average != null && data.overall_average != null
        ? +(data.average - data.overall_average).toFixed(2)
        : null
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
          <StatTile
            value={data.average ?? '—'}
            caption={`group average score out of 5 · ${data.high_performers_pct}% scored 4+`}
            delta={
              diff == null
                ? null
                : `${diff >= 0 ? '+' : ''}${diff} vs overall average (${data.overall_average})`
            }
            deltaGood={diff != null && diff >= 0}
          />
          <ColumnChart data={data.distribution} colors="ramp" />
        </div>
      )
    }
    default:
      return <HBarChart data={data} />
  }
}
