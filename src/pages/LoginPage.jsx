import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../contexts/RoleContext'
import { supabase } from '../supabase'
import './LoginPage.css'

function LoginPage() {
  const navigate = useNavigate()
  const { loginAsEmployee, loginAsContractor, isLoggedIn } = useRole()

  const [showContractorSelect, setShowContractorSelect] = useState(false)
  const [counterparties, setCounterparties] = useState([])
  const [selectedCounterparty, setSelectedCounterparty] = useState('')
  const [loading, setLoading] = useState(false)

  // Если уже авторизован, редиректим
  useEffect(() => {
    if (isLoggedIn) {
      navigate('/')
    }
  }, [isLoggedIn, navigate])

  // Загружаем список контрагентов при открытии выбора
  useEffect(() => {
    if (showContractorSelect) {
      fetchCounterparties()
    }
  }, [showContractorSelect])

  const fetchCounterparties = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('counterparties')
        .select('id, name')
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setCounterparties(data || [])
    } catch (error) {
      console.error('Ошибка загрузки контрагентов:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEmployeeLogin = () => {
    loginAsEmployee()
    navigate('/general/objects')
  }

  const handleContractorLogin = () => {
    if (!selectedCounterparty) {
      alert('Выберите организацию')
      return
    }

    const counterparty = counterparties.find(c => c.id === selectedCounterparty)
    if (counterparty) {
      loginAsContractor(counterparty.id, counterparty.name)
      navigate('/contractor/proposals')
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>ОСП</h1>
          <p>Отдел сопровождения подрядчиков</p>
        </div>

        {!showContractorSelect ? (
          <div className="login-options">
            <button
              className="login-option employee"
              onClick={handleEmployeeLogin}
            >
              <div className="option-icon">👔</div>
              <div className="option-content">
                <h3>Сотрудник СУ-10</h3>
                <p>Полный доступ к системе управления тендерами и договорами</p>
              </div>
            </button>

            <button
              className="login-option contractor"
              onClick={() => setShowContractorSelect(true)}
            >
              <div className="option-icon">🏢</div>
              <div className="option-content">
                <h3>Подрядчик</h3>
                <p>Загрузка коммерческих предложений по тендерам</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="contractor-select">
            <button
              className="back-button"
              onClick={() => setShowContractorSelect(false)}
            >
              ← Назад
            </button>

            <h2>Выберите организацию</h2>

            {loading ? (
              <div className="loading">Загрузка списка организаций...</div>
            ) : (
              <>
                <select
                  value={selectedCounterparty}
                  onChange={(e) => setSelectedCounterparty(e.target.value)}
                  className="counterparty-dropdown"
                >
                  <option value="">-- Выберите организацию --</option>
                  {counterparties.map(cp => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name}
                    </option>
                  ))}
                </select>

                <button
                  className="login-button"
                  onClick={handleContractorLogin}
                  disabled={!selectedCounterparty}
                >
                  Войти
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default LoginPage
