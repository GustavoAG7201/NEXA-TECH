CREATE FUNCTION nexa_internal.record_shipment(command_row public.commerce_command) RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE data jsonb := command_row.input;
DECLARE order_row public.customer_order;
DECLARE shipment_row public.shipment;
DECLARE requested text := data->>'event';
DECLARE next_order text;
BEGIN
  SELECT * INTO order_row FROM public.customer_order WHERE id = (data->>'orderId')::uuid FOR NO KEY UPDATE;
  IF NOT FOUND THEN PERFORM nexa_internal.reject('ORDER_UNAVAILABLE'); END IF;
  SELECT * INTO STRICT shipment_row FROM public.shipment WHERE order_id = order_row.id FOR NO KEY UPDATE;
  CASE requested
    WHEN 'PREPARING' THEN
      IF order_row.status <> 'PAID' OR shipment_row.status <> 'PLANNED' THEN PERFORM nexa_internal.reject('INVALID_TRANSITION'); END IF;
      next_order := 'PREPARING';
    WHEN 'SHIPPED' THEN
      IF order_row.status <> 'PREPARING' OR shipment_row.status <> 'PREPARING' THEN PERFORM nexa_internal.reject('INVALID_TRANSITION'); END IF;
      IF nullif(btrim(data->>'carrier'), '') IS NULL OR nullif(btrim(data->>'trackingCode'), '') IS NULL
      THEN PERFORM nexa_internal.reject('TRACKING_REQUIRED'); END IF;
      next_order := 'SHIPPED';
    WHEN 'DELIVERED' THEN
      IF shipment_row.status <> 'SHIPPED' THEN PERFORM nexa_internal.reject('INVALID_TRANSITION'); END IF;
      next_order := 'DELIVERED';
    WHEN 'DELIVERY_ATTEMPT_FAILED', 'INCIDENT', 'RETURNED_TO_SENDER' THEN
      IF shipment_row.status <> 'SHIPPED' THEN PERFORM nexa_internal.reject('INVALID_TRANSITION'); END IF;
    ELSE PERFORM nexa_internal.reject('INVALID_TRANSITION');
  END CASE;
  UPDATE public.shipment SET status = CASE WHEN next_order IS NOT NULL OR requested = 'RETURNED_TO_SENDER' THEN requested ELSE status END,
    carrier = CASE WHEN requested = 'SHIPPED' THEN btrim(data->>'carrier') ELSE carrier END,
    tracking_code = CASE WHEN requested = 'SHIPPED' THEN btrim(data->>'trackingCode') ELSE tracking_code END,
    shipped_at = CASE WHEN requested = 'SHIPPED' THEN statement_timestamp() ELSE shipped_at END,
    delivered_at = CASE WHEN requested = 'DELIVERED' THEN statement_timestamp() ELSE delivered_at END
    WHERE id = shipment_row.id;
  INSERT INTO public.shipment_event(shipment_id, command_id, event_type, public_detail, occurred_at)
  VALUES (shipment_row.id, command_row.id, requested, left(data->>'detail', 500), statement_timestamp());
  IF next_order IS NOT NULL THEN
    UPDATE public.customer_order SET status = next_order WHERE id = order_row.id;
    INSERT INTO public.order_status_event(order_id, command_id, previous_status, new_status)
    VALUES (order_row.id, command_row.id, order_row.status, next_order);
  END IF;
  INSERT INTO public.notification(user_uid, command_id, order_id, kind)
  VALUES (order_row.user_uid, command_row.id, order_row.id, 'SHIPMENT_UPDATED');
  RETURN shipment_row.id;
END $$;

CREATE FUNCTION nexa_internal.open_return(command_row public.commerce_command) RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE data jsonb := command_row.input;
DECLARE order_row public.customer_order;
DECLARE request_key uuid;
DECLARE requested_type text := data->>'kind';
DECLARE part record;
DECLARE bought public.order_item;
DECLARE commitments integer;
DECLARE items jsonb := data->'items';
BEGIN
  SELECT * INTO order_row FROM public.customer_order WHERE id = (data->>'orderId')::uuid
    AND user_uid = command_row.actor_uid FOR NO KEY UPDATE;
  IF NOT FOUND THEN PERFORM nexa_internal.reject('ORDER_UNAVAILABLE'); END IF;
  IF requested_type = 'CANCELLATION' THEN
    IF order_row.status NOT IN ('PAID','PREPARING') THEN PERFORM nexa_internal.reject('CANCELLATION_UNAVAILABLE'); END IF;
    SELECT jsonb_agg(jsonb_build_object('id', id, 'quantity', quantity)) INTO items FROM public.order_item WHERE order_id = order_row.id;
  ELSIF requested_type NOT IN ('RETURN','EXCHANGE','WARRANTY') OR order_row.status NOT IN ('SHIPPED','DELIVERED') THEN
    PERFORM nexa_internal.reject('RETURN_UNAVAILABLE');
  END IF;

  IF jsonb_typeof(items) IS DISTINCT FROM 'array' OR jsonb_array_length(items) NOT BETWEEN 1 AND 50
    OR (SELECT count(DISTINCT (value->>'id')::uuid) FROM jsonb_array_elements(items)) <> jsonb_array_length(items)
  THEN PERFORM nexa_internal.reject('INVALID_RETURN_ITEMS'); END IF;
  INSERT INTO public.return_request(order_id, folio, kind, reason_code, description)
  VALUES (order_row.id, 'NX-R-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)),
    requested_type, data->>'reason', data->>'description') RETURNING id INTO request_key;

  FOR part IN SELECT (value->>'id')::uuid AS item_id, (value->>'quantity')::integer AS units
    FROM jsonb_array_elements(items) ORDER BY 1 LOOP
    SELECT * INTO bought FROM public.order_item WHERE id = part.item_id AND order_id = order_row.id FOR SHARE;
    IF NOT FOUND THEN PERFORM nexa_internal.reject('ORDER_ITEM_UNAVAILABLE'); END IF;
    SELECT coalesce(sum(coalesce(ri.approved_qty, ri.requested_qty)), 0) INTO commitments
      FROM public.return_item ri JOIN public.return_request rr ON rr.id = ri.return_request_id
      WHERE ri.order_item_id = bought.id AND rr.status <> 'REJECTED';
    IF part.units IS NULL OR part.units <= 0 OR part.units > bought.quantity - commitments
    THEN PERFORM nexa_internal.reject('RETURN_QUANTITY_UNAVAILABLE'); END IF;
    INSERT INTO public.return_item(return_request_id, order_item_id, requested_qty)
    VALUES (request_key, bought.id, part.units);
  END LOOP;
  INSERT INTO public.return_event(return_request_id, command_id, new_status)
  VALUES (request_key, command_row.id, 'SUBMITTED');
  INSERT INTO public.notification(user_uid, command_id, return_request_id, kind)
  VALUES (command_row.actor_uid, command_row.id, request_key, 'RETURN_SUBMITTED');
  RETURN request_key;
END $$;

CREATE FUNCTION nexa_internal.write_case(command_row public.commerce_command) RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE data jsonb := command_row.input;
DECLARE actor text := command_row.actor_uid;
DECLARE request_row public.return_request;
DECLARE ticket_row public.support_ticket;
DECLARE resource uuid;
DECLARE contents bytea;
DECLARE encoded text;
DECLARE media text;
DECLARE is_staff boolean := command_row.kind IN ('REPLY_TO_CUSTOMER', 'ASSIGN_TICKET');
DECLARE is_admin boolean;
DECLARE target_actor text;
BEGIN
  CASE command_row.kind
    WHEN 'OPEN_TICKET' THEN
      IF data->>'orderId' IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.customer_order WHERE id = (data->>'orderId')::uuid AND user_uid = actor
      ) THEN PERFORM nexa_internal.reject('ORDER_UNAVAILABLE'); END IF;
      INSERT INTO public.support_ticket(requester_uid, order_id, folio, subject)
      VALUES (actor, (data->>'orderId')::uuid, 'NX-S-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)),
        btrim(data->>'subject')) RETURNING id INTO resource;
      INSERT INTO public.support_message(ticket_id, author_uid, body) VALUES (resource, actor, btrim(data->>'body'));
    WHEN 'REPLY_TICKET', 'REPLY_TO_CUSTOMER', 'ASSIGN_TICKET' THEN
      SELECT * INTO ticket_row FROM public.support_ticket WHERE id = (data->>'id')::uuid FOR NO KEY UPDATE;
      is_admin := is_staff AND EXISTS (SELECT 1 FROM public.user_role WHERE user_uid = actor AND role_code = 'ADMIN');
      IF NOT FOUND OR (NOT is_staff AND ticket_row.requester_uid <> actor)
        OR (is_staff AND NOT is_admin AND ticket_row.assigned_to_uid IS DISTINCT FROM actor
          AND NOT (command_row.kind = 'ASSIGN_TICKET' AND ticket_row.assigned_to_uid IS NULL))
      THEN PERFORM nexa_internal.reject('TICKET_UNAVAILABLE'); END IF;
      IF command_row.kind = 'ASSIGN_TICKET' THEN
        target_actor := coalesce(data->>'assignedTo', actor);
        IF NOT is_admin AND target_actor <> actor THEN PERFORM nexa_internal.reject('FORBIDDEN'); END IF;
        PERFORM nexa_internal.require_role(target_actor, ARRAY['SUPPORT','ADMIN']);
        UPDATE public.support_ticket SET assigned_to_uid = target_actor, status = 'IN_PROGRESS', closed_at = NULL WHERE id = ticket_row.id;
      ELSE
        INSERT INTO public.support_message(ticket_id, author_uid, body, visibility)
        VALUES (ticket_row.id, actor, btrim(data->>'body'),
          CASE WHEN is_staff AND (data->>'internal')::boolean THEN 'STAFF_ONLY' ELSE 'CUSTOMER_VISIBLE' END);
        IF NOT is_staff OR (data->>'internal')::boolean IS DISTINCT FROM true THEN
          UPDATE public.support_ticket SET status = CASE WHEN NOT is_staff THEN 'IN_PROGRESS'
            WHEN (data->>'close')::boolean THEN 'RESOLVED' ELSE 'WAITING_CUSTOMER' END,
            closed_at = CASE WHEN is_staff AND (data->>'close')::boolean THEN statement_timestamp() END WHERE id = ticket_row.id;
        END IF;
        IF is_staff AND (data->>'internal')::boolean IS DISTINCT FROM true THEN
          INSERT INTO public.notification(user_uid, command_id, support_ticket_id, kind)
          VALUES (ticket_row.requester_uid, command_row.id, ticket_row.id, 'SUPPORT_REPLY');
        END IF;
      END IF;
      resource := ticket_row.id;
    WHEN 'UPLOAD_EVIDENCE' THEN
      SELECT rr.* INTO request_row FROM public.return_request rr JOIN public.customer_order o ON o.id = rr.order_id
        WHERE rr.id = (data->>'id')::uuid AND o.user_uid = actor FOR NO KEY UPDATE OF rr;
      IF NOT FOUND OR request_row.status IN ('RESOLVED','REJECTED') THEN PERFORM nexa_internal.reject('RETURN_UNAVAILABLE'); END IF;
      IF (SELECT count(*) FROM public.return_evidence WHERE return_request_id = request_row.id AND deleted_at IS NULL) >= 5
      THEN PERFORM nexa_internal.reject('EVIDENCE_LIMIT'); END IF;
      encoded := data->>'content';
      media := data->>'media';
      IF encoded IS NULL OR length(encoded) > 349528 THEN PERFORM nexa_internal.reject('INVALID_EVIDENCE'); END IF;
      contents := decode(encoded, 'base64');
      IF octet_length(contents) NOT BETWEEN 4 AND 262144
        OR NOT coalesce(CASE media WHEN 'image/png' THEN substring(contents FOR 8) = decode('89504e470d0a1a0a','hex')
          WHEN 'image/jpeg' THEN substring(contents FOR 3) = decode('ffd8ff','hex') ELSE false END, false)
      THEN PERFORM nexa_internal.reject('INVALID_EVIDENCE'); END IF;
      INSERT INTO public.return_evidence(return_request_id, uploaded_by_uid, media_type, content_b64, size_bytes, sha256)
      VALUES (request_row.id, actor, media, encoded, octet_length(contents), encode(sha256(contents), 'hex')) RETURNING id INTO resource;
    ELSE
      PERFORM nexa_internal.reject('UNKNOWN_COMMAND');
  END CASE;
  RETURN resource;
END $$;

CREATE FUNCTION nexa_internal.review_return(command_row public.commerce_command) RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE data jsonb := command_row.input;
DECLARE actor text := command_row.actor_uid;
DECLARE request_row public.return_request;
DECLARE order_row public.customer_order;
DECLARE next_state text := data->>'state';
DECLARE actor_is_admin boolean;
DECLARE target_actor text;
DECLARE item record;
DECLARE units integer;
BEGIN
  SELECT * INTO request_row FROM public.return_request WHERE id = (data->>'id')::uuid;
  IF NOT FOUND THEN PERFORM nexa_internal.reject('RETURN_UNAVAILABLE'); END IF;
  SELECT * INTO STRICT order_row FROM public.customer_order WHERE id = request_row.order_id FOR NO KEY UPDATE;
  SELECT * INTO STRICT request_row FROM public.return_request WHERE id = request_row.id FOR NO KEY UPDATE;
  actor_is_admin := EXISTS (SELECT 1 FROM public.user_role WHERE user_uid = actor AND role_code = 'ADMIN');
  IF command_row.kind = 'ASSIGN_CASE' THEN
    IF request_row.status IN ('RESOLVED','REJECTED')
      OR (request_row.assigned_to_uid IS NOT NULL AND NOT actor_is_admin)
    THEN PERFORM nexa_internal.reject('RETURN_UNAVAILABLE'); END IF;
    target_actor := coalesce(data->>'assignedTo', actor);
    IF NOT actor_is_admin AND target_actor <> actor THEN PERFORM nexa_internal.reject('FORBIDDEN'); END IF;
    PERFORM nexa_internal.require_role(target_actor, ARRAY['SUPPORT','ADMIN']);
    UPDATE public.return_request SET assigned_to_uid = target_actor WHERE id = request_row.id;
    IF request_row.status <> 'SUBMITTED' THEN RETURN request_row.id; END IF;
    next_state := 'IN_REVIEW';
  ELSE
    IF NOT actor_is_admin AND request_row.assigned_to_uid IS DISTINCT FROM actor
    THEN PERFORM nexa_internal.reject('RETURN_UNAVAILABLE'); END IF;
    IF command_row.kind = 'RECORD_INSPECTION' THEN
      IF request_row.status NOT IN ('AWAITING_ITEM','RECEIVED') THEN PERFORM nexa_internal.reject('INVALID_TRANSITION'); END IF;
      IF jsonb_typeof(data->'items') IS DISTINCT FROM 'array'
        OR (SELECT count(DISTINCT (value->>'id')::uuid) FROM jsonb_array_elements(data->'items'))
          <> (SELECT count(*) FROM public.return_item WHERE return_request_id = request_row.id)
      THEN PERFORM nexa_internal.reject('INVALID_RETURN_ITEMS'); END IF;
      FOR item IN SELECT (value->>'id')::uuid AS id, (value->>'quantity')::integer AS received,
        (value->>'restock')::integer AS restock, value->>'condition' AS condition
        FROM jsonb_array_elements(data->'items') ORDER BY 1 LOOP
        IF item.received IS NULL OR item.restock IS NULL OR item.restock NOT BETWEEN 0 AND item.received
        THEN PERFORM nexa_internal.reject('INVALID_RETURN_ITEMS'); END IF;
        UPDATE public.return_item SET received_qty = item.received, condition_code = item.condition,
          inspection_note = data->>'detail'
          WHERE id = item.id AND return_request_id = request_row.id AND item.received BETWEEN 0 AND approved_qty;
        IF NOT FOUND THEN PERFORM nexa_internal.reject('INVALID_RETURN_ITEMS'); END IF;
      END LOOP;

      FOR item IN
        SELECT ri.id, oi.variant_id, (entry.value->>'restock')::integer AS restock
        FROM jsonb_array_elements(data->'items') AS entry(value)
        JOIN public.return_item ri ON ri.id = (entry.value->>'id')::uuid
        JOIN public.order_item oi ON oi.id = ri.order_item_id
        WHERE ri.return_request_id = request_row.id AND (entry.value->>'restock')::integer > 0 ORDER BY oi.variant_id
      LOOP
        IF NOT actor_is_admin THEN PERFORM nexa_internal.reject('INVENTORY_ADMIN_REQUIRED'); END IF;
        units := item.restock;
        UPDATE public.product_variant SET stock_on_hand = stock_on_hand + units WHERE id = item.variant_id;
        UPDATE public.return_item SET restocked_qty = units WHERE id = item.id;
        INSERT INTO public.inventory_movement(variant_id, command_id, return_item_id, kind, delta, reason)
        VALUES (item.variant_id, command_row.id, item.id, 'RESTOCK', units, 'Inspección de mercancía vendible');
      END LOOP;
      next_state := 'INSPECTED';
      IF request_row.status = 'AWAITING_ITEM' THEN
        INSERT INTO public.return_event(return_request_id, command_id, previous_status, new_status)
        VALUES (request_row.id, command_row.id, 'AWAITING_ITEM', 'RECEIVED');
        request_row.status := 'RECEIVED';
      END IF;
    ELSE
      IF NOT coalesce(CASE request_row.status
        WHEN 'SUBMITTED' THEN next_state = 'IN_REVIEW'
        WHEN 'IN_REVIEW' THEN next_state IN ('NEEDS_INFO','APPROVED','REJECTED')
        WHEN 'NEEDS_INFO' THEN next_state = 'IN_REVIEW'
        WHEN 'APPROVED' THEN next_state = 'AWAITING_ITEM' AND request_row.kind <> 'CANCELLATION'
        WHEN 'INSPECTED' THEN next_state = 'RESOLVED' AND data->>'resolution' IN ('REPAIR','NO_REFUND')
        ELSE false END, false)
      THEN PERFORM nexa_internal.reject('INVALID_TRANSITION'); END IF;
      IF next_state IN ('NEEDS_INFO','REJECTED','RESOLVED') AND nullif(btrim(data->>'detail'), '') IS NULL
      THEN PERFORM nexa_internal.reject('REASON_REQUIRED'); END IF;
      IF next_state = 'APPROVED' THEN
        UPDATE public.return_item SET approved_qty = requested_qty WHERE return_request_id = request_row.id;
      END IF;
    END IF;
  END IF;

  UPDATE public.return_request SET status = next_state,
    resolution_code = CASE WHEN next_state IN ('REJECTED','RESOLVED') THEN coalesce(data->>'resolution', 'REJECTED') END,
    resolution_note = CASE WHEN next_state IN ('REJECTED','RESOLVED') THEN data->>'detail' END,
    closed_at = CASE WHEN next_state IN ('REJECTED','RESOLVED') THEN statement_timestamp() END
    WHERE id = request_row.id;
  INSERT INTO public.return_event(return_request_id, command_id, previous_status, new_status, public_detail)
  VALUES (request_row.id, command_row.id, request_row.status, next_state, data->>'detail');
  INSERT INTO public.notification(user_uid, command_id, return_request_id, kind)
  VALUES (order_row.user_uid, command_row.id, request_row.id, 'RETURN_UPDATED');
  RETURN request_row.id;
END $$;
