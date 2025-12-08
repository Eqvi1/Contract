-- Таблица для хранения ссылок на документы тендера (Google Drive и др.)
CREATE TABLE IF NOT EXISTS tender_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- Название документа
  url TEXT NOT NULL,                     -- Ссылка на Google Drive или другой ресурс
  document_type TEXT DEFAULT 'attachment', -- 'attachment' или 'estimate_template'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска по tender_id
CREATE INDEX IF NOT EXISTS idx_tender_documents_tender_id ON tender_documents(tender_id);

-- RLS политики
ALTER TABLE tender_documents ENABLE ROW LEVEL SECURITY;

-- Политика на чтение (все могут читать)
CREATE POLICY "Все могут читать документы тендера" ON tender_documents
  FOR SELECT USING (true);

-- Политика на вставку
CREATE POLICY "Все могут добавлять документы" ON tender_documents
  FOR INSERT WITH CHECK (true);

-- Политика на удаление
CREATE POLICY "Все могут удалять документы" ON tender_documents
  FOR DELETE USING (true);

-- Политика на обновление
CREATE POLICY "Все могут обновлять документы" ON tender_documents
  FOR UPDATE USING (true);
