-- Миграция: Добавление полей "Статус" и "Примечание" в таблицу контрагентов
-- Дата: 2025-11-22
-- Описание: Добавление поля status (статус контрагента) и notes (примечания)

-- Создаем ENUM для статуса контрагента
DO $$ BEGIN
  CREATE TYPE counterparty_status AS ENUM ('active', 'blacklist');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Добавляем поле статуса (по умолчанию - действующий)
ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS status counterparty_status DEFAULT 'active';

-- Добавляем поле для примечаний
ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS notes TEXT;

-- Добавляем комментарии к столбцам
COMMENT ON COLUMN counterparties.status IS 'Статус контрагента (действующий/черный список)';
COMMENT ON COLUMN counterparties.notes IS 'Примечания к контрагенту';
