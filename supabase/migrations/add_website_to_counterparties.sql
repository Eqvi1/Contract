-- Миграция: Добавление поля "Ссылка на сайт" в таблицу контрагентов
-- Дата: 2025-11-22
-- Описание: Добавление поля website для хранения ссылки на сайт контрагента

-- Добавляем поле для ссылки на сайт
ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS website VARCHAR(500);

-- Добавляем комментарий к столбцу
COMMENT ON COLUMN counterparties.website IS 'Ссылка на сайт контрагента';
