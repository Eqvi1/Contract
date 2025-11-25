import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import '../components/Tenders.css'

function TendersPage() {
  const [tenders, setTenders] = useState([])
  const [objects, setObjects] = useState([])
  const [counterparties, setCounterparties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTender, setEditingTender] = useState(null)
  const [expandedTenderId, setExpandedTenderId] = useState(null)
  const [tenderCounterparties, setTenderCounterparties] = useState({})
  const [showAddCounterpartyModal, setShowAddCounterpartyModal] = useState(false)
  const [selectedTenderForCounterparty, setSelectedTenderForCounterparty] = useState(null)
  const [counterpartySearchQuery, setCounterpartySearchQuery] = useState('')
  const [counterpartyWorkTypeFilter, setCounterpartyWorkTypeFilter] = useState('')
  const [selectedCounterpartyIds, setSelectedCounterpartyIds] = useState([])
  const [formData, setFormData] = useState({
    object_id: '',
    work_description: '',
    status: 'Не начат',
    start_date: '',
    end_date: '',
    tender_package_link: '',
  })

  const statusOptions = ['Не начат', 'Идет тендерная процедура', 'Завершен']

  const counterpartyStatusOptions = [
    { value: 'request_sent', label: 'Запрос отправлен' },
    { value: 'declined', label: 'Отказ' },
    { value: 'proposal_provided', label: 'КП предоставлено' }
  ]

  const getCounterpartyStatusLabel = (status) => {
    const option = counterpartyStatusOptions.find(opt => opt.value === status)
    return option ? option.label : status
  }

  const getCounterpartyStatusColor = (status) => {
    const colors = {
      'request_sent': '#3b82f6',
      'declined': '#dc2626',
      'proposal_provided': '#16a34a'
    }
    return colors[status] || '#6b7280'
  }

  useEffect(() => {
    fetchTenders()
    fetchObjects()
    fetchCounterparties()
  }, [])

  const fetchTenders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tenders')
        .select('*, objects(name)')
        .order('start_date', { ascending: false })

      if (error) throw error
      setTenders(data || [])
    } catch (error) {
      console.error('Ошибка загрузки тендеров:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchObjects = async () => {
    try {
      const { data, error } = await supabase
        .from('objects')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setObjects(data || [])
    } catch (error) {
      console.error('Ошибка загрузки объектов:', error.message)
    }
  }

  const fetchCounterparties = async () => {
    try {
      const { data, error } = await supabase
        .from('counterparties')
        .select('*')
        .eq('status', 'active')
        .order('name', { ascending: true })

      if (error) throw error
      setCounterparties(data || [])
    } catch (error) {
      console.error('Ошибка загрузки контрагентов:', error.message)
    }
  }

  const fetchTenderCounterparties = async (tenderId) => {
    try {
      const { data, error } = await supabase
        .from('tender_counterparties')
        .select(`
          *,
          counterparties(
            id,
            name,
            work_type,
            inn,
            counterparty_contacts(
              id,
              full_name,
              position,
              phone,
              email
            )
          )
        `)
        .eq('tender_id', tenderId)

      if (error) throw error
      setTenderCounterparties(prev => ({
        ...prev,
        [tenderId]: data || []
      }))
    } catch (error) {
      console.error('Ошибка загрузки контрагентов тендера:', error.message)
    }
  }

  const handleToggleTender = async (tenderId) => {
    if (expandedTenderId === tenderId) {
      setExpandedTenderId(null)
    } else {
      setExpandedTenderId(tenderId)
      if (!tenderCounterparties[tenderId]) {
        await fetchTenderCounterparties(tenderId)
      }
    }
  }

  const handleAddCounterpartiesToTender = async () => {
    if (!selectedTenderForCounterparty || selectedCounterpartyIds.length === 0) {
      alert('Выберите хотя бы одного контрагента')
      return
    }

    try {
      const inserts = selectedCounterpartyIds.map(counterpartyId => ({
        tender_id: selectedTenderForCounterparty,
        counterparty_id: counterpartyId
      }))

      const { error } = await supabase
        .from('tender_counterparties')
        .insert(inserts)

      if (error) throw error

      await fetchTenderCounterparties(selectedTenderForCounterparty)
      setShowAddCounterpartyModal(false)
      setSelectedCounterpartyIds([])
      setCounterpartySearchQuery('')
      setCounterpartyWorkTypeFilter('')
    } catch (error) {
      console.error('Ошибка добавления контрагентов:', error.message)
      alert('Ошибка добавления: ' + error.message)
    }
  }

  const handleToggleCounterpartySelection = (counterpartyId) => {
    setSelectedCounterpartyIds(prev => {
      if (prev.includes(counterpartyId)) {
        return prev.filter(id => id !== counterpartyId)
      } else {
        return [...prev, counterpartyId]
      }
    })
  }

  const handleUpdateCounterpartyStatus = async (tenderId, tenderCounterpartyId, newStatus) => {
    try {
      const { error } = await supabase
        .from('tender_counterparties')
        .update({ status: newStatus })
        .eq('id', tenderCounterpartyId)

      if (error) throw error

      // Обновляем локальное состояние
      setTenderCounterparties(prev => ({
        ...prev,
        [tenderId]: prev[tenderId].map(tc =>
          tc.id === tenderCounterpartyId ? { ...tc, status: newStatus } : tc
        )
      }))
    } catch (error) {
      console.error('Ошибка обновления статуса:', error.message)
      alert('Ошибка обновления статуса: ' + error.message)
    }
  }

  const handleRemoveCounterpartyFromTender = async (tenderId, tenderCounterpartyId) => {
    if (!window.confirm('Удалить контрагента из тендера?')) return

    try {
      const { error} = await supabase
        .from('tender_counterparties')
        .delete()
        .eq('id', tenderCounterpartyId)

      if (error) throw error

      await fetchTenderCounterparties(tenderId)
    } catch (error) {
      console.error('Ошибка удаления контрагента:', error.message)
      alert('Ошибка удаления: ' + error.message)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingTender) {
        // Update existing tender
        const { error } = await supabase
          .from('tenders')
          .update(formData)
          .eq('id', editingTender.id)

        if (error) throw error
      } else {
        // Insert new tender
        const { error } = await supabase.from('tenders').insert([formData])
        if (error) throw error
      }

      setShowModal(false)
      setEditingTender(null)
      setFormData({
        object_id: '',
        work_description: '',
        status: 'Не начат',
        start_date: '',
        end_date: '',
        tender_package_link: '',
      })
      fetchTenders()
    } catch (error) {
      console.error('Ошибка сохранения тендера:', error.message)
      alert('Ошибка: ' + error.message)
    }
  }

  const handleEditTender = (tender) => {
    setEditingTender(tender)
    setFormData({
      object_id: tender.object_id || '',
      work_description: tender.work_description,
      status: tender.status,
      start_date: tender.start_date || '',
      end_date: tender.end_date || '',
      tender_package_link: tender.tender_package_link || '',
    })
    setShowModal(true)
  }

  const handleDeleteTender = async (id, objectName) => {
    if (
      window.confirm(`Вы уверены, что хотите удалить тендер "${objectName}"?`)
    ) {
      try {
        const { error } = await supabase.from('tenders').delete().eq('id', id)

        if (error) throw error
        fetchTenders()
      } catch (error) {
        console.error('Ошибка удаления тендера:', error.message)
        alert('Ошибка удаления: ' + error.message)
      }
    }
  }

  const handleAddNew = () => {
    setEditingTender(null)
    setFormData({
      object_id: '',
      work_description: '',
      status: 'Не начат',
      start_date: '',
      end_date: '',
      tender_package_link: '',
    })
    setShowModal(true)
  }

  const handleStatusChange = async (tenderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('tenders')
        .update({ status: newStatus })
        .eq('id', tenderId)

      if (error) throw error
      fetchTenders()
    } catch (error) {
      console.error('Ошибка изменения статуса:', error.message)
      alert('Ошибка изменения статуса: ' + error.message)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('ru-RU')
  }

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      'Не начат': 'status-not-started',
      'Идет тендерная процедура': 'status-in-progress',
      'Завершен': 'status-completed',
    }
    return statusClasses[status] || 'status-not-started'
  }

  if (loading) {
    return <div className="loading">Загрузка...</div>
  }

  return (
    <div className="tenders-page">
      <div className="page-header">
        <h2>Тендеры</h2>
        <button className="btn-primary" onClick={handleAddNew}>
          + Добавить тендер
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}></th>
              <th>Наименование объекта</th>
              <th>Описание работ</th>
              <th>Статус</th>
              <th>Дата начала</th>
              <th>Дата окончания</th>
              <th>Тендерный пакет</th>
              <th className="actions-column">Действия</th>
            </tr>
          </thead>
          <tbody>
            {tenders.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">
                  Нет тендеров. Добавьте первый тендер.
                </td>
              </tr>
            ) : (
              tenders.map((tender) => (
                <>
                  <tr key={tender.id}>
                    <td>
                      <button
                        onClick={() => handleToggleTender(tender.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1.2rem',
                          padding: '0.25rem'
                        }}
                        title="Показать контрагентов"
                      >
                        {expandedTenderId === tender.id ? '▼' : '▶'}
                      </button>
                    </td>
                    <td>{tender.objects?.name || '-'}</td>
                    <td>{tender.work_description}</td>
                    <td>
                      <select
                        className={`status-select ${getStatusBadgeClass(tender.status)}`}
                        value={tender.status}
                        onChange={(e) => handleStatusChange(tender.id, e.target.value)}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{formatDate(tender.start_date)}</td>
                    <td>{formatDate(tender.end_date)}</td>
                    <td>
                      {tender.tender_package_link ? (
                        <a
                          href={tender.tender_package_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link"
                        >
                          Открыть
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="actions-cell">
                      <button
                        className="btn-icon btn-edit"
                        onClick={() => handleEditTender(tender)}
                        title="Редактировать"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() =>
                          handleDeleteTender(tender.id, tender.objects?.name || 'тендер')
                        }
                        title="Удалить"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                  {expandedTenderId === tender.id && (
                    <tr key={`${tender.id}-counterparties`}>
                      <td colSpan="8" style={{ padding: '1.5rem', backgroundColor: 'var(--card-bg)', borderTop: '2px solid var(--primary-color)' }}>
                        <div style={{ marginBottom: '1rem' }}>
                          <button
                            className="btn-primary"
                            onClick={() => {
                              setSelectedTenderForCounterparty(tender.id)
                              setShowAddCounterpartyModal(true)
                            }}
                            style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                          >
                            + Добавить контрагента
                          </button>
                        </div>
                        {tenderCounterparties[tender.id] && tenderCounterparties[tender.id].length > 0 ? (
                          <div style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            overflow: 'hidden'
                          }}>
                            <table className="data-table" style={{ margin: 0 }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '60px' }}>№ п/п</th>
                                  <th>Наименование</th>
                                  <th>Контактные данные</th>
                                  <th>Email</th>
                                  <th>Статус</th>
                                  <th style={{ width: '100px' }}>Действия</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tenderCounterparties[tender.id].map((tc, index) => (
                                  <tr key={tc.id}>
                                    <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                      {index + 1}
                                    </td>
                                    <td>
                                      <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                                        {tc.counterparties?.name}
                                      </div>
                                      {tc.counterparties?.work_type && (
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                          {tc.counterparties.work_type}
                                        </div>
                                      )}
                                      {tc.counterparties?.inn && (
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                          ИНН: {tc.counterparties.inn}
                                        </div>
                                      )}
                                    </td>
                                    <td>
                                      {tc.counterparties?.counterparty_contacts && tc.counterparties.counterparty_contacts.length > 0 ? (
                                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                                          {tc.counterparties.counterparty_contacts.map((contact, idx) => (
                                            <div key={contact.id || idx} style={{ fontSize: '0.875rem' }}>
                                              {contact.full_name && (
                                                <div style={{ fontWeight: '600', color: 'var(--text-color)' }}>
                                                  {contact.full_name}
                                                  {contact.position && (
                                                    <span style={{
                                                      color: 'var(--text-secondary)',
                                                      fontWeight: '400',
                                                      marginLeft: '0.5rem'
                                                    }}>
                                                      ({contact.position})
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                              {contact.phone && (
                                                <a
                                                  href={`tel:${contact.phone}`}
                                                  style={{
                                                    color: 'var(--primary-color)',
                                                    textDecoration: 'none',
                                                    display: 'block'
                                                  }}
                                                >
                                                  📞 {contact.phone}
                                                </a>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.875rem' }}>
                                          Не указаны
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      {tc.counterparties?.counterparty_contacts && tc.counterparties.counterparty_contacts.length > 0 ? (
                                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                                          {tc.counterparties.counterparty_contacts
                                            .filter(contact => contact.email)
                                            .map((contact, idx) => (
                                              <a
                                                key={contact.id || idx}
                                                href={`mailto:${contact.email}`}
                                                style={{
                                                  color: 'var(--primary-color)',
                                                  textDecoration: 'none',
                                                  fontSize: '0.875rem',
                                                  display: 'block'
                                                }}
                                              >
                                                ✉️ {contact.email}
                                              </a>
                                            ))}
                                          {tc.counterparties.counterparty_contacts.every(c => !c.email) && (
                                            <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.875rem' }}>
                                              Не указан
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.875rem' }}>
                                          Не указан
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      <select
                                        value={tc.status || 'request_sent'}
                                        onChange={(e) => handleUpdateCounterpartyStatus(tender.id, tc.id, e.target.value)}
                                        style={{
                                          padding: '0.4rem 0.75rem',
                                          fontSize: '0.875rem',
                                          fontWeight: '500',
                                          border: '2px solid',
                                          borderColor: getCounterpartyStatusColor(tc.status || 'request_sent'),
                                          borderRadius: '6px',
                                          backgroundColor: 'var(--bg-color)',
                                          color: getCounterpartyStatusColor(tc.status || 'request_sent'),
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                          width: '100%'
                                        }}
                                      >
                                        {counterpartyStatusOptions.map((option) => (
                                          <option
                                            key={option.value}
                                            value={option.value}
                                            style={{ backgroundColor: '#ffffff', color: '#000000' }}
                                          >
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td>
                                      <button
                                        onClick={() => handleRemoveCounterpartyFromTender(tender.id, tc.id)}
                                        style={{
                                          background: '#dc2626',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '6px',
                                          padding: '0.5rem 0.75rem',
                                          cursor: 'pointer',
                                          fontSize: '0.875rem',
                                          fontWeight: '500',
                                          transition: 'all 0.2s',
                                          width: '100%'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.target.style.background = '#b91c1c'
                                        }}
                                        onMouseLeave={(e) => {
                                          e.target.style.background = '#dc2626'
                                        }}
                                      >
                                        🗑️
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
                            Контрагенты еще не добавлены к этому тендеру
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {editingTender ? 'Редактировать тендер' : 'Добавить новый тендер'}
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowModal(false)
                  setEditingTender(null)
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Наименование объекта *</label>
                  <select
                    name="object_id"
                    value={formData.object_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Выберите объект</option>
                    {objects.map((obj) => (
                      <option key={obj.id} value={obj.id}>
                        {obj.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>Описание работ *</label>
                  <textarea
                    name="work_description"
                    value={formData.work_description}
                    onChange={handleInputChange}
                    required
                    rows="4"
                    placeholder="Опишите виды работ, которые будут проводиться..."
                  />
                </div>

                <div className="form-group">
                  <label>Статус *</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    required
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Дата начала *</label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Дата окончания *</label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label>Ссылка на тендерный пакет</label>
                  <input
                    type="url"
                    name="tender_package_link"
                    value={formData.tender_package_link}
                    onChange={handleInputChange}
                    placeholder="https://example.com/tender-package.pdf"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowModal(false)
                    setEditingTender(null)
                  }}
                >
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  {editingTender ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddCounterpartyModal && (() => {
        const currentTenderCounterparties = tenderCounterparties[selectedTenderForCounterparty] || []
        const uniqueWorkTypes = [...new Set(
          counterparties
            .map(c => c.work_type)
            .filter(wt => wt && wt.trim() !== '')
        )].sort()

        const availableCounterparties = counterparties.filter(cp => {
          // Исключаем уже добавленных
          if (currentTenderCounterparties.some(tc => tc.counterparty_id === cp.id)) {
            return false
          }

          // Фильтр по виду работ
          if (counterpartyWorkTypeFilter && cp.work_type !== counterpartyWorkTypeFilter) {
            return false
          }

          // Поиск по всем полям
          if (counterpartySearchQuery.trim()) {
            const query = counterpartySearchQuery.toLowerCase()
            return (
              (cp.name && cp.name.toLowerCase().includes(query)) ||
              (cp.work_type && cp.work_type.toLowerCase().includes(query)) ||
              (cp.inn && cp.inn.toLowerCase().includes(query)) ||
              (cp.kpp && cp.kpp.toLowerCase().includes(query))
            )
          }

          return true
        })

        return (
          <div className="modal-overlay" onClick={() => {
            setShowAddCounterpartyModal(false)
            setCounterpartySearchQuery('')
            setCounterpartyWorkTypeFilter('')
            setSelectedCounterpartyIds([])
          }}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '85vh' }}>
              <div className="modal-header">
                <h3>Выбрать контрагентов для добавления к тендеру</h3>
                <button
                  className="modal-close"
                  onClick={() => {
                    setShowAddCounterpartyModal(false)
                    setCounterpartySearchQuery('')
                    setCounterpartyWorkTypeFilter('')
                    setSelectedCounterpartyIds([])
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: '1.5rem' }}>
                {/* Поиск и фильтры */}
                <div style={{ marginBottom: '1rem' }}>
                  <input
                    type="text"
                    placeholder="🔍 Поиск по названию, виду работ, ИНН..."
                    value={counterpartySearchQuery}
                    onChange={(e) => setCounterpartySearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      fontSize: '1rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-color)',
                      color: 'var(--text-color)',
                      marginBottom: '0.75rem'
                    }}
                  />

                  {uniqueWorkTypes.length > 0 && (
                    <select
                      value={counterpartyWorkTypeFilter}
                      onChange={(e) => setCounterpartyWorkTypeFilter(e.target.value)}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        border: '2px solid var(--primary-color)',
                        borderRadius: '6px',
                        backgroundColor: counterpartyWorkTypeFilter ? 'var(--primary-color)' : '#ffffff',
                        color: counterpartyWorkTypeFilter ? 'white' : '#000000',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      <option value="" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                        🔍 Все виды работ
                      </option>
                      {uniqueWorkTypes.map(workType => (
                        <option key={workType} value={workType} style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                          {workType}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Таблица контрагентов */}
                {counterparties.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem' }}>
                    Нет активных контрагентов
                  </p>
                ) : availableCounterparties.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem' }}>
                    {currentTenderCounterparties.length === counterparties.length
                      ? 'Все активные контрагенты уже добавлены к тендеру'
                      : 'Контрагенты не найдены по заданным критериям'
                    }
                  </p>
                ) : (
                  <>
                    <div style={{
                      maxHeight: '400px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      marginBottom: '1rem'
                    }}>
                      <table className="data-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th style={{
                              width: '50px',
                              position: 'sticky',
                              top: 0,
                              backgroundColor: 'var(--card-bg)',
                              backdropFilter: 'blur(10px)',
                              zIndex: 11,
                              borderBottom: '2px solid var(--border-color)',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                              padding: '0.75rem'
                            }}>
                              <input
                                type="checkbox"
                                checked={availableCounterparties.length > 0 && selectedCounterpartyIds.length === availableCounterparties.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCounterpartyIds(availableCounterparties.map(cp => cp.id))
                                  } else {
                                    setSelectedCounterpartyIds([])
                                  }
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                            </th>
                            <th style={{
                              position: 'sticky',
                              top: 0,
                              backgroundColor: 'var(--card-bg)',
                              backdropFilter: 'blur(10px)',
                              zIndex: 11,
                              borderBottom: '2px solid var(--border-color)',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                              padding: '0.75rem'
                            }}>Наименование</th>
                            <th style={{
                              position: 'sticky',
                              top: 0,
                              backgroundColor: 'var(--card-bg)',
                              backdropFilter: 'blur(10px)',
                              zIndex: 11,
                              borderBottom: '2px solid var(--border-color)',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                              padding: '0.75rem'
                            }}>Вид работ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availableCounterparties.map((counterparty) => (
                            <tr
                              key={counterparty.id}
                              style={{
                                cursor: 'pointer',
                                backgroundColor: selectedCounterpartyIds.includes(counterparty.id) ? 'var(--hover-bg, #f0f9ff)' : ''
                              }}
                              onClick={() => handleToggleCounterpartySelection(counterparty.id)}
                              onMouseEnter={(e) => {
                                if (!selectedCounterpartyIds.includes(counterparty.id)) {
                                  e.currentTarget.style.backgroundColor = 'var(--hover-bg, #f9fafb)'
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!selectedCounterpartyIds.includes(counterparty.id)) {
                                  e.currentTarget.style.backgroundColor = ''
                                }
                              }}
                            >
                              <td onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedCounterpartyIds.includes(counterparty.id)}
                                  onChange={() => handleToggleCounterpartySelection(counterparty.id)}
                                  style={{ cursor: 'pointer' }}
                                />
                              </td>
                              <td>{counterparty.name}</td>
                              <td>{counterparty.work_type || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {selectedCounterpartyIds.length > 0 && (
                          <span>Выбрано: <strong>{selectedCounterpartyIds.length}</strong></span>
                        )}
                      </div>
                      <button
                        onClick={handleAddCounterpartiesToTender}
                        disabled={selectedCounterpartyIds.length === 0}
                        style={{
                          backgroundColor: selectedCounterpartyIds.length > 0 ? 'var(--primary-color)' : '#9ca3af',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.75rem 2rem',
                          cursor: selectedCounterpartyIds.length > 0 ? 'pointer' : 'not-allowed',
                          fontSize: '1rem',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                          boxShadow: selectedCounterpartyIds.length > 0 ? '0 4px 6px rgba(0, 0, 0, 0.1)' : 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedCounterpartyIds.length > 0) {
                            e.target.style.transform = 'scale(1.05)'
                            e.target.style.boxShadow = '0 6px 8px rgba(0, 0, 0, 0.15)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'scale(1)'
                          if (selectedCounterpartyIds.length > 0) {
                            e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }
                        }}
                      >
                        ✓ Добавить выбранных ({selectedCounterpartyIds.length})
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default TendersPage
