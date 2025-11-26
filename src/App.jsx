import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import Sidebar from './components/Sidebar'
import ObjectsPage from './pages/ObjectsPage'
import ContactsPage from './pages/ContactsPage'
import CounterpartiesPage from './pages/CounterpartiesPage'
import TendersPage from './pages/TendersPage'
import TenderDetailPage from './pages/TenderDetailPage'
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
              <Route path="/" element={<Navigate to="/general/objects" replace />} />
              <Route path="/general" element={<Navigate to="/general/objects" replace />} />
              <Route path="/general/objects" element={<ObjectsPage />} />
              <Route path="/general/contacts" element={<ContactsPage />} />
              <Route path="/general/counterparties" element={<CounterpartiesPage />} />
              <Route path="/tenders" element={<Navigate to="/tenders/construction" replace />} />
              <Route path="/tenders/construction" element={<TendersPage department="construction" />} />
              <Route path="/tenders/warranty" element={<TendersPage department="warranty" />} />
              <Route path="/tenders/:tenderId" element={<TenderDetailPage />} />
              <Route path="/contracts" element={<Navigate to="/contracts/construction/pending" replace />} />
              <Route path="/contracts/construction" element={<Navigate to="/contracts/construction/pending" replace />} />
              <Route path="/contracts/construction/pending" element={<ContractsPage department="construction" status="pending" />} />
              <Route path="/contracts/construction/signed" element={<ContractsPage department="construction" status="signed" />} />
              <Route path="/contracts/warranty" element={<Navigate to="/contracts/warranty/pending" replace />} />
              <Route path="/contracts/warranty/pending" element={<ContractsPage department="warranty" status="pending" />} />
              <Route path="/contracts/warranty/signed" element={<ContractsPage department="warranty" status="signed" />} />
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
