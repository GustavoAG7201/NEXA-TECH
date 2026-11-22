-- Map the original 18 products and all 135 E1 editions by their existing slugs.
WITH models(slug, has_detail) AS (
  VALUES ('novabook-air-14', true), ('novabook-studio-16', true), ('novabook-go-13', true),
    ('nova-work-15', true), ('nexa-mini', false), ('auralis-pro', true), ('auralis-buds', false),
    ('auralis-play', true), ('sonus-pocket', false), ('sonus-desk', false), ('nexa-one', true),
    ('nexa-one-plus', true), ('nexa-lite', true), ('nexa-core', true), ('nexa-max', true),
    ('pulse-watch-s', false), ('studio-display-27', false), ('arc-keyboard', false)
  UNION ALL
  SELECT 'e1-' || family || '-' || edition, family NOT IN ('c04', 'c05', 'a03', 'a04', 'a05')
  FROM unnest(ARRAY['c01','c02','c03','c04','c05','a01','a02','a03','a04','a05','s01','s02','s03','s04','s05']) AS family
  CROSS JOIN generate_series(1, 9) AS edition
)
UPDATE public.product_image i
SET src = '/catalogo/modelos/' || p.slug || CASE i.position WHEN 1 THEN '-detalle' ELSE '' END || '.webp',
  alt = CASE i.position WHEN 1 THEN 'Acercamiento ilustrativo de ' ELSE 'Vista ilustrativa de ' END || p.name,
  credit = 'NexaTech · ilustración de catálogo generada con ImageGen'
FROM public.product p JOIN models m ON m.slug = p.slug
WHERE i.product_id = p.id AND (i.position = 0 OR (i.position = 1 AND m.has_detail))
  AND (
    (i.credit = 'NexaTech · ilustración generada para E1 · 2026-11-20' AND i.src LIKE '/catalogo/%.jpg')
    OR (i.credit = 'Unsplash (referencia visual del catálogo prototipo)' AND i.src LIKE 'https://images.unsplash.com/photo-%')
  );

UPDATE public.product
SET description = regexp_replace(description, '^Edición académica para ', 'Diseñado para ')
WHERE slug ~ '^e1-[cas]0[1-5]-[1-9]$' AND description LIKE 'Edición académica para %';
