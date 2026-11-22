SELECT pg_advisory_xact_lock(752196, 1);

-- Publish revised wording while keeping existing policy IDs and acceptance records.
WITH wording(kind, previous, revised) AS (VALUES
  ('PRIVACY',
    'La identidad y el domicilio del responsable del tratamiento y el medio de contacto para solicitudes de privacidad se publican en esta página una vez validados por la administración.',
    'Los datos del responsable y los medios para consultas de privacidad se indican en este aviso.'),
  ('TERMS',
    'La identidad, el domicilio y los canales de contacto validados del proveedor se publican en esta página.',
    'Los datos del proveedor se indican en la sección de contacto de estos términos.'),
  ('SUPPORT',
    'Los canales externos de NexaTech se publican una vez validados.',
    'Los canales de atención de NexaTech se indican en esta página.')
), withdrawn AS (
  UPDATE public.legal_document d
  SET withdrawn_at = statement_timestamp()
  FROM wording w
  WHERE d.kind = w.kind AND d.withdrawn_at IS NULL AND d.published_at <= statement_timestamp()
    AND strpos(d.body, w.previous) > 0
  RETURNING d.kind, d.title, replace(d.body, w.previous, w.revised) AS body
)
INSERT INTO public.legal_document (kind, version, title, body, sha256, published_at)
SELECT w.kind, (SELECT max(d.version) + 1 FROM public.legal_document d WHERE d.kind = w.kind),
  w.title, w.body, encode(sha256(convert_to(w.body, 'UTF8')), 'hex'), statement_timestamp()
FROM withdrawn w;
