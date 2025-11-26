import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../contexts/RoleContext'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import './ContractorProposalsPage.css'

function ContractorProposalsPage() {
  const navigate = useNavigate()
  const { contractorInfo, isContractor, logout } = useRole()

  const [tenders, setTenders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTender, setSelectedTender] = useState(null)
  const [estimateItems, setEstimateItems] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  // Редирект если не подрядчик
  useEffect(() => {
    if (!isContractor) {
      navigate('/login')
    }
  }, [isContractor, navigate])

  // Загружаем тендеры, в которых участвует подрядчик
  useEffect(() => {
    if (contractorInfo?.id) {
      fetchTenders()
    }
  }, [contractorInfo])

  const fetchTenders = async () => {
    setLoading(true)
    try {
      // Получаем тендеры, где подрядчик является участником
      const { data: participations, error: partError } = await supabase
        .from('tender_counterparties')
        .select(`
          tender_id,
          status,
          tenders (
            id,
            work_description,
            tender_start_date,
            tender_end_date,
            status,
            objects (name)
          )
        `)
        .eq('counterparty_id', contractorInfo.id)

      if (partError) throw partError

      // Фильтруем только активные тендеры
      const activeTenders = (participations || [])
        .filter(p => p.tenders && p.tenders.status !== 'completed')
        .map(p => ({
          ...p.tenders,
          participationStatus: p.status
        }))

      setTenders(activeTenders)
    } catch (error) {
      console.error('Ошибка загрузки тендеров:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEstimateItems = async (tenderId) => {
    try {
      const { data, error } = await supabase
        .from('tender_estimate_items')
        .select('*')
        .eq('tender_id', tenderId)
        .order('row_number')

      if (error) throw error
      setEstimateItems(data || [])
    } catch (error) {
      console.error('Ошибка загрузки сметы:', error)
    }
  }

  const handleTenderSelect = (tender) => {
    setSelectedTender(tender)
    setUploadSuccess(false)
    fetchEstimateItems(tender.id)
  }

  const handleDownloadTemplate = () => {
    if (!selectedTender || estimateItems.length === 0) return

    const headerRow = [
      '№ п/п', 'КОД', 'Вид затрат', 'Наименование затрат', 'Примечание к расчету',
      'Ед. изм.', 'Объем по виду работ', 'Общий расход по материалу',
      'Цена за ед. Матер./Обор. с НДС', 'Цена за ед. СМР/ПНР с НДС',
      'ИТОГО цена за ед. с НДС', 'Стоим. Матер./Обор. с НДС', 'Стоим. СМР/ПНР с НДС',
      'ИТОГО стоимость с НДС', 'Общая стоимость с НДС', 'Примечание участника'
    ]

    const dataRows = estimateItems.map((item, idx) => {
      const rowNum = idx + 2
      return [
        item.row_number,
        item.code || '',
        item.cost_type || '',
        item.cost_name || '',
        item.calculation_note || '',
        item.unit || '',
        item.work_volume || '',
        item.material_consumption || '',
        '', // Цена материалы
        '', // Цена СМР
        { f: `I${rowNum}+J${rowNum}` },
        { f: `I${rowNum}*G${rowNum}` },
        { f: `J${rowNum}*G${rowNum}` },
        { f: `L${rowNum}+M${rowNum}` },
        { f: `N${rowNum}` },
        '', // Примечание
      ]
    })

    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])

    ws['!cols'] = [
      { wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 40 }, { wch: 25 },
      { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 22 }, { wch: 20 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 25 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'КП')

    const fileName = `КП_${selectedTender.objects?.name || 'Тендер'}_${contractorInfo.name}.xlsx`
      .replace(/[/\\?%*:|"<>]/g, '_')
    XLSX.writeFile(wb, fileName)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !selectedTender) return

    setUploading(true)
    setUploadSuccess(false)

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

          await parseAndSaveProposals(jsonData)
          setUploadSuccess(true)

        } catch (parseError) {
          console.error('Ошибка парсинга:', parseError)
          alert('Ошибка чтения файла: ' + parseError.message)
        }
      }
      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error('Ошибка загрузки:', error)
      alert('Ошибка: ' + error.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const parseAndSaveProposals = async (excelData) => {
    const proposalsToInsert = []

    for (let i = 1; i < excelData.length; i++) {
      const row = excelData[i]
      if (!row || row.length === 0) continue

      const rowNumber = parseInt(row[0])
      if (isNaN(rowNumber)) continue

      const estimateItem = estimateItems.find(item => item.row_number === rowNumber)
      if (!estimateItem) continue

      const unitPriceMaterials = parseFloat(row[8]) || 0
      const unitPriceWorks = parseFloat(row[9]) || 0
      const participantNote = row[15] || ''

      const workVolume = estimateItem.work_volume || 0
      const totalUnitPrice = unitPriceMaterials + unitPriceWorks
      const totalMaterials = unitPriceMaterials * workVolume
      const totalWorks = unitPriceWorks * workVolume
      const totalCost = totalMaterials + totalWorks

      proposalsToInsert.push({
        tender_id: selectedTender.id,
        counterparty_id: contractorInfo.id,
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
      // Удаляем старые предложения
      await supabase
        .from('tender_counterparty_proposals')
        .delete()
        .eq('tender_id', selectedTender.id)
        .eq('counterparty_id', contractorInfo.id)

      // Вставляем новые
      const { error } = await supabase
        .from('tender_counterparty_proposals')
        .insert(proposalsToInsert)

      if (error) throw error

      // Обновляем статус участия
      await supabase
        .from('tender_counterparties')
        .update({ status: 'proposal_submitted' })
        .eq('tender_id', selectedTender.id)
        .eq('counterparty_id', contractorInfo.id)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ru-RU')
  }

  const getStatusLabel = (status) => {
    const labels = {
      'request_sent': 'Запрос отправлен',
      'proposal_submitted': 'КП загружено',
      'under_review': 'На рассмотрении',
      'winner': 'Победитель',
      'rejected': 'Отклонено'
    }
    return labels[status] || status
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!isContractor) return null

  return (
    <div className="contractor-page">
      {/* Header */}
      <header className="contractor-header">
        <div className="header-left">
          <h1>Личный кабинет подрядчика</h1>
          <p className="company-name">{contractorInfo?.name}</p>
        </div>
        <button className="logout-button" onClick={handleLogout}>
          Выйти
        </button>
      </header>

      <div className="contractor-content">
        {/* Список тендеров */}
        <aside className="tenders-sidebar">
          <h2>Ваши тендеры</h2>

          {loading ? (
            <div className="loading">Загрузка...</div>
          ) : tenders.length === 0 ? (
            <div className="empty">Нет активных тендеров</div>
          ) : (
            <div className="tenders-list">
              {tenders.map(tender => (
                <button
                  key={tender.id}
                  className={`tender-item ${selectedTender?.id === tender.id ? 'active' : ''}`}
                  onClick={() => handleTenderSelect(tender)}
                >
                  <div className="tender-object">{tender.objects?.name || 'Без объекта'}</div>
                  <div className="tender-desc">{tender.work_description}</div>
                  <div className="tender-meta">
                    <span className="tender-date">
                      до {formatDate(tender.tender_end_date)}
                    </span>
                    <span className={`tender-status status-${tender.participationStatus}`}>
                      {getStatusLabel(tender.participationStatus)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Основной контент */}
        <main className="proposal-main">
          {!selectedTender ? (
            <div className="select-tender-prompt">
              <div className="prompt-icon">📋</div>
              <h2>Выберите тендер</h2>
              <p>Выберите тендер из списка слева, чтобы загрузить коммерческое предложение</p>
            </div>
          ) : (
            <div className="proposal-content">
              <div className="tender-info-header">
                <h2>{selectedTender.objects?.name}</h2>
                <p>{selectedTender.work_description}</p>
                <div className="tender-dates">
                  <span>Срок подачи: {formatDate(selectedTender.tender_start_date)} — {formatDate(selectedTender.tender_end_date)}</span>
                </div>
              </div>

              {uploadSuccess && (
                <div className="success-message">
                  ✅ Коммерческое предложение успешно загружено!
                </div>
              )}

              <div className="proposal-actions">
                <div className="action-card download">
                  <div className="action-icon">📥</div>
                  <h3>Шаг 1: Скачайте шаблон</h3>
                  <p>Скачайте Excel-файл со сметой тендера и заполните цены</p>
                  <button
                    className="action-button"
                    onClick={handleDownloadTemplate}
                    disabled={estimateItems.length === 0}
                  >
                    Скачать шаблон КП
                  </button>
                  {estimateItems.length === 0 && (
                    <span className="action-note">Смета ещё не добавлена</span>
                  )}
                </div>

                <div className="action-card upload">
                  <div className="action-icon">📤</div>
                  <h3>Шаг 2: Загрузите КП</h3>
                  <p>Заполните шаблон и загрузите готовое коммерческое предложение</p>
                  <label className="action-button upload-label">
                    {uploading ? 'Загрузка...' : 'Загрузить КП'}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      disabled={uploading || estimateItems.length === 0}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {/* Превью сметы */}
              {estimateItems.length > 0 && (
                <div className="estimate-preview">
                  <h3>Позиции сметы ({estimateItems.length})</h3>
                  <div className="estimate-table-wrapper">
                    <table className="estimate-preview-table">
                      <thead>
                        <tr>
                          <th>№</th>
                          <th>Наименование</th>
                          <th>Ед.изм.</th>
                          <th>Объём</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estimateItems.slice(0, 10).map(item => (
                          <tr key={item.id}>
                            <td>{item.row_number}</td>
                            <td>{item.cost_name}</td>
                            <td>{item.unit || '-'}</td>
                            <td>{item.work_volume || '-'}</td>
                          </tr>
                        ))}
                        {estimateItems.length > 10 && (
                          <tr>
                            <td colSpan="4" className="more-items">
                              ...и ещё {estimateItems.length - 10} позиций
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default ContractorProposalsPage
