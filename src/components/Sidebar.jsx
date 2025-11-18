import { NavLink } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import './Sidebar.css'

function Sidebar() {
  const menuItems = [
    { path: '/general', label: 'Общая информация', icon: '📁' },
    { path: '/tenders', label: 'Тендеры', icon: '📢' },
    { path: '/contracts', label: 'Реестр договоров', icon: '📋' },
    { path: '/acceptance', label: 'Приёмка работ', icon: '✓' },
    { path: '/reports', label: 'Отчёты', icon: '📊' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">ОСП</h1>
        <p className="sidebar-subtitle">отдел сопровождения подрядчиков</p>
      </div>

      <nav className="sidebar-nav">
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
