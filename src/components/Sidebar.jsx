import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import './Sidebar.css'

function Sidebar() {
  const location = useLocation()
  const [generalInfoExpanded, setGeneralInfoExpanded] = useState(
    location.pathname.startsWith('/general')
  )

  const menuItems = [
    { path: '/tenders', label: 'Тендеры', icon: '📢' },
    { path: '/contracts', label: 'Реестр договоров', icon: '📋' },
    { path: '/acceptance', label: 'Приёмка работ', icon: '✓' },
    { path: '/reports', label: 'Отчёты', icon: '📊' },
  ]

  const generalInfoSubItems = [
    { path: '/general/objects', label: 'Объекты', icon: '🏢' },
    { path: '/general/contacts', label: 'Контакты', icon: '👤' },
    { path: '/general/counterparties', label: 'Контрагенты', icon: '🏛️' },
  ]

  const isGeneralInfoActive = location.pathname.startsWith('/general')

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">ОСП</h1>
        <p className="sidebar-subtitle">отдел сопровождения подрядчиков</p>
      </div>

      <nav className="sidebar-nav">
        {/* Collapsible General Info Section */}
        <div className="sidebar-item-wrapper">
          <button
            className={`sidebar-item sidebar-item-parent ${isGeneralInfoActive ? 'active' : ''}`}
            onClick={() => setGeneralInfoExpanded(!generalInfoExpanded)}
          >
            <span className="sidebar-icon">📁</span>
            <span className="sidebar-label">Общая информация</span>
            <span className={`sidebar-chevron ${generalInfoExpanded ? 'expanded' : ''}`}>
              ›
            </span>
          </button>

          {generalInfoExpanded && (
            <div className="sidebar-submenu">
              {generalInfoSubItems.map((item) => (
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
      </div>
    </aside>
  )
}

export default Sidebar
