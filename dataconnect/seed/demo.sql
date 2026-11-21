-- Synthetic demonstration data. Invoke only against the isolated demo database.
INSERT INTO public.tax_class(code, label, rate_bps) VALUES
  ('DEMO_ITEMS', 'Tasa simulada de artículos', 1600), ('DEMO_SHIPPING', 'Tasa simulada de envío', 1600)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.delivery_zone(state_code, label) VALUES ('TAM', 'Tamaulipas'), ('CMX', 'Ciudad de México')
ON CONFLICT (country_code, state_code) DO NOTHING;
INSERT INTO public.delivery_method(code, label) VALUES ('DEMO_PARCEL', 'Paquetería simulada')
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.delivery_rate(zone_id, method_code, tax_class_code, price_cents, free_threshold_cents, eta_min_days, eta_max_days)
SELECT id, 'DEMO_PARCEL', 'DEMO_SHIPPING', 9900, 199900, 2, 5
FROM public.delivery_zone WHERE state_code IN ('TAM','CMX')
ON CONFLICT (zone_id, method_code) DO NOTHING;

INSERT INTO public.category(slug, name) VALUES
  ('computadoras','Computadoras'), ('audio','Audio'), ('smartphones','Smartphones'),
  ('wearables','Wearables'), ('monitores','Monitores'), ('accesorios','Accesorios')
ON CONFLICT (slug) DO NOTHING;

CREATE TEMP TABLE nexa_demo_catalog (
  legacy_id integer, category_slug text, slug text, name text, description text, sku text,
  finish text, price bigint, compare_at bigint, stock integer, photo text
) ON COMMIT DROP;

INSERT INTO nexa_demo_catalog VALUES
  (1,'computadoras','novabook-air-14','NovaBook Air 14','Portátil de 14 pulgadas con SSD de 512 GB.','NX-NBA14-TI','Titanio',2499900,2799900,8,'1517336714731-489689fd1ca8'),
  (2,'audio','auralis-pro','Auralis Pro','Audífonos inalámbricos con cancelación de ruido.','NX-AUP-GR','Grafito',649900,799900,12,'1505740420928-5e560c06d30e'),
  (3,'smartphones','nexa-one','Nexa One','Teléfono OLED con almacenamiento de 256 GB.','NX-NO-BK','Negro',1899900,2099900,6,'1592899677977-9c10ca588bbd'),
  (4,'wearables','pulse-watch-s','Pulse Watch S','Reloj con GPS y pantalla AMOLED.','NX-PWS-SL','Plata',599900,NULL,15,'1523275335684-37898b6baf30'),
  (5,'monitores','studio-display-27','Studio Display 27','Monitor 4K de 27 pulgadas con USB-C.','NX-SD27-WH','Blanco',1699900,1899900,4,'1527443224154-c4a3942d3acf'),
  (6,'accesorios','arc-keyboard','Arc Keyboard','Teclado compacto con retroiluminación.','NX-ARK-BK','Negro',269900,319900,20,'1587829741301-dc798b83add3'),
  (NULL,'computadoras','novabook-studio-16','NovaBook Studio 16','Portátil de rendimiento con 32 GB de RAM.','NX-NBS16-GR','Grafito',3199900,NULL,7,'1517336714731-489689fd1ca8'),
  (NULL,'computadoras','novabook-go-13','NovaBook Go 13','Portátil ligero de 13 pulgadas para estudio.','NX-NBG13-SL','Plata',1299900,NULL,10,'1517336714731-489689fd1ca8'),
  (NULL,'computadoras','nexa-mini','Nexa Mini','Equipo compacto de escritorio con SSD.','NX-NM-BK','Negro',1199900,NULL,9,'1517336714731-489689fd1ca8'),
  (NULL,'computadoras','nova-work-15','Nova Work 15','Portátil de 15 pulgadas para oficina.','NX-NW15-GR','Grafito',1699900,NULL,11,'1517336714731-489689fd1ca8'),
  (NULL,'audio','auralis-buds','Auralis Buds','Audífonos compactos con estuche de carga.','NX-AUB-WH','Blanco',189900,NULL,18,'1505740420928-5e560c06d30e'),
  (NULL,'audio','auralis-play','Auralis Play','Audífonos ligeros con conexión de 3.5 mm.','NX-AUPL-BK','Negro',69900,NULL,22,'1505740420928-5e560c06d30e'),
  (NULL,'audio','sonus-pocket','Sonus Pocket','Altavoz Bluetooth portátil.','NX-SP-BK','Negro',129900,NULL,16,'1505740420928-5e560c06d30e'),
  (NULL,'audio','sonus-desk','Sonus Desk','Par de altavoces compactos para escritorio.','NX-SD-GR','Grafito',249900,NULL,12,'1505740420928-5e560c06d30e'),
  (NULL,'smartphones','nexa-one-plus','Nexa One Plus','Teléfono OLED con batería de larga duración.','NX-NOP-BK','Negro',2299900,NULL,8,'1592899677977-9c10ca588bbd'),
  (NULL,'smartphones','nexa-lite','Nexa Lite','Teléfono de entrada con 128 GB.','NX-NL-SL','Plata',449900,NULL,17,'1592899677977-9c10ca588bbd'),
  (NULL,'smartphones','nexa-core','Nexa Core','Teléfono de gama media con doble SIM.','NX-NC-BK','Negro',749900,NULL,12,'1592899677977-9c10ca588bbd'),
  (NULL,'smartphones','nexa-max','Nexa Max','Teléfono con pantalla de 6.8 pulgadas.','NX-NMAX-GR','Grafito',1099900,NULL,9,'1592899677977-9c10ca588bbd');

INSERT INTO public.product(category_id, slug, legacy_id, name, description, status, featured)
SELECT c.id, d.slug, d.legacy_id, d.name, d.description, 'ACTIVE', coalesce(d.legacy_id <= 4, false)
FROM nexa_demo_catalog d JOIN public.category c ON c.slug = d.category_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.product_image(product_id, src, alt, position, credit)
SELECT p.id, 'https://images.unsplash.com/photo-' || d.photo || '?auto=format&fit=crop&w=1000&q=85',
  'Imagen ilustrativa para ' || d.name, 0, 'Unsplash (referencia visual del catálogo prototipo)'
FROM nexa_demo_catalog d JOIN public.product p ON p.slug = d.slug
ON CONFLICT (product_id, position) DO NOTHING;

WITH opening AS (
  INSERT INTO public.product_variant(product_id, tax_class_code, sku, option_label, color, unit_price_cents, compare_at_cents,
    stock_on_hand, low_stock_threshold)
  SELECT p.id, 'DEMO_ITEMS', d.sku, d.finish, d.finish, d.price, d.compare_at, d.stock, 3
  FROM nexa_demo_catalog d JOIN public.product p ON p.slug = d.slug
  ON CONFLICT (sku) DO NOTHING
  RETURNING id, stock_on_hand
)
INSERT INTO public.inventory_movement(variant_id, kind, delta, reason)
SELECT id, 'OPENING', stock_on_hand, 'Apertura de inventario sintético' FROM opening;

INSERT INTO public.coupon(code, kind, percentage_bps, starts_at, ends_at, min_subtotal_cents, total_limit, per_user_limit)
VALUES ('DEMO10','PERCENTAGE',1000, '2020-01-01T00:00:00Z', '2100-01-01T00:00:00Z', 10000, 100, 1)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.legal_document(kind, version, title, body, sha256, published_at)
SELECT kind, 1, title, body, encode(sha256(convert_to(body, 'UTF8')), 'hex'), statement_timestamp()
FROM (VALUES
  ('TERMS','Términos de la demostración','Compra académica con importes y pagos de prueba.'),
  ('PRIVACY','Aviso de privacidad de la demostración','Usa exclusivamente datos ficticios para la cuenta y la entrega.'),
  ('SHIPPING','Envío de demostración','Los costos, guías y fechas representan una operación simulada.'),
  ('CANCELLATION','Cancelación de demostración','Las solicitudes previas al despacho se revisan en el panel.'),
  ('RETURN','Devolución de demostración','La solicitud conserva partidas, inspección y resolución simulada.'),
  ('WARRANTY','Garantía de demostración','Las reparaciones y reposiciones presentadas son escenarios de práctica.')
) AS policies(kind, title, body)
ON CONFLICT (kind, version) DO NOTHING;
