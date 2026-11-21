CREATE FUNCTION nexa_internal.account_change(command_row public.commerce_command) RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE actor text := command_row.actor_uid;
DECLARE data jsonb := command_row.input;
DECLARE resource uuid;
DECLARE variant_key uuid;
DECLARE cart_key uuid;
DECLARE address_key uuid;
DECLARE coupon_key uuid;
DECLARE purchase jsonb;
DECLARE item jsonb;
BEGIN
  CASE command_row.kind
    WHEN 'UPDATE_PROFILE' THEN
      UPDATE public.app_user SET display_name = btrim(data->>'name'), phone = nullif(btrim(data->>'phone'), '') WHERE uid = actor;
    WHEN 'SAVE_ADDRESS' THEN
      -- Serialize updates to a customer's default address.
      PERFORM pg_advisory_xact_lock(752197, hashtext(actor));
      resource := coalesce((data->>'id')::uuid, gen_random_uuid());
      IF data->>'id' IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.address WHERE id = resource AND user_uid = actor AND archived_at IS NULL
      ) THEN PERFORM nexa_internal.reject('ADDRESS_UNAVAILABLE'); END IF;
      IF coalesce((data->>'primary')::boolean, false) THEN
        UPDATE public.address SET is_default = false WHERE user_uid = actor AND is_default AND id <> resource;
      END IF;
      INSERT INTO public.address(id, user_uid, label, recipient, phone, line1, line2, district, city, state_code, postal_code, is_default)
      VALUES (resource, actor, btrim(data->>'label'), btrim(data->>'recipient'), btrim(data->>'phone'), btrim(data->>'line1'),
        nullif(btrim(data->>'line2'), ''), btrim(data->>'district'), btrim(data->>'city'), upper(data->>'stateCode'),
        data->>'postalCode', coalesce((data->>'primary')::boolean, false))
      ON CONFLICT (id) DO UPDATE SET label = excluded.label, recipient = excluded.recipient, phone = excluded.phone,
        line1 = excluded.line1, line2 = excluded.line2, district = excluded.district, city = excluded.city,
        state_code = excluded.state_code, postal_code = excluded.postal_code, is_default = excluded.is_default
      WHERE address.user_uid = actor AND address.archived_at IS NULL;
      IF NOT FOUND THEN PERFORM nexa_internal.reject('ADDRESS_UNAVAILABLE'); END IF;
    WHEN 'ARCHIVE_ADDRESS' THEN
      PERFORM pg_advisory_xact_lock(752197, hashtext(actor));
      UPDATE public.address SET archived_at = statement_timestamp(), is_default = false
        WHERE id = (data->>'id')::uuid AND user_uid = actor AND archived_at IS NULL RETURNING id INTO resource;
      IF NOT FOUND THEN PERFORM nexa_internal.reject('ADDRESS_UNAVAILABLE'); END IF;
    WHEN 'SET_FAVORITE' THEN
      resource := (data->>'productId')::uuid;
      IF (data->>'enabled')::boolean THEN
        IF NOT EXISTS (SELECT 1 FROM public.product WHERE id = resource AND status = 'ACTIVE')
        THEN PERFORM nexa_internal.reject('PRODUCT_UNAVAILABLE'); END IF;
        INSERT INTO public.favorite(user_uid, product_id) VALUES (actor, resource) ON CONFLICT DO NOTHING;
      ELSE
        DELETE FROM public.favorite WHERE user_uid = actor AND product_id = resource;
      END IF;
    WHEN 'SET_CART_ITEM', 'MERGE_CART' THEN
      cart_key := nexa_internal.active_cart(actor);
      IF command_row.kind = 'SET_CART_ITEM' THEN
        PERFORM nexa_internal.set_cart_item(cart_key, (data->>'variantId')::uuid, (data->>'quantity')::integer, false);
      ELSE
        IF jsonb_typeof(data->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(data->'items') NOT BETWEEN 1 AND 50
        THEN PERFORM nexa_internal.reject('CART_LIMIT'); END IF;
        IF (SELECT count(DISTINCT (value->>'variantId')::uuid) FROM jsonb_array_elements(data->'items'))
            <> jsonb_array_length(data->'items')
        THEN PERFORM nexa_internal.reject('DUPLICATE_VARIANT'); END IF;
        FOR item IN SELECT value FROM jsonb_array_elements(data->'items') ORDER BY (value->>'variantId')::uuid LOOP
          PERFORM nexa_internal.set_cart_item(cart_key, (item->>'variantId')::uuid, (item->>'quantity')::integer, true);
        END LOOP;
      END IF;
      UPDATE public.cart SET revision = revision + 1 WHERE id = cart_key RETURNING id INTO resource;
    WHEN 'QUOTE_CHECKOUT' THEN
      cart_key := (data->>'cartId')::uuid;
      address_key := (data->>'addressId')::uuid;
      IF nullif(btrim(data->>'couponCode'), '') IS NOT NULL THEN
        SELECT id INTO coupon_key FROM public.coupon WHERE code = upper(btrim(data->>'couponCode'));
        IF NOT FOUND THEN PERFORM nexa_internal.reject('COUPON_UNAVAILABLE'); END IF;
      END IF;
      purchase := nexa_internal.quote_summary(actor, cart_key, address_key, data->>'deliveryMethod', coupon_key);
      INSERT INTO public.checkout_quote(cart_id, address_id, zone_id, method_code, coupon_id, cart_revision,
        pricing_digest, summary, expires_at)
      VALUES (cart_key, address_key, (purchase->>'zoneId')::uuid, data->>'deliveryMethod', coupon_key,
        (purchase->>'cartRevision')::bigint, encode(sha256(convert_to(purchase::text, 'UTF8')), 'hex'),
        purchase, statement_timestamp() + interval '15 minutes')
      RETURNING id INTO resource;
    WHEN 'MARK_NOTIFICATION_READ' THEN
      UPDATE public.notification SET read_at = coalesce(read_at, statement_timestamp())
        WHERE id = (data->>'id')::uuid AND user_uid = actor RETURNING id INTO resource;
      IF NOT FOUND THEN PERFORM nexa_internal.reject('NOTIFICATION_UNAVAILABLE'); END IF;
    WHEN 'SUBMIT_REVIEW' THEN
      SELECT v.product_id INTO variant_key
        FROM public.order_item oi JOIN public.customer_order o ON o.id = oi.order_id
        JOIN public.product_variant v ON v.id = oi.variant_id
        WHERE oi.id = (data->>'orderItemId')::uuid AND o.user_uid = actor AND o.status = 'DELIVERED'
        FOR SHARE OF o;
      IF NOT FOUND THEN PERFORM nexa_internal.reject('ORDER_ITEM_UNAVAILABLE'); END IF;
      INSERT INTO public.review(author_uid, product_id, order_item_id, rating, body)
      VALUES (actor, variant_key, (data->>'orderItemId')::uuid, (data->>'rating')::integer, data->>'body')
      RETURNING id INTO resource;
    ELSE
      PERFORM nexa_internal.reject('UNKNOWN_COMMAND');
  END CASE;
  RETURN resource;
END $$;

CREATE FUNCTION nexa_internal.admin_change(command_row public.commerce_command) RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE actor text := command_row.actor_uid;
DECLARE data jsonb := command_row.input;
DECLARE resource uuid;
DECLARE subject_uid text;
DECLARE arg_code text;
DECLARE stock_delta integer;
DECLARE role_enabled boolean;
BEGIN
  CASE command_row.kind
    WHEN 'SAVE_CATEGORY' THEN
      IF data->>'id' IS NULL THEN
        INSERT INTO public.category(slug, name, description)
          VALUES (lower(btrim(data->>'slug')), btrim(data->>'name'), data->>'description') RETURNING id INTO resource;
      ELSE
        UPDATE public.category SET name = btrim(data->>'name'), description = data->>'description',
          archived_at = CASE WHEN coalesce((data->>'archived')::boolean, false) THEN coalesce(archived_at, statement_timestamp()) END
          WHERE id = (data->>'id')::uuid RETURNING id INTO resource;
        IF NOT FOUND THEN PERFORM nexa_internal.reject('CATEGORY_UNAVAILABLE'); END IF;
      END IF;
    WHEN 'SAVE_PRODUCT' THEN
      IF data->>'status' NOT IN ('ACTIVE', 'DRAFT') THEN PERFORM nexa_internal.reject('INVALID_PRODUCT_STATE'); END IF;
      IF data->>'id' IS NULL THEN
        INSERT INTO public.product(category_id, slug, name, description, specs, featured)
        VALUES ((data->>'categoryId')::uuid, lower(btrim(data->>'slug')), btrim(data->>'name'), btrim(data->>'description'),
          nullif(data->'specs','null'::jsonb), coalesce((data->>'featured')::boolean, false)) RETURNING id INTO resource;
      ELSE
        IF data->>'status' = 'ACTIVE' AND NOT EXISTS (
          SELECT 1 FROM public.product_variant WHERE product_id = (data->>'id')::uuid AND archived_at IS NULL
        ) THEN PERFORM nexa_internal.reject('NO_SELLABLE_VARIANT'); END IF;
        UPDATE public.product SET category_id = (data->>'categoryId')::uuid, name = btrim(data->>'name'),
          description = btrim(data->>'description'), specs = nullif(data->'specs','null'::jsonb), status = data->>'status',
          archived_at = NULL, featured = coalesce((data->>'featured')::boolean, false)
          WHERE id = (data->>'id')::uuid RETURNING id INTO resource;
        IF NOT FOUND THEN PERFORM nexa_internal.reject('PRODUCT_UNAVAILABLE'); END IF;
      END IF;
    WHEN 'ARCHIVE_PRODUCT' THEN
      UPDATE public.product SET status = 'ARCHIVED', archived_at = coalesce(archived_at, statement_timestamp())
        WHERE id = (data->>'id')::uuid RETURNING id INTO resource;
      IF NOT FOUND THEN PERFORM nexa_internal.reject('PRODUCT_UNAVAILABLE'); END IF;
    WHEN 'SAVE_VARIANT' THEN
      IF data->>'id' IS NULL THEN
        INSERT INTO public.product_variant(product_id, tax_class_code, sku, option_label, color, unit_price_cents, compare_at_cents,
          unit_cost_cents, low_stock_threshold, weight_g, length_mm, width_mm, height_mm)
        VALUES ((data->>'productId')::uuid, data->>'taxClass', upper(btrim(data->>'sku')), btrim(data->>'label'),
          data->>'color', (data->>'price')::bigint, (data->>'compareAt')::bigint, (data->>'cost')::bigint,
          (data->>'threshold')::integer, (data->>'weight')::integer, (data->>'length')::integer,
          (data->>'width')::integer, (data->>'height')::integer) RETURNING id INTO resource;
      ELSE
        UPDATE public.product_variant SET tax_class_code = data->>'taxClass', option_label = btrim(data->>'label'),
          color = data->>'color', unit_price_cents = (data->>'price')::bigint, compare_at_cents = (data->>'compareAt')::bigint,
          unit_cost_cents = (data->>'cost')::bigint, low_stock_threshold = (data->>'threshold')::integer,
          weight_g = (data->>'weight')::integer, length_mm = (data->>'length')::integer,
          width_mm = (data->>'width')::integer, height_mm = (data->>'height')::integer,
          archived_at = CASE WHEN coalesce((data->>'archived')::boolean, false) THEN coalesce(archived_at, statement_timestamp()) END
        WHERE id = (data->>'id')::uuid AND product_id = (data->>'productId')::uuid
        RETURNING id INTO resource;
        IF NOT FOUND THEN PERFORM nexa_internal.reject('VARIANT_UNAVAILABLE'); END IF;
      END IF;
    WHEN 'SAVE_PRODUCT_IMAGE' THEN
      IF data->>'id' IS NULL THEN
        INSERT INTO public.product_image(product_id, src, alt, position, credit)
        VALUES ((data->>'productId')::uuid, data->>'src', btrim(data->>'alt'), (data->>'position')::integer, data->>'credit')
        RETURNING id INTO resource;
      ELSE
        UPDATE public.product_image SET src = data->>'src', alt = btrim(data->>'alt'), position = (data->>'position')::integer,
          credit = data->>'credit' WHERE id = (data->>'id')::uuid AND product_id = (data->>'productId')::uuid
        RETURNING id INTO resource;
        IF NOT FOUND THEN PERFORM nexa_internal.reject('IMAGE_UNAVAILABLE'); END IF;
      END IF;
    WHEN 'ADJUST_INVENTORY' THEN
      resource := (data->>'variantId')::uuid;
      stock_delta := (data->>'delta')::integer;
      IF stock_delta IS NULL OR stock_delta = 0 THEN PERFORM nexa_internal.reject('INVALID_QUANTITY'); END IF;
      UPDATE public.product_variant SET stock_on_hand = stock_on_hand + stock_delta
        WHERE id = resource AND stock_on_hand::bigint + stock_delta BETWEEN 0 AND 2147483647;
      IF NOT FOUND THEN PERFORM nexa_internal.reject('STOCK_UNAVAILABLE'); END IF;
      INSERT INTO public.inventory_movement(variant_id, command_id, kind, delta, reason)
      VALUES (resource, command_row.id, 'ADJUSTMENT', stock_delta, btrim(data->>'reason'));
    WHEN 'SAVE_COUPON' THEN
      IF data->>'id' IS NULL THEN
        INSERT INTO public.coupon(code, kind, fixed_amount_cents, percentage_bps, min_subtotal_cents,
          starts_at, ends_at, total_limit, per_user_limit)
        VALUES (upper(btrim(data->>'code')), data->>'kind', (data->>'fixed')::bigint, (data->>'bps')::integer,
          (data->>'minimum')::bigint, (data->>'startsAt')::timestamptz, (data->>'endsAt')::timestamptz,
          (data->>'maxUses')::integer, (data->>'maxPerUser')::integer) RETURNING id INTO resource;
      ELSE
        UPDATE public.coupon SET kind = data->>'kind', fixed_amount_cents = (data->>'fixed')::bigint,
          percentage_bps = (data->>'bps')::integer, min_subtotal_cents = (data->>'minimum')::bigint,
          starts_at = (data->>'startsAt')::timestamptz, ends_at = (data->>'endsAt')::timestamptz,
          total_limit = (data->>'maxUses')::integer, per_user_limit = (data->>'maxPerUser')::integer,
          archived_at = CASE WHEN coalesce((data->>'archived')::boolean, false) THEN coalesce(archived_at, statement_timestamp()) END
          WHERE id = (data->>'id')::uuid RETURNING id INTO resource;
        IF NOT FOUND THEN PERFORM nexa_internal.reject('COUPON_UNAVAILABLE'); END IF;
      END IF;
    WHEN 'MODERATE_REVIEW' THEN
      UPDATE public.review SET moderation_status = CASE WHEN (data->>'approve')::boolean THEN 'APPROVED' ELSE 'REJECTED' END,
        moderated_by_uid = actor, moderated_at = statement_timestamp()
      WHERE id = (data->>'id')::uuid RETURNING id INTO resource;
      IF NOT FOUND THEN PERFORM nexa_internal.reject('REVIEW_UNAVAILABLE'); END IF;
    WHEN 'PUBLISH_POLICY' THEN
      arg_code := data->>'kind';
      PERFORM pg_advisory_xact_lock(752196, 1);
      UPDATE public.legal_document SET withdrawn_at = statement_timestamp()
        WHERE kind = arg_code AND published_at IS NOT NULL AND withdrawn_at IS NULL;
      INSERT INTO public.legal_document(kind, version, title, body, sha256, published_at)
      SELECT arg_code, coalesce(max(version), 0) + 1, data->>'title', data->>'body',
        encode(sha256(convert_to(data->>'body', 'UTF8')), 'hex'), statement_timestamp()
      FROM public.legal_document WHERE kind = arg_code RETURNING id INTO resource;
    WHEN 'CHANGE_USER_ROLE' THEN
      subject_uid := data->>'uid';
      arg_code := data->>'role';
      role_enabled := (data->>'enabled')::boolean;
      IF subject_uid = actor OR arg_code NOT IN ('SUPPORT','ADMIN') OR role_enabled IS NULL THEN
        PERFORM nexa_internal.reject('ROLE_CHANGE_NOT_ALLOWED');
      END IF;
      IF role_enabled THEN
        INSERT INTO public.user_role(user_uid, role_code, granted_by_uid)
        VALUES (subject_uid, arg_code, actor) ON CONFLICT DO NOTHING;
      ELSE
        DELETE FROM public.user_role WHERE user_uid = subject_uid AND role_code = arg_code;
      END IF;
      INSERT INTO public.audit_log(actor_uid, command_id, action, entity_type, entity_key, metadata)
      VALUES (actor, command_row.id, command_row.kind, 'USER_ROLE', subject_uid,
        jsonb_build_object('role', arg_code, 'enabled', role_enabled));
    ELSE
      PERFORM nexa_internal.reject('UNKNOWN_COMMAND');
  END CASE;

  RETURN resource;
END $$;
