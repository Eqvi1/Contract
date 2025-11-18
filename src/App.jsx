import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import Sidebar from './components/Sidebar'
import GeneralInfoPage from './pages/GeneralInfoPage'
import TendersPage from './pages/TendersPage'
import ContractsPage from './pages/ContractsPage'
import AcceptancePage from './pages/AcceptancePage'
import ReportsPage from './pages/ReportsPage'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="layout">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/general" replace />} />
              <Route path="/general" element={<GeneralInfoPage />} />
              <Route path="/tenders" element={<TendersPage />} />
              <Route path="/contracts" element={<ContractsPage />} />
              <Route path="/acceptance" element={<AcceptancePage />} />
              <Route path="/reports" element={<ReportsPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
