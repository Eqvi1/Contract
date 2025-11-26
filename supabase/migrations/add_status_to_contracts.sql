-- Добавление поля status в таблицу contracts
-- status: 'pending' (на согласовании), 'signed' (заключен)
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- Индекс для оптимизации запросов по статусу
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- Комментарий к столбцу
COMMENT ON COLUMN contracts.status IS 'Статус договора (pending - на согласовании, signed - заключен)';
