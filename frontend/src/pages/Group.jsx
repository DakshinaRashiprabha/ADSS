import { useEffect, useState } from 'react'
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

export default function Group() {
  const [searchParams] = useSearchParams()
  const level = searchParams.get('level')
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!level) return
    setAnalysis(null)
    api
      .analysis(level)
      .then((a) => {
        setAnalysis(a)
        setError(null)
      })
      .catch((e) => setError(e.message))
    window.scrollTo({ top: 0 })
  }, [level])

  if (!level) return <div className="error-box">No qualification group selected.</div>
  if (error) return <div className="error-box">{error}</div>
  if (!analysis) return <div className="loading">Loading analysis…</div>

  return (
    <>
      <h2 className="section-title">
        <span className="section-level-dot" style={{ background: LEVEL_COLORS[analysis.education_level] }} />
        {analysis.education_level}
      </h2>
      <p className="section-sub">
        {analysis.group_size} of {analysis.dataset_size} respondents · <Link to="/">← all groups</Link>
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
