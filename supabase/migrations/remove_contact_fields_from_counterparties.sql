-- Миграция: Удаление контактных полей из таблицы контрагентов
-- Дата: 2025-11-22
-- Описание: Удаление полей director_name, contact_phone, contact_email из таблицы counterparties,
--            так как эти данные теперь хранятся в отдельной таблице counterparty_contacts

-- Удаляем поля контактной информации из таблицы counterparties
ALTER TABLE counterparties DROP COLUMN IF EXISTS director_name;
ALTER TABLE counterparties DROP COLUMN IF EXISTS contact_phone;
ALTER TABLE counterparties DROP COLUMN IF EXISTS contact_email;
