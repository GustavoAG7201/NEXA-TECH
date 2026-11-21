CREATE FUNCTION nexa_internal.refund_or_replace(command_row public.commerce_command) RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE data jsonb := command_row.input;
DECLARE request_row public.return_request;
DECLARE order_row public.customer_order;
DECLARE payment_row public.payment;
DECLARE cancellation boolean;
DECLARE replacement boolean := command_row.kind = 'RESOLVE_REPLACEMENT';
DECLARE refund_key uuid;
DECLARE amount bigint := 0;
DECLARE shipping bigint := 0;
DECLARE previous_shipping bigint;
DECLARE previous_refunds bigint;
DECLARE allocation jsonb := '{}'::jsonb;
DECLARE line record;
DECLARE units integer;
DECLARE previous_units integer;
DECLARE line_total bigint;
DECLARE line_refund bigint;
DECLARE decision text;
DECLARE next_order text;
BEGIN
  SELECT * INTO request_row FROM public.return_request WHERE id = (data->>'id')::uuid;
  IF NOT FOUND THEN PERFORM nexa_internal.reject('RETURN_UNAVAILABLE'); END IF;
  SELECT * INTO STRICT order_row FROM public.customer_order WHERE id = request_row.order_id FOR NO KEY UPDATE;
  SELECT * INTO STRICT request_row FROM public.return_request WHERE id = request_row.id FOR NO KEY UPDATE;
  cancellation := request_row.kind = 'CANCELLATION';
  IF cancellation THEN
    IF replacement OR request_row.status <> 'APPROVED' OR order_row.status NOT IN ('PAID','PREPARING')
    THEN PERFORM nexa_internal.reject('CANCELLATION_UNAVAILABLE'); END IF;
  ELSIF request_row.status <> 'INSPECTED' THEN PERFORM nexa_internal.reject('INVALID_TRANSITION');
  END IF;

  IF replacement THEN
    IF request_row.kind NOT IN ('EXCHANGE','WARRANTY') THEN PERFORM nexa_internal.reject('INVALID_RESOLUTION'); END IF;
    FOR line IN SELECT ri.id, ri.received_qty, oi.variant_id FROM public.return_item ri
      JOIN public.order_item oi ON oi.id = ri.order_item_id
      WHERE ri.return_request_id = request_row.id AND ri.received_qty > 0 ORDER BY oi.variant_id
    LOOP
      UPDATE public.product_variant SET stock_on_hand = stock_on_hand - line.received_qty
        WHERE id = line.variant_id AND archived_at IS NULL AND stock_on_hand >= line.received_qty;
      IF NOT FOUND THEN PERFORM nexa_internal.reject('STOCK_UNAVAILABLE'); END IF;
      INSERT INTO public.inventory_movement(variant_id, command_id, return_item_id, kind, delta, reason)
      VALUES (line.variant_id, command_row.id, line.id, 'REPLACEMENT', -line.received_qty, 'Reposición del mismo SKU');
    END LOOP;
    IF NOT FOUND THEN PERFORM nexa_internal.reject('EMPTY_REPLACEMENT'); END IF;
    decision := 'REPLACEMENT';
  ELSE
    SELECT * INTO STRICT payment_row FROM public.payment WHERE order_id = order_row.id FOR NO KEY UPDATE;
    SELECT coalesce(sum(amount_cents), 0), coalesce(sum(shipping_refund_cents), 0)
      INTO previous_refunds, previous_shipping FROM public.refund
      WHERE payment_id = payment_row.id AND status IN ('APPROVED','PENDING');

    FOR line IN SELECT ri.id, ri.approved_qty, ri.received_qty, oi.id AS order_item_id, oi.variant_id, oi.quantity,
      oi.unit_price_cents, oi.discount_cents, oi.tax_cents FROM public.return_item ri
      JOIN public.order_item oi ON oi.id = ri.order_item_id
      WHERE ri.return_request_id = request_row.id ORDER BY oi.variant_id
    LOOP
      units := CASE WHEN cancellation THEN line.approved_qty ELSE line.received_qty END;
      IF units = 0 THEN CONTINUE; END IF;
      SELECT coalesce(sum(ri.received_qty), 0) INTO previous_units FROM public.refund_item fi
        JOIN public.refund rf ON rf.id = fi.refund_id JOIN public.return_item ri ON ri.id = fi.return_item_id
        WHERE rf.payment_id = payment_row.id AND rf.status IN ('APPROVED','PENDING') AND ri.order_item_id = line.order_item_id;
      IF previous_units + units > line.quantity THEN PERFORM nexa_internal.reject('REFUND_QUANTITY_EXCEEDED'); END IF;
      line_total := line.unit_price_cents * line.quantity - line.discount_cents + line.tax_cents;
      line_refund := (line_total / line.quantity) * units
        + greatest(least(line_total % line.quantity - previous_units, units), 0);
      IF line_refund > 0 THEN allocation := allocation || jsonb_build_object(line.id::text, line_refund); END IF;
      amount := amount + line_refund;

      IF cancellation THEN
        UPDATE public.product_variant SET stock_on_hand = stock_on_hand + units WHERE id = line.variant_id;
        INSERT INTO public.inventory_movement(variant_id, command_id, order_item_id, return_item_id, kind, delta, reason)
        VALUES (line.variant_id, command_row.id, line.order_item_id, line.id, 'CANCELLATION', units, 'Reversión previa al envío');
      END IF;
    END LOOP;

    IF cancellation OR (data->>'shipping')::boolean IS TRUE THEN
      shipping := order_row.shipping_cents + order_row.shipping_tax_cents - previous_shipping;
    END IF;
    amount := amount + shipping;
    IF amount + previous_refunds > payment_row.amount_cents OR (amount = 0 AND NOT cancellation) THEN
      PERFORM nexa_internal.reject('REFUND_AMOUNT_UNAVAILABLE');
    END IF;
    IF amount > 0 THEN
      INSERT INTO public.refund(payment_id, return_request_id, command_id, provider_reference, status, amount_cents,
        shipping_refund_cents, decided_at)
      VALUES (payment_row.id, request_row.id, command_row.id, 'SIM-R-' || command_row.id::text, 'APPROVED', amount,
        shipping, statement_timestamp()) RETURNING id INTO refund_key;
      INSERT INTO public.refund_item(refund_id, return_item_id, amount_cents)
        SELECT refund_key, key::uuid, value::bigint FROM jsonb_each_text(allocation);
    END IF;

    IF cancellation THEN
      next_order := 'CANCELLED';
      UPDATE public.shipment SET status = 'CANCELLED' WHERE order_id = order_row.id;
      decision := 'CANCELLED';
    ELSE
      IF amount + previous_refunds = payment_row.amount_cents THEN next_order := 'REFUNDED'; END IF;
      decision := 'REFUND';
    END IF;
    IF payment_row.amount_cents > 0 AND amount + previous_refunds = payment_row.amount_cents THEN
      UPDATE public.payment SET status = 'REFUNDED' WHERE id = payment_row.id;
    END IF;
    IF next_order IS NOT NULL THEN
      UPDATE public.customer_order SET status = next_order WHERE id = order_row.id;
      INSERT INTO public.order_status_event(order_id, command_id, previous_status, new_status, reason)
      VALUES (order_row.id, command_row.id, order_row.status, next_order, data->>'detail');
    END IF;
  END IF;

  UPDATE public.return_request SET status = 'RESOLVED', resolution_code = decision, resolution_note = data->>'detail',
    closed_at = statement_timestamp() WHERE id = request_row.id;
  INSERT INTO public.return_event(return_request_id, command_id, previous_status, new_status, public_detail)
  VALUES (request_row.id, command_row.id, request_row.status, 'RESOLVED', data->>'detail');
  INSERT INTO public.notification(user_uid, command_id, return_request_id, kind)
  VALUES (order_row.user_uid, command_row.id, request_row.id, 'RETURN_RESOLVED');
  RETURN coalesce(refund_key, request_row.id);
END $$;

-- The emulator can reconcile its schema again after a GraphQL edit. Block
-- business writes if that reconciliation removes the supplemental protections.
CREATE FUNCTION nexa_internal.commerce_schema_ready() RETURNS boolean
LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT to_regclass('public.cart_one_active_per_user') IS NOT NULL
    AND to_regclass('public.inventory_one_sale_per_item') IS NOT NULL
    AND to_regclass('public.legal_one_current_per_kind') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM (VALUES
        ('public.product_variant'::regclass, 'variant_valid'),
        ('public.customer_order'::regclass, 'order_values_valid'),
        ('public.commerce_command'::regclass, 'command_valid')
      ) AS required(table_id, constraint_name)
      WHERE NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = required.table_id AND conname = required.constraint_name AND convalidated
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace AND contype = 'f' AND confdeltype IN ('c', 'n')
    );
$$;

CREATE FUNCTION nexa_internal.handle_command() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE command_result text := 'OK';
DECLARE command_status text := 'SUCCEEDED';
DECLARE resource uuid;
DECLARE is_admin_operation boolean := NEW.kind IN ('SAVE_CATEGORY','SAVE_PRODUCT','ARCHIVE_PRODUCT','SAVE_VARIANT',
  'SAVE_PRODUCT_IMAGE','ADJUST_INVENTORY','SAVE_COUPON','MODERATE_REVIEW','PUBLISH_POLICY','CHANGE_USER_ROLE',
  'RECORD_SHIPMENT','APPROVE_REFUND','RESOLVE_REPLACEMENT');
DECLARE is_staff_operation boolean := NEW.kind IN ('ASSIGN_CASE','REVIEW_RETURN','RECORD_INSPECTION','ASSIGN_TICKET','REPLY_TO_CUSTOMER');
DECLARE digest text := encode(sha256(convert_to(jsonb_build_array(NEW.input_version, NEW.kind, NEW.input)::text, 'UTF8')), 'hex');
BEGIN
  BEGIN
    IF NOT nexa_internal.commerce_schema_ready() THEN PERFORM nexa_internal.reject('SCHEMA_INCOMPLETE'); END IF;
    IF is_admin_operation THEN
      PERFORM nexa_internal.require_role(NEW.actor_uid, ARRAY['ADMIN']);
    ELSIF is_staff_operation THEN
      PERFORM nexa_internal.require_role(NEW.actor_uid, ARRAY['ADMIN','SUPPORT']);
    ELSE
      PERFORM nexa_internal.require_role(NEW.actor_uid, ARRAY['CUSTOMER']);
    END IF;

    CASE NEW.kind
      WHEN 'CONFIRM_CHECKOUT', 'RESOLVE_PAYMENT' THEN
        SELECT code, resource_id INTO command_result, resource FROM nexa_internal.checkout(NEW);
        IF command_result NOT IN ('ORDER_CONFIRMED', 'PAYMENT_PENDING') THEN command_status := 'REJECTED'; END IF;
      WHEN 'RECORD_SHIPMENT' THEN resource := nexa_internal.record_shipment(NEW);
      WHEN 'CREATE_RETURN' THEN resource := nexa_internal.open_return(NEW);
      WHEN 'ASSIGN_CASE', 'REVIEW_RETURN', 'RECORD_INSPECTION' THEN resource := nexa_internal.review_return(NEW);
      WHEN 'APPROVE_REFUND', 'RESOLVE_REPLACEMENT' THEN resource := nexa_internal.refund_or_replace(NEW);
      WHEN 'OPEN_TICKET','REPLY_TICKET','REPLY_TO_CUSTOMER','ASSIGN_TICKET','UPLOAD_EVIDENCE' THEN resource := nexa_internal.write_case(NEW);
      ELSE
        IF is_admin_operation THEN resource := nexa_internal.admin_change(NEW);
        ELSE resource := nexa_internal.account_change(NEW);
        END IF;
    END CASE;

    IF (is_admin_operation OR is_staff_operation OR command_result = 'ORDER_CONFIRMED') AND NEW.kind <> 'CHANGE_USER_ROLE' THEN
      INSERT INTO public.audit_log(actor_uid, command_id, action, entity_type, entity_key)
      VALUES (NEW.actor_uid, NEW.id, NEW.kind, 'COMMERCE_COMMAND', coalesce(resource, NEW.id)::text);
    END IF;
  EXCEPTION
    WHEN SQLSTATE 'NX001' THEN
      GET STACKED DIAGNOSTICS command_result = MESSAGE_TEXT;
      command_status := 'REJECTED';
      resource := NULL;
    WHEN data_exception OR integrity_constraint_violation THEN
      command_result := 'INVALID_DATA';
      command_status := 'REJECTED';
      resource := NULL;
  END;

  UPDATE public.commerce_command SET input = NULL, input_digest = digest, status = command_status,
    result_code = command_result, result_id = resource, completed_at = statement_timestamp()
  WHERE id = NEW.id;
  RETURN NULL;
END $$;

CREATE TRIGGER handle_commerce_command AFTER INSERT ON public.commerce_command
  FOR EACH ROW EXECUTE FUNCTION nexa_internal.handle_command();

REVOKE ALL ON SCHEMA nexa_internal FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA nexa_internal FROM PUBLIC;
