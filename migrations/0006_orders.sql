CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','confirmed','processing','shipped','delivered','cancelled')),
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  subtotal INTEGER NOT NULL CHECK(subtotal >= 0),
  total INTEGER NOT NULL CHECK(total >= 0),
  payment_status TEXT NOT NULL DEFAULT 'not_integrated' CHECK(payment_status='not_integrated'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status,created_at DESC);
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),
  image_url TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE TRIGGER IF NOT EXISTS order_item_stock_guard
BEFORE INSERT ON order_items
BEGIN
  SELECT CASE WHEN (SELECT active FROM products WHERE id=NEW.product_id) IS NOT 1
    THEN RAISE(ABORT,'PRODUCT_UNAVAILABLE') END;
  SELECT CASE WHEN (SELECT stock FROM products WHERE id=NEW.product_id) < NEW.quantity
    THEN RAISE(ABORT,'INSUFFICIENT_STOCK') END;
END;
CREATE TRIGGER IF NOT EXISTS order_item_stock_decrement
AFTER INSERT ON order_items
BEGIN
  UPDATE products SET stock=stock-NEW.quantity,updated_at=CURRENT_TIMESTAMP WHERE id=NEW.product_id;
END;
