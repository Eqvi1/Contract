-- Миграция: разделение расценок на "от снабжения" и "согласованные для договора"
-- Дата: 2024-11-30

-- 1. Переименовываем существующую таблицу bsm_approved_rates в bsm_supply_rates
ALTER TABLE IF EXISTS bsm_approved_rates RENAME TO bsm_supply_rates;

-- 2. Переименовываем колонку approved_price в supply_price
ALTER TABLE bsm_supply_rates RENAME COLUMN approved_price TO supply_price;

-- 3. Обновляем комментарии
COMMENT ON TABLE bsm_supply_rates IS 'Актуальные расценки от снабжения на материалы по объектам';
COMMENT ON COLUMN bsm_supply_rates.supply_price IS 'Актуальная цена от снабжения';

-- 4. Переименовываем триггер и функцию
DROP TRIGGER IF EXISTS trigger_bsm_approved_rates_updated_at ON bsm_supply_rates;

CREATE OR REPLACE FUNCTION update_bsm_supply_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bsm_supply_rates_updated_at
    BEFORE UPDATE ON bsm_supply_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_bsm_supply_rates_updated_at();

-- 5. Создаём новую таблицу для согласованных расценок (для договора)
CREATE TABLE IF NOT EXISTS bsm_contract_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_id UUID REFERENCES objects(id) ON DELETE CASCADE,
    material_name TEXT NOT NULL,
    unit TEXT,
    contract_price DECIMAL(15, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(object_id, material_name)
);

-- 6. Триггер для bsm_contract_rates
CREATE OR REPLACE FUNCTION update_bsm_contract_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bsm_contract_rates_updated_at
    BEFORE UPDATE ON bsm_contract_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_bsm_contract_rates_updated_at();

-- 7. RLS политики для bsm_contract_rates
ALTER TABLE bsm_contract_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON bsm_contract_rates
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 8. Комментарии для bsm_contract_rates
COMMENT ON TABLE bsm_contract_rates IS 'Согласованные расценки на материалы для договоров (фиксированные цены)';
COMMENT ON COLUMN bsm_contract_rates.object_id IS 'Ссылка на объект';
COMMENT ON COLUMN bsm_contract_rates.material_name IS 'Наименование материала';
COMMENT ON COLUMN bsm_contract_rates.unit IS 'Единица измерения';
COMMENT ON COLUMN bsm_contract_rates.contract_price IS 'Согласованная цена для договора';
COMMENT ON COLUMN bsm_contract_rates.notes IS 'Примечания';
