-- Миграция: Добавление поля "Вид работ" в таблицу контрагентов
-- Дата: 2025-11-22
-- Описание: Добавление поля work_type для указания вида работ контрагента

-- Добавляем поле для вида работ
ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS work_type VARCHAR(255);

-- Добавляем комментарий к столбцу
COMMENT ON COLUMN counterparties.work_type IS 'Вид работ контрагента';
