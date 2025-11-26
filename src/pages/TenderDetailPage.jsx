import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import '../components/TenderDetail.css'

function TenderDetailPage() {
  const { tenderId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [tender, setTender] = useState(null)
  const [tenderCounterparties, setTenderCounterparties] = useState([])
  const [estimateItems, setEstimateItems] = useState([])
  const [proposals, setProposals] = useState({})
  const [proposalFiles, setProposalFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('estimate') // 'estimate', 'comparison', 'participants'
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedCounterpartyForUpload, setSelectedCounterpartyForUpload] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [showAddEstimateModal, setShowAddEstimateModal] = useState(false)
  const [showImportEstimateModal, setShowImportEstimateModal] = useState(false)
  const [editingEstimateItem, setEditingEstimateItem] = useState(null)
  const [estimateFormData, setEstimateFormData] = useState({
    row_number: '',
    code: '',
    cost_type: '',
    cost_name: '',
    calculation_note: '',
    unit: '',
    work_volume: '',
    material_consumption: ''
  })

  useEffect(() => {
    if (tenderId) {
      fetchTenderData()
    }
  }, [tenderId])

  const fetchTenderData = async () => {
    setLoading(true)
    try {
      // Загружаем данные тендера
      const { data: tenderData, error: tenderError } = await supabase
        .from('tenders')
        .select('*, objects(name, status), winner:counterparties!winner_counterparty_id(id, name)')
        .eq('id', tenderId)
        .single()

      if (tenderError) throw tenderError
      setTender(tenderData)

      // Загружаем контрагентов тендера
      const { data: counterpartiesData, error: cpError } = await supabase
        .from('tender_counterparties')
        .select(`
          *,
          counterparties(
            id,
            name,
            work_type,
            inn,
            counterparty_contacts(id, full_name, position, phone, email)
          )
        `)
        .eq('tender_id', tenderId)

      if (cpError) throw cpError
      setTenderCounterparties(counterpartiesData || [])

      // Загружаем позиции сметы
      const { data: estimateData, error: estimateError } = await supabase
        .from('tender_estimate_items')
        .select('*')
        .eq('tender_id', tenderId)
        .order('row_number', { ascending: true })

      if (!estimateError) {
        setEstimateItems(estimateData || [])
      }

      // Загружаем предложения контрагентов
      const { data: proposalsData, error: proposalsError } = await supabase
        .from('tender_counterparty_proposals')
        .select('*')
        .eq('tender_id', tenderId)

      if (!proposalsError && proposalsData) {
        // Группируем предложения по контрагентам
        const grouped = {}
        proposalsData.forEach(p => {
          if (!grouped[p.counterparty_id]) {
            grouped[p.counterparty_id] = {}
          }
          grouped[p.counterparty_id][p.estimate_item_id] = p
        })
        setProposals(grouped)
      }

      // Загружаем файлы предложений
      const { data: filesData, error: filesError } = await supabase
        .from('tender_proposal_files')
        .select('*, counterparties(name)')
        .eq('tender_id', tenderId)
        .order('uploaded_at', { ascending: false })

      if (!filesError) {
        setProposalFiles(filesData || [])
      }

    } catch (error) {
      console.error('Ошибка загрузки данных тендера:', error.message)
      alert('Ошибка загрузки данных: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddEstimateItem = () => {
    const nextRowNumber = estimateItems.length > 0
      ? Math.max(...estimateItems.map(i => i.row_number)) + 1
      : 1
    setEstimateFormData({
      row_number: nextRowNumber,
      code: '',
      cost_type: '',
      cost_name: '',
      calculation_note: '',
      unit: '',
      work_volume: '',
      material_consumption: ''
    })
    setEditingEstimateItem(null)
    setShowAddEstimateModal(true)
  }

  const handleEditEstimateItem = (item) => {
    setEstimateFormData({
      row_number: item.row_number,
      code: item.code || '',
      cost_type: item.cost_type || '',
      cost_name: item.cost_name || '',
      calculation_note: item.calculation_note || '',
      unit: item.unit || '',
      work_volume: item.work_volume || '',
      material_consumption: item.material_consumption || ''
    })
    setEditingEstimateItem(item)
    setShowAddEstimateModal(true)
  }

  const handleSaveEstimateItem = async (e) => {
    e.preventDefault()
    try {
      const itemData = {
        tender_id: tenderId,
        row_number: parseInt(estimateFormData.row_number),
        code: estimateFormData.code || null,
        cost_type: estimateFormData.cost_type || null,
        cost_name: estimateFormData.cost_name,
        calculation_note: estimateFormData.calculation_note || null,
        unit: estimateFormData.unit || null,
        work_volume: estimateFormData.work_volume ? parseFloat(estimateFormData.work_volume) : null,
        material_consumption: estimateFormData.material_consumption ? parseFloat(estimateFormData.material_consumption) : null
      }

      if (editingEstimateItem) {
        const { error } = await supabase
          .from('tender_estimate_items')
          .update(itemData)
          .eq('id', editingEstimateItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tender_estimate_items')
          .insert([itemData])
        if (error) throw error
      }

      setShowAddEstimateModal(false)
      fetchTenderData()
    } catch (error) {
      console.error('Ошибка сохранения позиции:', error.message)
      alert('Ошибка сохранения: ' + error.message)
    }
  }

  const handleDeleteEstimateItem = async (itemId) => {
    if (!window.confirm('Удалить эту позицию сметы?')) return
    try {
      const { error } = await supabase
        .from('tender_estimate_items')
        .delete()
        .eq('id', itemId)
      if (error) throw error
      fetchTenderData()
    } catch (error) {
      console.error('Ошибка удаления:', error.message)
      alert('Ошибка удаления: ' + error.message)
    }
  }

  const handleUploadClick = (counterpartyId) => {
    setSelectedCounterpartyForUpload(counterpartyId)
    setShowUploadModal(true)
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('Пожалуйста, выберите файл Excel (.xlsx или .xls)')
      return
    }

    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

          // Парсим данные из Excel и сохраняем предложения
          await parseAndSaveProposals(jsonData, selectedCounterpartyForUpload, file.name)

          setShowUploadModal(false)
          setSelectedCounterpartyForUpload(null)
          fetchTenderData()
        } catch (parseError) {
          console.error('Ошибка парсинга Excel:', parseError)
          alert('Ошибка чтения файла Excel: ' + parseError.message)
        }
      }
      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error('Ошибка загрузки файла:', error)
      alert('Ошибка загрузки: ' + error.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const parseAndSaveProposals = async (excelData, counterpartyId, fileName) => {
    // Предполагаем, что данные начинаются со 2-й строки (первая - заголовки)
    // Структура: № п/п, КОД, ..., Цена материалы, Цена работы, ..., Примечание
    // Нужно будет адаптировать под реальную структуру Excel файла

    const proposalsToInsert = []

    // Пропускаем заголовок, начинаем с индекса 1
    for (let i = 1; i < excelData.length; i++) {
      const row = excelData[i]
      if (!row || row.length === 0) continue

      const rowNumber = parseInt(row[0])
      if (isNaN(rowNumber)) continue

      // Находим позицию сметы по номеру строки
      const estimateItem = estimateItems.find(item => item.row_number === rowNumber)
      if (!estimateItem) continue

      // Индексы колонок - нужно адаптировать под реальную структуру
      // Предполагаем: колонка 8 - цена материалы, колонка 9 - цена работы, последняя - примечание
      const unitPriceMaterials = parseFloat(row[8]) || 0
      const unitPriceWorks = parseFloat(row[9]) || 0
      const participantNote = row[row.length - 1] || ''

      const workVolume = estimateItem.work_volume || 0
      const totalUnitPrice = unitPriceMaterials + unitPriceWorks
      const totalMaterials = unitPriceMaterials * workVolume
      const totalWorks = unitPriceWorks * workVolume
      const totalCost = totalMaterials + totalWorks

      proposalsToInsert.push({
        tender_id: tenderId,
        counterparty_id: counterpartyId,
        estimate_item_id: estimateItem.id,
        unit_price_materials: unitPriceMaterials,
        unit_price_works: unitPriceWorks,
        total_unit_price: totalUnitPrice,
        total_materials: totalMaterials,
        total_works: totalWorks,
        total_cost: totalCost,
        participant_note: participantNote
      })
    }

    if (proposalsToInsert.length > 0) {
      // Удаляем старые предложения этого контрагента
      await supabase
        .from('tender_counterparty_proposals')
        .delete()
        .eq('tender_id', tenderId)
        .eq('counterparty_id', counterpartyId)

      // Вставляем новые
      const { error } = await supabase
        .from('tender_counterparty_proposals')
        .insert(proposalsToInsert)

      if (error) throw error

      // Сохраняем информацию о файле
      await supabase
        .from('tender_proposal_files')
        .insert([{
          tender_id: tenderId,
          counterparty_id: counterpartyId,
          file_name: fileName,
          file_url: '',  // Можно добавить загрузку в Storage
          file_size: 0
        }])
    }
  }

  const handleImportEstimateFromExcel = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

          // Парсим смету из Excel
          const itemsToInsert = []
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.length === 0) continue

            const rowNumber = parseInt(row[0])
            if (isNaN(rowNumber)) continue

            itemsToInsert.push({
              tender_id: tenderId,
              row_number: rowNumber,
              code: row[1] || null,
              cost_type: row[2] || null,
              cost_name: row[3] || '',
              calculation_note: row[4] || null,
              unit: row[5] || null,
              work_volume: parseFloat(row[6]) || null,
              material_consumption: parseFloat(row[7]) || null
            })
          }

          if (itemsToInsert.length > 0) {
            // Удаляем старые позиции
            await supabase
              .from('tender_estimate_items')
              .delete()
              .eq('tender_id', tenderId)

            // Вставляем новые
            const { error } = await supabase
              .from('tender_estimate_items')
              .insert(itemsToInsert)

            if (error) throw error
            fetchTenderData()
            alert(`Импортировано ${itemsToInsert.length} позиций сметы`)
          }
        } catch (parseError) {
          console.error('Ошибка парсинга:', parseError)
          alert('Ошибка чтения файла: ' + parseError.message)
        }
      }
      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error('Ошибка импорта:', error)
      alert('Ошибка импорта: ' + error.message)
    }
  }

  const handleDownloadEstimateTemplate = () => {
    // Создаем шаблон сметы
    const templateData = [
      ['№ п/п', 'КОД', 'Вид затрат', 'Наименование затрат', 'Примечание к расчету', 'Ед. изм.', 'Объем по виду работ', 'Общий расход по материалу'],
      [1, 'МТР-001', 'Материалы', 'Пример: Кабель ВВГнг 3x2.5', 'Расчет по проекту', 'м', 100, 105],
      [2, 'РАБ-001', 'Работы', 'Пример: Монтаж кабеля', 'По ведомости объемов', 'м', 100, ''],
      [3, '', '', '', '', '', '', ''],
    ]

    const ws = XLSX.utils.aoa_to_sheet(templateData)

    // Устанавливаем ширину колонок
    ws['!cols'] = [
      { wch: 8 },   // № п/п
      { wch: 12 },  // КОД
      { wch: 15 },  // Вид затрат
      { wch: 40 },  // Наименование затрат
      { wch: 25 },  // Примечание к расчету
      { wch: 10 },  // Ед. изм.
      { wch: 18 },  // Объем по виду работ
      { wch: 22 },  // Общий расход по материалу
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Смета')
    XLSX.writeFile(wb, 'Шаблон_сметы.xlsx')
  }

  const handleDownloadProposalTemplate = () => {
    // Создаем шаблон КП на основе существующей сметы
    // Структура согласно требованиям:
    // A-H: базовые колонки сметы
    // I-J: Цена за единицу (материалы/оборудование, СМР/ПНР)
    // K: ИТОГО цена за единицу
    // L-M: Стоимость ИТОГО (материалы/оборудование, СМР/ПНР)
    // N: ИТОГО стоимость
    // O: Общая стоимость
    // P: Примечание участника
    const headerRow = [
      '№ п/п', 'КОД', 'Вид затрат', 'Наименование затрат', 'Примечание к расчету',
      'Ед. изм.', 'Объем по виду работ', 'Общий расход по материалу',
      'Цена за ед. Матер./Обор. с НДС', 'Цена за ед. СМР/ПНР с НДС',
      'ИТОГО цена за ед. с НДС', 'Стоим. Матер./Обор. с НДС', 'Стоим. СМР/ПНР с НДС',
      'ИТОГО стоимость с НДС', 'Общая стоимость с НДС', 'Примечание участника'
    ]

    const dataRows = estimateItems.map((item, idx) => {
      const rowNum = idx + 2 // Excel строка (1 - заголовок)
      return [
        item.row_number,
        item.code || '',
        item.cost_type || '',
        item.cost_name || '',
        item.calculation_note || '',
        item.unit || '',
        item.work_volume || '',
        item.material_consumption || '',
        '', // I: Цена материалы - заполняет подрядчик
        '', // J: Цена СМР/ПНР - заполняет подрядчик
        { f: `I${rowNum}+J${rowNum}` }, // K: ИТОГО цена за ед. = I + J
        { f: `I${rowNum}*G${rowNum}` }, // L: Стоимость материалы = цена * объем
        { f: `J${rowNum}*G${rowNum}` }, // M: Стоимость СМР = цена * объем
        { f: `L${rowNum}+M${rowNum}` }, // N: ИТОГО стоимость = L + M
        { f: `N${rowNum}` }, // O: Общая стоимость (равна ИТОГО)
        '', // P: Примечание участника - заполняет подрядчик
      ]
    })

    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])

    // Устанавливаем ширину колонок
    ws['!cols'] = [
      { wch: 8 },   // A: № п/п
      { wch: 12 },  // B: КОД
      { wch: 15 },  // C: Вид затрат
      { wch: 40 },  // D: Наименование затрат
      { wch: 25 },  // E: Примечание к расчету
      { wch: 10 },  // F: Ед. изм.
      { wch: 15 },  // G: Объем
      { wch: 15 },  // H: Расход
      { wch: 22 },  // I: Цена материалы
      { wch: 20 },  // J: Цена СМР
      { wch: 20 },  // K: ИТОГО цена
      { wch: 20 },  // L: Стоимость мат
      { wch: 20 },  // M: Стоимость СМР
      { wch: 20 },  // N: ИТОГО стоимость
      { wch: 20 },  // O: Общая стоимость
      { wch: 25 },  // P: Примечание
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'КП')

    const fileName = tender?.objects?.name
      ? `КП_${tender.objects.name.replace(/[/\\?%*:|"<>]/g, '_')}.xlsx`
      : 'Шаблон_КП.xlsx'
    XLSX.writeFile(wb, fileName)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ru-RU')
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '-'
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const getStatusBadgeClass = (status) => {
    const classes = {
      'Не начат': 'status-not-started',
      'Идет тендерная процедура': 'status-in-progress',
      'Завершен': 'status-completed'
    }
    return classes[status] || ''
  }

  const getCounterpartyStatusLabel = (status) => {
    const labels = {
      'request_sent': 'Запрос отправлен',
      'declined': 'Отказ',
      'proposal_provided': 'КП предоставлено'
    }
    return labels[status] || status
  }

  const getCounterpartyStatusColor = (status) => {
    const colors = {
      'request_sent': '#6366f1',
      'declined': '#b91c1c',
      'proposal_provided': '#15803d'
    }
    return colors[status] || '#64748b'
  }

  // Расчет итогов для сравнительной таблицы
  const calculateTotals = (counterpartyId) => {
    const cpProposals = proposals[counterpartyId] || {}
    let totalMaterials = 0
    let totalWorks = 0
    let totalCost = 0

    Object.values(cpProposals).forEach(p => {
      totalMaterials += p.total_materials || 0
      totalWorks += p.total_works || 0
      totalCost += p.total_cost || 0
    })

    return { totalMaterials, totalWorks, totalCost }
  }

  if (loading) {
    return <div className="loading">Загрузка...</div>
  }

  if (!tender) {
    return (
      <div className="tender-detail-page">
        <div className="error-message">Тендер не найден</div>
        <button className="btn-secondary" onClick={() => navigate(-1)}>
          Назад
        </button>
      </div>
    )
  }

  return (
    <div className="tender-detail-page">
      {/* Шапка */}
      <div className="tender-detail-header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          ← Назад к списку
        </button>
        <div className="tender-detail-title">
          <h2>{tender.objects?.name || 'Тендер'}</h2>
          <p className="tender-work-description">{tender.work_description}</p>
        </div>
        <span className={`status-badge ${getStatusBadgeClass(tender.status)}`}>
          {tender.status}
        </span>
      </div>

      {/* Информация о тендере */}
      <div className="tender-info-card">
        <div className="tender-info-grid">
          <div className="info-item">
            <span className="info-label">Дата начала</span>
            <span className="info-value">{formatDate(tender.start_date)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Дата окончания</span>
            <span className="info-value">{formatDate(tender.end_date)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Участников</span>
            <span className="info-value">{tenderCounterparties.length}</span>
          </div>
          {tender.winner && (
            <div className="info-item winner">
              <span className="info-label">Победитель</span>
              <span className="info-value winner-name">🏆 {tender.winner.name}</span>
            </div>
          )}
          {tender.tender_package_link && (
            <div className="info-item">
              <span className="info-label">Тендерный пакет</span>
              <a href={tender.tender_package_link} target="_blank" rel="noopener noreferrer" className="info-link">
                Открыть документ
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Вкладки */}
      <div className="tender-tabs">
        <button
          className={`tender-tab ${activeTab === 'estimate' ? 'active' : ''}`}
          onClick={() => setActiveTab('estimate')}
        >
          Смета
          {estimateItems.length > 0 && <span className="tab-count">{estimateItems.length}</span>}
        </button>
        <button
          className={`tender-tab ${activeTab === 'comparison' ? 'active' : ''}`}
          onClick={() => setActiveTab('comparison')}
        >
          Сравнение КП
        </button>
        <button
          className={`tender-tab ${activeTab === 'participants' ? 'active' : ''}`}
          onClick={() => setActiveTab('participants')}
        >
          Участники
          {tenderCounterparties.length > 0 && <span className="tab-count">{tenderCounterparties.length}</span>}
        </button>
      </div>

      {/* Контент вкладок */}
      <div className="tender-tab-content">
        {/* Вкладка Смета */}
        {activeTab === 'estimate' && (
          <div className="estimate-section">
            <div className="section-header">
              <h3>Позиции сметы</h3>
              <div className="section-actions">
                <button className="btn-secondary" onClick={() => setShowImportEstimateModal(true)}>
                  Импорт из Excel
                </button>
                <button className="btn-primary" onClick={handleAddEstimateItem}>
                  + Добавить позицию
                </button>
              </div>
            </div>

            {estimateItems.length === 0 ? (
              <div className="empty-state">
                <p>Позиции сметы еще не добавлены</p>
                <p className="hint">Добавьте позиции вручную или импортируйте из Excel файла</p>
              </div>
            ) : (
              <div className="estimate-table-container">
                <table className="estimate-table full-estimate">
                  <thead>
                    {/* Первый уровень заголовков */}
                    <tr className="header-row-1">
                      <th rowSpan="2" className="sticky-col col-num">№ п/п</th>
                      <th rowSpan="2" className="sticky-col col-code">КОД</th>
                      <th rowSpan="2" className="sticky-col col-type">Вид затрат</th>
                      <th rowSpan="2" className="sticky-col col-name">Наименование затрат</th>
                      <th rowSpan="2">Примечание к расчету</th>
                      <th rowSpan="2">Ед. изм.</th>
                      <th rowSpan="2">Объем по виду работ</th>
                      <th rowSpan="2">Общий расход по материалу</th>
                      {/* Колонки для каждого контрагента */}
                      {tenderCounterparties.map(tc => (
                        <th key={tc.id} colSpan="8" className="counterparty-header-cell">
                          <div className="cp-header-name">{tc.counterparties?.name}</div>
                          <button
                            className="btn-upload-small"
                            onClick={() => handleUploadClick(tc.counterparty_id)}
                            title="Загрузить КП"
                          >
                            📤 Загрузить КП
                          </button>
                        </th>
                      ))}
                      <th rowSpan="2" className="col-actions">Действия</th>
                    </tr>
                    {/* Второй уровень заголовков - подзаголовки для контрагентов */}
                    <tr className="header-row-2">
                      {tenderCounterparties.map(tc => (
                        <React.Fragment key={`sub-${tc.id}`}>
                          <th className="sub-header">Цена за ед. Матер./Обор.</th>
                          <th className="sub-header">Цена за ед. СМР/ПНР</th>
                          <th className="sub-header">ИТОГО цена за ед.</th>
                          <th className="sub-header">Стоим. Матер./Обор.</th>
                          <th className="sub-header">Стоим. СМР/ПНР</th>
                          <th className="sub-header">ИТОГО стоимость</th>
                          <th className="sub-header">Общая стоимость</th>
                          <th className="sub-header">Примечание</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {estimateItems.map(item => (
                      <tr key={item.id}>
                        <td className="sticky-col col-num center">{item.row_number}</td>
                        <td className="sticky-col col-code">{item.code || '-'}</td>
                        <td className="sticky-col col-type">{item.cost_type || '-'}</td>
                        <td className="sticky-col col-name">{item.cost_name}</td>
                        <td>{item.calculation_note || '-'}</td>
                        <td className="center">{item.unit || '-'}</td>
                        <td className="right">{item.work_volume ?? '-'}</td>
                        <td className="right">{item.material_consumption ?? '-'}</td>
                        {/* Данные от каждого контрагента */}
                        {tenderCounterparties.map(tc => {
                          const proposal = proposals[tc.counterparty_id]?.[item.id]
                          return (
                            <React.Fragment key={`data-${tc.id}-${item.id}`}>
                              <td className="right price-cell">
                                {proposal?.unit_price_materials ? formatCurrency(proposal.unit_price_materials) : '-'}
                              </td>
                              <td className="right price-cell">
                                {proposal?.unit_price_works ? formatCurrency(proposal.unit_price_works) : '-'}
                              </td>
                              <td className="right price-cell total-cell">
                                {proposal?.total_unit_price ? formatCurrency(proposal.total_unit_price) : '-'}
                              </td>
                              <td className="right price-cell">
                                {proposal?.total_materials ? formatCurrency(proposal.total_materials) : '-'}
                              </td>
                              <td className="right price-cell">
                                {proposal?.total_works ? formatCurrency(proposal.total_works) : '-'}
                              </td>
                              <td className="right price-cell sum-cell">
                                {proposal?.total_cost ? formatCurrency(proposal.total_cost) : '-'}
                              </td>
                              <td className="right price-cell grand-cell">
                                {proposal?.total_cost ? formatCurrency(proposal.total_cost) : '-'}
                              </td>
                              <td className="note-cell">{proposal?.participant_note || '-'}</td>
                            </React.Fragment>
                          )
                        })}
                        <td className="col-actions actions">
                          <button
                            className="btn-icon"
                            onClick={() => handleEditEstimateItem(item)}
                            title="Редактировать"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => handleDeleteEstimateItem(item.id)}
                            title="Удалить"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Итоговая строка */}
                  {tenderCounterparties.length > 0 && (
                    <tfoot>
                      <tr className="totals-row">
                        <td colSpan="8" className="sticky-col totals-label">ИТОГО:</td>
                        {tenderCounterparties.map(tc => {
                          const totals = calculateTotals(tc.counterparty_id)
                          return (
                            <React.Fragment key={`totals-${tc.id}`}>
                              <td className="right total-value">-</td>
                              <td className="right total-value">-</td>
                              <td className="right total-value">-</td>
                              <td className="right total-value">{formatCurrency(totals.totalMaterials)}</td>
                              <td className="right total-value">{formatCurrency(totals.totalWorks)}</td>
                              <td className="right total-value">{formatCurrency(totals.totalCost)}</td>
                              <td className="right total-value grand-total">{formatCurrency(totals.totalCost)}</td>
                              <td className="total-value">-</td>
                            </React.Fragment>
                          )
                        })}
                        <td className="col-actions">-</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}

        {/* Вкладка Сравнение КП */}
        {activeTab === 'comparison' && (
          <div className="comparison-section">
            <div className="section-header">
              <h3>Сравнительная таблица коммерческих предложений</h3>
              {estimateItems.length > 0 && (
                <div className="section-actions">
                  <button className="btn-secondary" onClick={handleDownloadProposalTemplate}>
                    Скачать шаблон КП
                  </button>
                </div>
              )}
            </div>

            {estimateItems.length === 0 ? (
              <div className="empty-state">
                <p>Сначала добавьте позиции сметы</p>
              </div>
            ) : tenderCounterparties.length === 0 ? (
              <div className="empty-state">
                <p>Нет участников тендера для сравнения</p>
              </div>
            ) : (
              <div className="comparison-table-container">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th rowSpan="2" className="sticky-col">№</th>
                      <th rowSpan="2" className="sticky-col col-2">Наименование затрат</th>
                      <th rowSpan="2">Ед.</th>
                      <th rowSpan="2">Объем</th>
                      {tenderCounterparties.map(tc => (
                        <th key={tc.id} colSpan="4" className="counterparty-header">
                          <div className="cp-name">{tc.counterparties?.name}</div>
                          <div className="cp-actions">
                            <button
                              className="btn-upload-small"
                              onClick={() => handleUploadClick(tc.counterparty_id)}
                              title="Загрузить КП"
                            >
                              📤 Загрузить КП
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {tenderCounterparties.map(tc => (
                        <>
                          <th key={`${tc.id}-mat`} className="sub-header">Материалы</th>
                          <th key={`${tc.id}-work`} className="sub-header">СМР/ПНР</th>
                          <th key={`${tc.id}-total`} className="sub-header">ИТОГО ед.</th>
                          <th key={`${tc.id}-sum`} className="sub-header">Сумма</th>
                        </>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {estimateItems.map(item => (
                      <tr key={item.id}>
                        <td className="sticky-col center">{item.row_number}</td>
                        <td className="sticky-col col-2">{item.cost_name}</td>
                        <td className="center">{item.unit || '-'}</td>
                        <td className="right">{item.work_volume || '-'}</td>
                        {tenderCounterparties.map(tc => {
                          const proposal = proposals[tc.counterparty_id]?.[item.id]
                          return (
                            <>
                              <td key={`${tc.id}-${item.id}-mat`} className="right price-cell">
                                {proposal ? formatCurrency(proposal.unit_price_materials) : '-'}
                              </td>
                              <td key={`${tc.id}-${item.id}-work`} className="right price-cell">
                                {proposal ? formatCurrency(proposal.unit_price_works) : '-'}
                              </td>
                              <td key={`${tc.id}-${item.id}-total`} className="right price-cell total">
                                {proposal ? formatCurrency(proposal.total_unit_price) : '-'}
                              </td>
                              <td key={`${tc.id}-${item.id}-sum`} className="right price-cell sum">
                                {proposal ? formatCurrency(proposal.total_cost) : '-'}
                              </td>
                            </>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="totals-row">
                      <td colSpan="4" className="sticky-col totals-label">ИТОГО:</td>
                      {tenderCounterparties.map(tc => {
                        const totals = calculateTotals(tc.counterparty_id)
                        return (
                          <>
                            <td key={`${tc.id}-total-mat`} className="right total-value">
                              {formatCurrency(totals.totalMaterials)}
                            </td>
                            <td key={`${tc.id}-total-work`} className="right total-value">
                              {formatCurrency(totals.totalWorks)}
                            </td>
                            <td key={`${tc.id}-total-unit`} className="right total-value">-</td>
                            <td key={`${tc.id}-total-sum`} className="right total-value grand-total">
                              {formatCurrency(totals.totalCost)}
                            </td>
                          </>
                        )
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Загруженные файлы */}
            {proposalFiles.length > 0 && (
              <div className="uploaded-files">
                <h4>Загруженные файлы КП</h4>
                <ul>
                  {proposalFiles.map(file => (
                    <li key={file.id}>
                      <span className="file-name">{file.file_name}</span>
                      <span className="file-info">
                        {file.counterparties?.name} — {formatDate(file.uploaded_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Вкладка Участники */}
        {activeTab === 'participants' && (
          <div className="participants-section">
            <div className="section-header">
              <h3>Участники тендера</h3>
            </div>

            {tenderCounterparties.length === 0 ? (
              <div className="empty-state">
                <p>Участники еще не добавлены</p>
              </div>
            ) : (
              <div className="participants-grid">
                {tenderCounterparties.map(tc => (
                  <div key={tc.id} className={`participant-card ${tender.winner?.id === tc.counterparty_id ? 'winner' : ''}`}>
                    {tender.winner?.id === tc.counterparty_id && (
                      <div className="winner-badge">🏆 Победитель</div>
                    )}
                    <div className="participant-name">{tc.counterparties?.name}</div>
                    {tc.counterparties?.work_type && (
                      <div className="participant-work-type">{tc.counterparties.work_type}</div>
                    )}
                    {tc.counterparties?.inn && (
                      <div className="participant-inn">ИНН: {tc.counterparties.inn}</div>
                    )}
                    <div className="participant-status" style={{ color: getCounterpartyStatusColor(tc.status) }}>
                      {getCounterpartyStatusLabel(tc.status || 'request_sent')}
                    </div>
                    {tc.counterparties?.counterparty_contacts?.length > 0 && (
                      <div className="participant-contacts">
                        {tc.counterparties.counterparty_contacts.map(contact => (
                          <div key={contact.id} className="contact-item">
                            <div className="contact-name">
                              {contact.full_name}
                              {contact.position && <span className="contact-position"> ({contact.position})</span>}
                            </div>
                            {contact.phone && (
                              <a href={`tel:${contact.phone}`} className="contact-phone">{contact.phone}</a>
                            )}
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} className="contact-email">{contact.email}</a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="participant-actions">
                      <button
                        className="btn-secondary"
                        onClick={() => handleUploadClick(tc.counterparty_id)}
                      >
                        📤 Загрузить КП
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модал добавления/редактирования позиции сметы */}
      {showAddEstimateModal && (
        <div className="modal-overlay" onClick={() => setShowAddEstimateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingEstimateItem ? 'Редактировать позицию' : 'Добавить позицию сметы'}</h3>
              <button className="modal-close" onClick={() => setShowAddEstimateModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveEstimateItem}>
              <div className="form-grid">
                <div className="form-group">
                  <label>№ п/п *</label>
                  <input
                    type="number"
                    value={estimateFormData.row_number}
                    onChange={e => setEstimateFormData({...estimateFormData, row_number: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>КОД</label>
                  <input
                    type="text"
                    value={estimateFormData.code}
                    onChange={e => setEstimateFormData({...estimateFormData, code: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Вид затрат</label>
                  <input
                    type="text"
                    value={estimateFormData.cost_type}
                    onChange={e => setEstimateFormData({...estimateFormData, cost_type: e.target.value})}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Наименование затрат *</label>
                  <textarea
                    value={estimateFormData.cost_name}
                    onChange={e => setEstimateFormData({...estimateFormData, cost_name: e.target.value})}
                    required
                    rows="2"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Примечание к расчету</label>
                  <textarea
                    value={estimateFormData.calculation_note}
                    onChange={e => setEstimateFormData({...estimateFormData, calculation_note: e.target.value})}
                    rows="2"
                  />
                </div>
                <div className="form-group">
                  <label>Ед. изм.</label>
                  <input
                    type="text"
                    value={estimateFormData.unit}
                    onChange={e => setEstimateFormData({...estimateFormData, unit: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Объем по виду работ</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={estimateFormData.work_volume}
                    onChange={e => setEstimateFormData({...estimateFormData, work_volume: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Общий расход по материалу</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={estimateFormData.material_consumption}
                    onChange={e => setEstimateFormData({...estimateFormData, material_consumption: e.target.value})}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddEstimateModal(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  {editingEstimateItem ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модал загрузки КП */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Загрузить коммерческое предложение</h3>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <p className="upload-hint">
                Выберите Excel файл (.xlsx) с заполненными ценами.
                Файл должен содержать позиции в том же порядке, что и смета.
              </p>
              <div className="upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
                {uploading && <div className="uploading-indicator">Загрузка...</div>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowUploadModal(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модал импорта сметы из Excel */}
      {showImportEstimateModal && (
        <div className="modal-overlay" onClick={() => setShowImportEstimateModal(false)}>
          <div className="modal import-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Импорт сметы из Excel</h3>
              <button className="modal-close" onClick={() => setShowImportEstimateModal(false)}>×</button>
            </div>
            <div className="modal-content">
              {/* Кнопка импорта */}
              <div className="import-upload-section">
                <label className="import-upload-btn">
                  <span className="import-upload-icon">📥</span>
                  <span className="import-upload-text">Выбрать файл для импорта</span>
                  <span className="import-upload-hint">Поддерживаются форматы .xlsx и .xls</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      handleImportEstimateFromExcel(e)
                      setShowImportEstimateModal(false)
                    }}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {/* Кнопка скачивания шаблона */}
              <div className="import-template-section">
                <button className="btn-template" onClick={handleDownloadEstimateTemplate}>
                  <span className="template-icon">📄</span>
                  <span className="template-text">
                    <span className="template-title">Скачать шаблон для импорта</span>
                    <span className="template-desc">Excel файл с примерами заполнения</span>
                  </span>
                </button>
              </div>

              {/* Инструкция */}
              <div className="import-instruction">
                <h4>Инструкция по заполнению</h4>
                <p>Подготовьте Excel файл со следующей структурой (первая строка — заголовки):</p>

                <div className="instruction-table-wrapper">
                  <table className="instruction-table">
                    <thead>
                      <tr>
                        <th>Колонка</th>
                        <th>Название</th>
                        <th>Описание</th>
                        <th>Обязат.</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>A</td><td>№ п/п</td><td>Порядковый номер (число)</td><td className="required">Да</td></tr>
                      <tr><td>B</td><td>КОД</td><td>Код позиции</td><td>Нет</td></tr>
                      <tr><td>C</td><td>Вид затрат</td><td>Материалы, Работы и т.д.</td><td>Нет</td></tr>
                      <tr><td>D</td><td>Наименование затрат</td><td>Описание позиции</td><td className="required">Да</td></tr>
                      <tr><td>E</td><td>Примечание к расчету</td><td>Доп. информация</td><td>Нет</td></tr>
                      <tr><td>F</td><td>Ед. изм.</td><td>Единица измерения</td><td>Нет</td></tr>
                      <tr><td>G</td><td>Объем по виду работ</td><td>Количество (число)</td><td>Нет</td></tr>
                      <tr><td>H</td><td>Общий расход</td><td>Расход материала (число)</td><td>Нет</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="instruction-note warning">
                  <strong>Внимание:</strong> При импорте существующие позиции сметы будут заменены на новые из файла.
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setShowImportEstimateModal(false)}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TenderDetailPage
