-- Fictional merchandise. Apply after demo.sql, only in an isolated local environment.
-- Nine editions in each of five product families for each of the three main categories.
CREATE TEMP TABLE nexa_catalog_e1 ON COMMIT DROP AS
WITH families(category_slug, prefix, brand, family, image, base_price, increment, purpose) AS (VALUES
  ('computadoras','C01','NexaTech','NovaBook Aula','portatil',899900,52000,'clases, consultas web y documentos'),
  ('computadoras','C02','NexaTech','NovaBook Viaje','portatil',1149900,68000,'trabajo móvil y videollamadas'),
  ('computadoras','C03','NexaTech','NovaBook Taller','portatil',1699900,85000,'edición multimedia y desarrollo'),
  ('computadoras','C04','NexaTech','NovaDesk Punto','mini-pc',649900,47000,'puestos de trabajo con poco espacio'),
  ('computadoras','C05','NexaTech','NovaDesk Estudio','mini-pc',1199900,73000,'proyectos creativos en escritorio'),
  ('audio','A01','Auralis','Auralis Trama','audifonos',109900,11500,'escucha personal durante jornadas largas'),
  ('audio','A02','Auralis','Auralis Calma','audifonos',219900,18000,'escucha enfocada en espacios compartidos'),
  ('audio','A03','Auralis','Auralis Pulso','buds',79900,9700,'traslados y actividad cotidiana'),
  ('audio','A04','Sonus','Sonus Ruta','altavoz',64900,8200,'audio portátil para espacios pequeños'),
  ('audio','A05','Sonus','Sonus Sala','altavoz',159900,14700,'escucha en casa y reuniones informales'),
  ('smartphones','S01','NexaTech','Nexa Umbral','telefono',329900,22000,'mensajería, llamadas y uso cotidiano'),
  ('smartphones','S02','NexaTech','Nexa Camino','telefono',479900,31000,'navegación, fotografía y productividad en movimiento'),
  ('smartphones','S03','NexaTech','Nexa Horizonte','telefono',649900,37000,'reproducción multimedia y fotografía diaria'),
  ('smartphones','S04','NexaTech','Nexa Prisma','telefono',949900,56000,'captura fotográfica y grabación de video'),
  ('smartphones','S05','NexaTech','Nexa Prisma Plus','telefono',1329900,65000,'multitarea y contenido de alta resolución')
)
SELECT category_slug,
  'e1-' || lower(prefix) || '-' || edition AS slug,
  'NX-E1-' || prefix || '-' || lpad(edition::text, 2, '0') AS sku,
  family || ' ' || edition AS name, brand, image,
  'Edición académica para ' || purpose || '. Configuración ' || edition || ' de la serie ' || family || '.' AS description,
  (ARRAY['Azul noche','Grafito','Plata'])[(edition - 1) % 3 + 1] AS finish,
  base_price + (edition - 1) * increment AS price,
  CASE WHEN edition = 9 THEN 0 ELSE 3 + (edition * 7 + base_price / 100) % 24 END AS stock,
  CASE category_slug
    WHEN 'computadoras' THEN jsonb_build_object(
      'Formato', CASE image WHEN 'mini-pc' THEN 'Mini PC' ELSE 'Portátil' END,
      'Procesador', CASE WHEN prefix IN ('C01','C04') THEN '4 núcleos' ELSE '8 núcleos' END,
      'Memoria RAM', (ARRAY['8 GB','16 GB','32 GB'])[1 + (edition - 1) / 3],
      'Almacenamiento SSD', (ARRAY['256 GB','512 GB','1 TB'])[(edition - 1) % 3 + 1],
      'Conectividad', 'Wi-Fi 6 y USB-C')
    WHEN 'audio' THEN jsonb_build_object(
      'Formato', CASE image WHEN 'buds' THEN 'Intraaural' WHEN 'altavoz' THEN 'Altavoz' ELSE 'Diadema' END,
      'Conexión', 'Bluetooth 5.3', 'Carga', 'USB-C',
      'Autonomía de referencia', (CASE image WHEN 'buds' THEN 16 WHEN 'altavoz' THEN 5 ELSE 18 END + edition * 2)::text || ' h',
      'Función', CASE prefix WHEN 'A02' THEN 'Cancelación activa' WHEN 'A03' THEN 'Estuche de carga' ELSE 'Controles físicos' END)
    ELSE jsonb_build_object(
      'Pantalla', CASE WHEN prefix IN ('S01','S02') THEN 'LCD 6.4 pulgadas' ELSE 'OLED 6.7 pulgadas' END,
      'Red', CASE WHEN prefix = 'S01' THEN '4G' ELSE '5G' END,
      'Almacenamiento', (ARRAY['128 GB','256 GB','512 GB'])[(edition - 1) % 3 + 1],
      'Batería', (4000 + edition * 150)::text || ' mAh',
      'Cámara principal', CASE WHEN prefix IN ('S04','S05') THEN '64 MP' ELSE '50 MP' END)
  END AS features
FROM families CROSS JOIN generate_series(1, 9) AS edition;

INSERT INTO public.product(category_id, slug, name, description, specs, status)
SELECT c.id, f.slug, f.name, f.description,
  jsonb_build_object('marca', f.brand, 'ficha', 'académica', 'origenPrecio', 'simulado', 'caracteristicas', f.features),
  'ACTIVE'
FROM nexa_catalog_e1 f JOIN public.category c ON c.slug = f.category_slug
ON CONFLICT (slug) DO NOTHING;

WITH opening AS (
  INSERT INTO public.product_variant(product_id, tax_class_code, sku, option_label, color, unit_price_cents,
    stock_on_hand, low_stock_threshold, weight_g, length_mm, width_mm, height_mm)
  SELECT p.id, 'DEMO_ITEMS', f.sku, f.finish, f.finish, f.price, f.stock, 3,
    size.grams, size.length, size.width, size.height
  FROM nexa_catalog_e1 f JOIN public.product p ON p.slug = f.slug
  JOIN (VALUES ('portatil', 1400, 224, 314, 17), ('mini-pc', 610, 128, 126, 42),
               ('audifonos', 260, 181, 165, 79), ('buds', 52, 62, 46, 24),
               ('altavoz', 420, 88, 88, 107), ('telefono', 192, 158, 75, 8))
    AS size(image, grams, length, width, height) ON size.image = f.image
  ON CONFLICT DO NOTHING
  RETURNING id, stock_on_hand
)
INSERT INTO public.inventory_movement(variant_id, kind, delta, reason)
SELECT id, 'OPENING', stock_on_hand, 'Apertura de catálogo académico E1' FROM opening WHERE stock_on_hand > 0;

CREATE TEMP TABLE nexa_catalog_visuals (
  slug text PRIMARY KEY, image text, brand text, features jsonb
) ON COMMIT DROP;
INSERT INTO nexa_catalog_visuals
SELECT slug, image, brand, features FROM nexa_catalog_e1;
INSERT INTO nexa_catalog_visuals VALUES
  ('novabook-air-14','portatil','NexaTech','{"Pantalla":"14 pulgadas","Memoria RAM":"16 GB","Almacenamiento SSD":"512 GB","Autonomía de referencia":"18 h"}'),
  ('novabook-studio-16','portatil','NexaTech','{"Pantalla":"16 pulgadas","Memoria RAM":"32 GB","Formato":"Portátil"}'),
  ('novabook-go-13','portatil','NexaTech','{"Pantalla":"13 pulgadas","Uso":"Estudio y movilidad"}'),
  ('nexa-mini','mini-pc','NexaTech','{"Formato":"Mini PC","Almacenamiento":"SSD"}'),
  ('nova-work-15','portatil','NexaTech','{"Pantalla":"15 pulgadas","Uso":"Oficina"}'),
  ('auralis-pro','audifonos','Auralis','{"Conexión":"Bluetooth 5.3","Función":"Cancelación de ruido","Autonomía de referencia":"40 h"}'),
  ('auralis-buds','buds','Auralis','{"Formato":"Intraaural","Carga":"Estuche incluido"}'),
  ('auralis-play','audifonos','Auralis','{"Conexión":"3.5 mm","Formato":"Diadema"}'),
  ('sonus-pocket','altavoz','Sonus','{"Formato":"Altavoz portátil","Conexión":"Bluetooth"}'),
  ('sonus-desk','altavoz','Sonus','{"Formato":"Par de altavoces","Uso":"Escritorio"}'),
  ('nexa-one','telefono','NexaTech','{"Pantalla":"OLED de 6.7 pulgadas","Cámara principal":"50 MP","Almacenamiento":"256 GB","Carga":"45 W"}'),
  ('nexa-one-plus','telefono','NexaTech','{"Pantalla":"OLED","Formato":"Smartphone"}'),
  ('nexa-lite','telefono','NexaTech','{"Almacenamiento":"128 GB","Gama":"Entrada"}'),
  ('nexa-core','telefono','NexaTech','{"Conectividad":"Doble SIM","Gama":"Media"}'),
  ('nexa-max','telefono','NexaTech','{"Pantalla":"6.8 pulgadas","Formato":"Smartphone"}'),
  ('pulse-watch-s','reloj','NexaTech','{"Pantalla":"AMOLED","Localización":"GPS","Resistencia de referencia":"5 ATM"}'),
  ('studio-display-27','monitor','NexaTech','{"Pantalla":"27 pulgadas","Resolución":"4K","Conexión":"USB-C"}'),
  ('arc-keyboard','teclado','NexaTech','{"Formato":"Compacto","Iluminación":"Retroiluminado","Conexión":"USB-C"}');

UPDATE public.product p
SET specs = jsonb_build_object('marca', v.brand, 'ficha', 'académica', 'origenPrecio', 'simulado', 'caracteristicas', v.features)
FROM nexa_catalog_visuals v WHERE p.slug = v.slug AND p.specs IS NULL;

CREATE TEMP TABLE nexa_catalog_images ON COMMIT DROP AS
SELECT p.id AS product_id, '/catalogo/' || v.image || '.jpg' AS src,
  'Vista ilustrativa de ' || p.name AS alt, 0 AS position
FROM nexa_catalog_visuals v JOIN public.product p ON p.slug = v.slug
UNION ALL
SELECT p.id, '/catalogo/' || second.image || '.jpg', second.alt || p.name, 1
FROM nexa_catalog_visuals v JOIN public.product p ON p.slug = v.slug
JOIN (VALUES ('portatil','portatil-detalle','Detalle ilustrativo del teclado de '),
             ('telefono','telefono-perfil','Vista lateral y trasera ilustrativa de '),
             ('audifonos','audifonos-detalle','Detalle ilustrativo de la diadema de '))
  AS second(main, image, alt) ON second.main = v.image;

INSERT INTO public.product_image(product_id, src, alt, position, credit)
SELECT product_id, src, alt, position, 'NexaTech · ilustración generada para E1 · 2026-11-20'
FROM nexa_catalog_images
ON CONFLICT (product_id, position) DO UPDATE
SET src = EXCLUDED.src, alt = EXCLUDED.alt, credit = EXCLUDED.credit
WHERE product_image.position = 0
  AND product_image.src LIKE 'https://images.unsplash.com/photo-%'
  AND product_image.credit = 'Unsplash (referencia visual del catálogo prototipo)';
