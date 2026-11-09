ALTER TABLE profiles ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS store_sections (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'featured' CHECK(kind IN ('featured','category','manual')),
  category TEXT NOT NULL DEFAULT '',
  product_ids TEXT NOT NULL DEFAULT '[]',
  position INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_store_sections_order ON store_sections(visible,position,created_at);
