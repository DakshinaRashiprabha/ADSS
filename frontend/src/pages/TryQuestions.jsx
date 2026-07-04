import { useEffect, useState } from 'react'
import { api } from '../api'
import { StatTile } from '../components/charts'

export default function TryQuestions() {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.quizQuestions().then(setQuestions).catch((e) => setError(e.message))
  }, [])

  const submit = async () => {
    try {
      setResult(await api.quizSubmit(answers))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e.message)
    }
  }

  const resultFor = (qid) => result?.results.find((r) => r.id === qid)

  return (
    <>
      <h2 className="section-title">Try the Aptitude Questions</h2>
      <p className="section-sub">
        These are the same five reasoning questions answered by all survey respondents. See how you compare.
      </p>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className="grid" style={{ marginBottom: 24 }}>
          <div className="card">
            <h3>Your score</h3>
            <StatTile value={`${result.score} / ${result.out_of}`} caption="aptitude score" />
          </div>
          <div className="card">
            <h3>Dataset average</h3>
            <StatTile value={result.dataset_average} caption="average across all respondents" />
          </div>
          <div className="card">
            <h3>Your percentile</h3>
            <StatTile value={`${result.percentile}%`} caption="of respondents scored below you" />
          </div>
        </div>
      )}

      {questions.map((q, i) => {
        const r = resultFor(q.id)
        return (
          <div className="card quiz-q" key={q.id}>
            <h4>
              {i + 1}. {q.question}
            </h4>
            {q.options.map((opt) => {
              let cls = 'quiz-option'
              if (!result && answers[q.id] === opt) cls += ' selected'
              if (result) {
                if (opt === r?.correct_answer) cls += ' correct'
                else if (opt === r?.your_answer && !r?.correct) cls += ' wrong'
              }
              return (
                <label
                  key={opt}
                  className={cls}
                  onClick={() => !result && setAnswers({ ...answers, [q.id]: opt })}
                >
                  {opt}
                  {result && opt === r?.correct_answer && ' ✓'}
                  {result && opt === r?.your_answer && !r?.correct && ' ✗'}
                </label>
              )
            })}
          </div>
        )
      })}

      {!result && questions.length > 0 && (
        <button
          className="nav-btn primary"
          onClick={submit}
          disabled={Object.keys(answers).length < questions.length}
        >
          Submit answers
        </button>
      )}
      {result && (
        <button
          className="nav-btn"
          onClick={() => {
            setResult(null)
            setAnswers({})
          }}
        >
          Try again
        </button>
      )}
    </>
  )
}
