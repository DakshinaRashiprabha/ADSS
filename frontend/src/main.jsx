import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import Home from './pages/Home'
import Group from './pages/Group'
import Decisions from './pages/Decisions'
import Admin from './pages/Admin'
import Needs from './pages/Needs'
import MapPage from './pages/MapPage'
import Support from './pages/Support'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Home />} />
          <Route path="group" element={<Group />} />
          <Route path="decisions" element={<Decisions />} />
          <Route path="admin" element={<Admin />} />
          <Route path="needs" element={<Needs />} />
          <Route path="map" element={<MapPage />} />
          <Route path="support" element={<Support />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
