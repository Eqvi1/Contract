-- Миграция: Добавление поля counterparty_id в таблицу contracts
-- Дата создания: 2025-11-19

-- Добавляем столбец counterparty_id в таблицу contracts
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS counterparty_id UUID REFERENCES counterparties(id) ON DELETE SET NULL;

-- Создаем индекс для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_contracts_counterparty_id ON contracts(counterparty_id);

-- Комментарий к новому столбцу
COMMENT ON COLUMN contracts.counterparty_id IS 'Ссылка на контрагента (подрядчика)';
