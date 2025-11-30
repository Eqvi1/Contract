import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import './BSMPage.css'

function BSMPage() {
  const [pivotData, setPivotData] = useState([])
  const [fileName, setFileName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('all') // 'all', 'zero', 'different', 'units', 'compare', 'not_in_supply'
  const [expandedItems, setExpandedItems] = useState({}) // для раскрытия деталей
  const [groupedDifferentPrices, setGroupedDifferentPrices] = useState([]) // сгруппированные материалы с разными ценами
  const [differentUnitsData, setDifferentUnitsData] = useState([]) // материалы с разными ед. изм.
  const fileInputRef = useRef(null)

  // Для сравнения с согласованными расценками
  const [objects, setObjects] = useState([])
  const [selectedObjectId, setSelectedObjectId] = useState('')
  const [approvedRates, setApprovedRates] = useState([])
  const [comparisonData, setComparisonData] = useState([])
  const [comparisonStats, setComparisonStats] = useState(null)

  // Загрузка объектов при монтировании
  useEffect(() => {
    fetchObjects()
  }, [])

  // Загрузка согласованных расценок при выборе объекта
  useEffect(() => {
    if (selectedObjectId) {
      fetchApprovedRates()
    } else {
      setApprovedRates([])
      setComparisonData([])
      setComparisonStats(null)
    }
  }, [selectedObjectId])

  // Пересчёт сравнения при изменении данных
  useEffect(() => {
    if (pivotData.length > 0 && approvedRates.length > 0) {
      calculateComparison()
    }
  }, [pivotData, approvedRates])

  const fetchObjects = async () => {
    const { data, error } = await supabase
      .from('objects')
      .select('id, name')
      .order('name')

    if (!error && data) {
      setObjects(data)
    }
  }

  const fetchApprovedRates = async () => {
    const { data, error } = await supabase
      .from('bsm_supply_rates')
      .select('*')
      .eq('object_id', selectedObjectId)

    if (!error && data) {
      setApprovedRates(data)
    }
  }

  const calculateComparison = () => {
    // Создаём карту расценок от снабжения по названию материала
    const ratesMap = {}
    approvedRates.forEach(rate => {
      const key = rate.material_name.trim().toLowerCase()
      ratesMap[key] = rate.supply_price
    })

    // Сравниваем каждую позицию
    const comparison = []
    let totalCurrentSum = 0      // Сумма по файлу (только найденные в снабжении)
    let totalApprovedSum = 0     // Сумма по снабжению
    let totalDifference = 0      // Сумма разниц (удешевление/удорожание)
    let matchedCount = 0
    let notFoundCount = 0
    let priceDiffCount = 0

    pivotData.forEach(item => {
      const key = item.name.trim().toLowerCase()
      const approvedPrice = ratesMap[key]
      const currentSum = item.totalVolume * (item.price || 0)

      let approvedSum = 0
      let difference = 0
      let status = 'not_found'

      if (approvedPrice !== undefined) {
        approvedSum = item.totalVolume * approvedPrice
        // Разница = снабжение - файл (отрицательное = удешевление)
        difference = approvedSum - currentSum

        totalCurrentSum += currentSum
        totalApprovedSum += approvedSum
        totalDifference += difference

        if (Math.abs(item.price - approvedPrice) < 0.01) {
          status = 'match'
          matchedCount++
        } else {
          status = 'different'
          priceDiffCount++
        }
      } else {
        notFoundCount++
      }

      comparison.push({
        ...item,
        approvedPrice: approvedPrice,
        currentSum: currentSum,
        approvedSum: approvedSum,
        difference: difference,
        status: status
      })
    })

    setComparisonData(comparison)
    setComparisonStats({
      totalCurrentSum,
      totalApprovedSum,
      totalDifference,
      matchedCount,
      priceDiffCount,
      notFoundCount,
      totalItems: pivotData.length
    })
  }

  // Создание сводной таблицы как в Excel
  const createPivotTable = (rows) => {
    // Группируем по наименованию + цена (ключ: название + цена)
    const pivotMap = {}

    rows.forEach(row => {
      const name = (row.name || '').trim()
      if (!name) return

      const price = parseFloat(row.price) || 0
      const volume = parseFloat(row.volume) || 0

      // Ключ: наименование + цена (если цена разная - это разные строки)
      const key = `${name.toLowerCase()}|${price.toFixed(2)}`

      if (!pivotMap[key]) {
        pivotMap[key] = {
          name: name,
          unit: row.unit || '',
          price: price,
          totalVolume: 0,
          count: 0,
          isZeroPrice: price === 0
        }
      }

      pivotMap[key].totalVolume += volume
      pivotMap[key].count += 1
    })

    // Преобразуем в массив и сортируем по названию
    const pivotArray = Object.values(pivotMap).sort((a, b) =>
      a.name.localeCompare(b.name, 'ru')
    )

    // Находим материалы с разными ценами
    const nameGroups = {}
    pivotArray.forEach(item => {
      const nameLower = item.name.toLowerCase()
      if (!nameGroups[nameLower]) {
        nameGroups[nameLower] = []
      }
      nameGroups[nameLower].push(item)
    })

    // Помечаем материалы с разными ценами и добавляем список всех цен
    pivotArray.forEach(item => {
      const nameLower = item.name.toLowerCase()
      const group = nameGroups[nameLower]
      item.hasDifferentPrices = group.length > 1

      if (item.hasDifferentPrices) {
        // Собираем все цены для этого материала
        item.allPrices = group.map(g => g.price).sort((a, b) => a - b)
      }
    })

    // Статистика
    const zeroPriceCount = pivotArray.filter(item => item.isZeroPrice).length
    const differentPricesCount = Object.values(nameGroups).filter(g => g.length > 1).length

    // Группируем материалы с разными ценами для отдельной вкладки
    const groupedDifferent = Object.values(nameGroups)
      .filter(g => g.length > 1)
      .map(group => ({
        name: group[0].name,
        unit: group[0].unit,
        totalVolume: group.reduce((sum, item) => sum + item.totalVolume, 0),
        variants: group.map(item => ({
          price: item.price,
          volume: item.totalVolume,
          count: item.count
        })).sort((a, b) => a.price - b.price)
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    // Анализ единиц измерения - группируем по названию и проверяем разные ед. изм.
    const unitsByName = {}
    rows.forEach(row => {
      const name = (row.name || '').trim().toLowerCase()
      const unit = (row.unit || '').trim()
      if (!name) return

      if (!unitsByName[name]) {
        unitsByName[name] = {
          originalName: row.name,
          units: {}
        }
      }
      if (!unitsByName[name].units[unit]) {
        unitsByName[name].units[unit] = {
          unit: unit,
          volume: 0,
          count: 0
        }
      }
      unitsByName[name].units[unit].volume += parseFloat(row.volume) || 0
      unitsByName[name].units[unit].count += 1
    })

    // Фильтруем только те, где больше одной единицы измерения
    const differentUnits = Object.values(unitsByName)
      .filter(item => Object.keys(item.units).length > 1)
      .map(item => ({
        name: item.originalName,
        variants: Object.values(item.units).sort((a, b) => b.count - a.count)
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    return {
      pivotArray,
      groupedDifferent,
      differentUnits,
      stats: {
        totalRows: rows.length,
        uniqueLines: pivotArray.length,
        zeroPriceCount,
        differentPricesCount,
        differentUnitsCount: differentUnits.length
      }
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsLoading(true)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        const rows = []

        // Находим строку заголовка
        let headerRowIndex = 0
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const row = jsonData[i]
          if (row && row.some(cell =>
            cell && typeof cell === 'string' &&
            (cell.toLowerCase().includes('наименование') ||
             cell.toLowerCase().includes('материал'))
          )) {
            headerRowIndex = i
            break
          }
        }

        // Парсим данные после заголовка
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (!row || !row[0]) continue

          rows.push({
            name: row[0] || '',
            unit: row[1] || '',
            volume: row[2] || 0,
            price: row[3] || 0
          })
        }

        const { pivotArray, groupedDifferent, differentUnits, stats } = createPivotTable(rows)
        setPivotData(pivotArray)
        setGroupedDifferentPrices(groupedDifferent)
        setDifferentUnitsData(differentUnits)
        setStats(stats)
      } catch (error) {
        console.error('Ошибка при чтении файла:', error)
        alert('Ошибка при чтении файла. Убедитесь, что это корректный Excel-файл.')
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleClear = () => {
    setPivotData([])
    setGroupedDifferentPrices([])
    setDifferentUnitsData([])
    setStats(null)
    setFileName('')
    setActiveTab('all')
    setExpandedItems({})
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const toggleExpanded = (index) => {
    setExpandedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  // Фильтрация данных по активной вкладке
  const getFilteredData = () => {
    switch (activeTab) {
      case 'zero':
        return pivotData.filter(item => item.isZeroPrice)
      case 'different':
        return pivotData.filter(item => item.hasDifferentPrices)
      default:
        return pivotData
    }
  }

  const filteredData = getFilteredData()

  const handleExport = () => {
    if (pivotData.length === 0) return

    const wb = XLSX.utils.book_new()

    // Функция для установки ширины столбцов
    const setColWidths = (ws, widths) => {
      ws['!cols'] = widths.map(w => ({ wch: w }))
    }

    // Функция для создания заголовка отчета
    const addReportHeader = (ws, title, colCount) => {
      // Вставляем заголовок в начало
      XLSX.utils.sheet_add_aoa(ws, [[title]], { origin: 'A1' })
      // Объединяем ячейки для заголовка
      if (!ws['!merges']) ws['!merges'] = []
      ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } })
    }

    // Общая сумма
    const totalSum = pivotData.reduce((sum, item) => sum + (item.totalVolume * (item.price || 0)), 0)

    // 1. Лист "Все материалы"
    const allHeaders = ['№', 'Наименование материалов', 'Ед. изм.', 'Итого объем', 'Цена за ед. с НДС', 'Итого сумма', 'Кол-во поз.', 'Примечание']
    const allRows = pivotData.map((item, idx) => [
      idx + 1,
      item.name,
      item.unit,
      item.totalVolume,
      item.price || '',
      item.price ? item.totalVolume * item.price : '',
      item.count,
      item.isZeroPrice ? 'Нет расценки' : (item.hasDifferentPrices ? 'Разные цены' : '')
    ])

    // Итоговая строка
    allRows.push(['', '', '', '', 'ИТОГО:', totalSum, '', ''])

    const wsAll = XLSX.utils.aoa_to_sheet([
      ['ОТЧЕТ ПО МАТЕРИАЛАМ'],
      ['Дата формирования: ' + new Date().toLocaleDateString('ru-RU')],
      [],
      allHeaders,
      ...allRows
    ])

    // Объединение для заголовка
    wsAll['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }
    ]

    setColWidths(wsAll, [5, 50, 10, 15, 18, 18, 10, 15])
    XLSX.utils.book_append_sheet(wb, wsAll, 'Все материалы')

    // 2. Лист "Без расценки"
    const zeroItems = pivotData.filter(item => item.isZeroPrice)
    if (zeroItems.length > 0) {
      const zeroHeaders = ['№', 'Наименование материалов', 'Ед. изм.', 'Итого объем', 'Кол-во поз.']
      const zeroRows = zeroItems.map((item, idx) => [
        idx + 1,
        item.name,
        item.unit,
        item.totalVolume,
        item.count
      ])

      const wsZero = XLSX.utils.aoa_to_sheet([
        ['МАТЕРИАЛЫ БЕЗ РАСЦЕНКИ'],
        ['Обнаружено позиций: ' + zeroItems.length],
        [],
        zeroHeaders,
        ...zeroRows
      ])

      wsZero['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }
      ]

      setColWidths(wsZero, [5, 50, 10, 15, 10])
      XLSX.utils.book_append_sheet(wb, wsZero, 'Без расценки')
    }

    // 3. Лист "Разные цены"
    if (groupedDifferentPrices.length > 0) {
      const diffPricesRows = [
        ['МАТЕРИАЛЫ С РАЗНЫМИ РАСЦЕНКАМИ'],
        ['Обнаружено материалов: ' + groupedDifferentPrices.length],
        [],
        ['№', 'Наименование материалов', 'Ед. изм.', 'Общий объем', 'Цена за ед.', 'Объем по цене', 'Кол-во поз.']
      ]

      groupedDifferentPrices.forEach((item, idx) => {
        // Строка с названием материала
        diffPricesRows.push([
          idx + 1,
          item.name,
          item.unit,
          item.totalVolume,
          '',
          '',
          ''
        ])
        // Варианты цен с отступом
        item.variants.forEach(variant => {
          diffPricesRows.push([
            '',
            '   → вариант цены:',
            '',
            '',
            variant.price || 'Не указана',
            variant.volume,
            variant.count
          ])
        })
        // Пустая строка
        diffPricesRows.push([])
      })

      const wsDiff = XLSX.utils.aoa_to_sheet(diffPricesRows)
      wsDiff['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }
      ]

      setColWidths(wsDiff, [5, 50, 10, 15, 15, 15, 10])
      XLSX.utils.book_append_sheet(wb, wsDiff, 'Разные цены')
    }

    // 4. Лист "Разные ед. изм."
    if (differentUnitsData.length > 0) {
      const diffUnitsRows = [
        ['ОШИБКИ В ЕДИНИЦАХ ИЗМЕРЕНИЯ'],
        ['Обнаружено материалов с разными ед. изм.: ' + differentUnitsData.length],
        [],
        ['№', 'Наименование материалов', 'Единица измерения', 'Объем', 'Кол-во поз.']
      ]

      differentUnitsData.forEach((item, idx) => {
        // Строка с названием материала
        diffUnitsRows.push([
          idx + 1,
          item.name,
          '',
          '',
          ''
        ])
        // Варианты единиц с отступом
        item.variants.forEach(variant => {
          diffUnitsRows.push([
            '',
            '   → единица:',
            variant.unit || '(пусто)',
            variant.volume,
            variant.count
          ])
        })
        // Пустая строка
        diffUnitsRows.push([])
      })

      const wsUnits = XLSX.utils.aoa_to_sheet(diffUnitsRows)
      wsUnits['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }
      ]

      setColWidths(wsUnits, [5, 50, 20, 15, 10])
      XLSX.utils.book_append_sheet(wb, wsUnits, 'Разные ед.изм.')
    }

    // 5. Лист "Нет в снабжении" - позиции отсутствующие в расценках от снабжения
    const notInSupplyItems = comparisonData.filter(item => item.status === 'not_found')
    if (notInSupplyItems.length > 0) {
      const notInSupplySum = notInSupplyItems.reduce((sum, item) => sum + item.currentSum, 0)
      const notInSupplyHeaders = ['№', 'Наименование материалов', 'Ед. изм.', 'Объем', 'Цена (файл)', 'Сумма (файл)']
      const notInSupplyRows = notInSupplyItems.map((item, idx) => [
        idx + 1,
        item.name,
        item.unit,
        item.totalVolume,
        item.price || '',
        item.currentSum || ''
      ])

      // Итоговая строка
      notInSupplyRows.push(['', '', '', '', 'ИТОГО:', notInSupplySum])

      const wsNotInSupply = XLSX.utils.aoa_to_sheet([
        ['ПОЗИЦИИ ОТСУТСТВУЮЩИЕ В РАСЦЕНКАХ ОТ СНАБЖЕНИЯ'],
        ['Объект: ' + (objects.find(o => o.id === selectedObjectId)?.name || 'Не выбран')],
        ['Обнаружено позиций: ' + notInSupplyItems.length],
        [],
        notInSupplyHeaders,
        ...notInSupplyRows
      ])

      wsNotInSupply['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }
      ]

      setColWidths(wsNotInSupply, [5, 50, 10, 15, 18, 18])
      XLSX.utils.book_append_sheet(wb, wsNotInSupply, 'Нет в снабжении')
    }

    // 6. Лист "Сравнение с ценами от снабжения"
    const comparedItems = comparisonData.filter(item => item.status !== 'not_found')
    if (comparedItems.length > 0 && comparisonStats) {
      const comparisonHeaders = ['№', 'Наименование материалов', 'Ед. изм.', 'Объем', 'Цена (файл)', 'Цена (снабжение)', 'Сумма (файл)', 'Сумма (снабжение)', 'Удешевление']
      const comparisonRows = comparedItems.map((item, idx) => [
        idx + 1,
        item.name,
        item.unit,
        item.totalVolume,
        item.price || '',
        item.approvedPrice || '',
        item.currentSum || '',
        item.approvedSum || '',
        item.difference || 0
      ])

      // Итоговая строка
      comparisonRows.push(['', '', '', '', '', 'ИТОГО:', comparisonStats.totalCurrentSum, comparisonStats.totalApprovedSum, comparisonStats.totalDifference])

      const wsComparison = XLSX.utils.aoa_to_sheet([
        ['СРАВНЕНИЕ С ЦЕНАМИ ОТ СНАБЖЕНИЯ'],
        ['Объект: ' + (objects.find(o => o.id === selectedObjectId)?.name || 'Не выбран')],
        ['Позиций сравнено: ' + comparedItems.length + ' | Совпадают: ' + comparisonStats.matchedCount + ' | Разные цены: ' + comparisonStats.priceDiffCount],
        [],
        comparisonHeaders,
        ...comparisonRows
      ])

      wsComparison['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } }
      ]

      setColWidths(wsComparison, [5, 45, 10, 12, 15, 15, 18, 18, 18])
      XLSX.utils.book_append_sheet(wb, wsComparison, 'Сравнение с снабжением')
    }

    // 7. Лист "Сводка"
    const summaryRows = [
      ['СВОДКА ПО АНАЛИЗУ МАТЕРИАЛОВ'],
      [''],
      ['Дата формирования отчета:', new Date().toLocaleDateString('ru-RU') + ' ' + new Date().toLocaleTimeString('ru-RU')],
      ['Исходный файл:', fileName],
      [''],
      ['СТАТИСТИКА', ''],
      ['Исходных строк в файле:', stats.totalRows],
      ['Уникальных позиций в сводной:', stats.uniqueLines],
      [''],
      ['ВЫЯВЛЕННЫЕ ПРОБЛЕМЫ', ''],
      ['Позиций без расценки:', stats.zeroPriceCount],
      ['Материалов с разными ценами:', stats.differentPricesCount],
      ['Материалов с разными ед. изм.:', stats.differentUnitsCount],
      ...(comparisonStats ? [['Позиций нет в снабжении:', comparisonStats.notFoundCount]] : []),
      [''],
      ['ИТОГИ', ''],
      ['Общая сумма материалов:', totalSum],
      ...(comparisonStats ? [
        [''],
        ['СРАВНЕНИЕ С ЦЕНАМИ ОТ СНАБЖЕНИЯ', ''],
        ['Объект сравнения:', objects.find(o => o.id === selectedObjectId)?.name || 'Не выбран'],
        ['Сумма по файлу (найденные):', comparisonStats.totalCurrentSum],
        ['Сумма от снабжения:', comparisonStats.totalApprovedSum],
        ['Удешевление:', comparisonStats.totalDifference]
      ] : [])
    ]

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
    wsSummary['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
    ]

    setColWidths(wsSummary, [35, 25])
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Сводка')

    // Формируем имя файла с датой
    const dateStr = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')
    XLSX.writeFile(wb, `БСМ_отчет_${dateStr}.xlsx`)
  }

  const formatNumber = (num) => {
    if (num === null || num === undefined || num === '') return '-'
    const parsed = parseFloat(num)
    if (isNaN(parsed)) return '-'
    return parsed.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  return (
    <div className="bsm-page">
      <h1>БСМ и материалы</h1>
      <p className="page-description">
        Загрузите Excel-файл для создания сводной таблицы по материалам
      </p>

      <div className="upload-section">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          ref={fileInputRef}
          id="file-upload"
          className="file-input"
        />
        <label htmlFor="file-upload" className="file-label">
          Выбрать файл
        </label>
        {fileName && (
          <span className="file-name">{fileName}</span>
        )}
        {pivotData.length > 0 && (
          <>
            <button onClick={handleExport} className="export-btn">
              Экспорт в Excel
            </button>
            <button onClick={handleClear} className="clear-btn">
              Очистить
            </button>
          </>
        )}
      </div>

      <div className="expected-format">
        <strong>Ожидаемый формат столбцов:</strong>
        <ol>
          <li>Наименование материалов</li>
          <li>Ед. изм.</li>
          <li>Объем</li>
          <li>Цена за ед. с учетом НДС</li>
        </ol>
      </div>

      {isLoading && (
        <div className="loading">Загрузка и анализ данных...</div>
      )}

      {stats && (
        <div className="summary">
          <div className="summary-cards">
            <div className="summary-card">
              <span className="card-value">{stats.totalRows}</span>
              <span className="card-label">Исходных строк</span>
            </div>
            <div className="summary-card">
              <span className="card-value">{stats.uniqueLines}</span>
              <span className="card-label">Строк в сводной</span>
            </div>
            <div className={`summary-card ${stats.zeroPriceCount > 0 ? 'warning' : ''}`}>
              <span className="card-value">{stats.zeroPriceCount}</span>
              <span className="card-label">Без расценки</span>
            </div>
            <div className={`summary-card ${stats.differentPricesCount > 0 ? 'alert' : ''}`}>
              <span className="card-value">{stats.differentPricesCount}</span>
              <span className="card-label">С разными ценами</span>
            </div>
          </div>
        </div>
      )}

      {pivotData.length > 0 && (
        <div className="pivot-section">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Все материалы
              <span className="tab-count">{stats.uniqueLines}</span>
            </button>
            <button
              className={`tab ${activeTab === 'zero' ? 'active' : ''} ${stats.zeroPriceCount > 0 ? 'warning' : ''}`}
              onClick={() => setActiveTab('zero')}
            >
              Без расценки
              <span className="tab-count">{stats.zeroPriceCount}</span>
            </button>
            <button
              className={`tab ${activeTab === 'different' ? 'active' : ''} ${stats.differentPricesCount > 0 ? 'alert' : ''}`}
              onClick={() => setActiveTab('different')}
            >
              Разные цены
              <span className="tab-count">{stats.differentPricesCount}</span>
            </button>
            <button
              className={`tab ${activeTab === 'units' ? 'active' : ''} ${stats.differentUnitsCount > 0 ? 'error' : ''}`}
              onClick={() => setActiveTab('units')}
            >
              Разные ед. изм.
              <span className="tab-count">{stats.differentUnitsCount}</span>
            </button>
            <button
              className={`tab ${activeTab === 'compare' ? 'active' : ''} ${comparisonStats && comparisonStats.totalDifference !== 0 ? 'compare' : ''}`}
              onClick={() => setActiveTab('compare')}
            >
              Сравнение с ценами от снабжения
              {comparisonStats && (
                <span className={`tab-count ${comparisonStats.totalDifference < 0 ? 'positive' : comparisonStats.totalDifference > 0 ? 'negative' : ''}`}>
                  {formatNumber(comparisonStats.totalDifference)}
                </span>
              )}
            </button>
            <button
              className={`tab ${activeTab === 'not_in_supply' ? 'active' : ''} ${comparisonStats && comparisonStats.notFoundCount > 0 ? 'warning' : ''}`}
              onClick={() => setActiveTab('not_in_supply')}
            >
              Нет в снабжении
              {comparisonStats && (
                <span className="tab-count">{comparisonStats.notFoundCount}</span>
              )}
            </button>
          </div>

          {activeTab === 'not_in_supply' ? (
            // Вкладка "Нет в снабжении" - позиции не найденные в расценках от снабжения
            <div className="compare-section">
              <div className="compare-header">
                <label>Позиции отсутствующие в расценках объекта:</label>
                <select
                  value={selectedObjectId}
                  onChange={(e) => setSelectedObjectId(e.target.value)}
                >
                  <option value="">-- Выберите объект --</option>
                  {objects.map(obj => (
                    <option key={obj.id} value={obj.id}>{obj.name}</option>
                  ))}
                </select>
                {selectedObjectId && approvedRates.length === 0 && (
                  <span className="no-rates-warning">Нет расценок от снабжения для этого объекта</span>
                )}
              </div>

              {comparisonStats && comparisonStats.notFoundCount > 0 && (
                <>
                  <div className="comparison-summary">
                    <div className="summary-card warning">
                      <span className="card-value">{comparisonStats.notFoundCount}</span>
                      <span className="card-label">Позиций не найдено</span>
                    </div>
                    <div className="summary-card">
                      <span className="card-value">
                        {formatNumber(comparisonData.filter(item => item.status === 'not_found').reduce((sum, item) => sum + item.currentSum, 0))}
                      </span>
                      <span className="card-label">Сумма без расценок</span>
                    </div>
                  </div>

                  <div className="table-container">
                    <table className="pivot-table comparison-table">
                      <thead>
                        <tr>
                          <th>№</th>
                          <th>Наименование</th>
                          <th>Ед. изм.</th>
                          <th>Объем</th>
                          <th>Цена (файл)</th>
                          <th>Сумма (файл)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.filter(item => item.status === 'not_found').map((item, idx) => (
                          <tr key={idx} className="comparison-row status-not_found">
                            <td>{idx + 1}</td>
                            <td className="col-name">{item.name}</td>
                            <td>{item.unit}</td>
                            <td className="col-volume">{formatNumber(item.totalVolume)}</td>
                            <td className="col-price">{item.price ? formatNumber(item.price) : '—'}</td>
                            <td className="col-total">{formatNumber(item.currentSum)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="total-row">
                          <td colSpan="5" className="total-label">ИТОГО:</td>
                          <td className="col-total">
                            {formatNumber(comparisonData.filter(item => item.status === 'not_found').reduce((sum, item) => sum + item.currentSum, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}

              {comparisonStats && comparisonStats.notFoundCount === 0 && (
                <div className="empty-tab success">Все позиции найдены в расценках от снабжения</div>
              )}

              {!selectedObjectId && (
                <div className="empty-tab">Выберите объект для проверки наличия расценок</div>
              )}
            </div>
          ) : activeTab === 'compare' ? (
            // Вкладка "Сравнение с ценами от снабжения"
            <div className="compare-section">
              <div className="compare-header">
                <label>Сравнить с расценками объекта:</label>
                <select
                  value={selectedObjectId}
                  onChange={(e) => setSelectedObjectId(e.target.value)}
                >
                  <option value="">-- Выберите объект --</option>
                  {objects.map(obj => (
                    <option key={obj.id} value={obj.id}>{obj.name}</option>
                  ))}
                </select>
                {selectedObjectId && approvedRates.length === 0 && (
                  <span className="no-rates-warning">Нет расценок от снабжения для этого объекта</span>
                )}
              </div>

              {comparisonStats && (
                <>
                  <div className="comparison-summary">
                    <div className="summary-card">
                      <span className="card-value">{formatNumber(comparisonStats.totalCurrentSum)}</span>
                      <span className="card-label">Сумма по файлу</span>
                    </div>
                    <div className="summary-card">
                      <span className="card-value">{formatNumber(comparisonStats.totalApprovedSum)}</span>
                      <span className="card-label">Сумма от снабжения</span>
                    </div>
                    <div className={`summary-card ${comparisonStats.totalDifference < 0 ? 'positive' : comparisonStats.totalDifference > 0 ? 'negative' : ''}`}>
                      <span className="card-value">
                        {formatNumber(comparisonStats.totalDifference)}
                      </span>
                      <span className="card-label">Удешевление</span>
                    </div>
                    <div className="summary-card success">
                      <span className="card-value">{comparisonStats.matchedCount}</span>
                      <span className="card-label">Совпадают</span>
                    </div>
                    <div className="summary-card warning">
                      <span className="card-value">{comparisonStats.priceDiffCount}</span>
                      <span className="card-label">Разные цены</span>
                    </div>
                  </div>

                  <div className="table-container">
                    <table className="pivot-table comparison-table">
                      <thead>
                        <tr>
                          <th>№</th>
                          <th>Наименование</th>
                          <th>Ед. изм.</th>
                          <th>Объем</th>
                          <th>Цена (файл)</th>
                          <th>Цена (снабжение)</th>
                          <th>Сумма (файл)</th>
                          <th>Сумма (снабжение)</th>
                          <th>Удешевление</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.filter(item => item.status !== 'not_found').map((item, idx) => (
                          <tr key={idx} className={`comparison-row status-${item.status}`}>
                            <td>{idx + 1}</td>
                            <td className="col-name">{item.name}</td>
                            <td>{item.unit}</td>
                            <td className="col-volume">{formatNumber(item.totalVolume)}</td>
                            <td className="col-price">{item.price ? formatNumber(item.price) : '—'}</td>
                            <td className="col-price">
                              {formatNumber(item.approvedPrice)}
                            </td>
                            <td className="col-total">{formatNumber(item.currentSum)}</td>
                            <td className="col-total">{formatNumber(item.approvedSum)}</td>
                            <td className={`col-diff ${item.difference < 0 ? 'positive' : item.difference > 0 ? 'negative' : ''}`}>
                              {formatNumber(item.difference)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="total-row">
                          <td colSpan="6" className="total-label">ИТОГО:</td>
                          <td className="col-total">{formatNumber(comparisonStats.totalCurrentSum)}</td>
                          <td className="col-total">{formatNumber(comparisonStats.totalApprovedSum)}</td>
                          <td className={`col-diff ${comparisonStats.totalDifference < 0 ? 'positive' : comparisonStats.totalDifference > 0 ? 'negative' : ''}`}>
                            {formatNumber(comparisonStats.totalDifference)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}

              {comparisonStats && comparisonStats.matchedCount === 0 && comparisonStats.priceDiffCount === 0 && (
                <div className="empty-tab">Нет позиций для сравнения (все позиции отсутствуют в снабжении)</div>
              )}

              {!selectedObjectId && (
                <div className="empty-tab">Выберите объект для сравнения с расценками от снабжения</div>
              )}
            </div>
          ) : activeTab === 'units' ? (
            // Вкладка "Разные ед. изм." - ошибки
            differentUnitsData.length === 0 ? (
              <div className="empty-tab success">Все единицы измерения корректны</div>
            ) : (
              <div className="accordion-list">
                {differentUnitsData.map((item, idx) => (
                  <div key={idx} className={`accordion-item error-item ${expandedItems[`unit-${idx}`] ? 'expanded' : ''}`}>
                    <div
                      className="accordion-header error-header"
                      onClick={() => toggleExpanded(`unit-${idx}`)}
                    >
                      <span className="accordion-toggle">
                        {expandedItems[`unit-${idx}`] ? '▼' : '▶'}
                      </span>
                      <span className="accordion-num">{idx + 1}</span>
                      <span className="accordion-name">{item.name}</span>
                      <span className="accordion-variants-count error-badge">
                        {item.variants.length} ед. изм.
                      </span>
                    </div>
                    {expandedItems[`unit-${idx}`] && (
                      <div className="accordion-body">
                        <table className="variants-table">
                          <thead>
                            <tr>
                              <th>Единица измерения</th>
                              <th>Объем</th>
                              <th>Кол-во позиций</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.variants.map((variant, vIdx) => (
                              <tr key={vIdx}>
                                <td><strong>{variant.unit || '(пусто)'}</strong></td>
                                <td>{formatNumber(variant.volume)}</td>
                                <td>{variant.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'different' ? (
            // Вкладка "Разные цены" - выпадающий список
            groupedDifferentPrices.length === 0 ? (
              <div className="empty-tab">Нет материалов с разными ценами</div>
            ) : (
              <div className="accordion-list">
                {groupedDifferentPrices.map((item, idx) => {
                  // Проверяем наличие расценки от снабжения
                  const supplyRate = approvedRates.find(rate =>
                    rate.material_name.trim().toLowerCase() === item.name.trim().toLowerCase()
                  )
                  const hasSupplyRate = !!supplyRate

                  return (
                  <div key={idx} className={`accordion-item ${expandedItems[idx] ? 'expanded' : ''}`}>
                    <div
                      className="accordion-header"
                      onClick={() => toggleExpanded(idx)}
                    >
                      <span className="accordion-toggle">
                        {expandedItems[idx] ? '▼' : '▶'}
                      </span>
                      <span className="accordion-num">{idx + 1}</span>
                      <span className="accordion-name">{item.name}</span>
                      <span className="accordion-unit">{item.unit}</span>
                      {selectedObjectId && (
                        <span className={`supply-rate-badge ${hasSupplyRate ? 'has-rate' : 'no-rate'}`} title={hasSupplyRate ? `Цена от снабжения: ${formatNumber(supplyRate.supply_price)}` : 'Нет в снабжении'}>
                          {hasSupplyRate ? `₽ ${formatNumber(supplyRate.supply_price)}` : 'Нет в снабж.'}
                        </span>
                      )}
                      <span className="accordion-total">
                        Общий объем: <strong>{formatNumber(item.totalVolume)}</strong>
                      </span>
                      <span className="accordion-variants-count">
                        {item.variants.length} расценки
                      </span>
                    </div>
                    {expandedItems[idx] && (
                      <div className="accordion-body">
                        <table className="variants-table">
                          <thead>
                            <tr>
                              <th>Цена за ед. с НДС</th>
                              <th>Объем</th>
                              <th>Кол-во позиций</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.variants.map((variant, vIdx) => (
                              <tr key={vIdx} className={variant.price === 0 ? 'zero-price-row' : ''}>
                                <td>
                                  {variant.price ? formatNumber(variant.price) : <span className="no-price">Не указана</span>}
                                </td>
                                <td>{formatNumber(variant.volume)}</td>
                                <td>{variant.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )
          ) : (
            // Остальные вкладки - таблица
            filteredData.length === 0 ? (
              <div className="empty-tab">
                {activeTab === 'zero' && 'Все позиции имеют расценки'}
              </div>
            ) : (
              <div className="table-container">
                <table className="pivot-table">
                  <thead>
                    <tr>
                      <th className="col-num">№</th>
                      <th className="col-name">Наименование материалов</th>
                      <th className="col-unit">Ед. изм.</th>
                      <th className="col-volume">Итого объем</th>
                      <th className="col-price">Цена за ед. с НДС</th>
                      {activeTab === 'all' && <th className="col-total">Итого сумма</th>}
                      <th className="col-count">Кол-во поз.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item, idx) => (
                      <tr
                        key={idx}
                        className={`
                          ${item.isZeroPrice ? 'zero-price-row' : ''}
                          ${item.hasDifferentPrices ? 'different-price-row' : ''}
                        `}
                      >
                        <td className="col-num">{idx + 1}</td>
                        <td className="col-name">{item.name}</td>
                        <td className="col-unit">{item.unit}</td>
                        <td className="col-volume">{formatNumber(item.totalVolume)}</td>
                        <td className="col-price">
                          {item.price ? formatNumber(item.price) : <span className="no-price">—</span>}
                        </td>
                        {activeTab === 'all' && (
                          <td className="col-total">
                            {item.price ? formatNumber(item.totalVolume * item.price) : <span className="no-price">—</span>}
                          </td>
                        )}
                        <td className="col-count">{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                  {activeTab === 'all' && (
                    <tfoot>
                      <tr className="total-row">
                        <td colSpan="5" className="total-label">ИТОГО:</td>
                        <td className="col-total total-value">
                          {formatNumber(
                            filteredData.reduce((sum, item) => sum + (item.totalVolume * (item.price || 0)), 0)
                          )}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

export default BSMPage
