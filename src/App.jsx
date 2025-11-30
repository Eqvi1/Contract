import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { RoleProvider, useRole } from './contexts/RoleContext'
import Sidebar from './components/Sidebar'
import ObjectsPage from './pages/ObjectsPage'
import ContactsPage from './pages/ContactsPage'
import CounterpartiesPage from './pages/CounterpartiesPage'
import TendersPage from './pages/TendersPage'
import TenderDetailPage from './pages/TenderDetailPage'
import ContractsPage from './pages/ContractsPage'
import AcceptancePage from './pages/AcceptancePage'
import ReportsPage from './pages/ReportsPage'
import LoginPage from './pages/LoginPage'
import ContractorProposalsPage from './pages/ContractorProposalsPage'
import BSMPage from './pages/BSMPage'
import BSMRatesPage from './pages/BSMRatesPage'
import BSMContractRatesPage from './pages/BSMContractRatesPage'
import BSMComparisonPage from './pages/BSMComparisonPage'
import './App.css'

// Компонент для защищённых маршрутов сотрудника
function EmployeeLayout() {
  const { isEmployee, isLoggedIn } = useRole()

  // Если не авторизован - редирект на логин
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  // Если подрядчик - редирект на его страницу
  if (!isEmployee) {
    return <Navigate to="/contractor/proposals" replace />
  }

  return (
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
          <Route path="/bsm" element={<Navigate to="/bsm/analysis" replace />} />
          <Route path="/bsm/analysis" element={<BSMPage />} />
          <Route path="/bsm/comparison" element={<BSMComparisonPage />} />
          <Route path="/bsm/contract-rates" element={<BSMContractRatesPage />} />
          <Route path="/bsm/supply-rates" element={<BSMRatesPage />} />
          <Route path="/acceptance" element={<AcceptancePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="/general/objects" replace />} />
        </Routes>
      </main>
    </div>
  )
}

// Компонент для маршрутов авторизации
function AuthRoutes() {
  const { isLoggedIn, isEmployee, isContractor } = useRole()

  return (
    <Routes>
      {/* Страница входа */}
      <Route
        path="/login"
        element={
          isLoggedIn
            ? <Navigate to={isEmployee ? "/general/objects" : "/contractor/proposals"} replace />
            : <LoginPage />
        }
      />

      {/* Страница подрядчика */}
      <Route
        path="/contractor/proposals"
        element={
          isContractor
            ? <ContractorProposalsPage />
            : <Navigate to="/login" replace />
        }
      />

      {/* Все остальные маршруты - для сотрудников */}
      <Route path="/*" element={<EmployeeLayout />} />
    </Routes>
  )
}

function App() {
  return (
    <ThemeProvider>
      <RoleProvider>
        <BrowserRouter>
          <AuthRoutes />
        </BrowserRouter>
      </RoleProvider>
    </ThemeProvider>
  )
}

export default App
