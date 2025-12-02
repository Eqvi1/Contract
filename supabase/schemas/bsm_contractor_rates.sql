-- Таблица расценок БСМ с подрядчиком (привязка к объекту и подрядчику)
CREATE TABLE IF NOT EXISTS bsm_contractor_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_id UUID REFERENCES objects(id) ON DELETE CASCADE,
    counterparty_id UUID REFERENCES counterparties(id) ON DELETE CASCADE,
    material_name TEXT NOT NULL,
    unit TEXT,
    contractor_price DECIMAL(15, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Уникальное ограничение: один материал - одна расценка для пары объект+подрядчик
    UNIQUE(object_id, counterparty_id, material_name)
);

-- Триггер для автообновления updated_at
CREATE OR REPLACE FUNCTION update_bsm_contractor_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bsm_contractor_rates_updated_at ON bsm_contractor_rates;
CREATE TRIGGER trigger_bsm_contractor_rates_updated_at
    BEFORE UPDATE ON bsm_contractor_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_bsm_contractor_rates_updated_at();

-- RLS политики
ALTER TABLE bsm_contractor_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON bsm_contractor_rates
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_bsm_contractor_rates_object_id ON bsm_contractor_rates(object_id);
CREATE INDEX IF NOT EXISTS idx_bsm_contractor_rates_counterparty_id ON bsm_contractor_rates(counterparty_id);
CREATE INDEX IF NOT EXISTS idx_bsm_contractor_rates_object_counterparty ON bsm_contractor_rates(object_id, counterparty_id);

-- Комментарии
COMMENT ON TABLE bsm_contractor_rates IS 'Расценки БСМ с подрядчиком (привязка к объекту и подрядчику)';
COMMENT ON COLUMN bsm_contractor_rates.object_id IS 'Ссылка на объект';
COMMENT ON COLUMN bsm_contractor_rates.counterparty_id IS 'Ссылка на подрядчика';
COMMENT ON COLUMN bsm_contractor_rates.material_name IS 'Наименование материала';
COMMENT ON COLUMN bsm_contractor_rates.unit IS 'Единица измерения';
COMMENT ON COLUMN bsm_contractor_rates.contractor_price IS 'Цена от подрядчика';
COMMENT ON COLUMN bsm_contractor_rates.notes IS 'Примечания';
