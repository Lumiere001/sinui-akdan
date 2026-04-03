import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Landing } from './pages/Landing'
import { Game } from './pages/Game'
import { Result } from './pages/Result'
import { Admin } from './pages/Admin'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/game" element={<Game />} />
        <Route path="/result/:type" element={<Result />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
