import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import '../components/GeneralInfo.css'

function GeneralInfo() {
  const [activeSection, setActiveSection] = useState('objects')
  const [objects, setObjects] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [showObjectModal, setShowObjectModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [editingObject, setEditingObject] = useState(null)
  const [editingContact, setEditingContact] = useState(null)
  const fileInputRef = useRef(null)

  const [objectFormData, setObjectFormData] = useState({
    name: '',
    address: '',
    description: '',
    map_link: '',
  })

  const [contactFormData, setContactFormData] = useState({
    full_name: '',
    position: '',
    phone: '',
    email: '',
    object_id: '',
  })

  useEffect(() => {
    if (activeSection === 'objects') {
      fetchObjects()
    } else if (activeSection === 'contacts') {
      fetchContacts()
    }
  }, [activeSection])

  const fetchObjects = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('objects')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setObjects(data || [])
    } catch (error) {
      console.error('Ошибка загрузки объектов:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchContacts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('contacts')
        .select('*, objects(name)')
        .order('full_name', { ascending: true })

      if (error) throw error
      setContacts(data || [])
    } catch (error) {
      console.error('Ошибка загрузки контактов:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleObjectSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingObject) {
        // Update existing object
        const { error } = await supabase
          .from('objects')
          .update(objectFormData)
          .eq('id', editingObject.id)

        if (error) throw error
      } else {
        // Insert new object
        const { error } = await supabase.from('objects').insert([objectFormData])
        if (error) throw error
      }

      setShowObjectModal(false)
      setEditingObject(null)
      setObjectFormData({ name: '', address: '', description: '' })
      fetchObjects()
    } catch (error) {
      console.error('Ошибка сохранения объекта:', error.message)
      alert('Ошибка: ' + error.message)
    }
  }

  const handleContactSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingContact) {
        // Update existing contact
        const { error } = await supabase
          .from('contacts')
          .update(contactFormData)
          .eq('id', editingContact.id)

        if (error) throw error
      } else {
        // Insert new contact
        const { error } = await supabase.from('contacts').insert([contactFormData])
        if (error) throw error
      }

      setShowContactModal(false)
      setEditingContact(null)
      setContactFormData({
        full_name: '',
        position: '',
        phone: '',
        email: '',
        object_id: '',
      })
      fetchContacts()
    } catch (error) {
      console.error('Ошибка сохранения контакта:', error.message)
      alert('Ошибка: ' + error.message)
    }
  }

  const handleEditObject = (object) => {
    setEditingObject(object)
    setObjectFormData({
      name: object.name,
      address: object.address,
      description: object.description || '',
      map_link: object.map_link || '',
    })
    setShowObjectModal(true)
  }

  const handleEditContact = (contact) => {
    setEditingContact(contact)
    setContactFormData({
      full_name: contact.full_name,
      position: contact.position,
      phone: contact.phone,
      email: contact.email || '',
      object_id: contact.object_id || '',
    })
    setShowContactModal(true)
  }

  const handleDeleteObject = async (id, name) => {
    if (window.confirm(`Вы уверены, что хотите удалить объект "${name}"?`)) {
      try {
        const { error } = await supabase.from('objects').delete().eq('id', id)

        if (error) throw error
        fetchObjects()
      } catch (error) {
        console.error('Ошибка удаления объекта:', error.message)
        alert('Ошибка удаления: ' + error.message)
      }
    }
  }

  const handleDeleteContact = async (id, name) => {
    if (window.confirm(`Вы уверены, что хотите удалить контакт "${name}"?`)) {
      try {
        const { error } = await supabase.from('contacts').delete().eq('id', id)

        if (error) throw error
        fetchContacts()
      } catch (error) {
        console.error('Ошибка удаления контакта:', error.message)
        alert('Ошибка удаления: ' + error.message)
      }
    }
  }

  const handleAddNewObject = () => {
    setEditingObject(null)
    setObjectFormData({ name: '', address: '', description: '', map_link: '' })
    setShowObjectModal(true)
  }

  const handleAddNewContact = () => {
    setEditingContact(null)
    setContactFormData({
      full_name: '',
      position: '',
      phone: '',
      email: '',
      object_id: '',
    })
    setShowContactModal(true)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      // Валидация и трансформация данных
      const validObjects = []
      const errors = []

      jsonData.forEach((row, index) => {
        const rowNumber = index + 2 // +2 потому что строка 1 - заголовки, индекс с 0

        // Проверяем обязательные поля
        if (!row['Название'] || !row['Адрес']) {
          errors.push(
            `Строка ${rowNumber}: отсутствуют обязательные поля (Название или Адрес)`
          )
          return
        }

        validObjects.push({
          name: String(row['Название']).trim(),
          address: String(row['Адрес']).trim(),
          description: row['Описание'] ? String(row['Описание']).trim() : '',
          map_link: row['Ссылка на карту'] ? String(row['Ссылка на карту']).trim() : '',
        })
      })

      if (errors.length > 0) {
        alert(
          `Обнаружены ошибки при импорте:\n\n${errors.join('\n')}\n\nКорректные данные будут импортированы.`
        )
      }

      if (validObjects.length === 0) {
        alert('Не найдено корректных данных для импорта.')
        setImporting(false)
        return
      }

      // Сохраняем в базу данных
      const { data: insertedData, error } = await supabase
        .from('objects')
        .insert(validObjects)
        .select()

      if (error) throw error

      alert(
        `Успешно импортировано ${insertedData.length} объект(ов)${errors.length > 0 ? ` (пропущено строк с ошибками: ${errors.length})` : ''}`
      )

      // Обновляем список объектов
      fetchObjects()

      // Очищаем input
      event.target.value = ''
    } catch (error) {
      console.error('Ошибка импорта:', error)
      alert(`Ошибка при импорте файла: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="general-info">
      <div className="general-info-header">
        <h2>Общая информация</h2>
      </div>

      <div className="section-tabs">
        <button
          className={`section-tab ${activeSection === 'objects' ? 'active' : ''}`}
          onClick={() => setActiveSection('objects')}
        >
          Объекты
        </button>
        <button
          className={`section-tab ${activeSection === 'contacts' ? 'active' : ''}`}
          onClick={() => setActiveSection('contacts')}
        >
          Контакты
        </button>
      </div>

      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : (
        <>
          {activeSection === 'objects' && (
            <div className="section-content">
              <div className="section-actions">
                <button className="btn-primary" onClick={handleAddNewObject}>
                  + Добавить объект
                </button>
                <button
                  className="btn-secondary"
                  onClick={handleImportClick}
                  disabled={importing}
                >
                  {importing ? 'Импорт...' : '📥 Импорт из Excel'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileImport}
                  style={{ display: 'none' }}
                />
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Название объекта</th>
                      <th>Адрес</th>
                      <th>Описание</th>
                      <th>Ссылка на карту</th>
                      <th className="actions-column">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objects.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="no-data">
                          Нет объектов. Добавьте первый объект.
                        </td>
                      </tr>
                    ) : (
                      objects.map((object) => (
                        <tr key={object.id}>
                          <td>{object.name}</td>
                          <td>{object.address}</td>
                          <td>{object.description}</td>
                          <td>
                            {object.map_link ? (
                              <a
                                href={object.map_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link"
                              >
                                Открыть карту
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="actions-cell">
                            <button
                              className="btn-icon btn-edit"
                              onClick={() => handleEditObject(object)}
                              title="Редактировать"
                            >
                              ✏️
                            </button>
                            <button
                              className="btn-icon btn-delete"
                              onClick={() =>
                                handleDeleteObject(object.id, object.name)
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
            </div>
          )}

          {activeSection === 'contacts' && (
            <div className="section-content">
              <div className="section-actions">
                <button className="btn-primary" onClick={handleAddNewContact}>
                  + Добавить контакт
                </button>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ФИО</th>
                      <th>Должность</th>
                      <th>Телефон</th>
                      <th>Email</th>
                      <th>Объект</th>
                      <th className="actions-column">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="no-data">
                          Нет контактов. Добавьте первый контакт.
                        </td>
                      </tr>
                    ) : (
                      contacts.map((contact) => (
                        <tr key={contact.id}>
                          <td>{contact.full_name}</td>
                          <td>{contact.position}</td>
                          <td>{contact.phone}</td>
                          <td>{contact.email}</td>
                          <td>{contact.objects?.name || '-'}</td>
                          <td className="actions-cell">
                            <button
                              className="btn-icon btn-edit"
                              onClick={() => handleEditContact(contact)}
                              title="Редактировать"
                            >
                              ✏️
                            </button>
                            <button
                              className="btn-icon btn-delete"
                              onClick={() =>
                                handleDeleteContact(contact.id, contact.full_name)
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
            </div>
          )}
        </>
      )}

      {/* Modal для добавления/редактирования объекта */}
      {showObjectModal && (
        <div className="modal-overlay" onClick={() => setShowObjectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {editingObject ? 'Редактировать объект' : 'Добавить новый объект'}
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowObjectModal(false)
                  setEditingObject(null)
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleObjectSubmit}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Название объекта *</label>
                  <input
                    type="text"
                    value={objectFormData.name}
                    onChange={(e) =>
                      setObjectFormData({ ...objectFormData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label>Адрес *</label>
                  <input
                    type="text"
                    value={objectFormData.address}
                    onChange={(e) =>
                      setObjectFormData({ ...objectFormData, address: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label>Описание</label>
                  <textarea
                    value={objectFormData.description}
                    onChange={(e) =>
                      setObjectFormData({
                        ...objectFormData,
                        description: e.target.value,
                      })
                    }
                    rows="3"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Ссылка на карту</label>
                  <input
                    type="url"
                    value={objectFormData.map_link}
                    onChange={(e) =>
                      setObjectFormData({
                        ...objectFormData,
                        map_link: e.target.value,
                      })
                    }
                    placeholder="https://maps.google.com/..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowObjectModal(false)
                    setEditingObject(null)
                  }}
                >
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  {editingObject ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal для добавления/редактирования контакта */}
      {showContactModal && (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {editingContact
                  ? 'Редактировать контакт'
                  : 'Добавить новый контакт'}
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowContactModal(false)
                  setEditingContact(null)
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleContactSubmit}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>ФИО *</label>
                  <input
                    type="text"
                    value={contactFormData.full_name}
                    onChange={(e) =>
                      setContactFormData({
                        ...contactFormData,
                        full_name: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Должность *</label>
                  <select
                    value={contactFormData.position}
                    onChange={(e) =>
                      setContactFormData({
                        ...contactFormData,
                        position: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Выберите должность</option>
                    <option value="Руководитель">Руководитель</option>
                    <option value="Экономист">Экономист</option>
                    <option value="Старший инженер">Старший инженер</option>
                    <option value="Инженер">Инженер</option>
                    <option value="Прораб">Прораб</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Объект</label>
                  <select
                    value={contactFormData.object_id}
                    onChange={(e) =>
                      setContactFormData({
                        ...contactFormData,
                        object_id: e.target.value,
                      })
                    }
                  >
                    <option value="">Не привязан к объекту</option>
                    {objects.map((obj) => (
                      <option key={obj.id} value={obj.id}>
                        {obj.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Телефон *</label>
                  <input
                    type="tel"
                    value={contactFormData.phone}
                    onChange={(e) =>
                      setContactFormData({ ...contactFormData, phone: e.target.value })
                    }
                    required
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={contactFormData.email}
                    onChange={(e) =>
                      setContactFormData({ ...contactFormData, email: e.target.value })
                    }
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowContactModal(false)
                    setEditingContact(null)
                  }}
                >
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  {editingContact ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default GeneralInfo
