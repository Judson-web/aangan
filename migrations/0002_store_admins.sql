CREATE TABLE IF NOT EXISTS store_admins (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('super_admin','admin')),
  added_by_email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_store_admins_role ON store_admins(role);
INSERT INTO store_admins(email, role, added_by_email)
VALUES ('isfirewhat@gmail.com', 'super_admin', 'bootstrap')
ON CONFLICT(email) DO UPDATE SET role = 'super_admin';
