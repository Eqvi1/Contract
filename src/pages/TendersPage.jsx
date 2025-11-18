import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import '../components/Tenders.css'

function TendersPage() {
  const [tenders, setTenders] = useState([])
  const [objects, setObjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTender, setEditingTender] = useState(null)
  const [formData, setFormData] = useState({
    object_id: '',
    work_description: '',
    status: 'Не начат',
    start_date: '',
    end_date: '',
    tender_package_link: '',
  })

  const statusOptions = ['Не начат', 'Идет тендерная процедура', 'Завершен']

  useEffect(() => {
    fetchTenders()
    fetchObjects()
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
                <td colSpan="7" className="no-data">
                  Нет тендеров. Добавьте первый тендер.
                </td>
              </tr>
            ) : (
              tenders.map((tender) => (
                <tr key={tender.id}>
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
    </div>
  )
}

export default TendersPage
