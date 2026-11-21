CREATE FUNCTION nexa_internal.reject(reason text) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION '%', reason USING ERRCODE = 'NX001';
END $$;

CREATE FUNCTION nexa_internal.require_role(actor text, required_roles text[]) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM 1 FROM public.app_user WHERE uid = actor AND status = 'ACTIVE' FOR NO KEY UPDATE;
  IF NOT FOUND THEN PERFORM nexa_internal.reject('PROFILE_DISABLED'); END IF;
  PERFORM 1 FROM public.user_role
    WHERE user_uid = actor AND role_code = ANY(required_roles) ORDER BY role_code FOR SHARE;
  IF NOT FOUND THEN PERFORM nexa_internal.reject('FORBIDDEN'); END IF;
END $$;

CREATE FUNCTION nexa_internal.active_cart(actor text) RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE cart_key uuid;
BEGIN
  INSERT INTO public.cart(user_uid) VALUES (actor)
    ON CONFLICT (user_uid) WHERE status = 'ACTIVE' DO NOTHING;
  SELECT id INTO STRICT cart_key FROM public.cart
    WHERE user_uid = actor AND status = 'ACTIVE' FOR UPDATE;
  RETURN cart_key;
END $$;

CREATE FUNCTION nexa_internal.set_cart_item(cart_key uuid, variant_key uuid, units integer, merge_item boolean)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE existing integer;
DECLARE available integer;
BEGIN
  IF variant_key IS NULL OR units IS NULL OR units NOT BETWEEN 0 AND 100
    OR (merge_item AND units = 0)
  THEN PERFORM nexa_internal.reject('INVALID_QUANTITY'); END IF;
  IF units = 0 THEN
    DELETE FROM public.cart_item WHERE cart_id = cart_key AND variant_id = variant_key;
    RETURN;
  END IF;
  SELECT v.stock_on_hand INTO available
  FROM public.product_variant v JOIN public.product p ON p.id = v.product_id
  JOIN public.category c ON c.id = p.category_id
  WHERE v.id = variant_key AND v.archived_at IS NULL AND p.status = 'ACTIVE' AND c.archived_at IS NULL
  FOR SHARE OF v, p, c;
  IF NOT FOUND THEN PERFORM nexa_internal.reject('VARIANT_UNAVAILABLE'); END IF;
  IF merge_item THEN
    SELECT quantity INTO existing FROM public.cart_item WHERE cart_id = cart_key AND variant_id = variant_key;
    units := units + coalesce(existing, 0);
  END IF;
  IF units > 100 OR units > available THEN PERFORM nexa_internal.reject('STOCK_UNAVAILABLE'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cart_item WHERE cart_id = cart_key AND variant_id = variant_key)
    AND (SELECT count(*) FROM public.cart_item WHERE cart_id = cart_key) >= 50
  THEN PERFORM nexa_internal.reject('CART_LIMIT'); END IF;
  INSERT INTO public.cart_item(cart_id, variant_id, quantity) VALUES (cart_key, variant_key, units)
    ON CONFLICT (cart_id, variant_id) DO UPDATE SET quantity = excluded.quantity;
END $$;

CREATE FUNCTION nexa_internal.quote_summary(
  actor text, cart_key uuid, address_key uuid, delivery_code text, coupon_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE cart_row public.cart;
DECLARE address_row public.address;
DECLARE coupon_row public.coupon;
DECLARE delivery record;
DECLARE item_count integer;
DECLARE sellable_count integer;
DECLARE in_stock boolean;
DECLARE subtotal bigint;
DECLARE discount bigint := 0;
DECLARE items_tax bigint;
DECLARE shipping bigint;
DECLARE shipping_tax bigint;
DECLARE history_lines jsonb;
DECLARE documents jsonb;
BEGIN
  SELECT * INTO cart_row FROM public.cart WHERE id = cart_key AND user_uid = actor AND status = 'ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN PERFORM nexa_internal.reject('CART_UNAVAILABLE'); END IF;
  SELECT * INTO address_row FROM public.address WHERE id = address_key AND user_uid = actor AND archived_at IS NULL FOR SHARE;
  IF NOT FOUND THEN PERFORM nexa_internal.reject('ADDRESS_UNAVAILABLE'); END IF;

  SELECT r.zone_id, r.price_cents, r.free_threshold_cents, r.eta_min_days, r.eta_max_days,
    m.label AS method_label, t.rate_bps
  INTO delivery
  FROM public.delivery_zone z JOIN public.delivery_rate r ON r.zone_id = z.id
  JOIN public.delivery_method m ON m.code = r.method_code JOIN public.tax_class t ON t.code = r.tax_class_code
  WHERE z.active AND r.active AND m.active AND r.method_code = delivery_code
    AND z.state_code = address_row.state_code AND z.country_code = address_row.country_code
  FOR SHARE OF z, r, m, t;
  IF NOT FOUND THEN PERFORM nexa_internal.reject('DELIVERY_UNAVAILABLE'); END IF;

  IF coupon_key IS NOT NULL THEN
    SELECT * INTO coupon_row FROM public.coupon WHERE id = coupon_key AND archived_at IS NULL
      AND starts_at <= statement_timestamp() AND ends_at > statement_timestamp() FOR NO KEY UPDATE;
    IF NOT FOUND THEN PERFORM nexa_internal.reject('COUPON_UNAVAILABLE'); END IF;
    IF (coupon_row.total_limit IS NOT NULL AND (
      SELECT count(*) FROM public.coupon_redemption WHERE coupon_id = coupon_key
    ) >= coupon_row.total_limit) OR (coupon_row.per_user_limit IS NOT NULL AND (
      SELECT count(*) FROM public.coupon_redemption cr JOIN public.customer_order co ON co.id = cr.order_id
        WHERE cr.coupon_id = coupon_key AND co.user_uid = actor
    ) >= coupon_row.per_user_limit) THEN PERFORM nexa_internal.reject('COUPON_LIMIT'); END IF;
  END IF;

  PERFORM v.id FROM public.cart_item ci JOIN public.product_variant v ON v.id = ci.variant_id
    WHERE ci.cart_id = cart_key ORDER BY v.id FOR NO KEY UPDATE OF v;
  PERFORM p.id FROM public.cart_item ci JOIN public.product_variant v ON v.id = ci.variant_id
    JOIN public.product p ON p.id = v.product_id JOIN public.category c ON c.id = p.category_id
    JOIN public.tax_class t ON t.code = v.tax_class_code
    WHERE ci.cart_id = cart_key ORDER BY p.id, c.id, t.code FOR SHARE OF p,c,t;

  SELECT count(*), count(*) FILTER (WHERE v.archived_at IS NULL AND p.status = 'ACTIVE' AND c.archived_at IS NULL),
    bool_and(v.stock_on_hand >= ci.quantity), sum(v.unit_price_cents * ci.quantity)
  INTO item_count, sellable_count, in_stock, subtotal
  FROM public.cart_item ci JOIN public.product_variant v ON v.id = ci.variant_id
  JOIN public.product p ON p.id = v.product_id JOIN public.category c ON c.id = p.category_id
  WHERE ci.cart_id = cart_key;

  IF item_count = 0 THEN PERFORM nexa_internal.reject('EMPTY_CART'); END IF;
  IF item_count <> sellable_count THEN PERFORM nexa_internal.reject('VARIANT_UNAVAILABLE'); END IF;
  IF NOT in_stock THEN PERFORM nexa_internal.reject('STOCK_UNAVAILABLE'); END IF;
  IF coupon_key IS NOT NULL THEN
    IF subtotal < coupon_row.min_subtotal_cents THEN PERFORM nexa_internal.reject('COUPON_MINIMUM'); END IF;
    discount := least(subtotal, CASE coupon_row.kind
      WHEN 'FIXED' THEN coupon_row.fixed_amount_cents
      ELSE round(subtotal::numeric * coupon_row.percentage_bps / 10000)::bigint END);
  END IF;

  WITH lines AS (
    SELECT v.id AS variant_id, v.sku, p.name, p.description, v.option_label, ci.quantity,
      v.unit_price_cents, v.unit_price_cents * ci.quantity AS gross, t.rate_bps
    FROM public.cart_item ci JOIN public.product_variant v ON v.id = ci.variant_id
    JOIN public.product p ON p.id = v.product_id JOIN public.tax_class t ON t.code = v.tax_class_code
    WHERE ci.cart_id = cart_key
  ), quota AS (
    SELECT *, CASE WHEN subtotal = 0 THEN 0 ELSE div(discount::numeric * gross, subtotal)::bigint END AS base_discount,
      CASE WHEN subtotal = 0 THEN 0 ELSE mod(discount::numeric * gross, subtotal) END AS remainder
    FROM lines
  ), allocated AS (
    SELECT *, base_discount + CASE WHEN row_number() OVER (ORDER BY remainder DESC, sku COLLATE "C")
      <= discount - sum(base_discount) OVER () THEN 1 ELSE 0 END AS line_discount
    FROM quota
  ), taxed AS (
    SELECT *, round((gross - line_discount)::numeric * rate_bps / 10000)::bigint AS line_tax FROM allocated
  )
  SELECT sum(line_tax), jsonb_agg(jsonb_build_object(
    'variantId', variant_id, 'sku', sku, 'name', name, 'description', description, 'option', option_label,
    'quantity', quantity, 'priceCents', unit_price_cents::text, 'discountCents', line_discount::text,
    'taxBps', rate_bps, 'taxCents', line_tax::text
  ) ORDER BY variant_id) INTO items_tax, history_lines FROM taxed;

  shipping := CASE WHEN delivery.free_threshold_cents IS NOT NULL
    AND subtotal - discount >= delivery.free_threshold_cents THEN 0 ELSE delivery.price_cents END;
  shipping_tax := round(shipping::numeric * delivery.rate_bps / 10000)::bigint;

  -- Serialize policy publications against a quote with the same transaction lock.
  PERFORM pg_advisory_xact_lock_shared(752196, 1);
  SELECT jsonb_object_agg(kind, id) INTO documents FROM public.legal_document
    WHERE published_at <= statement_timestamp() AND withdrawn_at IS NULL;
  IF documents IS NULL OR NOT (documents ?& ARRAY['TERMS','PRIVACY','SHIPPING','CANCELLATION','RETURN','WARRANTY'])
  THEN PERFORM nexa_internal.reject('POLICY_UNAVAILABLE'); END IF;

  RETURN jsonb_build_object('currency', 'MXN', 'cartRevision', cart_row.revision::text,
    'lines', history_lines, 'subtotalCents', subtotal::text, 'discountCents', discount::text,
    'itemsTaxCents', items_tax::text, 'shippingCents', shipping::text, 'shippingTaxCents', shipping_tax::text,
    'shippingTaxBps', delivery.rate_bps, 'totalCents', (subtotal-discount+items_tax+shipping+shipping_tax)::text,
    'zoneId', delivery.zone_id, 'deliveryMethod', delivery_code, 'deliveryLabel', delivery.method_label,
    'etaMinDays', delivery.eta_min_days, 'etaMaxDays', delivery.eta_max_days, 'couponId', coupon_key,
    'couponCode', coupon_row.code, 'documents', documents, 'address', to_jsonb(address_row) - ARRAY['created_at','updated_at']);
END $$;

CREATE FUNCTION nexa_internal.finish_purchase(
  command_key uuid, actor text, quote_row public.checkout_quote, purchase jsonb, contact_email text, accepted_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE order_key uuid;
DECLARE order_item_key uuid;
DECLARE line jsonb;
DECLARE address_row public.address;
DECLARE variant_key uuid;
DECLARE units integer;
DECLARE delivery_day date := (statement_timestamp() AT TIME ZONE 'America/Matamoros')::date;
BEGIN
  IF contact_email IS NULL OR contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  THEN PERFORM nexa_internal.reject('CONTACT_EMAIL_REQUIRED'); END IF;
  INSERT INTO public.customer_order(user_uid, cart_id, quote_id, folio, contact_email,
    subtotal_cents, discount_cents, items_tax_cents, shipping_cents, shipping_tax_cents, shipping_tax_bps, total_cents, confirmed_at)
  VALUES (actor, quote_row.cart_id, quote_row.id, 'NX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)),
    contact_email, (purchase->>'subtotalCents')::bigint, (purchase->>'discountCents')::bigint,
    (purchase->>'itemsTaxCents')::bigint, (purchase->>'shippingCents')::bigint, (purchase->>'shippingTaxCents')::bigint,
    (purchase->>'shippingTaxBps')::integer, (purchase->>'totalCents')::bigint, statement_timestamp())
  RETURNING id INTO order_key;

  SELECT * INTO STRICT address_row FROM public.address WHERE id = quote_row.address_id;
  INSERT INTO public.order_address(order_id, recipient, phone, line1, line2, district, city, state_code, postal_code, country_code)
  VALUES (order_key, address_row.recipient, address_row.phone, address_row.line1, address_row.line2, address_row.district,
    address_row.city, address_row.state_code, address_row.postal_code, address_row.country_code);

  FOR line IN SELECT value FROM jsonb_array_elements(purchase->'lines') LOOP
    variant_key := (line->>'variantId')::uuid;
    units := (line->>'quantity')::integer;
    UPDATE public.product_variant SET stock_on_hand = stock_on_hand - units
      WHERE id = variant_key AND stock_on_hand >= units;
    IF NOT FOUND THEN PERFORM nexa_internal.reject('STOCK_UNAVAILABLE'); END IF;
    INSERT INTO public.order_item(order_id, variant_id, sku_snapshot, name_snapshot, option_snapshot, description_snapshot,
      quantity, unit_price_cents, discount_cents, tax_bps, tax_cents)
    VALUES (order_key, variant_key, line->>'sku', line->>'name', line->>'option', line->>'description', units,
      (line->>'priceCents')::bigint, (line->>'discountCents')::bigint, (line->>'taxBps')::integer, (line->>'taxCents')::bigint)
    RETURNING id INTO order_item_key;
    INSERT INTO public.inventory_movement(variant_id, command_id, order_item_id, kind, delta, reason)
    VALUES (variant_key, command_key, order_item_key, 'SALE', -units, 'Compra confirmada');
  END LOOP;

  INSERT INTO public.shipment(order_id, method_snapshot, estimated_from, estimated_to)
  VALUES (order_key, purchase->>'deliveryLabel', delivery_day + (purchase->>'etaMinDays')::integer,
    delivery_day + (purchase->>'etaMaxDays')::integer);
  INSERT INTO public.terms_acceptance(order_id, legal_document_id, evidence_kind, presented_at)
    SELECT order_key, value::uuid, CASE WHEN key = 'TERMS' THEN 'ACCEPTED' ELSE 'PRESENTED' END, accepted_at
    FROM jsonb_each_text(purchase->'documents');
  IF quote_row.coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemption(order_id, coupon_id, code_snapshot)
    VALUES (order_key, quote_row.coupon_id, purchase->>'couponCode');
  END IF;
  UPDATE public.cart SET status = 'CONVERTED' WHERE id = quote_row.cart_id;
  INSERT INTO public.order_status_event(order_id, command_id, new_status) VALUES (order_key, command_key, 'PAID');
  INSERT INTO public.notification(user_uid, command_id, order_id, kind)
  VALUES (actor, command_key, order_key, 'ORDER_CONFIRMED');
  RETURN order_key;
END $$;

CREATE FUNCTION nexa_internal.checkout(command_row public.commerce_command)
RETURNS TABLE(code text, resource_id uuid)
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE data jsonb := command_row.input;
DECLARE quote_row public.checkout_quote;
DECLARE payment_row public.payment;
DECLARE scenario text := data->>'scenario';
DECLARE purchase jsonb;
DECLARE order_key uuid;
DECLARE new_payment uuid;
DECLARE elapsed_issue text;
DECLARE resolving boolean := command_row.kind = 'RESOLVE_PAYMENT';
BEGIN
  IF scenario IS NULL OR scenario NOT IN ('APPROVE', 'DECLINE', 'PENDING') OR (resolving AND scenario = 'PENDING')
  THEN PERFORM nexa_internal.reject('INVALID_SIMULATION'); END IF;
  IF resolving THEN
    SELECT p.* INTO payment_row FROM public.payment p JOIN public.commerce_command cc ON cc.id = p.checkout_command_id
      WHERE p.id = (data->>'paymentId')::uuid AND cc.actor_uid = command_row.actor_uid FOR NO KEY UPDATE OF p;
    IF NOT FOUND THEN PERFORM nexa_internal.reject('PAYMENT_UNAVAILABLE'); END IF;
    IF payment_row.status <> 'PENDING' THEN PERFORM nexa_internal.reject('PAYMENT_ALREADY_DECIDED'); END IF;
    SELECT * INTO STRICT quote_row FROM public.checkout_quote WHERE id = payment_row.quote_id;
  ELSE
    SELECT q.* INTO quote_row FROM public.checkout_quote q JOIN public.cart c ON c.id = q.cart_id
      WHERE q.id = (data->>'quoteId')::uuid AND c.user_uid = command_row.actor_uid;
    IF NOT FOUND THEN PERFORM nexa_internal.reject('QUOTE_UNAVAILABLE'); END IF;
    IF (data->>'accepted')::boolean IS DISTINCT FROM true
      OR (data->>'termsId')::uuid IS DISTINCT FROM (quote_row.summary->'documents'->>'TERMS')::uuid
    THEN PERFORM nexa_internal.reject('TERMS_REQUIRED'); END IF;
  END IF;

  BEGIN
    IF quote_row.expires_at <= statement_timestamp() THEN PERFORM nexa_internal.reject('QUOTE_EXPIRED'); END IF;
    purchase := nexa_internal.quote_summary(command_row.actor_uid, quote_row.cart_id, quote_row.address_id, quote_row.method_code, quote_row.coupon_id);
    IF encode(sha256(convert_to(purchase::text, 'UTF8')), 'hex') <> quote_row.pricing_digest
    THEN PERFORM nexa_internal.reject('QUOTE_CHANGED'); END IF;
  EXCEPTION WHEN SQLSTATE 'NX001' THEN
    IF NOT resolving THEN RAISE; END IF;
    GET STACKED DIAGNOSTICS elapsed_issue = MESSAGE_TEXT;
    UPDATE public.payment SET status = 'DECLINED', decision_code = elapsed_issue, decided_at = statement_timestamp()
      WHERE id = payment_row.id;
    RETURN QUERY SELECT elapsed_issue, payment_row.id;
    RETURN;
  END;

  IF scenario = 'APPROVE' THEN
    order_key := nexa_internal.finish_purchase(command_row.id, command_row.actor_uid, quote_row, purchase,
      data->>'email', coalesce(payment_row.terms_accepted_at, statement_timestamp()));
  END IF;

  IF resolving THEN
    UPDATE public.payment SET order_id = order_key, status = CASE WHEN order_key IS NULL THEN 'DECLINED' ELSE 'APPROVED' END,
      decided_at = statement_timestamp(), decision_code = CASE WHEN order_key IS NULL THEN 'TEST_DECLINED' ELSE 'TEST_APPROVED' END
      WHERE id = payment_row.id RETURNING id INTO new_payment;
  ELSE
    INSERT INTO public.payment(quote_id, order_id, checkout_command_id, provider_reference, status, amount_cents,
      terms_accepted_at, decided_at, decision_code)
    VALUES (quote_row.id, order_key, command_row.id, 'SIM-' || command_row.id::text,
      CASE scenario WHEN 'APPROVE' THEN 'APPROVED' WHEN 'DECLINE' THEN 'DECLINED' ELSE 'PENDING' END,
      (purchase->>'totalCents')::bigint, statement_timestamp(),
      CASE WHEN scenario <> 'PENDING' THEN statement_timestamp() END,
      CASE scenario WHEN 'APPROVE' THEN 'TEST_APPROVED' WHEN 'DECLINE' THEN 'TEST_DECLINED' END)
    RETURNING id INTO new_payment;
  END IF;
  IF order_key IS NOT NULL THEN RETURN QUERY SELECT 'ORDER_CONFIRMED'::text, order_key;
  ELSIF scenario = 'PENDING' THEN RETURN QUERY SELECT 'PAYMENT_PENDING'::text, new_payment;
  ELSE RETURN QUERY SELECT 'PAYMENT_DECLINED'::text, new_payment;
  END IF;
END $$;
