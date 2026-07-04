import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import Home from './pages/Home'
import Decisions from './pages/Decisions'
import Admin from './pages/Admin'
import TryQuestions from './pages/TryQuestions'
import Needs from './pages/Needs'
import MapPage from './pages/MapPage'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Home />} />
          <Route path="decisions" element={<Decisions />} />
          <Route path="admin" element={<Admin />} />
          <Route path="try-questions" element={<TryQuestions />} />
          <Route path="needs" element={<Needs />} />
          <Route path="map" element={<MapPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
