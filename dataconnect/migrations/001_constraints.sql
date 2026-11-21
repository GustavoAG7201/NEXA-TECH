-- Applies after SQL Connect has created the tables in a fresh local database.
CREATE SCHEMA nexa_internal;

CREATE UNIQUE INDEX cart_one_active_per_user ON public.cart(user_uid) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX address_one_default_per_user ON public.address(user_uid) WHERE is_default AND archived_at IS NULL;
CREATE UNIQUE INDEX inventory_one_sale_per_item ON public.inventory_movement(order_item_id) WHERE kind = 'SALE';
CREATE UNIQUE INDEX shipment_tracking_unique ON public.shipment(carrier, tracking_code) WHERE tracking_code IS NOT NULL;
CREATE UNIQUE INDEX legal_one_current_per_kind ON public.legal_document(kind)
  WHERE published_at IS NOT NULL AND withdrawn_at IS NULL;
CREATE INDEX return_assigned_open ON public.return_request(assigned_to_uid, created_at)
  WHERE status NOT IN ('RESOLVED', 'REJECTED');
CREATE INDEX inventory_by_return_item ON public.inventory_movement(return_item_id) WHERE return_item_id IS NOT NULL;

ALTER TABLE public.app_user ADD CONSTRAINT account_valid CHECK (
  char_length(uid) BETWEEN 1 AND 128 AND char_length(btrim(display_name)) BETWEEN 1 AND 120
  AND (phone IS NULL OR char_length(phone) <= 25) AND status IN ('ACTIVE', 'DISABLED')
);
ALTER TABLE public.role ADD CONSTRAINT role_known CHECK (code IN ('CUSTOMER', 'ADMIN', 'SUPPORT'));
ALTER TABLE public.address ADD CONSTRAINT address_valid CHECK (
  country_code = 'MX' AND postal_code ~ '^[0-9]{5}$'
  AND char_length(btrim(label)) BETWEEN 1 AND 48
  AND char_length(btrim(recipient)) BETWEEN 1 AND 120
  AND char_length(btrim(phone)) BETWEEN 1 AND 25
  AND char_length(btrim(line1)) BETWEEN 1 AND 150 AND (line2 IS NULL OR char_length(line2) <= 150)
  AND char_length(btrim(city)) BETWEEN 1 AND 100 AND char_length(btrim(district)) BETWEEN 1 AND 100
  AND state_code ~ '^[A-Z]{2,8}$' AND (archived_at IS NULL OR NOT is_default)
);
ALTER TABLE public.category ADD CONSTRAINT category_valid CHECK (
  slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 120
  AND length(btrim(name)) BETWEEN 1 AND 120 AND (description IS NULL OR length(description) <= 1000)
);
ALTER TABLE public.product ADD CONSTRAINT product_valid CHECK (
  slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 160
  AND length(btrim(name)) BETWEEN 1 AND 160 AND length(btrim(description)) BETWEEN 1 AND 6000
  AND status IN ('DRAFT', 'ACTIVE', 'ARCHIVED') AND ((archived_at IS NULL) = (status <> 'ARCHIVED'))
);
ALTER TABLE public.product_image ADD CONSTRAINT product_image_valid CHECK (
  position >= 0 AND length(btrim(alt)) BETWEEN 1 AND 250 AND length(src) <= 1024
  AND (src ~ '^https://' OR src ~ '^/[a-zA-Z0-9_/-]+[.][a-zA-Z0-9]+$')
);
ALTER TABLE public.product_variant ADD CONSTRAINT variant_valid CHECK (
  sku ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' AND length(sku) <= 64
  AND length(btrim(option_label)) BETWEEN 1 AND 120 AND (color IS NULL OR length(color) <= 60)
  AND unit_price_cents BETWEEN 0 AND 1000000000000
  AND (compare_at_cents IS NULL OR compare_at_cents BETWEEN unit_price_cents + 1 AND 1000000000000)
  AND (unit_cost_cents IS NULL OR unit_cost_cents BETWEEN 0 AND 1000000000000)
  AND stock_on_hand >= 0 AND low_stock_threshold >= 0
  AND (weight_g IS NULL OR weight_g > 0)
  AND (num_nonnulls(length_mm, width_mm, height_mm) = 0
    OR (num_nonnulls(length_mm, width_mm, height_mm) = 3 AND least(length_mm, width_mm, height_mm) > 0))
);
ALTER TABLE public.tax_class ADD CONSTRAINT tax_rate_valid CHECK (rate_bps BETWEEN 0 AND 10000);
ALTER TABLE public.review ADD CONSTRAINT review_valid CHECK (
  rating BETWEEN 1 AND 5 AND length(body) <= 2000 AND moderation_status IN ('PENDING', 'APPROVED', 'REJECTED')
);
ALTER TABLE public.cart ADD CONSTRAINT cart_valid CHECK (
  status IN ('ACTIVE', 'CONVERTED', 'ABANDONED') AND revision >= 0
);
ALTER TABLE public.cart_item ADD CONSTRAINT cart_item_quantity CHECK (quantity BETWEEN 1 AND 100);
ALTER TABLE public.delivery_zone ADD CONSTRAINT delivery_zone_valid CHECK (
  country_code = 'MX' AND state_code ~ '^[A-Z]{2,8}$'
);
ALTER TABLE public.delivery_rate ADD CONSTRAINT delivery_rate_valid CHECK (
  price_cents BETWEEN 0 AND 1000000000000 AND (free_threshold_cents IS NULL OR free_threshold_cents > 0)
  AND eta_min_days >= 0 AND eta_max_days BETWEEN eta_min_days AND 365
);
ALTER TABLE public.checkout_quote ADD CONSTRAINT checkout_quote_valid CHECK (
  expires_at > created_at AND cart_revision >= 0 AND pricing_digest ~ '^[a-f0-9]{64}$'
  AND jsonb_typeof(summary) = 'object'
);
ALTER TABLE public.customer_order ADD CONSTRAINT order_values_valid CHECK (
  status IN ('PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED')
  AND currency = 'MXN' AND subtotal_cents >= 0 AND discount_cents BETWEEN 0 AND subtotal_cents
  AND items_tax_cents >= 0 AND shipping_cents >= 0 AND shipping_tax_cents >= 0
  AND shipping_tax_bps BETWEEN 0 AND 10000 AND total_cents >= 0
  AND total_cents = subtotal_cents - discount_cents + items_tax_cents + shipping_cents + shipping_tax_cents
  AND length(contact_email) BETWEEN 3 AND 254 AND length(folio) BETWEEN 1 AND 32
);
ALTER TABLE public.order_address ADD CONSTRAINT order_address_valid CHECK (
  country_code = 'MX' AND postal_code ~ '^[0-9]{5}$'
);
ALTER TABLE public.order_item ADD CONSTRAINT order_item_values_valid CHECK (
  quantity BETWEEN 1 AND 100 AND unit_price_cents BETWEEN 0 AND 1000000000000
  AND discount_cents BETWEEN 0 AND unit_price_cents * quantity
  AND tax_bps BETWEEN 0 AND 10000 AND tax_cents >= 0
);
ALTER TABLE public.payment ADD CONSTRAINT payment_state_valid CHECK (
  provider = 'SIMULATED' AND amount_cents >= 0
  AND status IN ('PENDING', 'APPROVED', 'DECLINED', 'REFUNDED')
  AND (order_id IS NOT NULL) = (status IN ('APPROVED', 'REFUNDED'))
  AND (decided_at IS NULL) = (status = 'PENDING')
);
ALTER TABLE public.shipment ADD CONSTRAINT shipment_state_valid CHECK (
  estimated_from <= estimated_to
  AND status IN ('PLANNED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'RETURNED_TO_SENDER', 'CANCELLED')
  AND (carrier IS NULL) = (tracking_code IS NULL)
  AND (status NOT IN ('SHIPPED', 'DELIVERED', 'RETURNED_TO_SENDER')
    OR (carrier IS NOT NULL AND shipped_at IS NOT NULL))
  AND (delivered_at IS NULL OR (shipped_at IS NOT NULL AND shipped_at <= delivered_at))
);
ALTER TABLE public.inventory_movement ADD CONSTRAINT movement_valid CHECK (
  delta <> 0 AND length(btrim(reason)) BETWEEN 1 AND 480
  AND (kind = 'OPENING' OR command_id IS NOT NULL)
  AND CASE kind
    WHEN 'OPENING' THEN delta > 0 AND order_item_id IS NULL AND return_item_id IS NULL
    WHEN 'ADJUSTMENT' THEN order_item_id IS NULL AND return_item_id IS NULL
    WHEN 'SALE' THEN delta < 0 AND order_item_id IS NOT NULL AND return_item_id IS NULL
    WHEN 'CANCELLATION' THEN delta > 0 AND order_item_id IS NOT NULL AND return_item_id IS NOT NULL
    WHEN 'RESTOCK' THEN delta > 0 AND return_item_id IS NOT NULL
    WHEN 'REPLACEMENT' THEN delta < 0 AND return_item_id IS NOT NULL
    ELSE false
  END
);
ALTER TABLE public.coupon ADD CONSTRAINT coupon_valid CHECK (
  code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' AND length(code) <= 48
  AND starts_at < ends_at AND min_subtotal_cents >= 0
  AND (total_limit IS NULL OR total_limit > 0) AND (per_user_limit IS NULL OR per_user_limit > 0)
  AND CASE kind
    WHEN 'FIXED' THEN fixed_amount_cents IS NOT NULL AND fixed_amount_cents > 0 AND percentage_bps IS NULL
    WHEN 'PERCENTAGE' THEN percentage_bps IS NOT NULL AND percentage_bps BETWEEN 1 AND 10000 AND fixed_amount_cents IS NULL
    ELSE false
  END
);
ALTER TABLE public.return_request ADD CONSTRAINT return_request_valid CHECK (
  kind IN ('CANCELLATION', 'RETURN', 'EXCHANGE', 'WARRANTY')
  AND status IN ('SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'AWAITING_ITEM', 'RECEIVED', 'INSPECTED', 'RESOLVED')
  AND length(btrim(reason_code)) BETWEEN 1 AND 64 AND length(btrim(description)) BETWEEN 1 AND 2000
  AND length(resolution_note) <= 2000
);
ALTER TABLE public.return_item ADD CONSTRAINT return_quantities_valid CHECK (
  requested_qty BETWEEN 1 AND 100 AND (approved_qty IS NULL OR approved_qty BETWEEN 0 AND requested_qty)
  AND received_qty BETWEEN 0 AND coalesce(approved_qty, 0) AND restocked_qty BETWEEN 0 AND received_qty
  AND length(inspection_note) <= 1000
);
ALTER TABLE public.return_evidence ADD CONSTRAINT return_evidence_valid CHECK (
  media_type IN ('image/png', 'image/jpeg') AND size_bytes BETWEEN 4 AND 262144
  AND sha256 ~ '^[a-f0-9]{64}$' AND (content_b64 IS NULL) = (deleted_at IS NOT NULL)
  AND (content_b64 IS NULL OR length(content_b64) <= 349528)
);
ALTER TABLE public.refund ADD CONSTRAINT refund_valid CHECK (
  status IN ('PENDING', 'APPROVED', 'DECLINED') AND amount_cents > 0
  AND shipping_refund_cents BETWEEN 0 AND amount_cents
);
ALTER TABLE public.refund_item ADD CONSTRAINT refund_item_valid CHECK (amount_cents > 0);
ALTER TABLE public.support_ticket ADD CONSTRAINT ticket_valid CHECK (
  status IN ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED')
  AND length(btrim(subject)) BETWEEN 1 AND 180
);
ALTER TABLE public.support_message ADD CONSTRAINT message_valid CHECK (
  visibility IN ('CUSTOMER_VISIBLE', 'STAFF_ONLY') AND length(btrim(body)) BETWEEN 1 AND 2500
);
ALTER TABLE public.notification ADD CONSTRAINT notification_one_resource CHECK (
  num_nonnulls(order_id, return_request_id, support_ticket_id) = 1
);
ALTER TABLE public.commerce_command ADD CONSTRAINT command_valid CHECK (
  input_version = 1
  AND (input IS NULL OR (jsonb_typeof(input) = 'object' AND octet_length(input::text) <= 360000))
  AND (
    (status = 'REQUESTED' AND input_digest = '' AND result_code IS NULL AND completed_at IS NULL)
    OR (status IN ('SUCCEEDED', 'REJECTED') AND input IS NULL
      AND input_digest ~ '^[a-f0-9]{64}$' AND result_code IS NOT NULL AND completed_at IS NOT NULL)
  )
);
ALTER TABLE public.legal_document ADD CONSTRAINT legal_document_valid CHECK (
  kind IN ('TERMS', 'PRIVACY', 'SHIPPING', 'CANCELLATION', 'RETURN', 'WARRANTY')
  AND version > 0 AND length(btrim(title)) BETWEEN 1 AND 150 AND length(btrim(body)) BETWEEN 1 AND 50000
  AND sha256 = encode(sha256(convert_to(body, 'UTF8')), 'hex')
  AND (withdrawn_at IS NULL OR (published_at IS NOT NULL AND published_at <= withdrawn_at))
);
ALTER TABLE public.terms_acceptance ADD CONSTRAINT acceptance_valid CHECK (evidence_kind IN ('PRESENTED', 'ACCEPTED'));

-- Preserve commercial references even when the generated schema defaults to cascade.
DO $$
DECLARE reference record;
BEGIN
  FOR reference IN
    SELECT conname, conrelid::regclass AS table_name, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype = 'f'
    AND confdeltype IN ('c', 'n')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I, ADD CONSTRAINT %I %s',
      reference.table_name, reference.conname, reference.conname,
      regexp_replace(reference.definition, 'ON DELETE (CASCADE|SET NULL)', 'ON DELETE RESTRICT'));
  END LOOP;
END $$;

CREATE FUNCTION nexa_internal.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END $$;

CREATE FUNCTION nexa_internal.protect_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_RECORD' USING ERRCODE = '23514';
END $$;

CREATE FUNCTION nexa_internal.protect_order() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE'
    OR to_jsonb(NEW) - ARRAY['status', 'updated_at'] IS DISTINCT FROM to_jsonb(OLD) - ARRAY['status', 'updated_at']
  THEN RAISE EXCEPTION 'IMMUTABLE_ORDER' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION nexa_internal.protect_policy() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.published_at IS NOT NULL AND (
    TG_OP = 'DELETE' OR to_jsonb(NEW) - 'withdrawn_at' IS DISTINCT FROM to_jsonb(OLD) - 'withdrawn_at'
    OR (OLD.withdrawn_at IS NOT NULL AND NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at)
  ) THEN RAISE EXCEPTION 'IMMUTABLE_POLICY' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_customer_order BEFORE UPDATE OR DELETE ON public.customer_order
  FOR EACH ROW EXECUTE FUNCTION nexa_internal.protect_order();
CREATE TRIGGER protect_legal_document BEFORE UPDATE OR DELETE ON public.legal_document
  FOR EACH ROW EXECUTE FUNCTION nexa_internal.protect_policy();

DO $$
DECLARE record_table text;
BEGIN
  FOREACH record_table IN ARRAY ARRAY['order_address','order_item','order_status_event','shipment_event',
    'inventory_movement','coupon_redemption','return_event','refund_item','support_message','audit_log',
    'terms_acceptance','checkout_quote']
  LOOP
    EXECUTE format('CREATE TRIGGER protect_immutable BEFORE UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION nexa_internal.protect_immutable()', record_table);
  END LOOP;
  FOR record_table IN SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'updated_at' AND table_name NOT LIKE 'nexa_%'
  LOOP
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION nexa_internal.touch_updated_at()', record_table);
  END LOOP;
END $$;

INSERT INTO public.role(code, label) VALUES
  ('CUSTOMER', 'Cliente'), ('ADMIN', 'Administrador'), ('SUPPORT', 'Soporte')
ON CONFLICT (code) DO NOTHING;

CREATE FUNCTION nexa_internal.grant_customer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.user_role(user_uid, role_code) VALUES (NEW.uid, 'CUSTOMER');
  RETURN NEW;
END $$;
CREATE TRIGGER grant_customer AFTER INSERT ON public.app_user
  FOR EACH ROW EXECUTE FUNCTION nexa_internal.grant_customer();
