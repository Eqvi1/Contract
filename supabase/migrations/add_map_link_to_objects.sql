-- Миграция: Добавление поля map_link в таблицу objects
-- Дата: 2025-11-18

-- Добавляем столбец map_link если его еще нет
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'objects'
        AND column_name = 'map_link'
    ) THEN
        ALTER TABLE public.objects ADD COLUMN map_link TEXT;

        -- Добавляем комментарий к новому полю
        COMMENT ON COLUMN public.objects.map_link IS 'Ссылка на карту (Google Maps, Yandex Maps и т.д.)';
    END IF;
END $$;
