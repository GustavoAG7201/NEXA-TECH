// Named reads. Parameters are bound by the PostgreSQL driver.
export const queries = {
  ListCategories: {
    access: "public", variables: {}, params: [], root: "categories",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'slug', t0.slug,
        'name', t0.name,
        'description', t0.description
      ) AS item
      FROM public.category t0
      WHERE t0.archived_at IS NULL
      ORDER BY t0.name ASC
      LIMIT 100
      ) AS page
    ) AS result`,
  },
  ListCatalog: {
    access: "public", variables: {"search":"String","categoryId":"UUID","minimum":"Int64","maximum":"Int64","available":"Int","offset":"Int!"}, params: ["search","categoryId","minimum","maximum","available","offset"], root: "productVariants",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'sku', t0.sku,
        'optionLabel', t0.option_label,
        'color', t0.color,
        'unitPriceCents', t0.unit_price_cents::text,
        'compareAtCents', t0.compare_at_cents::text,
        'stockOnHand', t0.stock_on_hand,
        'product', (
        SELECT jsonb_build_object(
          'id', t3.id,
          'slug', t3.slug,
          'legacyId', t3.legacy_id,
          'name', t3.name,
          'description', t3.description,
          'specs', t3.specs,
          'status', t3.status,
          'featured', t3.featured,
          'category', (
          SELECT jsonb_build_object(
            'id', t4.id,
            'slug', t4.slug,
            'name', t4.name
          ) AS item
          FROM public.category t4
          WHERE t3.category_id = t4.id
        ),
          'productImages_on_product', (
          SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
            SELECT jsonb_build_object(
            'src', t5.src,
            'alt', t5.alt
          ) AS item
          FROM public.product_image t5
          WHERE t3.id = t5.product_id
          ORDER BY t5.position ASC
          LIMIT 1
          ) AS page
        )
        ) AS item
        FROM public.product t3
        WHERE t0.product_id = t3.id
      )
      ) AS item
      FROM public.product_variant t0
      WHERE t0.archived_at IS NULL
        AND EXISTS (SELECT 1 FROM public.product t1 WHERE t0.product_id = t1.id AND t1.status = 'ACTIVE' AND t1.archived_at IS NULL AND ($1::text IS NULL OR strpos(t1.name, $1::text) > 0) AND ($2::uuid IS NULL OR t1.category_id = $2::uuid) AND EXISTS (SELECT 1 FROM public.category t2 WHERE t1.category_id = t2.id AND t2.archived_at IS NULL))
        AND ($3::bigint IS NULL OR t0.unit_price_cents >= $3::bigint)
        AND ($4::bigint IS NULL OR t0.unit_price_cents <= $4::bigint)
        AND ($5::integer IS NULL OR t0.stock_on_hand >= $5::integer)
      ORDER BY t0.unit_price_cents ASC, t0.id ASC
      LIMIT 30 OFFSET $6::integer
      ) AS page
    ) AS result`,
  },
  GetProduct: {
    access: "public", variables: {"slug":"String!"}, params: ["slug"], root: "products",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'slug', t0.slug,
        'legacyId', t0.legacy_id,
        'name', t0.name,
        'description', t0.description,
        'specs', t0.specs,
        'status', t0.status,
        'category', (
        SELECT jsonb_build_object(
          'id', t3.id,
          'slug', t3.slug,
          'name', t3.name
        ) AS item
        FROM public.category t3
        WHERE t0.category_id = t3.id
      ),
        'productImages_on_product', (
        SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
          'src', t4.src,
          'alt', t4.alt,
          'position', t4.position,
          'credit', t4.credit
        ) AS item
        FROM public.product_image t4
        WHERE t0.id = t4.product_id
        ORDER BY t4.position ASC
        LIMIT 20
        ) AS page
      ),
        'productVariants_on_product', (
        SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
          'id', t5.id,
          'sku', t5.sku,
          'optionLabel', t5.option_label,
          'color', t5.color,
          'unitPriceCents', t5.unit_price_cents::text,
          'compareAtCents', t5.compare_at_cents::text,
          'stockOnHand', t5.stock_on_hand,
          'weightG', t5.weight_g,
          'lengthMm', t5.length_mm,
          'widthMm', t5.width_mm,
          'heightMm', t5.height_mm
        ) AS item
        FROM public.product_variant t5
        WHERE t0.id = t5.product_id
          AND t5.archived_at IS NULL
        LIMIT 50
        ) AS page
      )
      ) AS item
      FROM public.product t0
      WHERE t0.slug = $1::text
        AND t0.status = 'ACTIVE'
        AND t0.archived_at IS NULL
        AND EXISTS (SELECT 1 FROM public.category t1 WHERE t0.category_id = t1.id AND t1.archived_at IS NULL)
        AND EXISTS (SELECT 1 FROM public.product_variant t2 WHERE t0.id = t2.product_id AND t2.archived_at IS NULL)
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  ListProductReviews: {
    access: "public", variables: {"productId":"UUID!","offset":"Int!"}, params: ["productId","offset"], root: "reviews",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'rating', t0.rating,
        'body', t0.body,
        'createdAt', t0.created_at
      ) AS item
      FROM public.review t0
      WHERE t0.product_id = $1::uuid
        AND t0.moderation_status = 'APPROVED'
        AND EXISTS (SELECT 1 FROM public.product t1 WHERE t0.product_id = t1.id AND t1.status = 'ACTIVE' AND t1.archived_at IS NULL AND EXISTS (SELECT 1 FROM public.category t2 WHERE t1.category_id = t2.id AND t2.archived_at IS NULL))
      ORDER BY t0.created_at DESC, t0.id ASC
      LIMIT 30 OFFSET $2::integer
      ) AS page
    ) AS result`,
  },
  GetPublishedPolicies: {
    access: "public", variables: {}, params: [], root: "legalDocuments",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'kind', t0.kind,
        'version', t0.version,
        'title', t0.title,
        'body', t0.body,
        'sha256', t0.sha256,
        'publishedAt', t0.published_at
      ) AS item
      FROM public.legal_document t0
      WHERE t0.published_at <= statement_timestamp()
        AND t0.withdrawn_at IS NULL
      ORDER BY t0.kind ASC
      LIMIT 20
      ) AS page
    ) AS result`,
  },
  GetMyProfile: {
    access: "customer", variables: {}, params: ["uid"], root: "appUsers",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'uid', t0.uid,
        'displayName', t0.display_name,
        'phone', t0.phone,
        'userRoles_on_user', (
        SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
          'roleCode', t1.role_code
        ) AS item
        FROM public.user_role t1
        WHERE t0.uid = t1.user_uid
        ) AS page
      )
      ) AS item
      FROM public.app_user t0
      WHERE t0.uid = $1::text
        AND t0.status = 'ACTIVE'
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  ListMyAddresses: {
    access: "customer", variables: {}, params: ["uid"], root: "addresses",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'label', t0.label,
        'recipient', t0.recipient,
        'phone', t0.phone,
        'line1', t0.line1,
        'line2', t0.line2,
        'district', t0.district,
        'city', t0.city,
        'stateCode', t0.state_code,
        'postalCode', t0.postal_code,
        'countryCode', t0.country_code,
        'isDefault', t0.is_default
      ) AS item
      FROM public.address t0
      WHERE t0.user_uid = $1::text
        AND t0.archived_at IS NULL
        AND EXISTS (SELECT 1 FROM public.app_user t1 WHERE t0.user_uid = t1.uid AND t1.status = 'ACTIVE')
      ORDER BY t0.is_default DESC, t0.created_at ASC
      LIMIT 30
      ) AS page
    ) AS result`,
  },
  GetMyCart: {
    access: "customer", variables: {}, params: ["uid"], root: "carts",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'revision', t0.revision::text,
        'cartItems_on_cart', (
        SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
          'variantId', t2.variant_id,
          'quantity', t2.quantity,
          'variant', (
          SELECT jsonb_build_object(
            'sku', t3.sku,
            'optionLabel', t3.option_label,
            'stockOnHand', t3.stock_on_hand,
            'unitPriceCents', t3.unit_price_cents::text,
            'archivedAt', t3.archived_at,
            'product', (
            SELECT jsonb_build_object(
              'id', t4.id,
              'slug', t4.slug,
              'name', t4.name,
              'status', t4.status
            ) AS item
            FROM public.product t4
            WHERE t3.product_id = t4.id
          )
          ) AS item
          FROM public.product_variant t3
          WHERE t2.variant_id = t3.id
        )
        ) AS item
        FROM public.cart_item t2
        WHERE t0.id = t2.cart_id
        ORDER BY t2.created_at ASC
        LIMIT 50
        ) AS page
      )
      ) AS item
      FROM public.cart t0
      WHERE t0.user_uid = $1::text
        AND t0.status = 'ACTIVE'
        AND EXISTS (SELECT 1 FROM public.app_user t1 WHERE t0.user_uid = t1.uid AND t1.status = 'ACTIVE')
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  ListMyFavorites: {
    access: "customer", variables: {"offset":"Int"}, params: ["uid","offset"], root: "favorites",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'productId', t0.product_id,
        'product', (
        SELECT jsonb_build_object(
          'slug', t2.slug,
          'name', t2.name,
          'status', t2.status
        ) AS item
        FROM public.product t2
        WHERE t0.product_id = t2.id
      )
      ) AS item
      FROM public.favorite t0
      WHERE t0.user_uid = $1::text
        AND EXISTS (SELECT 1 FROM public.app_user t1 WHERE t0.user_uid = t1.uid AND t1.status = 'ACTIVE')
      ORDER BY t0.created_at DESC, t0.product_id ASC
      LIMIT 100 OFFSET $2::integer
      ) AS page
    ) AS result`,
  },
  ListMyOrders: {
    access: "customer", variables: {"offset":"Int!"}, params: ["uid","offset"], root: "customerOrders",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'folio', t0.folio,
        'status', t0.status,
        'currency', t0.currency,
        'totalCents', t0.total_cents::text,
        'confirmedAt', t0.confirmed_at
      ) AS item
      FROM public.customer_order t0
      WHERE t0.user_uid = $1::text
        AND EXISTS (SELECT 1 FROM public.app_user t1 WHERE t0.user_uid = t1.uid AND t1.status = 'ACTIVE')
      ORDER BY t0.created_at DESC, t0.id ASC
      LIMIT 30 OFFSET $2::integer
      ) AS page
    ) AS result`,
  },
  GetMyOrder: {
    access: "customer", variables: {"id":"UUID!"}, params: ["id","uid"], root: "customerOrders",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'folio', t0.folio,
        'status', t0.status,
        'currency', t0.currency,
        'contactEmail', t0.contact_email,
        'subtotalCents', t0.subtotal_cents::text,
        'discountCents', t0.discount_cents::text,
        'itemsTaxCents', t0.items_tax_cents::text,
        'shippingCents', t0.shipping_cents::text,
        'shippingTaxCents', t0.shipping_tax_cents::text,
        'totalCents', t0.total_cents::text,
        'confirmedAt', t0.confirmed_at,
        'payment_on_order', (
        SELECT jsonb_build_object(
          'status', t2.status
        ) AS item
        FROM public.payment t2
        WHERE t0.id = t2.order_id
      ),
        'orderItems_on_order', (
        SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
          'id', t3.id,
          'skuSnapshot', t3.sku_snapshot,
          'nameSnapshot', t3.name_snapshot,
          'optionSnapshot', t3.option_snapshot,
          'quantity', t3.quantity,
          'unitPriceCents', t3.unit_price_cents::text,
          'discountCents', t3.discount_cents::text,
          'taxCents', t3.tax_cents::text
        ) AS item
        FROM public.order_item t3
        WHERE t0.id = t3.order_id
        ORDER BY t3.id ASC
        LIMIT 50
        ) AS page
      ),
        'orderAddress_on_order', (
        SELECT jsonb_build_object(
          'recipient', t4.recipient,
          'phone', t4.phone,
          'line1', t4.line1,
          'line2', t4.line2,
          'district', t4.district,
          'city', t4.city,
          'stateCode', t4.state_code,
          'postalCode', t4.postal_code,
          'countryCode', t4.country_code
        ) AS item
        FROM public.order_address t4
        WHERE t0.id = t4.order_id
      ),
        'orderStatusEvents_on_order', (
        SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
          'newStatus', t5.new_status,
          'createdAt', t5.created_at
        ) AS item
        FROM public.order_status_event t5
        WHERE t0.id = t5.order_id
        ORDER BY t5.created_at ASC, t5.id ASC
        ) AS page
      ),
        'shipment_on_order', (
        SELECT jsonb_build_object(
          'status', t6.status,
          'methodSnapshot', t6.method_snapshot,
          'carrier', t6.carrier,
          'trackingCode', t6.tracking_code,
          'estimatedFrom', t6.estimated_from,
          'estimatedTo', t6.estimated_to,
          'shippedAt', t6.shipped_at,
          'deliveredAt', t6.delivered_at,
          'shipmentEvents_on_shipment', (
          SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
            SELECT jsonb_build_object(
            'eventType', t7.event_type,
            'publicDetail', t7.public_detail,
            'occurredAt', t7.occurred_at
          ) AS item
          FROM public.shipment_event t7
          WHERE t6.id = t7.shipment_id
          ORDER BY t7.occurred_at DESC
          LIMIT 50
          ) AS page
        )
        ) AS item
        FROM public.shipment t6
        WHERE t0.id = t6.order_id
      ),
        'termsAcceptances_on_order', (
        SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
          'evidenceKind', t8.evidence_kind,
          'presentedAt', t8.presented_at,
          'document', (
          SELECT jsonb_build_object(
            'id', t9.id,
            'kind', t9.kind,
            'version', t9.version,
            'sha256', t9.sha256,
            'title', t9.title,
            'body', t9.body
          ) AS item
          FROM public.legal_document t9
          WHERE t8.legal_document_id = t9.id
        )
        ) AS item
        FROM public.terms_acceptance t8
        WHERE t0.id = t8.order_id
        ) AS page
      )
      ) AS item
      FROM public.customer_order t0
      WHERE t0.id = $1::uuid
        AND t0.user_uid = $2::text
        AND EXISTS (SELECT 1 FROM public.app_user t1 WHERE t0.user_uid = t1.uid AND t1.status = 'ACTIVE')
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  GetMyPaymentStatus: {
    access: "customer", variables: {"id":"UUID!"}, params: ["id","uid"], root: "payments",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'orderId', t0.order_id,
        'status', t0.status,
        'amountCents', t0.amount_cents::text,
        'decisionCode', t0.decision_code,
        'decidedAt', t0.decided_at
      ) AS item
      FROM public.payment t0
      WHERE t0.id = $1::uuid
        AND EXISTS (SELECT 1 FROM public.commerce_command t1 WHERE t0.checkout_command_id = t1.id AND t1.actor_uid = $2::text AND EXISTS (SELECT 1 FROM public.app_user t2 WHERE t1.actor_uid = t2.uid AND t2.status = 'ACTIVE'))
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  ListMyNotifications: {
    access: "customer", variables: {"offset":"Int!"}, params: ["uid","offset"], root: "notifications",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'orderId', t0.order_id,
        'returnRequestId', t0.return_request_id,
        'supportTicketId', t0.support_ticket_id,
        'kind', t0.kind,
        'readAt', t0.read_at,
        'createdAt', t0.created_at
      ) AS item
      FROM public.notification t0
      WHERE t0.user_uid = $1::text
        AND EXISTS (SELECT 1 FROM public.app_user t1 WHERE t0.user_uid = t1.uid AND t1.status = 'ACTIVE')
      ORDER BY t0.created_at DESC, t0.id ASC
      LIMIT 30 OFFSET $2::integer
      ) AS page
    ) AS result`,
  },
  ListMyReturnRequests: {
    access: "customer", variables: {"offset":"Int!","orderId":"UUID"}, params: ["orderId","uid","offset"], root: "returnRequests",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'orderId', t0.order_id,
        'folio', t0.folio,
        'kind', t0.kind,
        'status', t0.status,
        'reasonCode', t0.reason_code,
        'resolutionCode', t0.resolution_code,
        'createdAt', t0.created_at
      ) AS item
      FROM public.return_request t0
      WHERE ($1::uuid IS NULL OR t0.order_id = $1::uuid)
        AND EXISTS (SELECT 1 FROM public.customer_order t1 WHERE t0.order_id = t1.id AND t1.user_uid = $2::text AND EXISTS (SELECT 1 FROM public.app_user t2 WHERE t1.user_uid = t2.uid AND t2.status = 'ACTIVE'))
      ORDER BY t0.created_at DESC, t0.id ASC
      LIMIT 30 OFFSET $3::integer
      ) AS page
    ) AS result`,
  },
  GetMyReturnRequest: {
    access: "customer", variables: {"id":"UUID!"}, params: ["id","uid"], root: "returnRequests",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'orderId', t0.order_id,
        'folio', t0.folio,
        'kind', t0.kind,
        'status', t0.status,
        'reasonCode', t0.reason_code,
        'description', t0.description,
        'resolutionCode', t0.resolution_code,
        'resolutionNote', t0.resolution_note,
        'createdAt', t0.created_at,
        'closedAt', t0.closed_at,
        'returnItems_on_request', (
        SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
          'id', t3.id,
          'orderItemId', t3.order_item_id,
          'requestedQty', t3.requested_qty,
          'approvedQty', t3.approved_qty,
          'receivedQty', t3.received_qty,
          'restockedQty', t3.restocked_qty,
          'conditionCode', t3.condition_code,
          'orderItem', (
          SELECT jsonb_build_object(
            'skuSnapshot', t4.sku_snapshot,
            'nameSnapshot', t4.name_snapshot
          ) AS item
          FROM public.order_item t4
          WHERE t3.order_item_id = t4.id
        )
        ) AS item
        FROM public.return_item t3
        WHERE t0.id = t3.return_request_id
        ) AS page
      ),
        'refunds_on_request', (
        SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
          'id', t5.id,
          'amountCents', t5.amount_cents::text,
          'shippingRefundCents', t5.shipping_refund_cents::text,
          'decidedAt', t5.decided_at
        ) AS item
        FROM public.refund t5
        WHERE t0.id = t5.return_request_id
          AND t5.status = 'APPROVED'
        ) AS page
      ),
        'returnEvents_on_request', (
        SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
          'previousStatus', t6.previous_status,
          'newStatus', t6.new_status,
          'publicDetail', t6.public_detail,
          'createdAt', t6.created_at
        ) AS item
        FROM public.return_event t6
        WHERE t0.id = t6.return_request_id
        ORDER BY t6.created_at ASC
        LIMIT 100
        ) AS page
      ),
        'returnEvidences_on_request', (
        SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
          'id', t7.id,
          'mediaType', t7.media_type,
          'sizeBytes', t7.size_bytes,
          'sha256', t7.sha256,
          'createdAt', t7.created_at
        ) AS item
        FROM public.return_evidence t7
        WHERE t0.id = t7.return_request_id
          AND t7.deleted_at IS NULL
        LIMIT 10
        ) AS page
      )
      ) AS item
      FROM public.return_request t0
      WHERE t0.id = $1::uuid
        AND EXISTS (SELECT 1 FROM public.customer_order t1 WHERE t0.order_id = t1.id AND t1.user_uid = $2::text AND EXISTS (SELECT 1 FROM public.app_user t2 WHERE t1.user_uid = t2.uid AND t2.status = 'ACTIVE'))
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  GetMyReturnEvidence: {
    access: "customer", variables: {"id":"UUID!"}, params: ["id","uid"], root: "returnEvidences",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'mediaType', t0.media_type,
        'sizeBytes', t0.size_bytes,
        'contentB64', t0.content_b64,
        'sha256', t0.sha256
      ) AS item
      FROM public.return_evidence t0
      WHERE t0.id = $1::uuid
        AND t0.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM public.return_request t1 WHERE t0.return_request_id = t1.id AND EXISTS (SELECT 1 FROM public.customer_order t2 WHERE t1.order_id = t2.id AND t2.user_uid = $2::text AND EXISTS (SELECT 1 FROM public.app_user t3 WHERE t2.user_uid = t3.uid AND t3.status = 'ACTIVE')))
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  GetMyTickets: {
    access: "customer", variables: {"offset":"Int!"}, params: ["uid","offset"], root: "supportTickets",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'folio', t0.folio,
        'subject', t0.subject,
        'status', t0.status,
        'createdAt', t0.created_at,
        'closedAt', t0.closed_at,
        'supportMessages_on_ticket', (
        SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
          'id', t2.id,
          'body', t2.body,
          'createdAt', t2.created_at
        ) AS item
        FROM public.support_message t2
        WHERE t0.id = t2.ticket_id
          AND t2.visibility = 'CUSTOMER_VISIBLE'
        ORDER BY t2.created_at ASC
        LIMIT 100
        ) AS page
      )
      ) AS item
      FROM public.support_ticket t0
      WHERE t0.requester_uid = $1::text
        AND EXISTS (SELECT 1 FROM public.app_user t1 WHERE t0.requester_uid = t1.uid AND t1.status = 'ACTIVE')
      ORDER BY t0.created_at DESC, t0.id ASC
      LIMIT 30 OFFSET $2::integer
      ) AS page
    ) AS result`,
  },
  GetMyTicket: {
    access: "customer", variables: {"id":"UUID!","messageOffset":"Int!"}, params: ["id","uid","messageOffset"], root: "supportTickets",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'folio', t0.folio,
        'subject', t0.subject,
        'status', t0.status,
        'orderId', t0.order_id,
        'createdAt', t0.created_at,
        'closedAt', t0.closed_at,
        'supportMessages_on_ticket', (
        SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
          SELECT jsonb_build_object(
          'id', t2.id,
          'body', t2.body,
          'createdAt', t2.created_at,
          'authorUid', t2.author_uid
        ) AS item
        FROM public.support_message t2
        WHERE t0.id = t2.ticket_id
          AND t2.visibility = 'CUSTOMER_VISIBLE'
        ORDER BY t2.created_at DESC, t2.id ASC
        LIMIT 100 OFFSET $3::integer
        ) AS page
      )
      ) AS item
      FROM public.support_ticket t0
      WHERE t0.id = $1::uuid
        AND t0.requester_uid = $2::text
        AND EXISTS (SELECT 1 FROM public.app_user t1 WHERE t0.requester_uid = t1.uid AND t1.status = 'ACTIVE')
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  GetMyCommandResult: {
    access: "customer", variables: {"key":"UUID!"}, params: ["uid","key"], root: "commerceCommands",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'kind', t0.kind,
        'inputVersion', t0.input_version,
        'inputDigest', t0.input_digest,
        'status', t0.status,
        'resultCode', t0.result_code,
        'resultId', t0.result_id
      ) AS item
      FROM public.commerce_command t0
      WHERE t0.actor_uid = $1::text
        AND t0.idempotency_key = $2::uuid
        AND EXISTS (SELECT 1 FROM public.app_user t1 WHERE t0.actor_uid = t1.uid AND t1.status = 'ACTIVE')
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  GetMyQuote: {
    access: "customer", variables: {"id":"UUID!"}, params: ["id","uid"], root: "checkoutQuotes",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'cartId', t0.cart_id,
        'addressId', t0.address_id,
        'methodCode', t0.method_code,
        'cartRevision', t0.cart_revision::text,
        'pricingDigest', t0.pricing_digest,
        'summary', t0.summary,
        'expiresAt', t0.expires_at
      ) AS item
      FROM public.checkout_quote t0
      WHERE t0.id = $1::uuid
        AND EXISTS (SELECT 1 FROM public.cart t1 WHERE t0.cart_id = t1.id AND t1.user_uid = $2::text AND EXISTS (SELECT 1 FROM public.app_user t2 WHERE t1.user_uid = t2.uid AND t2.status = 'ACTIVE'))
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  ListStaffOrders: {
    access: "admin", variables: {"offset":"Int!","status":"String"}, params: ["uid","status","offset"], root: "staffOrders",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'order', (
        SELECT jsonb_build_object(
          'id', t3.id,
          'folio', t3.folio,
          'status', t3.status,
          'userUid', t3.user_uid,
          'currency', t3.currency,
          'totalCents', t3.total_cents::text,
          'confirmedAt', t3.confirmed_at
        ) AS item
        FROM public.customer_order t3
        WHERE t0.order_id = t3.id
      )
      ) AS item
      FROM public.staff_order t0
      WHERE t0.reader_uid = $1::text
        AND EXISTS (SELECT 1 FROM public.customer_order t1 WHERE t0.order_id = t1.id AND ($2::text IS NULL OR t1.status = $2::text))
      ORDER BY (SELECT t2.created_at FROM public.customer_order t2 WHERE t0.order_id = t2.id) DESC, t0.order_id ASC
      LIMIT 30 OFFSET $3::integer
      ) AS page
    ) AS result`,
  },
  GetStaffOrder: {
    access: "admin", variables: {"id":"UUID!"}, params: ["uid","id"], root: "staffOrders",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'order', (
        SELECT jsonb_build_object(
          'id', t1.id,
          'folio', t1.folio,
          'userUid', t1.user_uid,
          'status', t1.status,
          'subtotalCents', t1.subtotal_cents::text,
          'discountCents', t1.discount_cents::text,
          'totalCents', t1.total_cents::text,
          'confirmedAt', t1.confirmed_at,
          'orderItems_on_order', (
          SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
            SELECT jsonb_build_object(
            'id', t2.id,
            'nameSnapshot', t2.name_snapshot,
            'skuSnapshot', t2.sku_snapshot,
            'quantity', t2.quantity,
            'unitPriceCents', t2.unit_price_cents::text
          ) AS item
          FROM public.order_item t2
          WHERE t1.id = t2.order_id
          ) AS page
        ),
          'orderAddress_on_order', (
          SELECT jsonb_build_object(
            'recipient', t3.recipient,
            'phone', t3.phone,
            'line1', t3.line1,
            'line2', t3.line2,
            'district', t3.district,
            'city', t3.city,
            'stateCode', t3.state_code,
            'postalCode', t3.postal_code
          ) AS item
          FROM public.order_address t3
          WHERE t1.id = t3.order_id
        ),
          'shipment_on_order', (
          SELECT jsonb_build_object(
            'id', t4.id,
            'status', t4.status,
            'carrier', t4.carrier,
            'trackingCode', t4.tracking_code,
            'estimatedFrom', t4.estimated_from,
            'estimatedTo', t4.estimated_to,
            'shippedAt', t4.shipped_at,
            'deliveredAt', t4.delivered_at,
            'shipmentEvents_on_shipment', (
            SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
              SELECT jsonb_build_object(
              'eventType', t5.event_type,
              'publicDetail', t5.public_detail,
              'occurredAt', t5.occurred_at
            ) AS item
            FROM public.shipment_event t5
            WHERE t4.id = t5.shipment_id
            ORDER BY t5.occurred_at DESC, t5.id ASC
            LIMIT 50
            ) AS page
          )
          ) AS item
          FROM public.shipment t4
          WHERE t1.id = t4.order_id
        ),
          'orderStatusEvents_on_order', (
          SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
            SELECT jsonb_build_object(
            'newStatus', t6.new_status,
            'reason', t6.reason,
            'createdAt', t6.created_at
          ) AS item
          FROM public.order_status_event t6
          WHERE t1.id = t6.order_id
          ORDER BY t6.created_at ASC, t6.id ASC
          ) AS page
        ),
          'payment_on_order', (
          SELECT jsonb_build_object(
            'status', t7.status,
            'amountCents', t7.amount_cents::text
          ) AS item
          FROM public.payment t7
          WHERE t1.id = t7.order_id
        )
        ) AS item
        FROM public.customer_order t1
        WHERE t0.order_id = t1.id
      )
      ) AS item
      FROM public.staff_order t0
      WHERE t0.reader_uid = $1::text
        AND t0.order_id = $2::uuid
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  ListCustomers: {
    access: "admin", variables: {"offset":"Int!"}, params: ["uid","offset"], root: "staffCustomers",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'customer', (
        SELECT jsonb_build_object(
          'uid', t1.uid,
          'displayName', t1.display_name,
          'status', t1.status,
          'createdAt', t1.created_at,
          'userRoles_on_user', (
          SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
            SELECT jsonb_build_object(
            'roleCode', t2.role_code
          ) AS item
          FROM public.user_role t2
          WHERE t1.uid = t2.user_uid
          ) AS page
        )
        ) AS item
        FROM public.app_user t1
        WHERE t0.customer_uid = t1.uid
      )
      ) AS item
      FROM public.staff_customer t0
      WHERE t0.reader_uid = $1::text
      ORDER BY t0.customer_uid ASC
      LIMIT 30 OFFSET $2::integer
      ) AS page
    ) AS result`,
  },
  ListStaffCategories: {
    access: "admin", variables: {"offset":"Int!"}, params: ["uid","offset"], root: "staffCategories",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'category', (
        SELECT jsonb_build_object(
          'id', t2.id,
          'slug', t2.slug,
          'name', t2.name,
          'description', t2.description,
          'archivedAt', t2.archived_at
        ) AS item
        FROM public.category t2
        WHERE t0.category_id = t2.id
      )
      ) AS item
      FROM public.staff_category t0
      WHERE t0.reader_uid = $1::text
      ORDER BY (SELECT t1.name FROM public.category t1 WHERE t0.category_id = t1.id) ASC, t0.category_id ASC
      LIMIT 30 OFFSET $2::integer
      ) AS page
    ) AS result`,
  },
  ListInventoryMovements: {
    access: "admin", variables: {"variantId":"UUID","offset":"Int!"}, params: ["uid","variantId","offset"], root: "staffInventories",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'movement', (
        SELECT jsonb_build_object(
          'id', t3.id,
          'variantId', t3.variant_id,
          'kind', t3.kind,
          'delta', t3.delta,
          'reason', t3.reason,
          'createdAt', t3.created_at,
          'command', (
          SELECT jsonb_build_object(
            'actorUid', t4.actor_uid
          ) AS item
          FROM public.commerce_command t4
          WHERE t3.command_id = t4.id
        ),
          'variant', (
          SELECT jsonb_build_object(
            'sku', t5.sku,
            'stockOnHand', t5.stock_on_hand,
            'lowStockThreshold', t5.low_stock_threshold
          ) AS item
          FROM public.product_variant t5
          WHERE t3.variant_id = t5.id
        )
        ) AS item
        FROM public.inventory_movement t3
        WHERE t0.movement_id = t3.id
      )
      ) AS item
      FROM public.staff_inventory t0
      WHERE t0.reader_uid = $1::text
        AND EXISTS (SELECT 1 FROM public.inventory_movement t1 WHERE t0.movement_id = t1.id AND ($2::uuid IS NULL OR t1.variant_id = $2::uuid))
      ORDER BY (SELECT t2.created_at FROM public.inventory_movement t2 WHERE t0.movement_id = t2.id) DESC, t0.movement_id ASC
      LIMIT 30 OFFSET $3::integer
      ) AS page
    ) AS result`,
  },
  ListAuditEvents: {
    access: "admin", variables: {"offset":"Int!"}, params: ["uid","offset"], root: "staffAuditEvents",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'event', (
        SELECT jsonb_build_object(
          'id', t2.id,
          'actorUid', t2.actor_uid,
          'action', t2.action,
          'entityType', t2.entity_type,
          'entityKey', t2.entity_key,
          'metadata', t2.metadata,
          'createdAt', t2.created_at
        ) AS item
        FROM public.audit_log t2
        WHERE t0.event_id = t2.id
      )
      ) AS item
      FROM public.staff_audit_event t0
      WHERE t0.reader_uid = $1::text
      ORDER BY (SELECT t1.created_at FROM public.audit_log t1 WHERE t0.event_id = t1.id) DESC, t0.event_id ASC
      LIMIT 30 OFFSET $2::integer
      ) AS page
    ) AS result`,
  },
  ListSupportQueue: {
    access: "staff", variables: {"offset":"Int!"}, params: ["uid","offset"], root: "staffQueueEntries",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'id', t0.id,
        'kind', t0.kind,
        'status', t0.status,
        'createdAt', t0.created_at,
        'assigned', t0.assigned
      ) AS item
      FROM public.staff_queue_entry t0
      WHERE t0.reader_uid = $1::text
      ORDER BY t0.created_at ASC, t0.id ASC
      LIMIT 30 OFFSET $2::integer
      ) AS page
    ) AS result`,
  },
  GetStaffReturnRequest: {
    access: "staff", variables: {"id":"UUID!"}, params: ["uid","id"], root: "staffReturnCases",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'request', (
        SELECT jsonb_build_object(
          'id', t1.id,
          'orderId', t1.order_id,
          'folio', t1.folio,
          'kind', t1.kind,
          'status', t1.status,
          'reasonCode', t1.reason_code,
          'description', t1.description,
          'assignedToUid', t1.assigned_to_uid,
          'resolutionCode', t1.resolution_code,
          'resolutionNote', t1.resolution_note,
          'createdAt', t1.created_at,
          'closedAt', t1.closed_at,
          'order', (
          SELECT jsonb_build_object(
            'folio', t2.folio,
            'status', t2.status
          ) AS item
          FROM public.customer_order t2
          WHERE t1.order_id = t2.id
        ),
          'returnItems_on_request', (
          SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
            SELECT jsonb_build_object(
            'id', t3.id,
            'orderItemId', t3.order_item_id,
            'requestedQty', t3.requested_qty,
            'approvedQty', t3.approved_qty,
            'receivedQty', t3.received_qty,
            'restockedQty', t3.restocked_qty,
            'conditionCode', t3.condition_code,
            'inspectionNote', t3.inspection_note,
            'orderItem', (
            SELECT jsonb_build_object(
              'skuSnapshot', t4.sku_snapshot,
              'nameSnapshot', t4.name_snapshot
            ) AS item
            FROM public.order_item t4
            WHERE t3.order_item_id = t4.id
          )
          ) AS item
          FROM public.return_item t3
          WHERE t1.id = t3.return_request_id
          ) AS page
        ),
          'returnEvidences_on_request', (
          SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
            SELECT jsonb_build_object(
            'id', t5.id,
            'mediaType', t5.media_type,
            'sizeBytes', t5.size_bytes,
            'sha256', t5.sha256
          ) AS item
          FROM public.return_evidence t5
          WHERE t1.id = t5.return_request_id
            AND t5.deleted_at IS NULL
          LIMIT 5
          ) AS page
        ),
          'returnEvents_on_request', (
          SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
            SELECT jsonb_build_object(
            'newStatus', t6.new_status,
            'publicDetail', t6.public_detail,
            'createdAt', t6.created_at
          ) AS item
          FROM public.return_event t6
          WHERE t1.id = t6.return_request_id
          ORDER BY t6.created_at ASC
          LIMIT 100
          ) AS page
        )
        ) AS item
        FROM public.return_request t1
        WHERE t0.request_id = t1.id
      )
      ) AS item
      FROM public.staff_return_case t0
      WHERE t0.reader_uid = $1::text
        AND t0.request_id = $2::uuid
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  GetStaffReturnEvidence: {
    access: "staff", variables: {"requestId":"UUID!","id":"UUID!"}, params: ["uid","requestId","id"], root: "staffReturnCases",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'request', (
        SELECT jsonb_build_object(
          'returnEvidences_on_request', (
          SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
            SELECT jsonb_build_object(
            'id', t2.id,
            'mediaType', t2.media_type,
            'sizeBytes', t2.size_bytes,
            'contentB64', t2.content_b64,
            'sha256', t2.sha256
          ) AS item
          FROM public.return_evidence t2
          WHERE t1.id = t2.return_request_id
            AND t2.id = $3::uuid
            AND t2.deleted_at IS NULL
          LIMIT 1
          ) AS page
        )
        ) AS item
        FROM public.return_request t1
        WHERE t0.request_id = t1.id
      )
      ) AS item
      FROM public.staff_return_case t0
      WHERE t0.reader_uid = $1::text
        AND t0.request_id = $2::uuid
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  GetStaffCaseRefunds: {
    access: "admin", variables: {"orderId":"UUID!","id":"UUID!"}, params: ["uid","orderId","id"], root: "staffOrders",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'order', (
        SELECT jsonb_build_object(
          'returnRequests_on_order', (
          SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
            SELECT jsonb_build_object(
            'refunds_on_request', (
            SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
              SELECT jsonb_build_object(
              'id', t3.id,
              'amountCents', t3.amount_cents::text,
              'shippingRefundCents', t3.shipping_refund_cents::text,
              'decidedAt', t3.decided_at
            ) AS item
            FROM public.refund t3
            WHERE t2.id = t3.return_request_id
              AND t3.status = 'APPROVED'
            ) AS page
          )
          ) AS item
          FROM public.return_request t2
          WHERE t1.id = t2.order_id
            AND t2.id = $3::uuid
          LIMIT 1
          ) AS page
        )
        ) AS item
        FROM public.customer_order t1
        WHERE t0.order_id = t1.id
      )
      ) AS item
      FROM public.staff_order t0
      WHERE t0.reader_uid = $1::text
        AND t0.order_id = $2::uuid
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  GetStaffTicket: {
    access: "staff", variables: {"id":"UUID!","messageOffset":"Int"}, params: ["uid","id","messageOffset"], root: "staffTickets",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'ticket', (
        SELECT jsonb_build_object(
          'id', t1.id,
          'folio', t1.folio,
          'status', t1.status,
          'subject', t1.subject,
          'orderId', t1.order_id,
          'assignedToUid', t1.assigned_to_uid,
          'createdAt', t1.created_at,
          'closedAt', t1.closed_at,
          'supportMessages_on_ticket', (
          SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
            SELECT jsonb_build_object(
            'id', t2.id,
            'body', t2.body,
            'visibility', t2.visibility,
            'createdAt', t2.created_at,
            'authorUid', t2.author_uid
          ) AS item
          FROM public.support_message t2
          WHERE t1.id = t2.ticket_id
          ORDER BY t2.created_at DESC, t2.id ASC
          LIMIT 100 OFFSET $3::integer
          ) AS page
        )
        ) AS item
        FROM public.support_ticket t1
        WHERE t0.ticket_id = t1.id
      )
      ) AS item
      FROM public.staff_ticket t0
      WHERE t0.reader_uid = $1::text
        AND t0.ticket_id = $2::uuid
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  GetAdminReports: {
    access: "admin", variables: {"start":"Date!","end":"Date!"}, params: ["uid","start","end"], root: "staffDailySales",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'day', t0.day,
        'orderCount', t0.order_count::text,
        'netCents', t0.net_cents::text
      ) AS item
      FROM public.staff_daily_sale t0
      WHERE t0.reader_uid = $1::text
        AND t0.day >= $2::date
        AND t0.day < $3::date
      ORDER BY t0.day ASC
      LIMIT 366
      ) AS page
    ) AS result`,
  },
  ListLowStock: {
    access: "admin", variables: {"offset":"Int!"}, params: ["uid","offset"], root: "staffStockAlerts",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'variantId', t0.variant_id,
        'sku', t0.sku,
        'stockOnHand', t0.stock_on_hand,
        'lowStockThreshold', t0.low_stock_threshold
      ) AS item
      FROM public.staff_stock_alert t0
      WHERE t0.reader_uid = $1::text
      ORDER BY t0.stock_on_hand ASC, t0.sku ASC
      LIMIT 30 OFFSET $2::integer
      ) AS page
    ) AS result`,
  },
  ListSkuSales: {
    access: "admin", variables: {"start":"Date!","end":"Date!","offset":"Int!"}, params: ["uid","start","end","offset"], root: "staffSkuSales",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'day', t0.day,
        'sku', t0.sku,
        'grossUnits', t0.gross_units::text
      ) AS item
      FROM public.staff_sku_sale t0
      WHERE t0.reader_uid = $1::text
        AND t0.day >= $2::date
        AND t0.day < $3::date
      ORDER BY t0.day DESC, t0.gross_units DESC, t0.sku ASC
      LIMIT 100 OFFSET $4::integer
      ) AS page
    ) AS result`,
  },
  ListReturnSummary: {
    access: "admin", variables: {"start":"Date!","end":"Date!","offset":"Int!"}, params: ["uid","start","end","offset"], root: "staffReturnSummaries",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'day', t0.day,
        'kind', t0.kind,
        'status', t0.status,
        'reasonCode', t0.reason_code,
        'requestCount', t0.request_count::text
      ) AS item
      FROM public.staff_return_summary t0
      WHERE t0.reader_uid = $1::text
        AND t0.day >= $2::date
        AND t0.day < $3::date
      ORDER BY t0.day DESC, t0.kind ASC, t0.status ASC, t0.reason_code ASC
      LIMIT 100 OFFSET $4::integer
      ) AS page
    ) AS result`,
  },
  ListStaffProducts: {
    access: "admin", variables: {"offset":"Int!","search":"String","status":"String"}, params: ["uid","search","status","offset"], root: "staffCatalogProducts",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'product', (
        SELECT jsonb_build_object(
          'id', t3.id,
          'name', t3.name,
          'slug', t3.slug,
          'status', t3.status,
          'category', (
          SELECT jsonb_build_object(
            'name', t4.name
          ) AS item
          FROM public.category t4
          WHERE t3.category_id = t4.id
        )
        ) AS item
        FROM public.product t3
        WHERE t0.product_id = t3.id
      )
      ) AS item
      FROM public.staff_catalog_product t0
      WHERE t0.reader_uid = $1::text
        AND EXISTS (SELECT 1 FROM public.product t1 WHERE t0.product_id = t1.id AND ($2::text IS NULL OR strpos(t1.name, $2::text) > 0) AND ($3::text IS NULL OR t1.status = $3::text))
      ORDER BY (SELECT t2.name FROM public.product t2 WHERE t0.product_id = t2.id) ASC, t0.product_id ASC
      LIMIT 30 OFFSET $4::integer
      ) AS page
    ) AS result`,
  },
  GetStaffProduct: {
    access: "admin", variables: {"id":"UUID!","variantOffset":"Int!"}, params: ["uid","id","variantOffset"], root: "staffCatalogProducts",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'product', (
        SELECT jsonb_build_object(
          'id', t1.id,
          'name', t1.name,
          'slug', t1.slug,
          'status', t1.status,
          'categoryId', t1.category_id,
          'description', t1.description,
          'specs', t1.specs,
          'featured', t1.featured,
          'productVariants_on_product', (
          SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
            SELECT jsonb_build_object(
            'id', t2.id,
            'sku', t2.sku,
            'optionLabel', t2.option_label,
            'unitPriceCents', t2.unit_price_cents::text,
            'stockOnHand', t2.stock_on_hand,
            'archivedAt', t2.archived_at
          ) AS item
          FROM public.product_variant t2
          WHERE t1.id = t2.product_id
          ORDER BY t2.sku ASC, t2.id ASC
          LIMIT 30 OFFSET $3::integer
          ) AS page
        )
        ) AS item
        FROM public.product t1
        WHERE t0.product_id = t1.id
      )
      ) AS item
      FROM public.staff_catalog_product t0
      WHERE t0.reader_uid = $1::text
        AND t0.product_id = $2::uuid
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  ListStaffVariants: {
    access: "admin", variables: {"offset":"Int!","id":"UUID","productId":"UUID","sku":"String"}, params: ["uid","id","productId","sku","offset"], root: "staffCatalogVariants",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'variant', (
        SELECT jsonb_build_object(
          'id', t3.id,
          'productId', t3.product_id,
          'sku', t3.sku,
          'optionLabel', t3.option_label,
          'color', t3.color,
          'taxClassCode', t3.tax_class_code,
          'unitPriceCents', t3.unit_price_cents::text,
          'compareAtCents', t3.compare_at_cents::text,
          'unitCostCents', t3.unit_cost_cents::text,
          'stockOnHand', t3.stock_on_hand,
          'lowStockThreshold', t3.low_stock_threshold,
          'weightG', t3.weight_g,
          'lengthMm', t3.length_mm,
          'widthMm', t3.width_mm,
          'heightMm', t3.height_mm,
          'archivedAt', t3.archived_at,
          'product', (
          SELECT jsonb_build_object(
            'name', t4.name,
            'status', t4.status
          ) AS item
          FROM public.product t4
          WHERE t3.product_id = t4.id
        )
        ) AS item
        FROM public.product_variant t3
        WHERE t0.variant_id = t3.id
      )
      ) AS item
      FROM public.staff_catalog_variant t0
      WHERE t0.reader_uid = $1::text
        AND ($2::uuid IS NULL OR t0.variant_id = $2::uuid)
        AND EXISTS (SELECT 1 FROM public.product_variant t1 WHERE t0.variant_id = t1.id AND ($3::uuid IS NULL OR t1.product_id = $3::uuid) AND ($4::text IS NULL OR strpos(t1.sku, $4::text) > 0))
      ORDER BY (SELECT t2.sku FROM public.product_variant t2 WHERE t0.variant_id = t2.id) ASC, t0.variant_id ASC
      LIMIT 30 OFFSET $5::integer
      ) AS page
    ) AS result`,
  },
  ListStaffTaxClasses: {
    access: "admin", variables: {}, params: ["uid"], root: "staffCatalogTaxes",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'code', t0.code,
        'label', t0.label,
        'rateBps', t0.rate_bps
      ) AS item
      FROM public.staff_catalog_tax t0
      WHERE t0.reader_uid = $1::text
      ORDER BY t0.code ASC
      ) AS page
    ) AS result`,
  },
  ListStaffCoupons: {
    access: "admin", variables: {"offset":"Int!","id":"UUID"}, params: ["uid","id","offset"], root: "staffCoupons",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'redemptionCount', t0.redemption_count::text,
        'coupon', (
        SELECT jsonb_build_object(
          'id', t2.id,
          'code', t2.code,
          'kind', t2.kind,
          'fixedAmountCents', t2.fixed_amount_cents::text,
          'percentageBps', t2.percentage_bps,
          'minSubtotalCents', t2.min_subtotal_cents::text,
          'startsAt', t2.starts_at,
          'endsAt', t2.ends_at,
          'totalLimit', t2.total_limit,
          'perUserLimit', t2.per_user_limit,
          'archivedAt', t2.archived_at
        ) AS item
        FROM public.coupon t2
        WHERE t0.coupon_id = t2.id
      )
      ) AS item
      FROM public.staff_coupon t0
      WHERE t0.reader_uid = $1::text
        AND ($2::uuid IS NULL OR t0.coupon_id = $2::uuid)
      ORDER BY (SELECT t1.code FROM public.coupon t1 WHERE t0.coupon_id = t1.id) ASC, t0.coupon_id ASC
      LIMIT 30 OFFSET $3::integer
      ) AS page
    ) AS result`,
  },
  ListCouponRedemptions: {
    access: "admin", variables: {"id":"UUID!","offset":"Int!"}, params: ["uid","id","offset"], root: "staffCoupons",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'coupon', (
        SELECT jsonb_build_object(
          'couponRedemptions_on_coupon', (
          SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
            SELECT jsonb_build_object(
            'orderId', t2.order_id,
            'codeSnapshot', t2.code_snapshot,
            'createdAt', t2.created_at,
            'order', (
            SELECT jsonb_build_object(
              'folio', t3.folio,
              'status', t3.status,
              'discountCents', t3.discount_cents::text
            ) AS item
            FROM public.customer_order t3
            WHERE t2.order_id = t3.id
          )
          ) AS item
          FROM public.coupon_redemption t2
          WHERE t1.id = t2.coupon_id
          ORDER BY t2.created_at DESC, t2.order_id ASC
          LIMIT 30 OFFSET $3::integer
          ) AS page
        )
        ) AS item
        FROM public.coupon t1
        WHERE t0.coupon_id = t1.id
      )
      ) AS item
      FROM public.staff_coupon t0
      WHERE t0.reader_uid = $1::text
        AND t0.coupon_id = $2::uuid
      LIMIT 1
      ) AS page
    ) AS result`,
  },
  ListStaffReturnRequests: {
    access: "staff", variables: {"offset":"Int!","orderId":"UUID"}, params: ["uid","orderId","offset"], root: "staffReturnCases",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'request', (
        SELECT jsonb_build_object(
          'id', t3.id,
          'folio', t3.folio,
          'kind', t3.kind,
          'status', t3.status,
          'createdAt', t3.created_at,
          'order', (
          SELECT jsonb_build_object(
            'folio', t4.folio
          ) AS item
          FROM public.customer_order t4
          WHERE t3.order_id = t4.id
        )
        ) AS item
        FROM public.return_request t3
        WHERE t0.request_id = t3.id
      )
      ) AS item
      FROM public.staff_return_case t0
      WHERE t0.reader_uid = $1::text
        AND EXISTS (SELECT 1 FROM public.return_request t1 WHERE t0.request_id = t1.id AND ($2::uuid IS NULL OR t1.order_id = $2::uuid))
      ORDER BY (SELECT t2.created_at FROM public.return_request t2 WHERE t0.request_id = t2.id) DESC, t0.request_id ASC
      LIMIT 30 OFFSET $3::integer
      ) AS page
    ) AS result`,
  },
  ListStaffTickets: {
    access: "staff", variables: {"offset":"Int!"}, params: ["uid","offset"], root: "staffTickets",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'ticket', (
        SELECT jsonb_build_object(
          'id', t2.id,
          'folio', t2.folio,
          'subject', t2.subject,
          'status', t2.status,
          'assignedToUid', t2.assigned_to_uid,
          'updatedAt', t2.updated_at
        ) AS item
        FROM public.support_ticket t2
        WHERE t0.ticket_id = t2.id
      )
      ) AS item
      FROM public.staff_ticket t0
      WHERE t0.reader_uid = $1::text
      ORDER BY (SELECT t1.updated_at FROM public.support_ticket t1 WHERE t0.ticket_id = t1.id) DESC, t0.ticket_id ASC
      LIMIT 30 OFFSET $2::integer
      ) AS page
    ) AS result`,
  },
  ListStaffOperators: {
    access: "admin", variables: {"offset":"Int!"}, params: ["uid","offset"], root: "staffOperators",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'uid', t0.uid,
        'displayName', t0.display_name
      ) AS item
      FROM public.staff_operator t0
      WHERE t0.reader_uid = $1::text
      ORDER BY t0.display_name ASC, t0.uid ASC
      LIMIT 30 OFFSET $2::integer
      ) AS page
    ) AS result`,
  },
  GetOperationTotals: {
    access: "admin", variables: {}, params: ["uid"], root: "staffOperationTotals",
    sql: `
    SELECT (
      SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
        'orderCount', t0.order_count::text,
        'ordersByStatus', t0.orders_by_status,
        'availableUnits', t0.available_units::text,
        'lowStockVariants', t0.low_stock_variants::text,
        'grossCents', t0.gross_cents::text,
        'refundedCents', t0.refunded_cents::text,
        'refundCount', t0.refund_count::text,
        'cancellationRequests', t0.cancellation_requests::text,
        'returnRequests', t0.return_requests::text,
        'exchangeRequests', t0.exchange_requests::text,
        'warrantyRequests', t0.warranty_requests::text,
        'couponUses', t0.coupon_uses::text
      ) AS item
      FROM public.staff_operation_total t0
      WHERE t0.reader_uid = $1::text
      LIMIT 1
      ) AS page
    ) AS result`,
  },
};
