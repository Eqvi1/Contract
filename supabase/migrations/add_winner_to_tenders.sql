-- Добавление поля winner_counterparty_id в таблицу tenders
ALTER TABLE tenders
ADD COLUMN IF NOT EXISTS winner_counterparty_id UUID REFERENCES counterparties(id) ON DELETE SET NULL;

-- Индекс для оптимизации запросов по победителю
CREATE INDEX IF NOT EXISTS idx_tenders_winner_counterparty_id ON tenders(winner_counterparty_id);

-- Комментарий к столбцу
COMMENT ON COLUMN tenders.winner_counterparty_id IS 'Контрагент-победитель тендера';
