ALTER TABLE products ADD COLUMN image_urls TEXT NOT NULL DEFAULT '[]';
UPDATE products SET image_urls = CASE WHEN image_url <> '' THEN json_array(image_url) ELSE '[]' END WHERE image_urls = '[]';
