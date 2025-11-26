import { createContext, useContext, useState, useEffect } from 'react'

const RoleContext = createContext()

// Роли пользователей
export const ROLES = {
  CONTRACTOR: 'contractor',    // Подрядчик
  EMPLOYEE: 'employee'         // Сотрудник СУ-10
}

export function RoleProvider({ children }) {
  const [role, setRole] = useState(() => {
    // Загружаем роль из localStorage при инициализации
    return localStorage.getItem('userRole') || null
  })

  const [contractorInfo, setContractorInfo] = useState(() => {
    // Информация о подрядчике (если роль = contractor)
    const saved = localStorage.getItem('contractorInfo')
    return saved ? JSON.parse(saved) : null
  })

  // Сохраняем роль в localStorage при изменении
  useEffect(() => {
    if (role) {
      localStorage.setItem('userRole', role)
    } else {
      localStorage.removeItem('userRole')
    }
  }, [role])

  // Сохраняем информацию о подрядчике
  useEffect(() => {
    if (contractorInfo) {
      localStorage.setItem('contractorInfo', JSON.stringify(contractorInfo))
    } else {
      localStorage.removeItem('contractorInfo')
    }
  }, [contractorInfo])

  // Войти как сотрудник СУ-10
  const loginAsEmployee = () => {
    setRole(ROLES.EMPLOYEE)
    setContractorInfo(null)
  }

  // Войти как подрядчик
  const loginAsContractor = (counterpartyId, counterpartyName) => {
    setRole(ROLES.CONTRACTOR)
    setContractorInfo({ id: counterpartyId, name: counterpartyName })
  }

  // Выйти
  const logout = () => {
    setRole(null)
    setContractorInfo(null)
  }

  // Проверки ролей
  const isEmployee = role === ROLES.EMPLOYEE
  const isContractor = role === ROLES.CONTRACTOR
  const isLoggedIn = role !== null

  return (
    <RoleContext.Provider value={{
      role,
      contractorInfo,
      isEmployee,
      isContractor,
      isLoggedIn,
      loginAsEmployee,
      loginAsContractor,
      logout,
      ROLES
    }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const context = useContext(RoleContext)
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider')
  }
  return context
}
