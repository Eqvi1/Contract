-- Добавление поля tender_id в таблицу contracts для связи с тендером
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS tender_id UUID REFERENCES tenders(id) ON DELETE SET NULL;

-- Индекс для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_contracts_tender_id ON contracts(tender_id);

-- Комментарий к столбцу
COMMENT ON COLUMN contracts.tender_id IS 'Ссылка на тендер, по результатам которого заключается договор';
