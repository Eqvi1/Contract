import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import './BSMRatesPage.css'

function BSMRatesPage() {
  const [objects, setObjects] = useState([])
  const [selectedObjectId, setSelectedObjectId] = useState('')
  const [rates, setRates] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [editingRate, setEditingRate] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRate, setNewRate] = useState({ material_name: '', unit: '', approved_price: '' })
  const [searchTerm, setSearchTerm] = useState('')
  const [showImportHelp, setShowImportHelp] = useState(false)
  const [selectedRates, setSelectedRates] = useState(new Set())
  const fileInputRef = useRef(null)

  // Загрузка объектов
  useEffect(() => {
    fetchObjects()
  }, [])

  // Загрузка расценок при выборе объекта
  useEffect(() => {
    if (selectedObjectId) {
      fetchRates()
    } else {
      setRates([])
    }
  }, [selectedObjectId])

  const fetchObjects = async () => {
    const { data, error } = await supabase
      .from('objects')
      .select('id, name')
      .order('name')

    if (!error && data) {
      setObjects(data)
    }
  }

  const fetchRates = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('bsm_approved_rates')
      .select('*')
      .eq('object_id', selectedObjectId)
      .order('material_name')

    if (!error && data) {
      setRates(data)
    }
    setIsLoading(false)
  }

  const handleAddRate = async () => {
    if (!newRate.material_name || !newRate.approved_price) {
      alert('Заполните наименование материала и цену')
      return
    }

    const { error } = await supabase
      .from('bsm_approved_rates')
      .insert({
        object_id: selectedObjectId,
        material_name: newRate.material_name.trim(),
        unit: newRate.unit.trim(),
        approved_price: parseFloat(newRate.approved_price)
      })

    if (error) {
      if (error.code === '23505') {
        alert('Материал с таким названием уже существует для этого объекта')
      } else {
        alert('Ошибка при добавлении: ' + error.message)
      }
    } else {
      setNewRate({ material_name: '', unit: '', approved_price: '' })
      setShowAddForm(false)
      fetchRates()
    }
  }

  const handleUpdateRate = async (id, updates) => {
    const { error } = await supabase
      .from('bsm_approved_rates')
      .update(updates)
      .eq('id', id)

    if (error) {
      alert('Ошибка при обновлении: ' + error.message)
    } else {
      setEditingRate(null)
      fetchRates()
    }
  }

  const handleDeleteRate = async (id) => {
    if (!confirm('Удалить эту расценку?')) return

    const { error } = await supabase
      .from('bsm_approved_rates')
      .delete()
      .eq('id', id)

    if (!error) {
      fetchRates()
    }
  }

  // Удаление выбранных расценок
  const handleDeleteSelected = async () => {
    if (selectedRates.size === 0) return
    if (!confirm(`Удалить ${selectedRates.size} выбранных расценок?`)) return

    const idsToDelete = Array.from(selectedRates)
    const { error } = await supabase
      .from('bsm_approved_rates')
      .delete()
      .in('id', idsToDelete)

    if (!error) {
      setSelectedRates(new Set())
      fetchRates()
    } else {
      alert('Ошибка при удалении: ' + error.message)
    }
  }

  // Выбор/снятие выбора одной расценки
  const toggleSelectRate = (id) => {
    setSelectedRates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Выбрать все / снять выбор со всех
  const toggleSelectAll = () => {
    if (selectedRates.size === filteredRates.length) {
      setSelectedRates(new Set())
    } else {
      setSelectedRates(new Set(filteredRates.map(r => r.id)))
    }
  }

  const handleImportExcel = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

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

        // Парсим данные
        const newRates = []
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (!row || !row[0]) continue

          const materialName = String(row[0]).trim()
          const unit = row[1] ? String(row[1]).trim() : ''
          // Убираем пробелы из цены (например "1 234,56" -> "1234.56")
          const parsePrice = (val) => {
            if (val === null || val === undefined || val === '') return 0
            const strVal = String(val)
              .replace(/\s/g, '')  // убираем все пробелы
              .replace(/,/g, '.')   // заменяем запятую на точку
            return parseFloat(strVal) || 0
          }
          const price = parsePrice(row[2]) || parsePrice(row[3]) || 0

          if (materialName && price > 0) {
            newRates.push({
              object_id: selectedObjectId,
              material_name: materialName,
              unit: unit,
              approved_price: price
            })
          }
        }

        if (newRates.length === 0) {
          alert('Не найдено данных для импорта')
          return
        }

        // Импортируем по одному с обработкой дубликатов
        let importedCount = 0
        let updatedCount = 0
        let errors = []

        console.log('Начинаем импорт, записей:', newRates.length)
        console.log('Пример записи:', newRates[0])

        for (const rate of newRates) {
          // Проверяем, существует ли уже такой материал
          const { data: existing, error: searchError } = await supabase
            .from('bsm_approved_rates')
            .select('id')
            .eq('object_id', rate.object_id)
            .ilike('material_name', rate.material_name)
            .maybeSingle()

          if (searchError) {
            console.error('Ошибка поиска:', searchError)
            errors.push(`Поиск: ${searchError.message}`)
            continue
          }

          if (existing) {
            // Обновляем существующую запись
            const { error: updateError } = await supabase
              .from('bsm_approved_rates')
              .update({
                unit: rate.unit,
                approved_price: rate.approved_price
              })
              .eq('id', existing.id)

            if (updateError) {
              console.error('Ошибка обновления:', updateError)
              errors.push(`Обновление: ${updateError.message}`)
            } else {
              updatedCount++
            }
          } else {
            // Создаём новую запись
            const { error: insertError } = await supabase
              .from('bsm_approved_rates')
              .insert(rate)

            if (insertError) {
              console.error('Ошибка вставки:', insertError)
              errors.push(`Вставка: ${insertError.message}`)
            } else {
              importedCount++
            }
          }
        }

        console.log('Результат: добавлено', importedCount, 'обновлено', updatedCount, 'ошибок', errors.length)

        const totalProcessed = importedCount + updatedCount
        if (totalProcessed === 0) {
          const errorMsg = errors.length > 0
            ? `Ошибки:\n${errors.slice(0, 3).join('\n')}`
            : 'Проверьте формат файла.'
          alert(`Не удалось импортировать данные.\n${errorMsg}`)
        } else {
          let message = `Обработано: ${totalProcessed} расценок`
          if (importedCount > 0) message += `\nДобавлено новых: ${importedCount}`
          if (updatedCount > 0) message += `\nОбновлено: ${updatedCount}`
          if (errors.length > 0) message += `\nОшибок: ${errors.length}`
          alert(message)
          fetchRates()
        }
      } catch (error) {
        console.error('Ошибка при чтении файла:', error)
        alert('Ошибка при чтении файла')
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleExportExcel = () => {
    if (rates.length === 0) return

    const selectedObject = objects.find(o => o.id === selectedObjectId)
    const exportData = rates.map((rate, idx) => ({
      '№': idx + 1,
      'Наименование материала': rate.material_name,
      'Ед. изм.': rate.unit,
      'Согласованная цена': rate.approved_price,
      'Примечание': rate.notes || ''
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    ws['!cols'] = [{ wch: 5 }, { wch: 50 }, { wch: 10 }, { wch: 18 }, { wch: 30 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Расценки')
    XLSX.writeFile(wb, `Расценки_${selectedObject?.name || 'объект'}.xlsx`)
  }

  const filteredRates = rates.filter(rate =>
    rate.material_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatNumber = (num) => {
    return parseFloat(num).toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  return (
    <div className="bsm-rates-page">
      <h1>Согласованные расценки БСМ</h1>
      <p className="page-description">
        Управление согласованными расценками на материалы по объектам
      </p>

      <div className="object-selector">
        <label>Выберите объект:</label>
        <select
          value={selectedObjectId}
          onChange={(e) => setSelectedObjectId(e.target.value)}
        >
          <option value="">-- Выберите объект --</option>
          {objects.map(obj => (
            <option key={obj.id} value={obj.id}>{obj.name}</option>
          ))}
        </select>
      </div>

      {selectedObjectId && (
        <>
          <div className="rates-toolbar">
            <div className="toolbar-left">
              <input
                type="text"
                placeholder="Поиск материала..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <span className="rates-count">
                Найдено: {filteredRates.length} из {rates.length}
              </span>
              {selectedRates.size > 0 && (
                <button onClick={handleDeleteSelected} className="btn-delete-selected">
                  Удалить выбранные ({selectedRates.size})
                </button>
              )}
            </div>
            <div className="toolbar-right">
              <button onClick={() => setShowAddForm(true)} className="btn-add">
                + Добавить
              </button>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportExcel}
                ref={fileInputRef}
                style={{ display: 'none' }}
                id="import-rates"
              />
              <label htmlFor="import-rates" className="btn-import">
                Импорт из Excel
              </label>
              <button
                onClick={() => setShowImportHelp(!showImportHelp)}
                className="btn-help"
                title="Инструкция по импорту"
              >
                ?
              </button>
              <button onClick={handleExportExcel} className="btn-export" disabled={rates.length === 0}>
                Экспорт в Excel
              </button>
            </div>
          </div>

          {showImportHelp && (
            <div className="import-help">
              <div className="import-help-header">
                <h3>Инструкция по импорту из Excel</h3>
                <button onClick={() => setShowImportHelp(false)} className="btn-close">×</button>
              </div>
              <div className="import-help-content">
                <p><strong>Формат файла:</strong> Excel (.xlsx, .xls)</p>
                <p><strong>Структура столбцов:</strong></p>
                <table className="format-table">
                  <thead>
                    <tr>
                      <th>Столбец A</th>
                      <th>Столбец B</th>
                      <th>Столбец C</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Наименование материала *</td>
                      <td>Ед. изм.</td>
                      <td>Цена *</td>
                    </tr>
                    <tr className="example-row">
                      <td>Кабель ВВГнг 3x2.5</td>
                      <td>м</td>
                      <td>125.50</td>
                    </tr>
                    <tr className="example-row">
                      <td>Труба ПНД 32</td>
                      <td>м</td>
                      <td>45.00</td>
                    </tr>
                  </tbody>
                </table>
                <div className="import-notes">
                  <p><strong>Примечания:</strong></p>
                  <ul>
                    <li>Первая строка может содержать заголовки (будет пропущена автоматически)</li>
                    <li>Система ищет заголовок со словом "наименование" или "материал"</li>
                    <li>Строки без названия или с нулевой ценой будут пропущены</li>
                    <li>При совпадении названия материала цена будет обновлена</li>
                    <li>Если цена в столбце C пустая, система проверит столбец D</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {showAddForm && (
            <div className="add-form">
              <h3>Добавить расценку</h3>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Наименование материала *"
                  value={newRate.material_name}
                  onChange={(e) => setNewRate({ ...newRate, material_name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Ед. изм."
                  value={newRate.unit}
                  onChange={(e) => setNewRate({ ...newRate, unit: e.target.value })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Цена *"
                  value={newRate.approved_price}
                  onChange={(e) => setNewRate({ ...newRate, approved_price: e.target.value })}
                />
                <button onClick={handleAddRate} className="btn-save">Сохранить</button>
                <button onClick={() => setShowAddForm(false)} className="btn-cancel">Отмена</button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="loading">Загрузка...</div>
          ) : filteredRates.length === 0 ? (
            <div className="empty-state">
              {rates.length === 0
                ? 'Нет согласованных расценок для этого объекта. Добавьте расценки вручную или импортируйте из Excel.'
                : 'Ничего не найдено по запросу'}
            </div>
          ) : (
            <div className="table-container">
              <table className="rates-table">
                <thead>
                  <tr>
                    <th className="col-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedRates.size === filteredRates.length && filteredRates.length > 0}
                        onChange={toggleSelectAll}
                        title="Выбрать все"
                      />
                    </th>
                    <th className="col-num">№</th>
                    <th className="col-name">Наименование материала</th>
                    <th className="col-unit">Ед. изм.</th>
                    <th className="col-price">Согласованная цена</th>
                    <th className="col-actions">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRates.map((rate, idx) => (
                    <tr key={rate.id} className={selectedRates.has(rate.id) ? 'selected-row' : ''}>
                      <td className="col-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedRates.has(rate.id)}
                          onChange={() => toggleSelectRate(rate.id)}
                        />
                      </td>
                      <td className="col-num">{idx + 1}</td>
                      <td className="col-name">
                        {editingRate === rate.id ? (
                          <input
                            type="text"
                            defaultValue={rate.material_name}
                            onBlur={(e) => handleUpdateRate(rate.id, { material_name: e.target.value })}
                          />
                        ) : (
                          rate.material_name
                        )}
                      </td>
                      <td className="col-unit">
                        {editingRate === rate.id ? (
                          <input
                            type="text"
                            defaultValue={rate.unit}
                            onBlur={(e) => handleUpdateRate(rate.id, { unit: e.target.value })}
                          />
                        ) : (
                          rate.unit
                        )}
                      </td>
                      <td className="col-price">
                        {editingRate === rate.id ? (
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={rate.approved_price}
                            onBlur={(e) => handleUpdateRate(rate.id, { approved_price: parseFloat(e.target.value) })}
                          />
                        ) : (
                          formatNumber(rate.approved_price)
                        )}
                      </td>
                      <td className="col-actions">
                        {editingRate === rate.id ? (
                          <button onClick={() => setEditingRate(null)} className="btn-done">✓</button>
                        ) : (
                          <>
                            <button onClick={() => setEditingRate(rate.id)} className="btn-edit">✎</button>
                            <button onClick={() => handleDeleteRate(rate.id)} className="btn-delete">✕</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default BSMRatesPage
