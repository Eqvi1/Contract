-- Добавление полей широты и долготы в таблицу objects
-- Миграция для точного позиционирования объектов на карте

-- Добавляем поле широты (latitude)
ALTER TABLE objects
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);

-- Добавляем поле долготы (longitude)
ALTER TABLE objects
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Добавляем индекс для быстрого поиска по координатам
CREATE INDEX IF NOT EXISTS idx_objects_coordinates ON objects(latitude, longitude);

-- Добавляем комментарии к новым столбцам
COMMENT ON COLUMN objects.latitude IS 'Широта объекта (latitude) в десятичных градусах';
COMMENT ON COLUMN objects.longitude IS 'Долгота объекта (longitude) в десятичных градусах';
