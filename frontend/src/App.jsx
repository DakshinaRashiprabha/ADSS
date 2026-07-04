import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'

function initialTheme() {
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('theme')
  if (fromUrl === 'light' || fromUrl === 'dark') return fromUrl
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <>
      <header className="site-header">
        <div className="container">
          <Link to="/" className="brand">
            Ampara DSS
            <small>Intellectual Inequality — Decision Support System</small>
          </Link>
          <Link to="/try-questions" className="nav-btn">Try Questions</Link>
          <Link to="/needs" className="nav-btn">Needs</Link>
          <Link to="/map" className="nav-btn">District Map</Link>
          <Link to="/admin" className="nav-btn primary">Admin Dashboard</Link>
          <button
            className="nav-btn theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
