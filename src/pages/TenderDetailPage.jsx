import { useState, useEffect, useRef } from 'react'
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
  const [selectedEstimateItems, setSelectedEstimateItems] = useState(new Set())

  // Состояния для множественных смет
  const [expandedEstimates, setExpandedEstimates] = useState(new Set(['Основная смета']))

  // Состояния для документов тендера (исходные данные) - ссылки на Google Drive
  const [tenderDocuments, setTenderDocuments] = useState([])
  const [estimateTemplate, setEstimateTemplate] = useState(null)
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(false)
  const [addingDocumentType, setAddingDocumentType] = useState('attachment') // 'attachment' или 'estimate_template'
  const [documentFormData, setDocumentFormData] = useState({ name: '', url: '' })
  const [savingDocument, setSavingDocument] = useState(false)

  const [estimateFormData, setEstimateFormData] = useState({
    row_number: '',
    code: '',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Загружаем документы тендера (исходные данные)
      const { data: docsData, error: docsError } = await supabase
        .from('tender_documents')
        .select('*')
        .eq('tender_id', tenderId)
        .order('created_at', { ascending: false })

      if (!docsError) {
        setTenderDocuments(docsData || [])
        // Находим шаблон сметы
        const template = docsData?.find(d => d.document_type === 'estimate_template')
        setEstimateTemplate(template || null)
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
      // Автоопределение типа затрат по коду
      let costType = null
      const code = estimateFormData.code?.trim()
      if (code) {
        if (code.toLowerCase().startsWith('мат')) costType = 'Материалы'
        else if (code.toUpperCase().startsWith('Р')) costType = 'Работы'
      }

      const itemData = {
        tender_id: tenderId,
        row_number: parseInt(estimateFormData.row_number),
        code: code || null,
        cost_type: costType,
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
      setSelectedEstimateItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
      fetchTenderData()
    } catch (error) {
      console.error('Ошибка удаления:', error.message)
      alert('Ошибка удаления: ' + error.message)
    }
  }

  // Функции для множественного выбора и удаления позиций сметы
  const handleToggleSelectItem = (itemId) => {
    setSelectedEstimateItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const handleDeleteSelectedItems = async () => {
    if (selectedEstimateItems.size === 0) return
    if (!window.confirm(`Удалить ${selectedEstimateItems.size} выбранных позиций?`)) return

    try {
      const idsToDelete = Array.from(selectedEstimateItems)
      const { error } = await supabase
        .from('tender_estimate_items')
        .delete()
        .in('id', idsToDelete)
      if (error) throw error
      setSelectedEstimateItems(new Set())
      fetchTenderData()
      alert(`Удалено ${idsToDelete.length} позиций`)
    } catch (error) {
      console.error('Ошибка удаления:', error.message)
      alert('Ошибка удаления: ' + error.message)
    }
  }

  // ========== Функции для работы с документами тендера (ссылки Google Drive) ==========
  const handleOpenAddDocument = (docType) => {
    setAddingDocumentType(docType)
    setDocumentFormData({ name: '', url: '' })
    setShowAddDocumentModal(true)
  }

  const handleSaveDocument = async (e) => {
    e.preventDefault()
    if (!documentFormData.name.trim() || !documentFormData.url.trim()) {
      alert('Заполните название и ссылку')
      return
    }

    setSavingDocument(true)
    try {
      const { error } = await supabase
        .from('tender_documents')
        .insert({
          tender_id: tenderId,
          name: documentFormData.name.trim(),
          url: documentFormData.url.trim(),
          document_type: addingDocumentType
        })

      if (error) throw error

      setShowAddDocumentModal(false)
      fetchTenderData()
    } catch (error) {
      console.error('Ошибка сохранения документа:', error.message)
      alert('Ошибка сохранения: ' + error.message)
    } finally {
      setSavingDocument(false)
    }
  }

  const handleDeleteDocument = async (doc) => {
    if (!window.confirm(`Удалить ссылку "${doc.name}"?`)) return

    try {
      const { error } = await supabase
        .from('tender_documents')
        .delete()
        .eq('id', doc.id)

      if (error) throw error
      fetchTenderData()
    } catch (error) {
      console.error('Ошибка удаления:', error.message)
      alert('Ошибка удаления: ' + error.message)
    }
  }

  const getDocumentIcon = (url) => {
    if (url.includes('drive.google.com')) return '📁'
    if (url.includes('docs.google.com/spreadsheets')) return '📊'
    if (url.includes('docs.google.com/document')) return '📝'
    if (url.includes('docs.google.com/presentation')) return '📽️'
    return '🔗'
  }

  // ========== Функции для работы с множественными сметами ==========

  // Получить уникальные названия смет
  const getEstimateNames = () => {
    const names = new Set()
    estimateItems.forEach(item => {
      names.add(item.estimate_name || 'Основная смета')
    })
    return Array.from(names).sort()
  }

  // Получить позиции по названию сметы
  const getItemsByEstimate = (estimateName) => {
    return estimateItems.filter(item =>
      (item.estimate_name || 'Основная смета') === estimateName
    ).sort((a, b) => a.row_number - b.row_number)
  }

  // Переключить раскрытие/скрытие сметы
  const toggleEstimateExpanded = (estimateName) => {
    setExpandedEstimates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(estimateName)) {
        newSet.delete(estimateName)
      } else {
        newSet.add(estimateName)
      }
      return newSet
    })
  }

  // Удалить всю смету
  const handleDeleteEstimate = async (estimateName) => {
    if (!window.confirm(`Удалить смету "${estimateName}" со всеми позициями?`)) return

    try {
      const itemsToDelete = estimateItems
        .filter(item => (item.estimate_name || 'Основная смета') === estimateName)
        .map(item => item.id)

      if (itemsToDelete.length === 0) return

      const { error } = await supabase
        .from('tender_estimate_items')
        .delete()
        .in('id', itemsToDelete)

      if (error) throw error
      fetchTenderData()
      alert(`Смета "${estimateName}" удалена`)
    } catch (error) {
      console.error('Ошибка удаления сметы:', error.message)
      alert('Ошибка удаления: ' + error.message)
    }
  }

  // ========== Функции для группировки позиций и генерации шаблона КП ==========

  // Группировка позиций сметы по ключу (наименование) - для шаблона расценок
  const getGroupedEstimateItems = () => {
    const grouped = {}

    estimateItems.forEach(item => {
      // Ключ группировки: наименование затрат (объединяем одинаковые позиции)
      const costName = item.cost_name?.trim() || ''
      if (!costName) return // Пропускаем позиции без наименования

      // Определяем тип позиции по коду: мат. = материалы, Р- = работы
      const code = item.code?.trim() || ''
      const isMaterial = code.toLowerCase().startsWith('мат')
      const isWork = code.toUpperCase().startsWith('Р')
      const itemType = isMaterial ? 'material' : (isWork ? 'work' : 'unknown')

      // Ключ = наименование + тип (чтобы не смешивать материалы и работы с одинаковым названием)
      const groupKey = `${costName}__${itemType}`

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          key: groupKey,
          code: item.code,
          cost_type: item.cost_type,
          cost_name: costName,
          unit: item.unit,
          itemType: itemType, // 'material' или 'work'
          total_volume: 0, // Объём (работ или расход материала)
          items: [],
          rowNumbers: []
        }
      }

      // Суммируем объём в зависимости от типа
      if (itemType === 'material') {
        grouped[groupKey].total_volume += parseFloat(item.material_consumption) || 0
      } else {
        grouped[groupKey].total_volume += parseFloat(item.work_volume) || 0
      }

      grouped[groupKey].items.push(item)
      grouped[groupKey].rowNumbers.push(item.row_number)
    })

    return Object.values(grouped).sort((a, b) => {
      // Сортируем по первому номеру строки в группе
      return Math.min(...a.rowNumbers) - Math.min(...b.rowNumbers)
    })
  }

  // Генерация упрощённого шаблона для заполнения расценок
  const handleDownloadPriceTemplate = () => {
    const groupedItems = getGroupedEstimateItems()

    if (groupedItems.length === 0) {
      alert('Сначала загрузите смету')
      return
    }

    // Заголовки шаблона:
    // №, Тип, Наименование, Ед.изм., Объём, Цена за ед., Позиции в смете
    const headers = [
      '№ п/п',
      'Тип',           // М = материал, Р = работа
      'Наименование',
      'Ед. изм.',
      'Объём',
      'Цена за ед. (заполнить)',  // ЗАПОЛНЯЕТ ПОДРЯДЧИК
      'Позиции в смете'
    ]

    // Данные - уникальные позиции со сводными объёмами
    // Числа передаём как числа (не строки), чтобы Excel корректно работал с формулами
    const dataRows = groupedItems.map((group, idx) => {
      const typeLabel = group.itemType === 'material' ? 'М' : (group.itemType === 'work' ? 'Р' : '?')
      return [
        idx + 1,
        typeLabel,
        group.cost_name || '',
        group.unit || '',
        group.total_volume || 0,  // Число, не строка - Excel сам отформатирует
        null, // Цена - ЗАПОЛНЯЕТ ПОДРЯДЧИК
        group.rowNumbers.join(', ')
      ]
    })

    // Создаём Excel
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])

    // Ширина колонок
    ws['!cols'] = [
      { wch: 8 },   // № п/п
      { wch: 6 },   // Тип
      { wch: 55 },  // Наименование
      { wch: 10 },  // Ед. изм.
      { wch: 15 },  // Объём
      { wch: 22 },  // Цена за ед.
      { wch: 18 },  // Позиции в смете
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Расценки')

    const objectName = tender?.objects?.name || 'Тендер'
    const fileName = `Расценки_${objectName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  // Импорт заполненных расценок и распределение на все позиции
  const handleImportPricesFromTemplate = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          const worksheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

          // Парсим расценки из шаблона
          // Новая структура: 0-№, 1-Тип(М/Р), 2-Наименование, 3-Ед.изм., 4-Объем, 5-Цена, 6-Позиции
          const priceMap = {} // key (наименование + тип) -> { price, type }

          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.length < 6) continue

            const typeLabel = row[1]?.toString().trim().toUpperCase() // М или Р
            const costName = row[2]?.toString().trim()
            const price = parseFloat(row[5]) || 0

            if (!costName || price <= 0) continue

            // Тип: М = материал, Р = работа
            const itemType = typeLabel === 'М' ? 'material' : (typeLabel === 'Р' ? 'work' : 'unknown')
            const key = `${costName}__${itemType}`

            priceMap[key] = { price, itemType }
          }

          if (Object.keys(priceMap).length === 0) {
            alert('Не найдены расценки в файле. Заполните колонку «Цена за ед.»')
            return
          }

          // Формируем предложения для каждой позиции сметы
          const proposalsToInsert = []

          estimateItems.forEach(item => {
            const costName = item.cost_name?.trim() || ''
            const code = item.code?.trim() || ''
            const isMaterial = code.toLowerCase().startsWith('мат')
            const isWork = code.toUpperCase().startsWith('Р')
            const itemType = isMaterial ? 'material' : (isWork ? 'work' : 'unknown')

            const key = `${costName}__${itemType}`
            const priceData = priceMap[key]

            if (priceData) {
              const workVolume = parseFloat(item.work_volume) || 0
              const materialConsumption = parseFloat(item.material_consumption) || 0

              // Расчёт в зависимости от типа позиции
              let unitPriceMaterials = 0
              let unitPriceWorks = 0
              let totalMaterials = 0
              let totalWorks = 0

              if (priceData.itemType === 'material') {
                unitPriceMaterials = priceData.price
                totalMaterials = priceData.price * materialConsumption
              } else {
                unitPriceWorks = priceData.price
                totalWorks = priceData.price * workVolume
              }

              const totalCost = totalMaterials + totalWorks

              proposalsToInsert.push({
                tender_id: tenderId,
                counterparty_id: selectedCounterpartyForUpload,
                estimate_item_id: item.id,
                unit_price_materials: unitPriceMaterials,
                unit_price_works: unitPriceWorks,
                total_unit_price: unitPriceMaterials + unitPriceWorks,
                total_materials: totalMaterials,
                total_works: totalWorks,
                total_cost: totalCost
              })
            }
          })

          if (proposalsToInsert.length === 0) {
            alert('Не удалось сопоставить расценки с позициями сметы. Проверьте наименования.')
            return
          }

          // Удаляем старые предложения этого контрагента для этого тендера
          await supabase
            .from('tender_counterparty_proposals')
            .delete()
            .eq('tender_id', tenderId)
            .eq('counterparty_id', selectedCounterpartyForUpload)

          // Вставляем новые предложения
          const { error } = await supabase
            .from('tender_counterparty_proposals')
            .insert(proposalsToInsert)

          if (error) throw error

          setShowUploadModal(false)
          fetchTenderData()
          alert(`Импортировано расценок для ${proposalsToInsert.length} из ${estimateItems.length} позиций`)

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

  // Импорт сметы из Excel - название берётся из имени файла
  const handleImportEstimateFromExcel = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Название сметы = имя файла без расширения
    const estimateName = file.name.replace(/\.(xlsx|xls)$/i, '').trim() || 'Новая смета'
    const existingEstimate = getEstimateNames().includes(estimateName)

    // Если смета с таким именем существует - спрашиваем
    if (existingEstimate) {
      if (!window.confirm(`Смета "${estimateName}" уже существует. Заменить её?`)) {
        e.target.value = ''
        return
      }
    }

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

          // Находим максимальный row_number среди ВСЕХ существующих позиций тендера
          // (кроме позиций сметы, которую заменяем)
          const existingItems = existingEstimate
            ? estimateItems.filter(item => (item.estimate_name || 'Основная смета') !== estimateName)
            : estimateItems

          const maxExistingRowNumber = existingItems.length > 0
            ? Math.max(...existingItems.map(item => item.row_number))
            : 0

          // Нумерация новых позиций начинается после максимального существующего номера
          let nextRowNumber = maxExistingRowNumber + 1

          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.length === 0) continue

            const code = row[1]?.toString().trim()
            if (!code) continue

            const costName = row[2]?.toString().trim()
            const rowNumber = nextRowNumber++

            let costType = null
            if (code.toLowerCase().startsWith('мат') || code.toLowerCase() === 'мат.') {
              costType = 'Материалы'
            } else if (code.toUpperCase().startsWith('Р') || code.toUpperCase().startsWith('Р-')) {
              costType = 'Работы'
            }

            itemsToInsert.push({
              tender_id: tenderId,
              estimate_name: estimateName,  // Название сметы = имя файла
              row_number: rowNumber,
              code: code || null,
              cost_type: costType,
              cost_name: costName || '',
              unit: row[3]?.toString().trim() || null,
              work_volume: parseFloat(row[4]) || null,
              material_consumption: parseFloat(row[5]) || null,
              calculation_note: row[11]?.toString().trim() || null
            })
          }

          if (itemsToInsert.length > 0) {
            // Удаляем старую смету с таким же названием (если есть)
            if (existingEstimate) {
              const oldItems = estimateItems
                .filter(item => (item.estimate_name || 'Основная смета') === estimateName)
                .map(item => item.id)
              if (oldItems.length > 0) {
                await supabase
                  .from('tender_estimate_items')
                  .delete()
                  .in('id', oldItems)
              }
            }

            // Вставляем новые позиции
            const { error } = await supabase
              .from('tender_estimate_items')
              .insert(itemsToInsert)

            if (error) throw error

            // Раскрываем добавленную смету
            setExpandedEstimates(prev => new Set([...prev, estimateName]))

            fetchTenderData()
            alert(`Импортировано ${itemsToInsert.length} позиций в смету "${estimateName}"`)
          } else {
            alert('Не найдено позиций для импорта. Проверьте структуру файла.')
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

    // Сбрасываем input для возможности повторного выбора того же файла
    e.target.value = ''
  }

  const handleDownloadEstimateTemplate = () => {
    // Создаем шаблон сметы - структура A-L
    const templateData = [
      ['№ п/п', 'КОД', 'Наименование затрат', 'Ед. изм.', 'Объем по виду работ', 'Общий расход по материалу', 'Материалы/оборудование', 'СМР, ПНР', 'Итого материалы', 'Итого СМР', 'Общая стоимость', 'ПРИМЕЧАНИЯ'],
      ['', 'мат.', 'Пример: Кабель ВВГнг 3x2.5', 'м', '', 105, '', '', '', '', '', ''],
      [1, 'Р-001', 'Пример: Монтаж кабеля', 'м', 100, '', '', '', '', '', '', ''],
      ['', 'мат.', 'Пример: Кабель-канал 40x25', 'м', '', 50, '', '', '', '', '', ''],
      [2, 'Р-002', 'Пример: Монтаж кабель-канала', 'м', 50, '', '', '', '', '', '', ''],
    ]

    const ws = XLSX.utils.aoa_to_sheet(templateData)

    // Устанавливаем ширину колонок (A-L)
    ws['!cols'] = [
      { wch: 8 },   // A: № п/п
      { wch: 12 },  // B: КОД
      { wch: 40 },  // C: Наименование затрат
      { wch: 10 },  // D: Ед. изм.
      { wch: 18 },  // E: Объем по виду работ
      { wch: 22 },  // F: Общий расход по материалу
      { wch: 20 },  // G: Материалы/оборудование (цена)
      { wch: 18 },  // H: СМР, ПНР (цена)
      { wch: 18 },  // I: Итого материалы
      { wch: 15 },  // J: Итого СМР
      { wch: 18 },  // K: Общая стоимость
      { wch: 25 },  // L: ПРИМЕЧАНИЯ
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
        <button className="btn-back" onClick={() => navigate(-1)} title="Назад к списку">
          ←
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
          className={`tender-tab ${activeTab === 'source_data' ? 'active' : ''}`}
          onClick={() => setActiveTab('source_data')}
        >
          Исходные данные
          {tenderDocuments.length > 0 && <span className="tab-count">{tenderDocuments.length}</span>}
        </button>
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
        {/* Вкладка Исходные данные */}
        {activeTab === 'source_data' && (
          <div className="source-data-section">
            {/* Шаблон сметы */}
            <div className="source-data-card">
              <div className="source-data-card-header">
                <h3>📊 Шаблон сметы (Excel)</h3>
                <p className="source-data-description">
                  Ссылка на шаблон сметы в Google Drive. Подрядчик скачивает, заполняет расценки и отправляет обратно.
                </p>
              </div>
              <div className="source-data-card-content">
                {estimateTemplate ? (
                  <div className="template-info">
                    <div className="template-file">
                      <span className="file-icon">{getDocumentIcon(estimateTemplate.url)}</span>
                      <div className="file-details">
                        <span className="file-name">{estimateTemplate.name}</span>
                        <span className="file-size file-url">{estimateTemplate.url}</span>
                      </div>
                      <div className="file-actions">
                        <a
                          href={estimateTemplate.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary"
                        >
                          Открыть
                        </a>
                        <button
                          className="btn-danger"
                          onClick={() => handleDeleteDocument(estimateTemplate)}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-template">
                    <p>Ссылка на исходную смету не добавлена</p>
                    <button
                      className="btn-primary"
                      onClick={() => handleOpenAddDocument('estimate_template')}
                    >
                      + Добавить ссылку на смету
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Шаблон расценок для подрядчика */}
            <div className="source-data-card">
              <div className="source-data-card-header">
                <h3>📋 Шаблон расценок для подрядчика</h3>
                <p className="source-data-description">
                  Система анализирует смету, объединяет одинаковые позиции и генерирует упрощённый шаблон.
                  Подрядчику нужно заполнить цены только для уникальных позиций.
                </p>
              </div>
              <div className="source-data-card-content">
                {estimateItems.length === 0 ? (
                  <div className="no-template">
                    <p>Сначала загрузите смету во вкладке «Смета»</p>
                    <button
                      className="btn-secondary"
                      onClick={() => setActiveTab('estimate')}
                    >
                      Перейти к смете
                    </button>
                  </div>
                ) : (
                  <div className="price-template-section">
                    <div className="analysis-stats">
                      <div className="stat-item">
                        <span className="stat-value">{estimateItems.length}</span>
                        <span className="stat-label">позиций в смете</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{getGroupedEstimateItems().length}</span>
                        <span className="stat-label">уникальных позиций</span>
                      </div>
                      <div className="stat-item highlight">
                        <span className="stat-value">
                          {estimateItems.length - getGroupedEstimateItems().length}
                        </span>
                        <span className="stat-label">объединённых (экономия)</span>
                      </div>
                    </div>
                    <div className="template-actions">
                      <button
                        className="btn-primary"
                        onClick={handleDownloadPriceTemplate}
                      >
                        📥 Скачать шаблон расценок
                      </button>
                      <p className="action-hint">
                        Отправьте этот файл подрядчикам. Они заполнят колонки «Цена материала» и «Цена работы»
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Документы для подрядчика */}
            <div className="source-data-card">
              <div className="source-data-card-header">
                <h3>📎 Документы для подрядчика</h3>
                <p className="source-data-description">
                  Ссылки на чертежи, спецификации, ТЗ и другие материалы в Google Drive
                </p>
              </div>
              <div className="source-data-card-content">
                <div className="documents-upload-area">
                  <button
                    className="btn-primary"
                    onClick={() => handleOpenAddDocument('attachment')}
                  >
                    + Добавить ссылку на документ
                  </button>
                </div>

                {tenderDocuments.filter(d => d.document_type === 'attachment').length === 0 ? (
                  <div className="empty-documents">
                    <p>Ссылки на документы не добавлены</p>
                    <p className="hint">Добавьте ссылки на Google Drive с чертежами и спецификациями</p>
                  </div>
                ) : (
                  <div className="documents-list">
                    {tenderDocuments
                      .filter(d => d.document_type === 'attachment')
                      .map(doc => (
                        <div key={doc.id} className="document-item">
                          <span className="doc-icon">{getDocumentIcon(doc.url)}</span>
                          <div className="doc-info">
                            <span className="doc-name">{doc.name}</span>
                            <span className="doc-size doc-url">{doc.url}</span>
                          </div>
                          <div className="doc-actions">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-icon-action"
                              title="Открыть"
                            >
                              🔗
                            </a>
                            <button
                              className="btn-icon-action btn-delete-doc"
                              onClick={() => handleDeleteDocument(doc)}
                              title="Удалить"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Вкладка Смета */}
        {activeTab === 'estimate' && (
          <div className="estimate-section">
            <div className="section-header">
              <h3>Сметы тендера ({getEstimateNames().length} смет, {estimateItems.length} позиций)</h3>
              <div className="section-actions">
                {selectedEstimateItems.size > 0 && (
                  <button className="btn-danger" onClick={handleDeleteSelectedItems}>
                    🗑️ Удалить выбранные ({selectedEstimateItems.size})
                  </button>
                )}
                <button className="btn-secondary" onClick={handleAddEstimateItem}>
                  + Добавить позицию
                </button>
                <button className="btn-primary" onClick={() => setShowImportEstimateModal(true)}>
                  📥 Импорт сметы
                </button>
              </div>
            </div>

            {estimateItems.length === 0 ? (
              <div className="empty-state">
                <p>Сметы еще не добавлены</p>
                <p className="hint">Импортируйте сметы из Excel файлов. Можно загрузить несколько смет.</p>
              </div>
            ) : (
              <div className="estimates-list">
                {getEstimateNames().map(estimateName => {
                  const items = getItemsByEstimate(estimateName)
                  const isExpanded = expandedEstimates.has(estimateName)

                  return (
                    <div key={estimateName} className="estimate-card">
                      <div
                        className="estimate-card-header"
                        onClick={() => toggleEstimateExpanded(estimateName)}
                      >
                        <div className="estimate-header-left">
                          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                          <h4>{estimateName}</h4>
                          <span className="estimate-count">({items.length} позиций)</span>
                        </div>
                        <div className="estimate-header-actions" onClick={e => e.stopPropagation()}>
                          <button
                            className="btn-icon-small"
                            onClick={() => handleDeleteEstimate(estimateName)}
                            title="Удалить смету"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="estimate-card-content">
                          <table className="estimate-table compact">
                            <thead>
                              <tr>
                                <th className="col-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={items.length > 0 && items.every(i => selectedEstimateItems.has(i.id))}
                                    onChange={() => {
                                      const allSelected = items.every(i => selectedEstimateItems.has(i.id))
                                      setSelectedEstimateItems(prev => {
                                        const newSet = new Set(prev)
                                        items.forEach(i => {
                                          if (allSelected) newSet.delete(i.id)
                                          else newSet.add(i.id)
                                        })
                                        return newSet
                                      })
                                    }}
                                    title="Выбрать все в этой смете"
                                  />
                                </th>
                                <th>№</th>
                                <th>КОД</th>
                                <th>Наименование</th>
                                <th>Ед.</th>
                                <th>Объём</th>
                                <th>Расход</th>
                                <th>Действия</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map(item => (
                                <tr
                                  key={item.id}
                                  className={selectedEstimateItems.has(item.id) ? 'selected-row' : ''}
                                >
                                  <td className="center">
                                    <input
                                      type="checkbox"
                                      checked={selectedEstimateItems.has(item.id)}
                                      onChange={() => handleToggleSelectItem(item.id)}
                                    />
                                  </td>
                                  <td className="center">{item.row_number}</td>
                                  <td>{item.code || '-'}</td>
                                  <td className="col-name-compact">{item.cost_name}</td>
                                  <td className="center">{item.unit || '-'}</td>
                                  <td className="right">{item.work_volume ?? '-'}</td>
                                  <td className="right">{item.material_consumption ?? '-'}</td>
                                  <td className="actions">
                                    <button
                                      className="btn-icon-small"
                                      onClick={() => handleEditEstimateItem(item)}
                                      title="Редактировать"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      className="btn-icon-small"
                                      onClick={() => handleDeleteEstimateItem(item.id)}
                                      title="Удалить"
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
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

      {/* Модал добавления ссылки на документ */}
      {showAddDocumentModal && (
        <div className="modal-overlay" onClick={() => setShowAddDocumentModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {addingDocumentType === 'estimate_template'
                  ? 'Добавить ссылку на шаблон сметы'
                  : 'Добавить ссылку на документ'}
              </h3>
              <button className="modal-close" onClick={() => setShowAddDocumentModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveDocument}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Название документа *</label>
                  <input
                    type="text"
                    value={documentFormData.name}
                    onChange={e => setDocumentFormData({...documentFormData, name: e.target.value})}
                    placeholder={addingDocumentType === 'estimate_template'
                      ? 'Например: Шаблон сметы - Объект N'
                      : 'Например: Чертежи фасада'}
                    required
                  />
                </div>
                <div className="form-group full-width">
                  <label>Ссылка на Google Drive *</label>
                  <input
                    type="url"
                    value={documentFormData.url}
                    onChange={e => setDocumentFormData({...documentFormData, url: e.target.value})}
                    placeholder="https://drive.google.com/..."
                    required
                  />
                  <small className="form-hint">
                    Скопируйте ссылку из Google Drive (Поделиться → Копировать ссылку)
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddDocumentModal(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary" disabled={savingDocument}>
                  {savingDocument ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    placeholder="мат. или Р-..."
                  />
                  <small className="form-hint">Тип автоопределяется: «мат.» = материалы, «Р-» = работы</small>
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
                <div className="form-group">
                  <label>Ед. изм.</label>
                  <input
                    type="text"
                    value={estimateFormData.unit}
                    onChange={e => setEstimateFormData({...estimateFormData, unit: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Объем работ (E)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={estimateFormData.work_volume}
                    onChange={e => setEstimateFormData({...estimateFormData, work_volume: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Расход материала (F)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={estimateFormData.material_consumption}
                    onChange={e => setEstimateFormData({...estimateFormData, material_consumption: e.target.value})}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Примечания (L)</label>
                  <textarea
                    value={estimateFormData.calculation_note}
                    onChange={e => setEstimateFormData({...estimateFormData, calculation_note: e.target.value})}
                    rows="2"
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
              <div className="upload-options">
                {/* Вариант 1: Упрощённый шаблон (рекомендуется) */}
                <div className="upload-option recommended">
                  <div className="upload-option-header">
                    <span className="option-badge">Рекомендуется</span>
                    <h4>📋 Загрузить упрощённый шаблон расценок</h4>
                  </div>
                  <p className="upload-option-desc">
                    Подрядчик заполняет цены только для уникальных позиций.
                    Система автоматически распределит их на все связанные позиции сметы.
                  </p>
                  <div className="upload-option-actions">
                    <label className="btn-primary upload-btn">
                      📤 Загрузить заполненный шаблон
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleImportPricesFromTemplate}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <button
                      className="btn-secondary"
                      onClick={handleDownloadPriceTemplate}
                      disabled={estimateItems.length === 0}
                    >
                      📥 Скачать пустой шаблон
                    </button>
                  </div>
                </div>

                {/* Вариант 2: Полный формат */}
                <div className="upload-option">
                  <h4>📊 Загрузить в полном формате</h4>
                  <p className="upload-option-desc">
                    Excel с ценами для каждой строки сметы (старый формат).
                  </p>
                  <label className="btn-secondary upload-btn">
                    Выбрать файл
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      disabled={uploading}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {uploading && <div className="uploading-indicator">Загрузка...</div>}
                </div>
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
