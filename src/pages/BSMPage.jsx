import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import './BSMPage.css'

function BSMPage() {
  const [pivotData, setPivotData] = useState([])
  const [materialsData, setMaterialsData] = useState([]) // только материалы
  const [worksData, setWorksData] = useState([]) // только работы

  // Накопительные данные из всех загруженных файлов
  const [loadedFiles, setLoadedFiles] = useState([]) // список загруженных файлов {name, rowCount}
  const [allRawRows, setAllRawRows] = useState([]) // все сырые строки из всех файлов

  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState(null)

  // Главная вкладка: материалы или работы
  const [mainTab, setMainTab] = useState('materials') // 'materials' | 'works'
  // Подвкладка для анализа
  const [activeTab, setActiveTab] = useState('all') // 'all', 'zero', 'different', 'units', 'compare', 'not_in_supply'

  const [expandedItems, setExpandedItems] = useState({}) // для раскрытия деталей

  // Данные анализа для материалов
  const [materialsGroupedDifferentPrices, setMaterialsGroupedDifferentPrices] = useState([])
  const [materialsDifferentUnitsData, setMaterialsDifferentUnitsData] = useState([])
  const [materialsStats, setMaterialsStats] = useState(null)

  // Данные анализа для работ
  const [worksGroupedDifferentPrices, setWorksGroupedDifferentPrices] = useState([])
  const [worksDifferentUnitsData, setWorksDifferentUnitsData] = useState([])
  const [worksStats, setWorksStats] = useState(null)

  const fileInputRef = useRef(null)

  // Для сравнения с согласованными расценками
  const [objects, setObjects] = useState([])
  const [selectedObjectId, setSelectedObjectId] = useState('')
  const [approvedRates, setApprovedRates] = useState([])
  const [comparisonData, setComparisonData] = useState([])
  const [comparisonStats, setComparisonStats] = useState(null)

  // Вспомогательная функция округления до сотых (2 знака после запятой)
  const round2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100

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

  // Пересчёт сравнения при изменении данных материалов
  useEffect(() => {
    if (materialsData.length > 0 && approvedRates.length > 0) {
      calculateComparison()
    }
  }, [materialsData, approvedRates])

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
      ratesMap[key] = round2(rate.supply_price)
    })

    // Сравниваем только материалы, у которых есть расценка в файле
    const comparison = []
    let totalCurrentSum = 0      // Сумма по файлу (только найденные в снабжении)
    let totalApprovedSum = 0     // Сумма по снабжению
    let totalDifference = 0      // Сумма разниц (удешевление/удорожание)
    let matchedCount = 0
    let notFoundCount = 0
    let priceDiffCount = 0

    // Используем только материалы с ненулевой ценой
    const materialsWithPrice = materialsData.filter(item => item.priceMaterials > 0)

    materialsWithPrice.forEach(item => {
      const key = item.name.trim().toLowerCase()
      const approvedPrice = ratesMap[key]
      const currentPrice = round2(item.priceMaterials || 0)
      const currentSum = round2(item.totalVolume * currentPrice)

      let approvedSum = 0
      let difference = 0
      let status = 'not_found'

      if (approvedPrice !== undefined) {
        approvedSum = round2(item.totalVolume * approvedPrice)
        // Разница = снабжение - файл (отрицательное = удешевление)
        difference = round2(approvedSum - currentSum)

        totalCurrentSum = round2(totalCurrentSum + currentSum)
        totalApprovedSum = round2(totalApprovedSum + approvedSum)
        totalDifference = round2(totalDifference + difference)

        if (Math.abs(currentPrice - approvedPrice) < 0.01) {
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
        price: currentPrice, // для совместимости с отображением
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
      totalItems: materialsWithPrice.length
    })
  }

  // Определение типа позиции по коду
  const getItemType = (code) => {
    if (!code) return 'material'
    const codeStr = String(code).trim().toLowerCase()
    // Если код начинается с "р" или равен "р" - это работа
    if (codeStr === 'р' || codeStr.startsWith('р-') || codeStr.startsWith('р ')) {
      return 'work'
    }
    // Если код содержит "мат" - это материал
    if (codeStr.includes('мат')) {
      return 'material'
    }
    // По умолчанию - материал
    return 'material'
  }

  // Создание сводной таблицы как в Excel
  const createPivotTable = (rows) => {
    // Две отдельные карты: для материалов и для работ
    const materialsMap = {}
    const worksMap = {}

    rows.forEach(row => {
      const name = (row.name || '').trim()
      if (!name) return

      const priceMaterials = round2(row.priceMaterials)
      const priceWorks = round2(row.priceWorks)
      const volume = round2(row.volume)
      const itemType = row.type || 'material'

      // Для работ (тип "Р") - добавляем только в работы
      if (itemType === 'work') {
        const key = `${name.toLowerCase()}|work|${priceWorks.toFixed(2)}`
        if (!worksMap[key]) {
          worksMap[key] = {
            name: name,
            unit: row.unit || '',
            type: 'work',
            priceMaterials: 0,
            priceWorks: priceWorks,
            totalVolume: 0,
            count: 0,
            isZeroPrice: priceWorks === 0
          }
        }
        worksMap[key].totalVolume = round2(worksMap[key].totalVolume + volume)
        worksMap[key].count += 1
      } else {
        // Для материалов (тип "мат."):
        // 1. Если есть цена материалов - добавляем в материалы
        if (priceMaterials > 0) {
          const matKey = `${name.toLowerCase()}|material|${priceMaterials.toFixed(2)}`
          if (!materialsMap[matKey]) {
            materialsMap[matKey] = {
              name: name,
              unit: row.unit || '',
              type: 'material',
              priceMaterials: priceMaterials,
              priceWorks: 0,
              totalVolume: 0,
              count: 0,
              isZeroPrice: false
            }
          }
          materialsMap[matKey].totalVolume = round2(materialsMap[matKey].totalVolume + volume)
          materialsMap[matKey].count += 1
        }

        // 2. Если есть цена работ - добавляем в работы (монтаж материала)
        if (priceWorks > 0) {
          const workKey = `${name.toLowerCase()}|material_work|${priceWorks.toFixed(2)}`
          if (!worksMap[workKey]) {
            worksMap[workKey] = {
              name: name,
              unit: row.unit || '',
              type: 'material_work', // Работы по монтажу материала
              priceMaterials: 0,
              priceWorks: priceWorks,
              totalVolume: 0,
              count: 0,
              isZeroPrice: false
            }
          }
          worksMap[workKey].totalVolume = round2(worksMap[workKey].totalVolume + volume)
          worksMap[workKey].count += 1
        }

        // 3. Если нет ни цены материалов, ни цены работ - добавляем в материалы как "без расценки"
        if (priceMaterials === 0 && priceWorks === 0) {
          const zeroKey = `${name.toLowerCase()}|material|0.00`
          if (!materialsMap[zeroKey]) {
            materialsMap[zeroKey] = {
              name: name,
              unit: row.unit || '',
              type: 'material',
              priceMaterials: 0,
              priceWorks: 0,
              totalVolume: 0,
              count: 0,
              isZeroPrice: true
            }
          }
          materialsMap[zeroKey].totalVolume = round2(materialsMap[zeroKey].totalVolume + volume)
          materialsMap[zeroKey].count += 1
        }
      }
    })

    // Преобразуем в массивы и сортируем по названию
    const materials = Object.values(materialsMap).sort((a, b) =>
      a.name.localeCompare(b.name, 'ru')
    )
    const works = Object.values(worksMap).sort((a, b) =>
      a.name.localeCompare(b.name, 'ru')
    )

    // Общий массив для совместимости
    const pivotArray = [...materials, ...works].sort((a, b) =>
      a.name.localeCompare(b.name, 'ru')
    )

    // Помечаем материалы с разными ценами и добавляем список всех цен
    // Для материалов - группируем по названию среди материалов
    // Для работ - группируем по названию среди работ
    const materialsByName = {}
    materials.forEach(item => {
      const nameLower = item.name.toLowerCase()
      if (!materialsByName[nameLower]) materialsByName[nameLower] = []
      materialsByName[nameLower].push(item)
    })

    const worksByName = {}
    works.forEach(item => {
      const nameLower = item.name.toLowerCase()
      if (!worksByName[nameLower]) worksByName[nameLower] = []
      worksByName[nameLower].push(item)
    })

    materials.forEach(item => {
      const nameLower = item.name.toLowerCase()
      const group = materialsByName[nameLower]
      item.hasDifferentPrices = group.length > 1
      if (item.hasDifferentPrices) {
        item.allPrices = group.map(g => g.priceMaterials).sort((a, b) => a - b)
      }
    })

    works.forEach(item => {
      const nameLower = item.name.toLowerCase()
      const group = worksByName[nameLower]
      item.hasDifferentPrices = group.length > 1
      if (item.hasDifferentPrices) {
        item.allPrices = group.map(g => g.priceWorks).sort((a, b) => a - b)
      }
    })

    // Группируем материалы с разными ценами для отдельной вкладки (раздельно для материалов и работ)
    const materialsNameGroups = {}
    const worksNameGroups = {}

    // Материалы - только type === 'material'
    materials.forEach(item => {
      const nameLower = item.name.toLowerCase()
      if (!materialsNameGroups[nameLower]) {
        materialsNameGroups[nameLower] = []
      }
      materialsNameGroups[nameLower].push(item)
    })

    // Работы - type === 'work' или 'material_work'
    works.forEach(item => {
      const nameLower = item.name.toLowerCase()
      if (!worksNameGroups[nameLower]) {
        worksNameGroups[nameLower] = []
      }
      worksNameGroups[nameLower].push(item)
    })

    // Функция для создания сгруппированных позиций с разными ценами
    const createGroupedDifferent = (nameGroups, priceField) => {
      return Object.values(nameGroups)
        .filter(g => g.length > 1)
        .map(group => ({
          name: group[0].name,
          unit: group[0].unit,
          type: group[0].type,
          totalVolume: group.reduce((sum, item) => sum + item.totalVolume, 0),
          variants: group.map(item => ({
            price: item[priceField],
            volume: item.totalVolume,
            count: item.count
          })).sort((a, b) => a.price - b.price)
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    }

    const materialsGroupedDifferent = createGroupedDifferent(materialsNameGroups, 'priceMaterials')
    const worksGroupedDifferent = createGroupedDifferent(worksNameGroups, 'priceWorks')

    // Анализ единиц измерения - группируем по названию и типу, проверяем разные ед. изм.
    const materialsUnitsByName = {}
    const worksUnitsByName = {}

    rows.forEach(row => {
      const name = (row.name || '').trim().toLowerCase()
      const unit = (row.unit || '').trim()
      const itemType = row.type || 'material'
      if (!name) return

      const targetUnits = itemType === 'material' ? materialsUnitsByName : worksUnitsByName

      if (!targetUnits[name]) {
        targetUnits[name] = {
          originalName: row.name,
          units: {}
        }
      }
      if (!targetUnits[name].units[unit]) {
        targetUnits[name].units[unit] = {
          unit: unit,
          volume: 0,
          count: 0
        }
      }
      targetUnits[name].units[unit].volume += parseFloat(row.volume) || 0
      targetUnits[name].units[unit].count += 1
    })

    // Функция для создания списка позиций с разными ед. изм.
    const createDifferentUnits = (unitsByName) => {
      return Object.values(unitsByName)
        .filter(item => Object.keys(item.units).length > 1)
        .map(item => ({
          name: item.originalName,
          variants: Object.values(item.units).sort((a, b) => b.count - a.count)
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    }

    const materialsDifferentUnits = createDifferentUnits(materialsUnitsByName)
    const worksDifferentUnits = createDifferentUnits(worksUnitsByName)

    // Статистика для материалов
    const materialsZeroPriceCount = materials.filter(item => item.isZeroPrice).length
    const materialsDifferentPricesCount = Object.values(materialsNameGroups).filter(g => g.length > 1).length

    // Статистика для работ
    const worksZeroPriceCount = works.filter(item => item.isZeroPrice).length
    const worksDifferentPricesCount = Object.values(worksNameGroups).filter(g => g.length > 1).length

    return {
      pivotArray,
      materials,
      works,
      // Данные анализа для материалов
      materialsGroupedDifferent,
      materialsDifferentUnits,
      materialsStats: {
        totalItems: materials.length,
        zeroPriceCount: materialsZeroPriceCount,
        differentPricesCount: materialsDifferentPricesCount,
        differentUnitsCount: materialsDifferentUnits.length
      },
      // Данные анализа для работ
      worksGroupedDifferent,
      worksDifferentUnits,
      worksStats: {
        totalItems: works.length,
        zeroPriceCount: worksZeroPriceCount,
        differentPricesCount: worksDifferentPricesCount,
        differentUnitsCount: worksDifferentUnits.length
      },
      // Общая статистика
      stats: {
        totalRows: rows.length,
        uniqueLines: pivotArray.length,
        materialsCount: materials.length,
        worksCount: works.length
      }
    }
  }

  // Парсинг одного файла и возврат строк
  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
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
               cell.toLowerCase().includes('материал') ||
               cell.toLowerCase().includes('код'))
            )) {
              headerRowIndex = i
              break
            }
          }

          // Парсим данные после заголовка
          // Новый формат: КОД | Наименование | Ед.изм. | Объем | Цена материалов | Цена работ
          for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row) continue

            const code = String(row[0] || '').trim()
            // Пропускаем строки без КОДа
            if (!code) continue

            const itemType = getItemType(code)

            rows.push({
              code: code,
              type: itemType,
              name: row[1] || '',
              unit: row[2] || '',
              volume: row[3] || 0,
              priceMaterials: row[4] || 0,
              priceWorks: row[5] || 0,
              sourceFile: file.name // для отслеживания источника
            })
          }

          resolve({ fileName: file.name, rows })
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = reject
      reader.readAsBinaryString(file)
    })
  }

  // Пересчёт сводной таблицы из всех накопленных строк
  const recalculateFromRows = (rows) => {
    const result = createPivotTable(rows)
    setPivotData(result.pivotArray)
    setMaterialsData(result.materials)
    setWorksData(result.works)

    // Данные анализа для материалов
    setMaterialsGroupedDifferentPrices(result.materialsGroupedDifferent)
    setMaterialsDifferentUnitsData(result.materialsDifferentUnits)
    setMaterialsStats(result.materialsStats)

    // Данные анализа для работ
    setWorksGroupedDifferentPrices(result.worksGroupedDifferent)
    setWorksDifferentUnitsData(result.worksDifferentUnits)
    setWorksStats(result.worksStats)

    setStats(result.stats)
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setIsLoading(true)

    try {
      // Парсим все выбранные файлы
      const results = await Promise.all(files.map(parseExcelFile))

      // Добавляем новые строки к существующим
      let newRows = [...allRawRows]
      const newFiles = [...loadedFiles]

      results.forEach(({ fileName, rows }) => {
        // Проверяем, не загружен ли уже файл с таким именем
        if (!loadedFiles.some(f => f.name === fileName)) {
          newRows = [...newRows, ...rows]
          newFiles.push({ name: fileName, rowCount: rows.length })
        } else {
          alert(`Файл "${fileName}" уже загружен`)
        }
      })

      setAllRawRows(newRows)
      setLoadedFiles(newFiles)
      recalculateFromRows(newRows)

    } catch (error) {
      console.error('Ошибка при чтении файла:', error)
      alert('Ошибка при чтении файла. Убедитесь, что это корректный Excel-файл.')
    } finally {
      setIsLoading(false)
      // Сбрасываем input для возможности повторной загрузки того же файла
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Удаление одного файла из списка
  const handleRemoveFile = (fileNameToRemove) => {
    const newFiles = loadedFiles.filter(f => f.name !== fileNameToRemove)
    const newRows = allRawRows.filter(row => row.sourceFile !== fileNameToRemove)

    setLoadedFiles(newFiles)
    setAllRawRows(newRows)

    if (newRows.length > 0) {
      recalculateFromRows(newRows)
    } else {
      // Если удалили все файлы - сбросить всё
      handleClear()
    }
  }

  const handleClear = () => {
    setPivotData([])
    setMaterialsData([])
    setWorksData([])

    // Сброс накопительных данных
    setLoadedFiles([])
    setAllRawRows([])

    // Сброс анализа материалов
    setMaterialsGroupedDifferentPrices([])
    setMaterialsDifferentUnitsData([])
    setMaterialsStats(null)

    // Сброс анализа работ
    setWorksGroupedDifferentPrices([])
    setWorksDifferentUnitsData([])
    setWorksStats(null)

    setStats(null)
    setMainTab('materials')
    setActiveTab('all')
    setExpandedItems({})
    setComparisonData([])
    setComparisonStats(null)
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

  // Функция расчёта суммы позиции
  // Для работ: объём × цена работ
  // Для материалов: объём × цена материалов + объём × цена работ (если есть)
  const calculateItemTotal = (item) => {
    if (item.type === 'work') {
      return round2(item.totalVolume * (item.priceWorks || 0))
    }
    // Для материалов: сумма материалов + сумма работ (если указана цена работ)
    const materialsSum = round2(item.totalVolume * (item.priceMaterials || 0))
    const worksSum = round2(item.totalVolume * (item.priceWorks || 0))
    return round2(materialsSum + worksSum)
  }

  // Расчёт суммы только по материалам (без работ)
  const calculateMaterialsSum = (item) => {
    return round2(item.totalVolume * (item.priceMaterials || 0))
  }

  // Расчёт суммы только по работам
  const calculateWorksSum = (item) => {
    return round2(item.totalVolume * (item.priceWorks || 0))
  }

  // Получение цены для позиции (в зависимости от типа)
  const getItemPrice = (item) => {
    return item.type === 'work' ? item.priceWorks : item.priceMaterials
  }

  // Получение текущих данных в зависимости от главной вкладки
  const getCurrentData = () => mainTab === 'materials' ? materialsData : worksData
  const getCurrentStats = () => mainTab === 'materials' ? materialsStats : worksStats
  const getCurrentGroupedDifferentPrices = () => mainTab === 'materials' ? materialsGroupedDifferentPrices : worksGroupedDifferentPrices
  const getCurrentDifferentUnitsData = () => mainTab === 'materials' ? materialsDifferentUnitsData : worksDifferentUnitsData

  // Фильтрация данных по активной подвкладке
  const getFilteredData = () => {
    const currentData = getCurrentData()
    switch (activeTab) {
      case 'zero':
        return currentData.filter(item => item.isZeroPrice)
      case 'different':
        return currentData.filter(item => item.hasDifferentPrices)
      default:
        return currentData
    }
  }

  const filteredData = getFilteredData()
  const currentStats = getCurrentStats()
  const currentGroupedDifferentPrices = getCurrentGroupedDifferentPrices()
  const currentDifferentUnitsData = getCurrentDifferentUnitsData()

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

    // Общие суммы
    // Для материалов: только стоимость материалов
    const totalMaterialsSum = round2(materialsData.reduce((sum, item) => sum + round2(item.totalVolume * (item.priceMaterials || 0)), 0))
    // Для работ: все работы (включая монтаж материалов)
    const totalWorksSum = round2(worksData.reduce((sum, item) => sum + round2(item.totalVolume * (item.priceWorks || 0)), 0))
    const totalSum = round2(totalMaterialsSum + totalWorksSum)

    // 1. Лист "Все позиции"
    const allHeaders = ['№', 'Тип', 'Наименование', 'Ед. изм.', 'Объем', 'Цена', 'Сумма', 'Кол-во', 'Примечание']
    const allRows = pivotData.map((item, idx) => {
      // Для материалов - цена материалов, для работ - цена работ
      const price = item.type === 'material' ? item.priceMaterials : item.priceWorks
      const itemSum = round2(item.totalVolume * (price || 0))
      const typeLabel = item.type === 'work' ? 'Р' : (item.type === 'material_work' ? 'монтаж' : 'мат.')
      return [
        idx + 1,
        typeLabel,
        item.name,
        item.unit,
        item.totalVolume,
        price || '',
        itemSum || '',
        item.count,
        item.isZeroPrice ? 'Нет расценки' : (item.hasDifferentPrices ? 'Разные цены' : '')
      ]
    })

    // Итоговая строка
    allRows.push(['', '', '', '', '', 'ИТОГО:', totalSum, '', ''])

    const wsAll = XLSX.utils.aoa_to_sheet([
      ['ОТЧЕТ ПО МАТЕРИАЛАМ И РАБОТАМ'],
      ['Дата формирования: ' + new Date().toLocaleDateString('ru-RU')],
      ['Материалы: ' + totalMaterialsSum.toLocaleString('ru-RU') + ' | Работы: ' + totalWorksSum.toLocaleString('ru-RU') + ' | ИТОГО: ' + totalSum.toLocaleString('ru-RU')],
      [],
      allHeaders,
      ...allRows
    ])

    // Объединение для заголовка
    wsAll['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } }
    ]

    setColWidths(wsAll, [5, 10, 45, 10, 12, 14, 18, 8, 15])
    XLSX.utils.book_append_sheet(wb, wsAll, 'Все позиции')

    // 2. Лист "Материалы"
    if (materialsData.length > 0) {
      const matHeaders = ['№', 'Наименование', 'Ед. изм.', 'Объем', 'Цена', 'Сумма', 'Кол-во']
      const matRows = materialsData.map((item, idx) => {
        const matSum = round2(item.totalVolume * (item.priceMaterials || 0))
        return [
          idx + 1,
          item.name,
          item.unit,
          item.totalVolume,
          item.priceMaterials || '',
          matSum || '',
          item.count
        ]
      })

      matRows.push(['', '', '', '', 'ИТОГО:', totalMaterialsSum, ''])

      const wsMat = XLSX.utils.aoa_to_sheet([
        ['МАТЕРИАЛЫ'],
        ['Позиций: ' + materialsData.length + ' | Сумма: ' + totalMaterialsSum.toLocaleString('ru-RU')],
        [],
        matHeaders,
        ...matRows
      ])

      wsMat['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }
      ]

      setColWidths(wsMat, [5, 50, 10, 12, 14, 18, 8])
      XLSX.utils.book_append_sheet(wb, wsMat, 'Материалы')
    }

    // 3. Лист "Работы"
    if (worksData.length > 0) {
      const workHeaders = ['№', 'Наименование', 'Ед. изм.', 'Объем', 'Цена работ', 'Сумма работ', 'Кол-во']
      const workRows = worksData.map((item, idx) => [
        idx + 1,
        item.name,
        item.unit,
        item.totalVolume,
        item.priceWorks || '',
        round2(item.totalVolume * (item.priceWorks || 0)) || '',
        item.count
      ])

      workRows.push(['', '', '', '', 'ИТОГО:', totalWorksSum, ''])

      const wsWork = XLSX.utils.aoa_to_sheet([
        ['РАБОТЫ (код "Р")'],
        ['Позиций: ' + worksData.length + ' | Сумма работ: ' + totalWorksSum.toLocaleString('ru-RU')],
        [],
        workHeaders,
        ...workRows
      ])

      wsWork['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }
      ]

      setColWidths(wsWork, [5, 50, 10, 12, 15, 18, 8])
      XLSX.utils.book_append_sheet(wb, wsWork, 'Работы')
    }

    // 3.1. Лист "Работы без расценки"
    const zeroWorksItems = worksData.filter(item => item.isZeroPrice)
    if (zeroWorksItems.length > 0) {
      const zeroWorksHeaders = ['№', 'Наименование', 'Ед. изм.', 'Объем', 'Кол-во']
      const zeroWorksRows = zeroWorksItems.map((item, idx) => [
        idx + 1,
        item.name,
        item.unit,
        item.totalVolume,
        item.count
      ])

      const wsZeroWorks = XLSX.utils.aoa_to_sheet([
        ['РАБОТЫ БЕЗ РАСЦЕНКИ'],
        ['Обнаружено позиций: ' + zeroWorksItems.length],
        [],
        zeroWorksHeaders,
        ...zeroWorksRows
      ])

      wsZeroWorks['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }
      ]

      setColWidths(wsZeroWorks, [5, 50, 10, 15, 8])
      XLSX.utils.book_append_sheet(wb, wsZeroWorks, 'Работы без расценки')
    }

    // 4. Лист "Материалы без расценки"
    const zeroItems = materialsData.filter(item => item.isZeroPrice)
    if (zeroItems.length > 0) {
      const zeroHeaders = ['№', 'Наименование', 'Ед. изм.', 'Объем', 'Кол-во']
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

      setColWidths(wsZero, [5, 50, 10, 15, 8])
      XLSX.utils.book_append_sheet(wb, wsZero, 'Мат. без расценки')
    }

    // 5. Лист "Разные цены (мат.)" - только материалы с разными ценами
    if (materialsGroupedDifferentPrices.length > 0) {
      const diffMatPricesRows = [
        ['МАТЕРИАЛЫ С РАЗНЫМИ РАСЦЕНКАМИ'],
        ['Обнаружено позиций: ' + materialsGroupedDifferentPrices.length],
        [],
        ['№', 'Наименование', 'Ед. изм.', 'Общий объем', 'Цена', 'Объем по цене', 'Кол-во']
      ]

      materialsGroupedDifferentPrices.forEach((item, idx) => {
        // Строка с названием
        diffMatPricesRows.push([
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
          diffMatPricesRows.push([
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
        diffMatPricesRows.push([])
      })

      const wsDiffMat = XLSX.utils.aoa_to_sheet(diffMatPricesRows)
      wsDiffMat['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }
      ]

      setColWidths(wsDiffMat, [5, 50, 10, 15, 15, 15, 8])
      XLSX.utils.book_append_sheet(wb, wsDiffMat, 'Разные цены (мат.)')
    }

    // 5.1. Лист "Разные цены (раб.)" - только работы с разными ценами
    if (worksGroupedDifferentPrices.length > 0) {
      const diffWorkPricesRows = [
        ['РАБОТЫ С РАЗНЫМИ РАСЦЕНКАМИ'],
        ['Обнаружено позиций: ' + worksGroupedDifferentPrices.length],
        [],
        ['№', 'Наименование', 'Ед. изм.', 'Общий объем', 'Цена', 'Объем по цене', 'Кол-во']
      ]

      worksGroupedDifferentPrices.forEach((item, idx) => {
        // Строка с названием
        diffWorkPricesRows.push([
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
          diffWorkPricesRows.push([
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
        diffWorkPricesRows.push([])
      })

      const wsDiffWork = XLSX.utils.aoa_to_sheet(diffWorkPricesRows)
      wsDiffWork['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }
      ]

      setColWidths(wsDiffWork, [5, 50, 10, 15, 15, 15, 8])
      XLSX.utils.book_append_sheet(wb, wsDiffWork, 'Разные цены (раб.)')
    }

    // 6. Лист "Разные ед. изм."
    // Объединяем данные материалов и работ для экспорта
    const allDifferentUnitsData = [...materialsDifferentUnitsData, ...worksDifferentUnitsData]
    if (allDifferentUnitsData.length > 0) {
      const diffUnitsRows = [
        ['ОШИБКИ В ЕДИНИЦАХ ИЗМЕРЕНИЯ'],
        ['Обнаружено позиций с разными ед. изм.: ' + allDifferentUnitsData.length],
        [],
        ['№', 'Наименование', 'Единица измерения', 'Объем', 'Кол-во поз.']
      ]

      allDifferentUnitsData.forEach((item, idx) => {
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

    // 7. Лист "БСМ" - расценки от снабжения с объемами из файла
    if (approvedRates.length > 0 && materialsData.length > 0) {
      // Создаём карту объемов по названию материала (суммируем все объемы для одного названия)
      const volumesByName = {}
      materialsData.forEach(item => {
        const key = item.name.trim().toLowerCase()
        if (!volumesByName[key]) {
          volumesByName[key] = {
            name: item.name,
            unit: item.unit,
            totalVolume: 0
          }
        }
        volumesByName[key].totalVolume = round2(volumesByName[key].totalVolume + item.totalVolume)
      })

      // Формируем данные для листа БСМ
      const bsmRows = []
      let bsmTotalSum = 0

      approvedRates.forEach((rate, idx) => {
        const key = rate.material_name.trim().toLowerCase()
        const volumeData = volumesByName[key]
        const volume = volumeData ? volumeData.totalVolume : 0
        const sum = round2(volume * (rate.supply_price || 0))
        bsmTotalSum = round2(bsmTotalSum + sum)

        bsmRows.push([
          idx + 1,
          rate.material_name,
          rate.unit || (volumeData ? volumeData.unit : ''),
          volume || '',
          rate.supply_price || '',
          sum || '',
          rate.notes || ''
        ])
      })

      // Итоговая строка
      bsmRows.push(['', '', '', '', 'ИТОГО:', bsmTotalSum, ''])

      const bsmHeaders = ['№', 'Наименование материала', 'Ед. изм.', 'Объем', 'Расценка БСМ', 'Сумма', 'Примечание']

      const wsBsm = XLSX.utils.aoa_to_sheet([
        ['РАСЦЕНКИ ОТ СНАБЖЕНИЯ (БСМ)'],
        ['Объект: ' + (objects.find(o => o.id === selectedObjectId)?.name || 'Не выбран')],
        ['Позиций: ' + approvedRates.length + ' | Итого: ' + bsmTotalSum.toLocaleString('ru-RU')],
        [],
        bsmHeaders,
        ...bsmRows
      ])

      wsBsm['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } }
      ]

      setColWidths(wsBsm, [5, 50, 10, 12, 15, 18, 20])
      XLSX.utils.book_append_sheet(wb, wsBsm, 'БСМ')
    }

    // 8. Лист "Сводка"
    const filesListText = loadedFiles.map(f => f.name).join(', ')
    const summaryRows = [
      ['СВОДКА ПО АНАЛИЗУ МАТЕРИАЛОВ И РАБОТ'],
      [''],
      ['Дата формирования отчета:', new Date().toLocaleDateString('ru-RU') + ' ' + new Date().toLocaleTimeString('ru-RU')],
      ['Загруженные файлы:', filesListText],
      ['Всего файлов:', loadedFiles.length],
      [''],
      ['СТАТИСТИКА', ''],
      ['Исходных строк в файлах:', stats.totalRows],
      ['Уникальных позиций в сводной:', stats.uniqueLines],
      ['Материалов:', stats.materialsCount],
      ['Работ:', stats.worksCount],
      [''],
      ['ВЫЯВЛЕННЫЕ ПРОБЛЕМЫ (МАТЕРИАЛЫ)', ''],
      ['Без расценки:', materialsStats?.zeroPriceCount || 0],
      ['С разными ценами:', materialsStats?.differentPricesCount || 0],
      ['С разными ед. изм.:', materialsStats?.differentUnitsCount || 0],
      [''],
      ['ВЫЯВЛЕННЫЕ ПРОБЛЕМЫ (РАБОТЫ)', ''],
      ['Без расценки:', worksStats?.zeroPriceCount || 0],
      ['С разными ценами:', worksStats?.differentPricesCount || 0],
      ['С разными ед. изм.:', worksStats?.differentUnitsCount || 0],
      ...(comparisonStats ? [[''], ['Позиций нет в снабжении:', comparisonStats.notFoundCount]] : []),
      [''],
      ['ИТОГИ', ''],
      ['Сумма материалов:', totalMaterialsSum],
      ['Сумма работ:', totalWorksSum],
      ['Общая сумма:', totalSum],
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

  // Округление до сотых (2 знака после запятой)
  const roundToHundredths = (num) => {
    if (num === null || num === undefined || num === '') return 0
    const parsed = parseFloat(num)
    if (isNaN(parsed)) return 0
    return Math.round(parsed * 100) / 100
  }

  const formatNumber = (num) => {
    if (num === null || num === undefined || num === '') return '-'
    const parsed = parseFloat(num)
    if (isNaN(parsed)) return '-'
    return roundToHundredths(parsed).toLocaleString('ru-RU', {
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
          multiple
        />
        <label htmlFor="file-upload" className="file-label">
          {loadedFiles.length > 0 ? 'Добавить файлы' : 'Выбрать файлы'}
        </label>
        {pivotData.length > 0 && (
          <>
            <button onClick={handleExport} className="export-btn">
              Экспорт в Excel
            </button>
            <button onClick={handleClear} className="clear-btn">
              Очистить всё
            </button>
          </>
        )}
      </div>

      {/* Список загруженных файлов */}
      {loadedFiles.length > 0 && (
        <div className="loaded-files-section">
          <h3>Загруженные файлы ({loadedFiles.length})</h3>
          <div className="loaded-files-list">
            {loadedFiles.map((file, idx) => (
              <div key={idx} className="loaded-file-item">
                <span className="file-icon">📄</span>
                <span className="file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-rows">{file.rowCount} строк</span>
                </span>
                <button
                  className="remove-file-btn"
                  onClick={() => handleRemoveFile(file.name)}
                  title="Удалить файл"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="expected-format">
        <strong>Ожидаемый формат столбцов:</strong>
        <ol>
          <li><strong>КОД</strong> — тип позиции: <code>Р</code> (работа) или <code>мат.</code> (материал)</li>
          <li>Наименование</li>
          <li>Ед. изм.</li>
          <li>Объем</li>
          <li>Цена материалов (с НДС)</li>
          <li>Цена работ (с НДС)</li>
        </ol>
        <p className="format-note">
          Расчёт: для работ (тип Р) — объём × цена работ; для материалов — объём × цена материалов + объём × цена работ (если указана)
        </p>
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
            <div className="summary-card materials">
              <span className="card-value">{stats.materialsCount}</span>
              <span className="card-label">Материалы</span>
            </div>
            <div className="summary-card works">
              <span className="card-value">{stats.worksCount}</span>
              <span className="card-label">Работы</span>
            </div>
          </div>
        </div>
      )}

      {pivotData.length > 0 && (
        <div className="pivot-section">
          {/* Главные вкладки: Материалы / Работы */}
          <div className="main-tabs">
            <button
              className={`main-tab ${mainTab === 'materials' ? 'active' : ''} tab-materials`}
              onClick={() => { setMainTab('materials'); setActiveTab('all'); setExpandedItems({}); }}
              title="Стоимость материалов (код 'мат.')"
            >
              Материалы
              <span className="tab-count">{stats.materialsCount}</span>
            </button>
            <button
              className={`main-tab ${mainTab === 'works' ? 'active' : ''} tab-works`}
              onClick={() => { setMainTab('works'); setActiveTab('all'); setExpandedItems({}); }}
              title="Все работы: монтаж материалов + работы (код 'Р')"
            >
              Работы
              <span className="tab-count">{stats.worksCount}</span>
            </button>
          </div>

          {/* Подвкладки анализа */}
          <div className="tabs sub-tabs">
            <button
              className={`tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Все {mainTab === 'materials' ? 'материалы' : 'работы'}
              <span className="tab-count">{currentStats?.totalItems || 0}</span>
            </button>
            <button
              className={`tab ${activeTab === 'zero' ? 'active' : ''} ${currentStats?.zeroPriceCount > 0 ? 'warning' : ''}`}
              onClick={() => setActiveTab('zero')}
            >
              Без расценки
              <span className="tab-count">{currentStats?.zeroPriceCount || 0}</span>
            </button>
            <button
              className={`tab ${activeTab === 'different' ? 'active' : ''} ${currentStats?.differentPricesCount > 0 ? 'alert' : ''}`}
              onClick={() => setActiveTab('different')}
            >
              Разные цены
              <span className="tab-count">{currentStats?.differentPricesCount || 0}</span>
            </button>
            <button
              className={`tab ${activeTab === 'units' ? 'active' : ''} ${currentStats?.differentUnitsCount > 0 ? 'error' : ''}`}
              onClick={() => setActiveTab('units')}
            >
              Разные ед. изм.
              <span className="tab-count">{currentStats?.differentUnitsCount || 0}</span>
            </button>
            {/* Сравнение с расценками только для материалов */}
            {mainTab === 'materials' && (
              <>
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
              </>
            )}
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
            currentDifferentUnitsData.length === 0 ? (
              <div className="empty-tab success">Все единицы измерения корректны</div>
            ) : (
              <div className="accordion-list">
                {currentDifferentUnitsData.map((item, idx) => (
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
            currentGroupedDifferentPrices.length === 0 ? (
              <div className="empty-tab">Нет {mainTab === 'materials' ? 'материалов' : 'работ'} с разными ценами</div>
            ) : (
              <div className="accordion-list">
                {currentGroupedDifferentPrices.map((item, idx) => {
                  // Проверяем наличие расценки от снабжения (только для материалов)
                  const supplyRate = mainTab === 'materials' ? approvedRates.find(rate =>
                    rate.material_name.trim().toLowerCase() === item.name.trim().toLowerCase()
                  ) : null
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
                      {mainTab === 'materials' && selectedObjectId && (
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
                {activeTab === 'zero' && `Все ${mainTab === 'materials' ? 'материалы' : 'работы'} имеют расценки`}
                {activeTab === 'all' && `Нет ${mainTab === 'materials' ? 'материалов' : 'работ'}`}
              </div>
            ) : (
              <div className="table-container">
                <table className="pivot-table">
                  <thead>
                    <tr>
                      <th className="col-num">№</th>
                      <th className="col-name">Наименование</th>
                      <th className="col-unit">Ед. изм.</th>
                      <th className="col-volume">Объем</th>
                      <th className="col-price">Цена</th>
                      <th className="col-total">Сумма</th>
                      <th className="col-count">Кол-во</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item, idx) => {
                      // Для материалов - цена и сумма материалов, для работ - цена и сумма работ
                      const price = mainTab === 'materials' ? item.priceMaterials : item.priceWorks
                      const itemSum = round2(item.totalVolume * (price || 0))
                      return (
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
                            {price ? formatNumber(price) : <span className="no-price">—</span>}
                          </td>
                          <td className="col-total">
                            {itemSum ? formatNumber(itemSum) : <span className="no-price">—</span>}
                          </td>
                          <td className="col-count">{item.count}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan="5" className="total-label">ИТОГО:</td>
                      <td className="col-total total-value">
                        {formatNumber(
                          filteredData.reduce((sum, item) => {
                            const price = mainTab === 'materials' ? item.priceMaterials : item.priceWorks
                            return sum + round2(item.totalVolume * (price || 0))
                          }, 0)
                        )}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
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
