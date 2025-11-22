-- Таблица контактных лиц контрагентов
CREATE TABLE IF NOT EXISTS counterparty_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  counterparty_id UUID REFERENCES counterparties(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  position VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_counterparty_contacts_counterparty_id ON counterparty_contacts(counterparty_id);
CREATE INDEX IF NOT EXISTS idx_counterparty_contacts_full_name ON counterparty_contacts(full_name);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_counterparty_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER trigger_update_counterparty_contacts_updated_at
  BEFORE UPDATE ON counterparty_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_counterparty_contacts_updated_at();

-- Enable Row Level Security
ALTER TABLE counterparty_contacts ENABLE ROW LEVEL SECURITY;

-- Политики RLS (базовые - разрешить все операции для всех пользователей)
CREATE POLICY "Enable read access for all users on counterparty_contacts" ON counterparty_contacts
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users on counterparty_contacts" ON counterparty_contacts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users on counterparty_contacts" ON counterparty_contacts
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users on counterparty_contacts" ON counterparty_contacts
  FOR DELETE USING (true);

-- Комментарии к таблице и столбцам
COMMENT ON TABLE counterparty_contacts IS 'Контактные лица контрагентов';
COMMENT ON COLUMN counterparty_contacts.id IS 'Уникальный идентификатор контакта';
COMMENT ON COLUMN counterparty_contacts.counterparty_id IS 'Ссылка на контрагента';
COMMENT ON COLUMN counterparty_contacts.full_name IS 'ФИО контактного лица';
COMMENT ON COLUMN counterparty_contacts.position IS 'Должность';
COMMENT ON COLUMN counterparty_contacts.phone IS 'Номер телефона';
COMMENT ON COLUMN counterparty_contacts.email IS 'Email';
COMMENT ON COLUMN counterparty_contacts.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN counterparty_contacts.updated_at IS 'Дата и время последнего обновления записи';
