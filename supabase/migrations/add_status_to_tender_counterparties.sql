-- Миграция: Добавление поля status в таблицу tender_counterparties

-- Создать ENUM для статуса (если еще не создан)
DO $$ BEGIN
    CREATE TYPE tender_counterparty_status AS ENUM ('request_sent', 'declined', 'proposal_provided');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Добавить поле status в таблицу tender_counterparties (если еще не добавлено)
DO $$ BEGIN
    ALTER TABLE tender_counterparties
    ADD COLUMN IF NOT EXISTS status tender_counterparty_status DEFAULT 'request_sent';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Обновить существующие записи (если поле только что добавлено)
UPDATE tender_counterparties
SET status = 'request_sent'
WHERE status IS NULL;

-- Добавить комментарий к столбцу
COMMENT ON COLUMN tender_counterparties.status IS 'Статус участия контрагента в тендере (Запрос отправлен, Отказ, КП предоставлено)';
