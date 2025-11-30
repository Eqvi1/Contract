-- Таблица согласованных расценок для договоров (фиксированные цены в договоре)
CREATE TABLE IF NOT EXISTS bsm_contract_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_id UUID REFERENCES objects(id) ON DELETE CASCADE,
    material_name TEXT NOT NULL,
    unit TEXT,
    contract_price DECIMAL(15, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Уникальное ограничение: один материал - одна расценка для объекта
    UNIQUE(object_id, material_name)
);

-- Триггер для автообновления updated_at
CREATE OR REPLACE FUNCTION update_bsm_contract_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bsm_contract_rates_updated_at ON bsm_contract_rates;
CREATE TRIGGER trigger_bsm_contract_rates_updated_at
    BEFORE UPDATE ON bsm_contract_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_bsm_contract_rates_updated_at();

-- RLS политики
ALTER TABLE bsm_contract_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON bsm_contract_rates
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Комментарии
COMMENT ON TABLE bsm_contract_rates IS 'Согласованные расценки на материалы для договоров (фиксированные цены)';
COMMENT ON COLUMN bsm_contract_rates.object_id IS 'Ссылка на объект';
COMMENT ON COLUMN bsm_contract_rates.material_name IS 'Наименование материала';
COMMENT ON COLUMN bsm_contract_rates.unit IS 'Единица измерения';
COMMENT ON COLUMN bsm_contract_rates.contract_price IS 'Согласованная цена для договора';
COMMENT ON COLUMN bsm_contract_rates.notes IS 'Примечания';
