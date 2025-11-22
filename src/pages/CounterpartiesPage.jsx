import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import '../components/GeneralInfo.css'

function CounterpartiesPage() {
  const [counterparties, setCounterparties] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [showCounterpartyModal, setShowCounterpartyModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showImportInstructionsModal, setShowImportInstructionsModal] = useState(false)
  const [editingCounterparty, setEditingCounterparty] = useState(null)
  const [selectedCounterparty, setSelectedCounterparty] = useState(null)
  const [editingContact, setEditingContact] = useState(null)
  const fileInputRef = useRef(null)

  const [counterpartyFormData, setCounterpartyFormData] = useState({
    name: '',
    work_type: '',
    inn: '',
    kpp: '',
    legal_address: '',
    actual_address: '',
    website: '',
    status: 'active',
    notes: '',
  })

  const [contactFormData, setContactFormData] = useState({
    full_name: '',
    position: '',
    phone: '',
    email: '',
  })

  // Контакты, которые добавляются при создании/редактировании контрагента
  const [tempContacts, setTempContacts] = useState([])
  const [editingTempContactIndex, setEditingTempContactIndex] = useState(null)

  useEffect(() => {
    fetchCounterparties()
  }, [])

  const fetchCounterparties = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('counterparties')
        .select(`
          *,
          counterparty_contacts (
            id,
            full_name,
            position,
            phone,
            email
          )
        `)
        .order('name', { ascending: true })

      if (error) throw error
      setCounterparties(data || [])
    } catch (error) {
      console.error('Ошибка загрузки контрагентов:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCounterpartySubmit = async (e) => {
    e.preventDefault()
    try {
      let counterpartyId

      if (editingCounterparty) {
        // Обновление существующего контрагента
        const { error } = await supabase
          .from('counterparties')
          .update(counterpartyFormData)
          .eq('id', editingCounterparty.id)

        if (error) throw error
        counterpartyId = editingCounterparty.id

        // Удаляем старые контакты и добавляем новые (упрощенный подход)
        // В реальном приложении можно делать более умное обновление
        const { error: deleteError } = await supabase
          .from('counterparty_contacts')
          .delete()
          .eq('counterparty_id', counterpartyId)

        if (deleteError) throw deleteError
      } else {
        // Создание нового контрагента
        const { data, error } = await supabase
          .from('counterparties')
          .insert([counterpartyFormData])
          .select()

        if (error) throw error
        counterpartyId = data[0].id
      }

      // Добавляем контакты
      if (tempContacts.length > 0) {
        const contactsToInsert = tempContacts.map(contact => ({
          ...contact,
          counterparty_id: counterpartyId
        }))

        const { error: contactsError } = await supabase
          .from('counterparty_contacts')
          .insert(contactsToInsert)

        if (contactsError) throw contactsError
      }

      setShowCounterpartyModal(false)
      setEditingCounterparty(null)
      setCounterpartyFormData({
        name: '',
        work_type: '',
        inn: '',
        kpp: '',
        legal_address: '',
        actual_address: '',
        website: '',
        status: 'active',
        notes: '',
      })
      setTempContacts([])
      fetchCounterparties()
    } catch (error) {
      console.error('Ошибка сохранения контрагента:', error.message)
      alert('Ошибка: ' + error.message)
    }
  }

  const handleContactSubmit = async (e) => {
    e.preventDefault()
    try {
      const contactData = {
        ...contactFormData,
        counterparty_id: selectedCounterparty.id
      }

      if (editingContact) {
        const { error } = await supabase
          .from('counterparty_contacts')
          .update(contactFormData)
          .eq('id', editingContact.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('counterparty_contacts')
          .insert([contactData])
        if (error) throw error
      }

      setShowContactModal(false)
      setEditingContact(null)
      setContactFormData({
        full_name: '',
        position: '',
        phone: '',
        email: '',
      })
      fetchCounterparties()
    } catch (error) {
      console.error('Ошибка сохранения контакта:', error.message)
      alert('Ошибка: ' + error.message)
    }
  }

  const handleEditCounterparty = (counterparty) => {
    setEditingCounterparty(counterparty)
    setCounterpartyFormData({
      name: counterparty.name,
      work_type: counterparty.work_type || '',
      inn: counterparty.inn || '',
      kpp: counterparty.kpp || '',
      legal_address: counterparty.legal_address || '',
      actual_address: counterparty.actual_address || '',
      website: counterparty.website || '',
      status: counterparty.status || 'active',
      notes: counterparty.notes || '',
    })
    // Загружаем существующие контакты в tempContacts
    setTempContacts(counterparty.counterparty_contacts || [])
    setShowCounterpartyModal(true)
  }

  // Функции для работы с временными контактами в форме контрагента
  const handleAddTempContact = () => {
    if (!contactFormData.full_name.trim()) {
      alert('Введите ФИО контакта')
      return
    }

    if (editingTempContactIndex !== null) {
      // Редактирование существующего временного контакта
      const updatedContacts = [...tempContacts]
      updatedContacts[editingTempContactIndex] = { ...contactFormData }
      setTempContacts(updatedContacts)
      setEditingTempContactIndex(null)
    } else {
      // Добавление нового временного контакта
      setTempContacts([...tempContacts, { ...contactFormData }])
    }

    // Очищаем форму контакта
    setContactFormData({
      full_name: '',
      position: '',
      phone: '',
      email: '',
    })
  }

  const handleEditTempContact = (index) => {
    setContactFormData({ ...tempContacts[index] })
    setEditingTempContactIndex(index)
  }

  const handleDeleteTempContact = (index) => {
    setTempContacts(tempContacts.filter((_, i) => i !== index))
    if (editingTempContactIndex === index) {
      setEditingTempContactIndex(null)
      setContactFormData({
        full_name: '',
        position: '',
        phone: '',
        email: '',
      })
    }
  }

  const handleCancelEditTempContact = () => {
    setEditingTempContactIndex(null)
    setContactFormData({
      full_name: '',
      position: '',
      phone: '',
      email: '',
    })
  }

  const handleAddContact = (counterparty) => {
    setSelectedCounterparty(counterparty)
    setEditingContact(null)
    setContactFormData({
      full_name: '',
      position: '',
      phone: '',
      email: '',
    })
    setShowContactModal(true)
  }

  const handleEditContact = (counterparty, contact) => {
    setSelectedCounterparty(counterparty)
    setEditingContact(contact)
    setContactFormData({
      full_name: contact.full_name,
      position: contact.position || '',
      phone: contact.phone || '',
      email: contact.email || '',
    })
    setShowContactModal(true)
  }

  const handleDeleteContact = async (contactId, contactName) => {
    if (window.confirm(`Вы уверены, что хотите удалить контакт "${contactName}"?`)) {
      try {
        const { error } = await supabase
          .from('counterparty_contacts')
          .delete()
          .eq('id', contactId)

        if (error) throw error
        fetchCounterparties()
      } catch (error) {
        console.error('Ошибка удаления контакта:', error.message)
        alert('Ошибка удаления: ' + error.message)
      }
    }
  }

  const handleDeleteCounterparty = async (id, name) => {
    if (window.confirm(`Вы уверены, что хотите удалить контрагента "${name}"?`)) {
      try {
        const { error } = await supabase.from('counterparties').delete().eq('id', id)
        if (error) throw error
        fetchCounterparties()
      } catch (error) {
        console.error('Ошибка удаления контрагента:', error.message)
        alert('Ошибка удаления: ' + error.message)
      }
    }
  }

  const handleAddNewCounterparty = () => {
    setEditingCounterparty(null)
    setCounterpartyFormData({
      name: '',
      work_type: '',
      inn: '',
      kpp: '',
      legal_address: '',
      actual_address: '',
      website: '',
      status: 'active',
      notes: '',
    })
    setTempContacts([])
    setContactFormData({
      full_name: '',
      position: '',
      phone: '',
      email: '',
    })
    setEditingTempContactIndex(null)
    setShowCounterpartyModal(true)
  }

  const handleImportClick = () => {
    setShowImportInstructionsModal(true)
  }

  const handleProceedWithImport = () => {
    setShowImportInstructionsModal(false)
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

      const counterpartiesToInsert = []
      const contactsToInsert = []
      const errors = []

      jsonData.forEach((row, index) => {
        const rowNumber = index + 2

        // Проверяем обязательное поле - наименование организации
        if (!row['Наименование организации']) {
          errors.push(`Строка ${rowNumber}: отсутствует обязательное поле "Наименование организации"`)
          return
        }

        // Создаем ID для контрагента (временный, для связи с контактами)
        const tempId = `temp_${index}`

        // Добавляем контрагента
        counterpartiesToInsert.push({
          tempId,
          name: String(row['Наименование организации']).trim(),
          work_type: row['Вид работ'] ? String(row['Вид работ']).trim() : null,
          inn: row['ИНН'] ? String(row['ИНН']).trim() : null,
          kpp: row['КПП'] ? String(row['КПП']).trim() : null,
          legal_address: row['Юридический адрес'] ? String(row['Юридический адрес']).trim() : null,
          actual_address: row['Фактический адрес'] ? String(row['Фактический адрес']).trim() : null,
          website: row['Ссылка на сайт'] ? String(row['Ссылка на сайт']).trim() : null,
          status: row['Статус'] === 'Черный список' ? 'blacklist' : 'active',
          notes: row['Примечание'] ? String(row['Примечание']).trim() : null,
        })

        // Добавляем контакт, если указан
        if (row['ФИО контакта']) {
          contactsToInsert.push({
            tempCounterpartyId: tempId,
            full_name: String(row['ФИО контакта']).trim(),
            position: row['Должность контакта'] ? String(row['Должность контакта']).trim() : null,
            phone: row['Телефон контакта'] ? String(row['Телефон контакта']).trim() : null,
            email: row['Email контакта'] ? String(row['Email контакта']).trim() : null,
          })
        }
      })

      if (errors.length > 0) {
        alert(`Обнаружены ошибки при импорте:\n\n${errors.join('\n')}\n\nКорректные данные будут импортированы.`)
      }

      if (counterpartiesToInsert.length === 0) {
        alert('Не найдено корректных данных для импорта.')
        setImporting(false)
        return
      }

      // Сохраняем контрагентов
      const counterpartiesToDB = counterpartiesToInsert.map(({ tempId, ...rest }) => rest)
      const { data: insertedCounterparties, error: counterpartiesError } = await supabase
        .from('counterparties')
        .insert(counterpartiesToDB)
        .select()

      if (counterpartiesError) throw counterpartiesError

      // Сопоставляем временные ID с реальными
      const idMapping = {}
      counterpartiesToInsert.forEach((cp, index) => {
        idMapping[cp.tempId] = insertedCounterparties[index].id
      })

      // Сохраняем контакты
      if (contactsToInsert.length > 0) {
        const contactsToDB = contactsToInsert.map(({ tempCounterpartyId, ...contact }) => ({
          ...contact,
          counterparty_id: idMapping[tempCounterpartyId]
        }))

        const { error: contactsError } = await supabase
          .from('counterparty_contacts')
          .insert(contactsToDB)

        if (contactsError) throw contactsError
      }

      alert(
        `Успешно импортировано:\n` +
        `- Контрагентов: ${insertedCounterparties.length}\n` +
        `- Контактов: ${contactsToInsert.length}` +
        `${errors.length > 0 ? `\n\nПропущено строк с ошибками: ${errors.length}` : ''}`
      )

      fetchCounterparties()
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
        <h2>Контрагенты</h2>
      </div>

      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : (
        <div className="section-content">
          <div className="section-actions">
            <button className="btn-primary" onClick={handleAddNewCounterparty}>
              + Добавить контрагента
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
                  <th>Наименование</th>
                  <th>Вид работ</th>
                  <th>ИНН</th>
                  <th>Статус</th>
                  <th>Примечание</th>
                  <th>Ссылка на сайт</th>
                  <th>Контактные данные</th>
                  <th className="actions-column">Действия</th>
                </tr>
              </thead>
              <tbody>
                {counterparties.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-data">
                      Нет контрагентов. Добавьте первого контрагента.
                    </td>
                  </tr>
                ) : (
                  counterparties.map((counterparty) => (
                    <tr key={counterparty.id}>
                      <td>{counterparty.name}</td>
                      <td>{counterparty.work_type || '-'}</td>
                      <td>{counterparty.inn || '-'}</td>
                      <td>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          backgroundColor: counterparty.status === 'blacklist' ? '#fee2e2' : '#d1fae5',
                          color: counterparty.status === 'blacklist' ? '#991b1b' : '#065f46'
                        }}>
                          {counterparty.status === 'blacklist' ? 'Черный список' : 'Действующий'}
                        </span>
                      </td>
                      <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {counterparty.notes || '-'}
                      </td>
                      <td>
                        {counterparty.website ? (
                          <a
                            href={counterparty.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}
                          >
                            {counterparty.website}
                          </a>
                        ) : '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {counterparty.counterparty_contacts && counterparty.counterparty_contacts.length > 0 ? (
                            <>
                              {counterparty.counterparty_contacts.map((contact) => (
                                <div
                                  key={contact.id}
                                  style={{
                                    padding: '0.5rem',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    borderRadius: '4px',
                                    fontSize: '0.875rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start'
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                                      {contact.full_name}
                                    </div>
                                    {contact.position && (
                                      <div style={{ color: 'var(--text-tertiary)' }}>
                                        {contact.position}
                                      </div>
                                    )}
                                    {contact.phone && (
                                      <div style={{ marginTop: '0.25rem' }}>
                                        📞 {contact.phone}
                                      </div>
                                    )}
                                    {contact.email && (
                                      <div>
                                        ✉️ {contact.email}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                                    <button
                                      className="btn-icon btn-edit"
                                      onClick={() => handleEditContact(counterparty, contact)}
                                      title="Редактировать контакт"
                                      style={{ fontSize: '0.875rem', padding: '0.25rem' }}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      className="btn-icon btn-delete"
                                      onClick={() => handleDeleteContact(contact.id, contact.full_name)}
                                      title="Удалить контакт"
                                      style={{ fontSize: '0.875rem', padding: '0.25rem' }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button
                                className="btn-secondary"
                                onClick={() => handleAddContact(counterparty)}
                                style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', marginTop: '0.25rem' }}
                              >
                                + Добавить контакт
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn-primary"
                              onClick={() => handleAddContact(counterparty)}
                              style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
                            >
                              + Добавить контакт
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="actions-cell">
                        <button
                          className="btn-icon btn-edit"
                          onClick={() => handleEditCounterparty(counterparty)}
                          title="Редактировать"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon btn-delete"
                          onClick={() =>
                            handleDeleteCounterparty(counterparty.id, counterparty.name)
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

      {/* Modal для добавления/редактирования контрагента */}
      {showCounterpartyModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCounterpartyModal(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {editingCounterparty
                  ? 'Редактировать контрагента'
                  : 'Добавить нового контрагента'}
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowCounterpartyModal(false)
                  setEditingCounterparty(null)
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCounterpartySubmit}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Наименование организации *</label>
                  <input
                    type="text"
                    value={counterpartyFormData.name}
                    onChange={(e) =>
                      setCounterpartyFormData({
                        ...counterpartyFormData,
                        name: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label>Вид работ</label>
                  <input
                    type="text"
                    value={counterpartyFormData.work_type}
                    onChange={(e) =>
                      setCounterpartyFormData({
                        ...counterpartyFormData,
                        work_type: e.target.value,
                      })
                    }
                    placeholder="Например: Строительно-монтажные работы, Электромонтажные работы и т.д."
                  />
                </div>

                <div className="form-group">
                  <label>ИНН</label>
                  <input
                    type="text"
                    value={counterpartyFormData.inn}
                    onChange={(e) =>
                      setCounterpartyFormData({
                        ...counterpartyFormData,
                        inn: e.target.value,
                      })
                    }
                    placeholder="1234567890"
                    maxLength="12"
                  />
                </div>

                <div className="form-group">
                  <label>КПП</label>
                  <input
                    type="text"
                    value={counterpartyFormData.kpp}
                    onChange={(e) =>
                      setCounterpartyFormData({
                        ...counterpartyFormData,
                        kpp: e.target.value,
                      })
                    }
                    placeholder="123456789"
                    maxLength="9"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Юридический адрес</label>
                  <input
                    type="text"
                    value={counterpartyFormData.legal_address}
                    onChange={(e) =>
                      setCounterpartyFormData({
                        ...counterpartyFormData,
                        legal_address: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group full-width">
                  <label>Фактический адрес</label>
                  <input
                    type="text"
                    value={counterpartyFormData.actual_address}
                    onChange={(e) =>
                      setCounterpartyFormData({
                        ...counterpartyFormData,
                        actual_address: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group full-width">
                  <label>Ссылка на сайт</label>
                  <input
                    type="url"
                    value={counterpartyFormData.website}
                    onChange={(e) =>
                      setCounterpartyFormData({
                        ...counterpartyFormData,
                        website: e.target.value,
                      })
                    }
                    placeholder="https://example.com"
                  />
                </div>

                <div className="form-group">
                  <label>Статус</label>
                  <select
                    value={counterpartyFormData.status}
                    onChange={(e) =>
                      setCounterpartyFormData({
                        ...counterpartyFormData,
                        status: e.target.value,
                      })
                    }
                  >
                    <option value="active">Действующий</option>
                    <option value="blacklist">Черный список</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>Примечание</label>
                  <textarea
                    value={counterpartyFormData.notes}
                    onChange={(e) =>
                      setCounterpartyFormData({
                        ...counterpartyFormData,
                        notes: e.target.value,
                      })
                    }
                    placeholder="Дополнительная информация о контрагенте"
                    rows="3"
                  />
                </div>
              </div>

              {/* Секция контактов */}
              <div style={{ marginTop: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
                  Контактные лица
                </h4>

                {/* Список добавленных контактов */}
                {tempContacts.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    {tempContacts.map((contact, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: 'var(--bg-secondary)',
                          borderRadius: '4px',
                          marginBottom: '0.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          border: editingTempContactIndex === index ? '2px solid #2563eb' : '1px solid var(--border-color)'
                        }}
                      >
                        <div style={{ fontSize: '0.875rem' }}>
                          <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                            {contact.full_name}
                          </div>
                          {contact.position && (
                            <div style={{ color: 'var(--text-tertiary)' }}>
                              {contact.position}
                            </div>
                          )}
                          {contact.phone && (
                            <div style={{ marginTop: '0.25rem' }}>
                              📞 {contact.phone}
                            </div>
                          )}
                          {contact.email && (
                            <div>
                              ✉️ {contact.email}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="btn-icon btn-edit"
                            onClick={() => handleEditTempContact(index)}
                            title="Редактировать"
                            style={{ fontSize: '0.875rem', padding: '0.25rem' }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn-icon btn-delete"
                            onClick={() => handleDeleteTempContact(index)}
                            title="Удалить"
                            style={{ fontSize: '0.875rem', padding: '0.25rem' }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Форма добавления/редактирования контакта */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                      ФИО
                    </label>
                    <input
                      type="text"
                      value={contactFormData.full_name}
                      onChange={(e) =>
                        setContactFormData({
                          ...contactFormData,
                          full_name: e.target.value,
                        })
                      }
                      placeholder="Иванов Иван Иванович"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                      Должность
                    </label>
                    <input
                      type="text"
                      value={contactFormData.position}
                      onChange={(e) =>
                        setContactFormData({
                          ...contactFormData,
                          position: e.target.value,
                        })
                      }
                      placeholder="Директор"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                      Телефон
                    </label>
                    <input
                      type="tel"
                      value={contactFormData.phone}
                      onChange={(e) =>
                        setContactFormData({
                          ...contactFormData,
                          phone: e.target.value,
                        })
                      }
                      placeholder="+7 (999) 123-45-67"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={contactFormData.email}
                      onChange={(e) =>
                        setContactFormData({
                          ...contactFormData,
                          email: e.target.value,
                        })
                      }
                      placeholder="email@example.com"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleAddTempContact}
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    {editingTempContactIndex !== null ? '✓ Сохранить контакт' : '+ Добавить контакт'}
                  </button>
                  {editingTempContactIndex !== null && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCancelEditTempContact}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      Отмена
                    </button>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowCounterpartyModal(false)
                    setEditingCounterparty(null)
                  }}
                >
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  {editingCounterparty ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal для добавления/редактирования контакта контрагента */}
      {showContactModal && (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {editingContact ? 'Редактировать контакт' : 'Добавить контакт'}
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
                  <label>Контрагент</label>
                  <input
                    type="text"
                    value={selectedCounterparty?.name || ''}
                    disabled
                    style={{ backgroundColor: 'var(--bg-tertiary)', cursor: 'not-allowed' }}
                  />
                </div>

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
                  <label>Должность</label>
                  <input
                    type="text"
                    value={contactFormData.position}
                    onChange={(e) =>
                      setContactFormData({
                        ...contactFormData,
                        position: e.target.value,
                      })
                    }
                    placeholder="Директор, Главный бухгалтер и т.д."
                  />
                </div>

                <div className="form-group">
                  <label>Телефон</label>
                  <input
                    type="tel"
                    value={contactFormData.phone}
                    onChange={(e) =>
                      setContactFormData({
                        ...contactFormData,
                        phone: e.target.value,
                      })
                    }
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Email</label>
                  <input
                    type="email"
                    value={contactFormData.email}
                    onChange={(e) =>
                      setContactFormData({
                        ...contactFormData,
                        email: e.target.value,
                      })
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

      {/* Modal с инструкцией по импорту */}
      {showImportInstructionsModal && (
        <div className="modal-overlay" onClick={() => setShowImportInstructionsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Инструкция по импорту контрагентов из Excel</h3>
              <button
                className="modal-close"
                onClick={() => setShowImportInstructionsModal(false)}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '2rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
                  📋 Формат файла Excel
                </h4>
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  Файл должен содержать следующие столбцы (первая строка - заголовки):
                </p>
              </div>

              <div style={{
                backgroundColor: 'var(--bg-tertiary)',
                padding: '1rem',
                borderRadius: '6px',
                marginBottom: '1.5rem',
                overflowX: 'auto'
              }}>
                <table style={{
                  width: '100%',
                  fontSize: '0.875rem',
                  borderCollapse: 'collapse'
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-primary)', fontWeight: '600' }}>Название столбца</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-primary)', fontWeight: '600' }}>Обязательно</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-primary)', fontWeight: '600' }}>Пример</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Наименование организации</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{ color: '#dc2626', fontWeight: '600' }}>Да</span>
                      </td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>ООО "Стройком"</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Вид работ</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>Нет</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>Строительно-монтажные работы</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>ИНН</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>Нет</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>7728123456</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>КПП</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>Нет</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>772801001</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Юридический адрес</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>Нет</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>г. Москва, ул. Ленина, д. 1</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Фактический адрес</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>Нет</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>г. Москва, ул. Ленина, д. 1</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Ссылка на сайт</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>Нет</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>https://stroykom.ru</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Статус</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>Нет</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>Действующий или Черный список</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Примечание</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>Нет</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>Хороший подрядчик, рекомендуем</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>ФИО контакта</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>Нет</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>Иванов Иван Иванович</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Должность контакта</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>Нет</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>Директор</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Телефон контакта</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>Нет</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>+7 (999) 123-45-67</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Email контакта</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>Нет</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>director@stroykom.ru</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{
                backgroundColor: '#dbeafe',
                border: '1px solid #3b82f6',
                padding: '1rem',
                borderRadius: '6px',
                marginBottom: '1.5rem'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  💡 Важные замечания
                </h4>
                <ul style={{ margin: '0', paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#1e3a8a' }}>
                  <li style={{ marginBottom: '0.25rem' }}>Названия столбцов должны точно совпадать с указанными выше</li>
                  <li style={{ marginBottom: '0.25rem' }}>Первая строка файла должна содержать заголовки столбцов</li>
                  <li style={{ marginBottom: '0.25rem' }}>Каждая строка = один контрагент с одним контактом (опционально)</li>
                  <li style={{ marginBottom: '0.25rem' }}>Если у контрагента несколько контактов, добавьте их вручную после импорта</li>
                  <li>Пустые ячейки допускаются (кроме "Наименование организации")</li>
                </ul>
              </div>

              <div style={{
                backgroundColor: 'var(--bg-tertiary)',
                padding: '1rem',
                borderRadius: '6px'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  📝 Пример структуры файла
                </h4>
                <p style={{ margin: '0', fontSize: '0.8125rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                  | Наименование организации | ИНН | КПП | ... | ФИО контакта | Должность контакта | ...<br/>
                  | ООО "Стройком" | 7728123456 | 772801001 | ... | Иванов И.И. | Директор | ...<br/>
                  | ЗАО "Ремонт+" | 7729654321 | ... | ... | Петров П.П. | Главный инженер | ...
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowImportInstructionsModal(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleProceedWithImport}
              >
                Выбрать файл
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CounterpartiesPage
