-- Idempotent initial content migration for site_settings, categories, metal_rates, and products
INSERT INTO site_settings (
  id, brand_name, tagline, gstin, support_email, support_phone,
  headquarters_address, upi_id, bank_details, default_delivery_charge,
  free_delivery_threshold, hero_banner_title, hero_banner_subtitle
) VALUES (
  1,
  'Aurelia Heritage Jewels',
  'Timeless Craftsmanship in Gold, Diamond & Silver',
  '27AABCA9603R1ZM',
  'concierge@aureliajewels.com',
  '+91 98765 43210',
  'Zaveri Bazaar Heritage Arcade, Mumbai 400002',
  'aureliajewels@icici',
  'Aurelia Jewels Pvt Ltd | A/C: 001122334455 | IFSC: ICIC0000011',
  250.00,
  25000.00,
  'The Royal Bridal & Heritage Edit',
  'BIS Hallmarked 22K Gold, 925 Sterling Silver & Certified Solitaires'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (name, slug, description, image_url, sort_order) VALUES
  ('Necklace', 'necklace', 'Handcrafted chokers, rani haars, and heirloom gold necklaces', '/src/assets/images/necklace_royal_gold_1794651704151.jpg', 1),
  ('Earrings', 'earrings', 'Artisanal jhumkas, chandbalis, and solitaire studs', '/src/assets/images/earrings_chandbali_gold_1794651704939.jpg', 2),
  ('Rings', 'rings', 'Certified diamond solitaires and timeless gold bands', '/src/assets/images/ring_diamond_solitaire_1794651705553.jpg', 3),
  ('Bangles', 'bangles', 'Carved 22K gold kadas and 925 sterling silver filigree bangles', '/src/assets/images/bangles_heritage_pair_1794651705194.jpg', 4),
  ('Bridal Collection', 'bridal-collection', 'Curated wedding trousseaus in uncut polki and 22K gold', '/src/assets/images/hero_bridal_jewellery_1794651704752.jpg', 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO metal_rates (material, purity, rate_per_gram) VALUES
  ('Gold', '24K', 7850.00),
  ('Gold', '22K', 7200.00),
  ('Gold', '18K', 5900.00),
  ('Silver', '925 Silver', 98.00)
ON CONFLICT (material, purity) DO NOTHING;

INSERT INTO products (
  product_code, category_id, name, slug, description, material, purity,
  weight_grams, use_live_metal_rate, fixed_base_price, making_charges,
  stone_charges, gst_percent, stock_qty, low_stock_threshold,
  is_featured, is_bridal, offer_percent, is_active
)
SELECT
  v.product_code, c.id, v.name, v.slug, v.description, v.material, v.purity,
  v.weight_grams, v.use_live_metal_rate, v.fixed_base_price, v.making_charges,
  v.stone_charges, v.gst_percent, v.stock_qty, v.low_stock_threshold,
  v.is_featured, v.is_bridal, v.offer_percent, true
FROM (VALUES
  ('JWL-1001', 'bridal-collection', 'Maharani Polki Bridal Necklace Set', 'maharani-polki-bridal-necklace-set', 'Heirloom 22K BIS hallmarked gold bridal haar handcrafted with uncut syndicate polki diamonds, baroque pearl drops, and matching chandbali earrings.', 'Gold', '22K', 48.500, true, 0.00, 24000.00, 45000.00, 3.00, 4, 3, true, true, 0.00),
  ('JWL-1002', 'necklace', 'Rajputana Ruby Filigree Gold Choker', 'rajputana-ruby-filigree-gold-choker', 'Intricate 22K yellow gold filigree collar choker studded with Burmese cabochon rubies and hand-engraved floral motifs.', 'Gold', '22K', 26.400, true, 0.00, 15500.00, 18000.00, 3.00, 6, 3, true, true, 5.00),
  ('JWL-1003', 'earrings', 'Noor Pearl Drop Chandbali Jhumkas', 'noor-pearl-drop-chandbali-jhumkas', 'Classic crescent chandbali jhumkas in 22K gold finished with fine granulation work and natural freshwater pearl clusters.', 'Gold', '22K', 14.200, true, 0.00, 8200.00, 4500.00, 3.00, 8, 3, true, false, 0.00),
  ('JWL-1004', 'rings', 'Celeste Pave Solitaire Diamond Ring', 'celeste-pave-solitaire-diamond-ring', 'IGI-certified VVS-EF 1.05 ct round brilliant solitaire set in 18K yellow gold with micro-pave diamond gallery shoulders.', 'Diamond', 'VVS-EF', 4.800, false, 85000.00, 12000.00, 68000.00, 3.00, 5, 3, true, false, 10.00),
  ('JWL-1005', 'bangles', 'Udaipur Carved Heritage Gold Kadas (Pair)', 'udaipur-carved-heritage-gold-kadas', 'Deep-relief floral nakshi carved 22K gold hinged kadas crafted as an heirloom bridal bangle pair.', 'Gold', '22K', 32.000, true, 0.00, 18000.00, 0.00, 3.00, 2, 3, true, true, 0.00),
  ('JWL-1006', 'bangles', 'Jaipur Sterling Filigree Silver Bangles', 'jaipur-sterling-filigree-silver-bangles', 'Hand-woven 925 sterling silver jaali filigree bangle pair with rhodium anti-tarnish lustre.', 'Silver', '925 Silver', 42.000, true, 0.00, 3200.00, 0.00, 3.00, 14, 3, false, false, 15.00)
) AS v(product_code, category_slug, name, slug, description, material, purity, weight_grams, use_live_metal_rate, fixed_base_price, making_charges, stone_charges, gst_percent, stock_qty, low_stock_threshold, is_featured, is_bridal, offer_percent)
JOIN categories c ON c.slug = v.category_slug
ON CONFLICT (product_code) DO NOTHING;

INSERT INTO product_images (product_id, image_url, is_primary, sort_order)
SELECT p.id, v.image_url, v.is_primary, v.sort_order
FROM (VALUES
  ('JWL-1001', '/src/assets/images/hero_bridal_jewellery_1794651704752.jpg', true, 0),
  ('JWL-1001', '/src/assets/images/necklace_royal_gold_1794651704151.jpg', false, 1),
  ('JWL-1002', '/src/assets/images/necklace_royal_gold_1794651704151.jpg', true, 0),
  ('JWL-1003', '/src/assets/images/earrings_chandbali_gold_1794651704939.jpg', true, 0),
  ('JWL-1004', '/src/assets/images/ring_diamond_solitaire_1794651705553.jpg', true, 0),
  ('JWL-1005', '/src/assets/images/bangles_heritage_pair_1794651705194.jpg', true, 0),
  ('JWL-1006', '/src/assets/images/bangles_heritage_pair_1794651705194.jpg', true, 0)
) AS v(product_code, image_url, is_primary, sort_order)
JOIN products p ON p.product_code = v.product_code
WHERE NOT EXISTS (
  SELECT 1 FROM product_images pi WHERE pi.product_id = p.id AND pi.image_url = v.image_url
);
