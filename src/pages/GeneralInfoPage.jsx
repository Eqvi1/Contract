import { useNavigate } from 'react-router-dom'
import './GeneralInfoPage.css'

function GeneralInfoPage() {
  const navigate = useNavigate()

  const sections = [
    { path: '/general/objects', label: 'Объекты', icon: '🏢', description: 'Строительные объекты' },
    { path: '/general/contacts', label: 'Контакты', icon: '👤', description: 'Контактные лица' },
    { path: '/general/counterparties', label: 'Контрагенты', icon: '🏛️', description: 'Организации-подрядчики' },
  ]

  return (
    <div className="general-info-page">
      <div className="page-header">
        <h2>Общая информация</h2>
      </div>

      <div className="section-selection">
        <p className="selection-label">Выберите раздел:</p>
        <div className="section-cards">
          {sections.map((section) => (
            <button
              key={section.path}
              className="section-card"
              onClick={() => navigate(section.path)}
            >
              <span className="section-icon">{section.icon}</span>
              <span className="section-name">{section.label}</span>
              <span className="section-description">{section.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default GeneralInfoPage

