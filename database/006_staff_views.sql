-- Retained visibility and reporting rules for administration and support.
CREATE VIEW public.staff_order AS
  SELECT account.uid AS reader_uid, entity.id AS order_id
  FROM public.app_user account
  CROSS JOIN public.customer_order entity
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid
      AND (access.role_code = 'ADMIN')
  );

CREATE VIEW public.staff_inventory AS
  SELECT account.uid AS reader_uid, entity.id AS movement_id
  FROM public.app_user account
  CROSS JOIN public.inventory_movement entity
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid
      AND (access.role_code = 'ADMIN')
  );

CREATE VIEW public.staff_audit_event AS
  SELECT account.uid AS reader_uid, entity.id AS event_id
  FROM public.app_user account
  CROSS JOIN public.audit_log entity
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid
      AND (access.role_code = 'ADMIN')
  );

CREATE VIEW public.staff_customer AS
  SELECT account.uid AS reader_uid, entity.uid AS customer_uid
  FROM public.app_user account
  CROSS JOIN public.app_user entity
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid
      AND (access.role_code = 'ADMIN')
  );

CREATE VIEW public.staff_category AS
  SELECT account.uid AS reader_uid, entity.id AS category_id
  FROM public.app_user account
  CROSS JOIN public.category entity
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid AND access.role_code = 'ADMIN'
  );

CREATE VIEW public.staff_return_case AS
  SELECT account.uid AS reader_uid, entity.id AS request_id
  FROM public.app_user account
  CROSS JOIN public.return_request entity
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid
      AND (access.role_code = 'ADMIN'
        OR (access.role_code = 'SUPPORT' AND entity.assigned_to_uid = account.uid))
  );

CREATE VIEW public.staff_ticket AS
  SELECT account.uid AS reader_uid, entity.id AS ticket_id
  FROM public.app_user account
  CROSS JOIN public.support_ticket entity
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid
      AND (access.role_code = 'ADMIN'
        OR (access.role_code = 'SUPPORT' AND entity.assigned_to_uid = account.uid))
  );

CREATE VIEW public.staff_queue_entry AS
  SELECT account.uid AS reader_uid, cases.id, cases.kind, cases.status, cases.created_at,
    cases.assigned_to_uid IS NOT NULL AS assigned
  FROM public.app_user account
  CROSS JOIN (
    SELECT id, kind, status, created_at, assigned_to_uid FROM public.return_request
    WHERE status NOT IN ('RESOLVED', 'REJECTED')
    UNION ALL
    SELECT id, 'TICKET', status, created_at, assigned_to_uid FROM public.support_ticket
    WHERE status <> 'RESOLVED'
  ) cases
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid
      AND (access.role_code = 'ADMIN'
        OR (access.role_code = 'SUPPORT' AND (cases.assigned_to_uid IS NULL OR cases.assigned_to_uid = account.uid)))
  );

CREATE VIEW public.staff_daily_sale AS
  WITH ledger AS (
    SELECT (p.decided_at AT TIME ZONE 'America/Matamoros')::date AS day, p.amount_cents AS cents, 1 AS sales
    FROM public.payment p WHERE p.status IN ('APPROVED','REFUNDED')
    UNION ALL
    SELECT (r.decided_at AT TIME ZONE 'America/Matamoros')::date AS day, -r.amount_cents, 0
    FROM public.refund r WHERE r.status = 'APPROVED'
  ), daily AS (
    SELECT day, sum(cents)::bigint AS net_cents, sum(sales)::bigint AS order_count FROM ledger GROUP BY day
  )
  SELECT account.uid AS reader_uid, daily.* FROM public.app_user account CROSS JOIN daily
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid AND access.role_code = 'ADMIN'
  );

CREATE VIEW public.staff_stock_alert AS
  SELECT account.uid AS reader_uid, variant.id AS variant_id, variant.sku,
    variant.stock_on_hand, variant.low_stock_threshold
  FROM public.app_user account
  CROSS JOIN public.product_variant variant
  JOIN public.product product ON product.id = variant.product_id
  JOIN public.category category ON category.id = product.category_id
  WHERE account.status = 'ACTIVE' AND product.status = 'ACTIVE' AND variant.archived_at IS NULL
    AND category.archived_at IS NULL
    AND variant.stock_on_hand <= variant.low_stock_threshold
    AND EXISTS (
      SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid AND access.role_code = 'ADMIN'
    );

CREATE VIEW public.staff_sku_sale AS
  WITH daily AS (
    SELECT (orders.confirmed_at AT TIME ZONE 'America/Matamoros')::date AS day,
      items.sku_snapshot AS sku, sum(items.quantity)::bigint AS gross_units
    FROM public.order_item items JOIN public.customer_order orders ON orders.id = items.order_id
    WHERE orders.status <> 'CANCELLED'
    GROUP BY day, items.sku_snapshot
  )
  SELECT account.uid AS reader_uid, daily.* FROM public.app_user account CROSS JOIN daily
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid AND access.role_code = 'ADMIN'
  );

CREATE VIEW public.staff_return_summary AS
  WITH daily AS (
    SELECT (created_at AT TIME ZONE 'America/Matamoros')::date AS day, kind, status,
      reason_code, count(*)::bigint AS request_count
    FROM public.return_request GROUP BY day, kind, status, reason_code
  )
  SELECT account.uid AS reader_uid, daily.* FROM public.app_user account CROSS JOIN daily
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid AND access.role_code = 'ADMIN'
  );

CREATE VIEW public.staff_catalog_product AS
  SELECT account.uid AS reader_uid, product.id AS product_id
  FROM public.app_user account CROSS JOIN public.product product
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid AND access.role_code = 'ADMIN'
  );

CREATE VIEW public.staff_catalog_variant AS
  SELECT account.uid AS reader_uid, variant.id AS variant_id
  FROM public.app_user account CROSS JOIN public.product_variant variant
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid AND access.role_code = 'ADMIN'
  );

CREATE VIEW public.staff_catalog_tax AS
  SELECT account.uid AS reader_uid, tax.code, tax.label, tax.rate_bps
  FROM public.app_user account CROSS JOIN public.tax_class tax
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid AND access.role_code = 'ADMIN'
  );

CREATE VIEW public.staff_coupon AS
  SELECT account.uid AS reader_uid, coupon.id AS coupon_id, coalesce(uses.total, 0) AS redemption_count
  FROM public.app_user account CROSS JOIN public.coupon coupon
  LEFT JOIN (SELECT coupon_id, count(*) AS total FROM public.coupon_redemption GROUP BY coupon_id) uses
    ON uses.coupon_id = coupon.id
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid AND access.role_code = 'ADMIN'
  );

CREATE VIEW public.staff_operator AS
  SELECT account.uid AS reader_uid, operator.uid, operator.display_name
  FROM public.app_user account CROSS JOIN public.app_user operator
  WHERE account.status = 'ACTIVE' AND operator.status = 'ACTIVE'
    AND EXISTS (SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid AND access.role_code = 'ADMIN')
    AND EXISTS (SELECT 1 FROM public.user_role role WHERE role.user_uid = operator.uid AND role.role_code IN ('ADMIN', 'SUPPORT'));

CREATE VIEW public.staff_operation_total AS
  WITH orders AS (
    SELECT coalesce(sum(amount), 0)::bigint AS order_count,
      coalesce(jsonb_object_agg(status, amount), '{}'::jsonb) AS orders_by_status
    FROM (SELECT status, count(*) AS amount FROM public.customer_order GROUP BY status) by_status
  ), stock AS (
    SELECT coalesce(sum(variant.stock_on_hand), 0) AS available_units,
      count(*) FILTER (WHERE variant.stock_on_hand <= variant.low_stock_threshold) AS low_stock_variants
    FROM public.product_variant variant JOIN public.product product ON product.id = variant.product_id
    JOIN public.category category ON category.id = product.category_id
    WHERE product.status = 'ACTIVE' AND variant.archived_at IS NULL AND category.archived_at IS NULL
  ), payments AS (
    SELECT coalesce(sum(amount_cents), 0)::bigint AS gross_cents FROM public.payment
    WHERE status IN ('APPROVED', 'REFUNDED')
  ), refunds AS (
    SELECT coalesce(sum(amount_cents), 0)::bigint AS refunded_cents, count(*) AS refund_count
    FROM public.refund WHERE status = 'APPROVED'
  ), cases AS (
    SELECT count(*) FILTER (WHERE kind = 'CANCELLATION') AS cancellation_requests,
      count(*) FILTER (WHERE kind = 'RETURN') AS return_requests,
      count(*) FILTER (WHERE kind = 'EXCHANGE') AS exchange_requests,
      count(*) FILTER (WHERE kind = 'WARRANTY') AS warranty_requests
    FROM public.return_request
  )
  SELECT account.uid AS reader_uid, orders.*, stock.*, payments.*, refunds.*, cases.*,
    (SELECT count(*) FROM public.coupon_redemption) AS coupon_uses
  FROM public.app_user account CROSS JOIN orders CROSS JOIN stock
    CROSS JOIN payments CROSS JOIN refunds CROSS JOIN cases
  WHERE account.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM public.user_role access WHERE access.user_uid = account.uid AND access.role_code = 'ADMIN'
  );
