-- Добавление поля статуса в таблицу objects
-- Статус объекта: основное строительство или гарантийное обслуживание

-- Создаем тип ENUM для статусов объектов
CREATE TYPE object_status AS ENUM ('main_construction', 'warranty_service');

-- Добавляем поле статуса в таблицу objects
ALTER TABLE objects
ADD COLUMN IF NOT EXISTS status object_status DEFAULT 'main_construction';

-- Добавляем индекс для быстрого поиска по статусу
CREATE INDEX IF NOT EXISTS idx_objects_status ON objects(status);

-- Добавляем комментарий к столбцу
COMMENT ON COLUMN objects.status IS 'Статус объекта: основное строительство или гарантийное обслуживание';
