import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import '../components/ContractRegistry.css'

function ContractRegistry() {
  const [contracts, setContracts] = useState([])
  const [objects, setObjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingContract, setEditingContract] = useState(null)
  const [formData, setFormData] = useState({
    contract_number: '',
    contract_date: '',
    object_id: '',
    contract_amount: '',
    warranty_retention_percent: '',
    warranty_retention_period: '',
    work_start_date: '',
    work_end_date: '',
    warranty_period: '',
  })

  useEffect(() => {
    fetchContracts()
    fetchObjects()
  }, [])

  const fetchContracts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('contracts')
        .select('*, objects(name)')
        .order('contract_date', { ascending: false })

      if (error) throw error
      setContracts(data || [])
    } catch (error) {
      console.error('Ошибка загрузки договоров:', error.message)
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
      if (editingContract) {
        // Update existing contract
        const { error } = await supabase
          .from('contracts')
          .update(formData)
          .eq('id', editingContract.id)

        if (error) throw error
      } else {
        // Insert new contract
        const { error } = await supabase.from('contracts').insert([formData])
        if (error) throw error
      }

      setShowModal(false)
      setEditingContract(null)
      setFormData({
        contract_number: '',
        contract_date: '',
        object_id: '',
        contract_amount: '',
        warranty_retention_percent: '',
        warranty_retention_period: '',
        work_start_date: '',
        work_end_date: '',
        warranty_period: '',
      })
      fetchContracts()
    } catch (error) {
      console.error('Ошибка сохранения договора:', error.message)
      alert('Ошибка: ' + error.message)
    }
  }

  const handleEditContract = (contract) => {
    setEditingContract(contract)
    setFormData({
      contract_number: contract.contract_number,
      contract_date: contract.contract_date,
      object_id: contract.object_id || '',
      contract_amount: contract.contract_amount,
      warranty_retention_percent: contract.warranty_retention_percent || '',
      warranty_retention_period: contract.warranty_retention_period || '',
      work_start_date: contract.work_start_date || '',
      work_end_date: contract.work_end_date || '',
      warranty_period: contract.warranty_period || '',
    })
    setShowModal(true)
  }

  const handleDeleteContract = async (id, contractNumber) => {
    if (
      window.confirm(`Вы уверены, что хотите удалить договор "${contractNumber}"?`)
    ) {
      try {
        const { error } = await supabase.from('contracts').delete().eq('id', id)

        if (error) throw error
        fetchContracts()
      } catch (error) {
        console.error('Ошибка удаления договора:', error.message)
        alert('Ошибка удаления: ' + error.message)
      }
    }
  }

  const handleAddNew = () => {
    setEditingContract(null)
    setFormData({
      contract_number: '',
      contract_date: '',
      object_id: '',
      contract_amount: '',
      warranty_retention_percent: '',
      warranty_retention_period: '',
      work_start_date: '',
      work_end_date: '',
      warranty_period: '',
    })
    setShowModal(true)
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('ru-RU')
  }

  const formatAmount = (amount) => {
    if (!amount) return ''
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(amount)
  }

  if (loading) {
    return <div className="loading">Загрузка...</div>
  }

  return (
    <div className="contract-registry">
      <div className="registry-header">
        <h2>Реестр договоров</h2>
        <button className="btn-primary" onClick={handleAddNew}>
          + Добавить договор
        </button>
      </div>

      <div className="table-container">
        <table className="contracts-table">
          <thead>
            <tr>
              <th>№ договора</th>
              <th>Дата договора</th>
              <th>Объект работ</th>
              <th>Сумма</th>
              <th>Гарант. удержание (%)</th>
              <th>Срок гарант. удержаний</th>
              <th>Начало работ</th>
              <th>Окончание работ</th>
              <th>Срок гарантии</th>
              <th className="actions-column">Действия</th>
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <tr>
                <td colSpan="10" className="no-data">
                  Нет договоров. Добавьте первый договор.
                </td>
              </tr>
            ) : (
              contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>{contract.contract_number}</td>
                  <td>{formatDate(contract.contract_date)}</td>
                  <td>{contract.objects?.name || '-'}</td>
                  <td>{formatAmount(contract.contract_amount)}</td>
                  <td>{contract.warranty_retention_percent}%</td>
                  <td>{contract.warranty_retention_period}</td>
                  <td>{formatDate(contract.work_start_date)}</td>
                  <td>{formatDate(contract.work_end_date)}</td>
                  <td>{contract.warranty_period}</td>
                  <td className="actions-cell">
                    <button
                      className="btn-icon btn-edit"
                      onClick={() => handleEditContract(contract)}
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon btn-delete"
                      onClick={() =>
                        handleDeleteContract(
                          contract.id,
                          contract.contract_number
                        )
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
                {editingContract
                  ? 'Редактировать договор'
                  : 'Добавить новый договор'}
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowModal(false)
                  setEditingContract(null)
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>№ договора *</label>
                  <input
                    type="text"
                    name="contract_number"
                    value={formData.contract_number}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Дата договора *</label>
                  <input
                    type="date"
                    name="contract_date"
                    value={formData.contract_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label>Объект работ *</label>
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

                <div className="form-group">
                  <label>Сумма по договору *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="contract_amount"
                    value={formData.contract_amount}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Гарантийное удержание (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="warranty_retention_percent"
                    value={formData.warranty_retention_percent}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Срок гарантийных удержаний</label>
                  <input
                    type="text"
                    name="warranty_retention_period"
                    value={formData.warranty_retention_period}
                    onChange={handleInputChange}
                    placeholder="Например: 12 месяцев"
                  />
                </div>

                <div className="form-group">
                  <label>Начало работ</label>
                  <input
                    type="date"
                    name="work_start_date"
                    value={formData.work_start_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Окончание работ</label>
                  <input
                    type="date"
                    name="work_end_date"
                    value={formData.work_end_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Срок гарантии на работы</label>
                  <input
                    type="text"
                    name="warranty_period"
                    value={formData.warranty_period}
                    onChange={handleInputChange}
                    placeholder="Например: 24 месяца"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowModal(false)
                    setEditingContract(null)
                  }}
                >
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  {editingContract ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContractRegistry
