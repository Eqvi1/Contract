-- Добавляем поле estimate_name для поддержки нескольких смет в одном тендере
ALTER TABLE tender_estimate_items
ADD COLUMN IF NOT EXISTS estimate_name TEXT DEFAULT 'Основная смета';

-- Комментарий к полю
COMMENT ON COLUMN tender_estimate_items.estimate_name IS 'Название сметы (для группировки нескольких смет в одном тендере)';

-- Индекс для быстрого поиска по смете
CREATE INDEX IF NOT EXISTS idx_tender_estimate_items_estimate_name
ON tender_estimate_items(tender_id, estimate_name);
