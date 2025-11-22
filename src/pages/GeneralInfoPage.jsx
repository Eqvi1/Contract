import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import '../components/GeneralInfo.css'

// Глобальная переменная для хранения экземпляра карты
let mapInstance = null

function GeneralInfo() {
  const [activeSection, setActiveSection] = useState('objects')
  const [objects, setObjects] = useState([])
  const [contacts, setContacts] = useState([])
  const [counterparties, setCounterparties] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [showObjectModal, setShowObjectModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showCounterpartyModal, setShowCounterpartyModal] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapFilter, setMapFilter] = useState('all') // 'all', 'main_construction', 'warranty_service'
  const [editingObject, setEditingObject] = useState(null)
  const [editingContact, setEditingContact] = useState(null)
  const [editingCounterparty, setEditingCounterparty] = useState(null)
  const fileInputRef = useRef(null)
  const mapInitialized = useRef(false)

  const [objectFormData, setObjectFormData] = useState({
    name: '',
    address: '',
    description: '',
    map_link: '',
    latitude: '',
    longitude: '',
    status: 'main_construction',
  })

  const [contactFormData, setContactFormData] = useState({
    full_name: '',
    position: '',
    phone: '',
    email: '',
    object_id: '',
  })

  const [counterpartyFormData, setCounterpartyFormData] = useState({
    name: '',
    inn: '',
    kpp: '',
    legal_address: '',
    actual_address: '',
    director_name: '',
    contact_phone: '',
    contact_email: '',
  })

  useEffect(() => {
    if (activeSection === 'objects') {
      fetchObjects()
    } else if (activeSection === 'contacts') {
      fetchContacts()
    } else if (activeSection === 'counterparties') {
      fetchCounterparties()
    }
  }, [activeSection])

  // Инициализация карты при открытии модального окна или изменении фильтра
  useEffect(() => {
    if (showMapModal && objects.length > 0) {
      // Небольшая задержка для рендера DOM
      const timer = setTimeout(() => {
        if (window.ymaps) {
          console.log('Инициализация/обновление карты...')
          window.ymaps.ready(() => {
            initMap()
          })
        }
      }, 100)

      return () => clearTimeout(timer)
    }

    return () => {
      if (mapInstance && !showMapModal) {
        console.log('Очистка карты...')
        mapInstance.destroy()
        mapInstance = null
        mapInitialized.current = false
      }
    }
  }, [showMapModal, objects, mapFilter])

  // Функция для получения координат объекта
  // Приоритет: прямые координаты (latitude/longitude) -> извлечение из ссылки
  const getObjectCoordinates = (object) => {
    // Приоритет 1: Используем прямые координаты, если они заполнены
    if (object.latitude !== null && object.latitude !== undefined &&
        object.longitude !== null && object.longitude !== undefined) {
      const lat = parseFloat(object.latitude)
      const lon = parseFloat(object.longitude)

      // Дополнительная проверка диапазона координат
      if (!isNaN(lat) && !isNaN(lon) &&
          lat >= -90 && lat <= 90 &&
          lon >= -180 && lon <= 180) {
        console.log(`✅ Используем прямые координаты для "${object.name}":`, [lat, lon])
        return [lat, lon]
      } else {
        console.warn(`❌ Координаты вне допустимого диапазона для "${object.name}":`, { lat, lon })
      }
    }

    console.warn(`❌ Объект "${object.name}" не имеет валидных координат`)
    return null
  }

  const initMap = async () => {
    try {
      setMapLoading(true)
      console.log('Начало инициализации карты')
      console.log('window.ymaps доступен:', !!window.ymaps)
      console.log('Количество объектов:', objects.length)

      if (mapInstance) {
        console.log('Уничтожение старого экземпляра карты')
        mapInstance.destroy()
      }

      const mapContainer = document.getElementById('yandex-map')
      if (!mapContainer) {
        console.error('Контейнер карты не найден!')
        alert('Ошибка: контейнер карты не найден!')
        setMapLoading(false)
        return
      }

      console.log('Контейнер карты найден:', mapContainer)
      console.log('Создание экземпляра карты...')

      // Создаем карту с центром в Москве по умолчанию
      mapInstance = new window.ymaps.Map('yandex-map', {
        center: [55.75, 37.57],
        zoom: 10,
        controls: ['zoomControl', 'fullscreenControl', 'geolocationControl']
      })

      mapInitialized.current = true
      console.log('Карта создана успешно')

      // Фильтруем объекты по выбранному статусу
      const filteredObjects = mapFilter === 'all'
        ? objects
        : objects.filter(obj => {
            // Если статус не задан, считаем его 'main_construction' (значение по умолчанию)
            const objectStatus = obj.status || 'main_construction'
            return objectStatus === mapFilter
          })

      // Добавляем метки для каждого объекта
      const bounds = []
      let successCount = 0
      let failCount = 0

      console.log(`Фильтр: ${mapFilter}`)
      console.log(`Обработка ${filteredObjects.length} из ${objects.length} объектов...`)

      for (let i = 0; i < filteredObjects.length; i++) {
        const object = filteredObjects[i]
        console.log(`\n--- Объект ${i + 1}/${filteredObjects.length} ---`)
        console.log('Название:', object.name)
        console.log('Статус:', object.status)
        console.log('Координаты:', object.latitude, object.longitude)

        // Получаем координаты объекта
        const coords = getObjectCoordinates(object)

        // Если координат нет - пропускаем объект
        if (!coords || !Array.isArray(coords) || coords.length !== 2 ||
            isNaN(coords[0]) || isNaN(coords[1])) {
          console.warn('❌ Пропущен: нет валидных координат')
          failCount++
          continue
        }

        try {
          console.log('✅ Используем координаты:', coords)

          // Проверяем, что coords - это массив с двумя числами
          if (!Array.isArray(coords) || coords.length !== 2) {
            console.error('❌ Некорректный формат координат:', coords)
            failCount++
            continue
          }

          const [lat, lon] = coords
          if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
            console.error('❌ Координаты не являются числами:', { lat, lon })
            failCount++
            continue
          }

          // Дополнительная проверка диапазона перед добавлением в bounds
          if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            console.error('❌ Координаты вне допустимого диапазона:', { lat, lon })
            failCount++
            continue
          }

          // Создаем метку
          const placemark = new window.ymaps.Placemark(
            [lat, lon], // Используем явно числовой массив
            {
              balloonContentHeader: `<strong>${object.name || 'Без названия'}</strong>`,
              balloonContentBody: `
                <p><strong>Адрес:</strong> ${object.address || 'Не указан'}</p>
                ${object.description ? `<p><strong>Описание:</strong> ${object.description}</p>` : ''}
                <p><strong>Статус:</strong> ${(object.status || 'main_construction') === 'warranty_service' ? 'Гарантийное обслуживание' : 'Основное строительство'}</p>
                ${object.map_link ? `<p><a href="${object.map_link}" target="_blank" rel="noopener noreferrer">Открыть в Яндекс.Картах</a></p>` : ''}
              `,
              hintContent: object.name || 'Объект',
              iconContent: String(i + 1) // Номер объекта на метке
            },
            {
              preset: 'islands#blueStretchyIcon',
              draggable: false
            }
          )

          mapInstance.geoObjects.add(placemark)

          // Добавляем координаты в bounds только после успешного создания метки
          bounds.push([lat, lon])
          successCount++

          console.log('✅ Метка успешно добавлена на карту')
          console.log('Количество объектов на карте:', mapInstance.geoObjects.getLength())
        } catch (error) {
          console.error('❌ Ошибка при добавлении метки на карту:', error)
          console.error('Объект, вызвавший ошибку:', object)
          console.error('Координаты:', coords)
          failCount++
        }
      }

      console.log('\n=== ИТОГИ ===')
      console.log(`✅ Успешно добавлено: ${successCount}`)
      console.log(`❌ Пропущено (нет координат): ${failCount}`)
      console.log(`📍 Всего объектов после фильтрации: ${filteredObjects.length}`)
      console.log(`📍 Всего объектов: ${objects.length}`)

      // Автоматическое масштабирование карты для отображения всех меток
      if (bounds.length > 0) {
        console.log('Настройка границ карты для', bounds.length, 'точек')
        console.log('Bounds:', bounds)

        // Дополнительная проверка bounds перед передачей в setBounds
        const validBounds = bounds.filter(coord => {
          if (!Array.isArray(coord) || coord.length !== 2) return false
          const [lat, lon] = coord
          return typeof lat === 'number' && typeof lon === 'number' &&
                 !isNaN(lat) && !isNaN(lon) &&
                 lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
        })

        console.log('Валидные bounds:', validBounds)

        if (validBounds.length > 0) {
          try {
            mapInstance.setBounds(validBounds, {
              checkZoomRange: true,
              zoomMargin: 50
            })
          } catch (boundsError) {
            console.error('❌ Ошибка при установке границ карты:', boundsError)
            console.error('Bounds:', validBounds)
            // Если не удалось установить bounds, устанавливаем центр на первую точку
            if (validBounds.length > 0) {
              mapInstance.setCenter(validBounds[0], 12)
            }
          }
        }
      } else {
        console.warn('⚠️ Нет координат для масштабирования, оставляем центр Москвы')
        const filterText = mapFilter === 'all'
          ? 'У всех объектов'
          : mapFilter === 'main_construction'
          ? 'У объектов со статусом "Основное строительство"'
          : 'У объектов со статусом "Гарантийное обслуживание"'
        alert(`Ни один объект не был добавлен на карту.\n\n${filterText} должны быть заполнены поля "Широта" и "Долгота".\n\nОткройте Яндекс.Карты, найдите объект, нажмите правой кнопкой мыши и выберите "Что здесь?" для получения координат.`)
      }

      setMapLoading(false)
      console.log('✅ Инициализация карты завершена')

      if (successCount > 0 && failCount > 0) {
        alert(`На карте отображено ${successCount} из ${filteredObjects.length} объектов.\n\n${failCount} объект(ов) пропущено - у них не заполнены координаты (широта и долгота).\n\nДля добавления координат отредактируйте объект и укажите широту и долготу.`)
      }
    } catch (error) {
      console.error('💥 КРИТИЧЕСКАЯ ОШИБКА при инициализации карты:', error)
      console.error('Стек:', error.stack)
      alert('Ошибка при загрузке карты: ' + error.message)
      setMapLoading(false)
    }
  }

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

  const fetchCounterparties = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('counterparties')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setCounterparties(data || [])
    } catch (error) {
      console.error('Ошибка загрузки контрагентов:', error.message)
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
      setObjectFormData({ name: '', address: '', description: '', map_link: '', latitude: '', longitude: '', status: 'main_construction' })
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

  const handleCounterpartySubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingCounterparty) {
        // Update existing counterparty
        const { error } = await supabase
          .from('counterparties')
          .update(counterpartyFormData)
          .eq('id', editingCounterparty.id)

        if (error) throw error
      } else {
        // Insert new counterparty
        const { error } = await supabase
          .from('counterparties')
          .insert([counterpartyFormData])
        if (error) throw error
      }

      setShowCounterpartyModal(false)
      setEditingCounterparty(null)
      setCounterpartyFormData({
        name: '',
        inn: '',
        kpp: '',
        legal_address: '',
        actual_address: '',
        director_name: '',
        contact_phone: '',
        contact_email: '',
      })
      fetchCounterparties()
    } catch (error) {
      console.error('Ошибка сохранения контрагента:', error.message)
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
      latitude: object.latitude || '',
      longitude: object.longitude || '',
      status: object.status || 'main_construction',
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

  const handleEditCounterparty = (counterparty) => {
    setEditingCounterparty(counterparty)
    setCounterpartyFormData({
      name: counterparty.name,
      inn: counterparty.inn || '',
      kpp: counterparty.kpp || '',
      legal_address: counterparty.legal_address || '',
      actual_address: counterparty.actual_address || '',
      director_name: counterparty.director_name || '',
      contact_phone: counterparty.contact_phone || '',
      contact_email: counterparty.contact_email || '',
    })
    setShowCounterpartyModal(true)
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

  const handleAddNewObject = () => {
    setEditingObject(null)
    setObjectFormData({ name: '', address: '', description: '', map_link: '', latitude: '', longitude: '', status: 'main_construction' })
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

  const handleAddNewCounterparty = () => {
    setEditingCounterparty(null)
    setCounterpartyFormData({
      name: '',
      inn: '',
      kpp: '',
      legal_address: '',
      actual_address: '',
      director_name: '',
      contact_phone: '',
      contact_email: '',
    })
    setShowCounterpartyModal(true)
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

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'objects':
        return 'Объекты'
      case 'contacts':
        return 'Контакты сотрудников'
      case 'counterparties':
        return 'Контрагенты'
      default:
        return 'Общая информация'
    }
  }

  return (
    <div className="general-info">
      <div className="general-info-header">
        <h2>{getSectionTitle()}</h2>
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
          Контакты сотрудников
        </button>
        <button
          className={`section-tab ${activeSection === 'counterparties' ? 'active' : ''}`}
          onClick={() => setActiveSection('counterparties')}
        >
          Контрагенты
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
                <button
                  className="btn-secondary"
                  onClick={() => setShowMapModal(true)}
                  disabled={objects.length === 0}
                >
                  🗺️ Объекты на карте
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
                      <th>Статус</th>
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
                          <td>
                            <span className={`status-badge status-${object.status || 'main_construction'}`}>
                              {(object.status || 'main_construction') === 'warranty_service'
                                ? 'Гарантийное обслуживание'
                                : 'Основное строительство'}
                            </span>
                          </td>
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

          {activeSection === 'counterparties' && (
            <div className="section-content">
              <div className="section-actions">
                <button className="btn-primary" onClick={handleAddNewCounterparty}>
                  + Добавить контрагента
                </button>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Наименование</th>
                      <th>ИНН</th>
                      <th>КПП</th>
                      <th>Юридический адрес</th>
                      <th>ФИО директора</th>
                      <th>Телефон</th>
                      <th>Email</th>
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
                          <td>{counterparty.inn || '-'}</td>
                          <td>{counterparty.kpp || '-'}</td>
                          <td>{counterparty.legal_address || '-'}</td>
                          <td>{counterparty.director_name || '-'}</td>
                          <td>{counterparty.contact_phone || '-'}</td>
                          <td>{counterparty.contact_email || '-'}</td>
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
                  <label>Статус *</label>
                  <select
                    value={objectFormData.status}
                    onChange={(e) =>
                      setObjectFormData({ ...objectFormData, status: e.target.value })
                    }
                    required
                  >
                    <option value="main_construction">Основное строительство</option>
                    <option value="warranty_service">Гарантийное обслуживание</option>
                  </select>
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
                    placeholder="https://yandex.ru/maps/..."
                  />
                  <small style={{ color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                    Необязательное поле. Можно указать ссылку на объект в Яндекс.Картах
                  </small>
                </div>

                <div className="form-group">
                  <label>Широта (Latitude)</label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={objectFormData.latitude}
                    onChange={(e) =>
                      setObjectFormData({
                        ...objectFormData,
                        latitude: e.target.value,
                      })
                    }
                    placeholder="55.751244"
                  />
                  <small style={{ color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                    Например: 55.751244 (для Москвы)
                  </small>
                </div>

                <div className="form-group">
                  <label>Долгота (Longitude)</label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={objectFormData.longitude}
                    onChange={(e) =>
                      setObjectFormData({
                        ...objectFormData,
                        longitude: e.target.value,
                      })
                    }
                    placeholder="37.618423"
                  />
                  <small style={{ color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                    Например: 37.618423 (для Москвы)
                  </small>
                </div>
              </div>

              <div className="form-info" style={{
                padding: '12px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '6px',
                marginTop: '16px',
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                <strong>💡 Как узнать координаты объекта:</strong>
                <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  <li>Откройте <a href="https://yandex.ru/maps" target="_blank" rel="noopener noreferrer">Яндекс.Карты</a></li>
                  <li>Найдите нужный объект на карте</li>
                  <li>Нажмите правой кнопкой мыши на точку объекта</li>
                  <li>Выберите "Что здесь?" - координаты появятся внизу</li>
                  <li>Скопируйте широту и долготу в соответствующие поля</li>
                </ol>
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
                  <label>ФИО директора</label>
                  <input
                    type="text"
                    value={counterpartyFormData.director_name}
                    onChange={(e) =>
                      setCounterpartyFormData({
                        ...counterpartyFormData,
                        director_name: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Контактный телефон</label>
                  <input
                    type="tel"
                    value={counterpartyFormData.contact_phone}
                    onChange={(e) =>
                      setCounterpartyFormData({
                        ...counterpartyFormData,
                        contact_phone: e.target.value,
                      })
                    }
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>

                <div className="form-group">
                  <label>Контактный email</label>
                  <input
                    type="email"
                    value={counterpartyFormData.contact_email}
                    onChange={(e) =>
                      setCounterpartyFormData({
                        ...counterpartyFormData,
                        contact_email: e.target.value,
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

      {/* Modal для карты объектов */}
      {showMapModal && (
        <div className="modal-overlay" onClick={() => setShowMapModal(false)}>
          <div
            className="modal modal-map"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Объекты на карте</h3>
              <button className="modal-close" onClick={() => setShowMapModal(false)}>
                ×
              </button>
            </div>

            {/* Фильтры для карты */}
            <div className="map-filters">
              <div className="map-filters-label">Показать на карте:</div>
              <div className="map-filter-buttons">
                <button
                  className={`map-filter-btn ${mapFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setMapFilter('all')}
                >
                  Все объекты ({objects.length})
                </button>
                <button
                  className={`map-filter-btn ${mapFilter === 'main_construction' ? 'active' : ''}`}
                  onClick={() => setMapFilter('main_construction')}
                >
                  Основное строительство ({objects.filter(obj => (obj.status || 'main_construction') === 'main_construction').length})
                </button>
                <button
                  className={`map-filter-btn ${mapFilter === 'warranty_service' ? 'active' : ''}`}
                  onClick={() => setMapFilter('warranty_service')}
                >
                  Гарантийное обслуживание ({objects.filter(obj => obj.status === 'warranty_service').length})
                </button>
              </div>
            </div>

            <div className="map-container">
              {mapLoading && (
                <div className="map-loading-overlay">
                  <div className="map-loading-spinner">
                    <div className="spinner"></div>
                    <p>Загрузка карты...</p>
                  </div>
                </div>
              )}
              <div id="yandex-map" className="yandex-map"></div>
              <div className="map-info">
                <p className="map-hint">
                  💡 Нажмите на метку, чтобы увидеть подробную информацию об объекте
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowMapModal(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GeneralInfo
