SELECT
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r') AS commerce_tables,
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'v') AS staff_views,
  (SELECT count(*) FROM public.product WHERE status = 'ACTIVE' AND archived_at IS NULL) AS products,
  (SELECT count(*) FROM public.category WHERE archived_at IS NULL) AS categories,
  (SELECT count(*) FROM public.product_variant WHERE archived_at IS NULL) AS variants,
  (SELECT coalesce(sum(stock_on_hand), 0) FROM public.product_variant) AS units,
  (SELECT count(*) FROM public.product_variant variant LEFT JOIN (
      SELECT variant_id, sum(delta) AS balance FROM public.inventory_movement GROUP BY variant_id
    ) ledger ON ledger.variant_id = variant.id
    WHERE variant.stock_on_hand <> coalesce(ledger.balance, 0) OR variant.stock_on_hand < 0) AS inventory_differences,
  (SELECT count(*) FROM pg_constraint WHERE connamespace IN ('public'::regnamespace, 'nexa_auth'::regnamespace)
    AND (NOT convalidated OR NOT conenforced)) AS invalid_constraints,
  (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relnamespace IN ('public'::regnamespace, 'nexa_auth'::regnamespace)
    AND (NOT indisvalid OR NOT indisready OR NOT indislive)) AS invalid_indexes,
  (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled NOT IN ('O', 'A')
    AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace)) AS disabled_triggers,
  nexa_internal.commerce_schema_ready() AS protections_ready;
