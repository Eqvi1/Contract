import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useRole } from '../contexts/RoleContext'
import ThemeToggle from './ThemeToggle'
import './Sidebar.css'

function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useRole()

  const [tendersExpanded, setTendersExpanded] = useState(
    location.pathname.startsWith('/tenders')
  )

  const menuItems = [
    { path: '/contracts', label: 'Договоры', icon: '📋' },
    { path: '/bsm', label: 'Материалы', icon: '📦' },
    { path: '/acceptance', label: 'Приёмка работ', icon: '✓' },
    { path: '/reports', label: 'Отчёты', icon: '📊' },
  ]

  const tendersSubItems = [
    { path: '/tenders/construction', label: 'Основное строительство', icon: '🏗️' },
    { path: '/tenders/warranty', label: 'Гарантийный отдел', icon: '🛡️' },
  ]

  const isTendersActive = location.pathname.startsWith('/tenders')

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">ОСП</h1>
        <p className="sidebar-subtitle">отдел сопровождения подрядчиков</p>
      </div>

      <nav className="sidebar-nav">
        {/* Regular menu items - first group */}
        <NavLink
          to="/general"
          className={({ isActive }) =>
            `sidebar-item ${isActive ? 'active' : ''}`
          }
        >
          <span className="sidebar-icon">📁</span>
          <span className="sidebar-label">Общая информация</span>
        </NavLink>

        {/* Collapsible Tenders Section */}
        <div className="sidebar-item-wrapper">
          <button
            className={`sidebar-item sidebar-item-parent ${isTendersActive ? 'active' : ''}`}
            onClick={() => setTendersExpanded(!tendersExpanded)}
          >
            <span className="sidebar-icon">📢</span>
            <span className="sidebar-label">Тендеры</span>
            <span className={`sidebar-chevron ${tendersExpanded ? 'expanded' : ''}`}>
              ›
            </span>
          </button>

          {tendersExpanded && (
            <div className="sidebar-submenu">
              {tendersSubItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar-subitem ${isActive ? 'active' : ''}`
                  }
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  <span className="sidebar-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Анализ КП */}
        <NavLink
          to="/analysis-kp"
          className={({ isActive }) =>
            `sidebar-item ${isActive ? 'active' : ''}`
          }
        >
          <span className="sidebar-icon">📊</span>
          <span className="sidebar-label">Анализ КП</span>
        </NavLink>

        {/* Regular menu items */}
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? 'active' : ''}`
            }
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <ThemeToggle />
        <button
          className="logout-btn"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          Выйти
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
