import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import './Sidebar.css'

function Sidebar() {
  const location = useLocation()
  const [generalInfoExpanded, setGeneralInfoExpanded] = useState(
    location.pathname.startsWith('/general')
  )
  const [tendersExpanded, setTendersExpanded] = useState(
    location.pathname.startsWith('/tenders')
  )
  const [contractsExpanded, setContractsExpanded] = useState(
    location.pathname.startsWith('/contracts')
  )
  const [contractsConstructionExpanded, setContractsConstructionExpanded] = useState(
    location.pathname.startsWith('/contracts/construction')
  )
  const [contractsWarrantyExpanded, setContractsWarrantyExpanded] = useState(
    location.pathname.startsWith('/contracts/warranty')
  )

  const menuItems = [
    { path: '/acceptance', label: 'Приёмка работ', icon: '✓' },
    { path: '/reports', label: 'Отчёты', icon: '📊' },
  ]

  const generalInfoSubItems = [
    { path: '/general/objects', label: 'Объекты', icon: '🏢' },
    { path: '/general/contacts', label: 'Контакты', icon: '👤' },
    { path: '/general/counterparties', label: 'Контрагенты', icon: '🏛️' },
  ]

  const tendersSubItems = [
    { path: '/tenders/construction', label: 'Основное строительство', icon: '🏗️' },
    { path: '/tenders/warranty', label: 'Гарантийный отдел', icon: '🛡️' },
  ]

  const contractsConstructionSubItems = [
    { path: '/contracts/construction/pending', label: 'На согласовании', icon: '⏳' },
    { path: '/contracts/construction/signed', label: 'Заключенные ДП', icon: '✅' },
  ]

  const contractsWarrantySubItems = [
    { path: '/contracts/warranty/pending', label: 'На согласовании', icon: '⏳' },
    { path: '/contracts/warranty/signed', label: 'Заключенные ДП', icon: '✅' },
  ]

  const isGeneralInfoActive = location.pathname.startsWith('/general')
  const isTendersActive = location.pathname.startsWith('/tenders')
  const isContractsActive = location.pathname.startsWith('/contracts')
  const isContractsConstructionActive = location.pathname.startsWith('/contracts/construction')
  const isContractsWarrantyActive = location.pathname.startsWith('/contracts/warranty')

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

        {/* Collapsible Contracts Section */}
        <div className="sidebar-item-wrapper">
          <button
            className={`sidebar-item sidebar-item-parent ${isContractsActive ? 'active' : ''}`}
            onClick={() => setContractsExpanded(!contractsExpanded)}
          >
            <span className="sidebar-icon">📋</span>
            <span className="sidebar-label">Договоры</span>
            <span className={`sidebar-chevron ${contractsExpanded ? 'expanded' : ''}`}>
              ›
            </span>
          </button>

          {contractsExpanded && (
            <div className="sidebar-submenu">
              {/* Основное строительство */}
              <div className="sidebar-nested-wrapper">
                <button
                  className={`sidebar-subitem sidebar-subitem-parent ${isContractsConstructionActive ? 'active' : ''}`}
                  onClick={() => setContractsConstructionExpanded(!contractsConstructionExpanded)}
                >
                  <span className="sidebar-icon">🏗️</span>
                  <span className="sidebar-label">Основное строительство</span>
                  <span className={`sidebar-chevron ${contractsConstructionExpanded ? 'expanded' : ''}`}>
                    ›
                  </span>
                </button>

                {contractsConstructionExpanded && (
                  <div className="sidebar-nested-submenu">
                    {contractsConstructionSubItems.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                          `sidebar-nested-item ${isActive ? 'active' : ''}`
                        }
                      >
                        <span className="sidebar-icon">{item.icon}</span>
                        <span className="sidebar-label">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              {/* Гарантийный отдел */}
              <div className="sidebar-nested-wrapper">
                <button
                  className={`sidebar-subitem sidebar-subitem-parent ${isContractsWarrantyActive ? 'active' : ''}`}
                  onClick={() => setContractsWarrantyExpanded(!contractsWarrantyExpanded)}
                >
                  <span className="sidebar-icon">🛡️</span>
                  <span className="sidebar-label">Гарантийный отдел</span>
                  <span className={`sidebar-chevron ${contractsWarrantyExpanded ? 'expanded' : ''}`}>
                    ›
                  </span>
                </button>

                {contractsWarrantyExpanded && (
                  <div className="sidebar-nested-submenu">
                    {contractsWarrantySubItems.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                          `sidebar-nested-item ${isActive ? 'active' : ''}`
                        }
                      >
                        <span className="sidebar-icon">{item.icon}</span>
                        <span className="sidebar-label">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
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
