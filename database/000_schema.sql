-- PostgreSQL 18 baseline for the 40 original commerce tables and indexes.
CREATE TABLE "public"."app_user" ("uid" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "disabled_at" timestamptz NULL, "display_name" text NOT NULL, "phone" text NULL, "status" text NOT NULL DEFAULT 'ACTIVE', "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("uid"));

CREATE TABLE "public"."address" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_uid" text NOT NULL, "archived_at" timestamptz NULL, "city" text NOT NULL, "country_code" text NOT NULL DEFAULT 'MX', "created_at" timestamptz NOT NULL DEFAULT now(), "district" text NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "label" text NOT NULL, "line1" text NOT NULL, "line2" text NULL, "phone" text NOT NULL, "postal_code" text NOT NULL, "recipient" text NOT NULL, "state_code" text NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "address_user_uid_fkey" FOREIGN KEY ("user_uid") REFERENCES "public"."app_user" ("uid") ON DELETE CASCADE);

CREATE INDEX "address_userUid_archivedAt_id_idx" ON "public"."address" ("user_uid", "archived_at", "id");

CREATE INDEX "address_userUid_idx" ON "public"."address" ("user_uid");

CREATE TABLE "public"."commerce_command" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "actor_uid" text NOT NULL, "completed_at" timestamptz NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "idempotency_key" uuid NOT NULL, "input" jsonb NULL, "input_digest" text NOT NULL DEFAULT '', "input_version" integer NOT NULL DEFAULT 1, "kind" text NOT NULL, "result_code" text NULL, "result_id" uuid NULL, "status" text NOT NULL DEFAULT 'REQUESTED', PRIMARY KEY ("id"), CONSTRAINT "commerce_command_actor_uid_fkey" FOREIGN KEY ("actor_uid") REFERENCES "public"."app_user" ("uid") ON DELETE CASCADE);

CREATE INDEX "commerce_command_actorUid_idx" ON "public"."commerce_command" ("actor_uid");

CREATE UNIQUE INDEX "commerce_command_actorUid_idempotencyKey_uidx" ON "public"."commerce_command" ("actor_uid", "idempotency_key");

CREATE TABLE "public"."audit_log" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "actor_uid" text NULL, "command_id" uuid NULL, "action" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "entity_key" text NOT NULL, "entity_type" text NOT NULL, "metadata" jsonb NULL, PRIMARY KEY ("id"), CONSTRAINT "audit_log_actor_uid_fkey" FOREIGN KEY ("actor_uid") REFERENCES "public"."app_user" ("uid") ON DELETE SET NULL, CONSTRAINT "audit_log_command_id_fkey" FOREIGN KEY ("command_id") REFERENCES "public"."commerce_command" ("id") ON DELETE SET NULL);

CREATE INDEX "audit_log_entityType_entityKey_createdAt_idx" ON "public"."audit_log" ("entity_type", "entity_key", "created_at");

CREATE INDEX "audit_log_actorUid_createdAt_idx" ON "public"."audit_log" ("actor_uid", "created_at");

CREATE INDEX "audit_log_actorUid_idx" ON "public"."audit_log" ("actor_uid");

CREATE INDEX "audit_log_commandId_idx" ON "public"."audit_log" ("command_id");

CREATE TABLE "public"."cart" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_uid" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "revision" bigint NOT NULL DEFAULT 0::bigint, "status" text NOT NULL DEFAULT 'ACTIVE', "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "cart_user_uid_fkey" FOREIGN KEY ("user_uid") REFERENCES "public"."app_user" ("uid") ON DELETE CASCADE);

CREATE INDEX "cart_userUid_idx" ON "public"."cart" ("user_uid");

CREATE TABLE "public"."category" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "archived_at" timestamptz NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "description" text NULL, "name" text NOT NULL, "slug" text NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "category_slug_uidx" ON "public"."category" ("slug");

CREATE TABLE "public"."product" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "category_id" uuid NOT NULL, "archived_at" timestamptz NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "description" text NOT NULL, "featured" boolean NOT NULL DEFAULT false, "legacy_id" integer NULL, "name" text NOT NULL, "slug" text NOT NULL, "specs" jsonb NULL, "status" text NOT NULL DEFAULT 'DRAFT', "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."category" ("id") ON DELETE CASCADE);

CREATE INDEX "product_categoryId_status_id_idx" ON "public"."product" ("category_id", "status", "id");

CREATE INDEX "product_categoryId_idx" ON "public"."product" ("category_id");

CREATE UNIQUE INDEX "product_legacyId_uidx" ON "public"."product" ("legacy_id");

CREATE UNIQUE INDEX "product_slug_uidx" ON "public"."product" ("slug");

CREATE TABLE "public"."tax_class" ("code" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "label" text NOT NULL, "rate_bps" integer NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("code"));

CREATE TABLE "public"."product_variant" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "product_id" uuid NOT NULL, "tax_class_code" text NOT NULL, "archived_at" timestamptz NULL, "color" text NULL, "compare_at_cents" bigint NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "height_mm" integer NULL, "length_mm" integer NULL, "low_stock_threshold" integer NOT NULL DEFAULT 0, "option_label" text NOT NULL, "sku" text NOT NULL, "stock_on_hand" integer NOT NULL DEFAULT 0, "unit_cost_cents" bigint NULL, "unit_price_cents" bigint NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), "weight_g" integer NULL, "width_mm" integer NULL, PRIMARY KEY ("id"), CONSTRAINT "product_variant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product" ("id") ON DELETE CASCADE, CONSTRAINT "product_variant_tax_class_code_fkey" FOREIGN KEY ("tax_class_code") REFERENCES "public"."tax_class" ("code") ON DELETE CASCADE);

CREATE INDEX "product_variant_productId_archivedAt_unitPriceCents_id_idx" ON "public"."product_variant" ("product_id", "archived_at", "unit_price_cents", "id");

CREATE INDEX "product_variant_productId_idx" ON "public"."product_variant" ("product_id");

CREATE INDEX "product_variant_taxClassCode_idx" ON "public"."product_variant" ("tax_class_code");

CREATE UNIQUE INDEX "product_variant_productId_optionLabel_uidx" ON "public"."product_variant" ("product_id", "option_label");

CREATE UNIQUE INDEX "product_variant_sku_uidx" ON "public"."product_variant" ("sku");

CREATE TABLE "public"."cart_item" ("cart_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "quantity" integer NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("cart_id", "variant_id"), CONSTRAINT "cart_item_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."cart" ("id") ON DELETE CASCADE, CONSTRAINT "cart_item_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant" ("id") ON DELETE CASCADE);

CREATE INDEX "cart_item_cartId_idx" ON "public"."cart_item" ("cart_id");

CREATE INDEX "cart_item_variantId_idx" ON "public"."cart_item" ("variant_id");

CREATE TABLE "public"."coupon" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "archived_at" timestamptz NULL, "code" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "ends_at" timestamptz NOT NULL, "fixed_amount_cents" bigint NULL, "kind" text NOT NULL, "min_subtotal_cents" bigint NOT NULL DEFAULT 0::bigint, "per_user_limit" integer NULL, "percentage_bps" integer NULL, "starts_at" timestamptz NOT NULL, "total_limit" integer NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "coupon_code_uidx" ON "public"."coupon" ("code");

CREATE TABLE "public"."delivery_method" ("code" text NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_at" timestamptz NOT NULL DEFAULT now(), "label" text NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("code"));

CREATE TABLE "public"."delivery_zone" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "active" boolean NOT NULL DEFAULT true, "country_code" text NOT NULL DEFAULT 'MX', "created_at" timestamptz NOT NULL DEFAULT now(), "label" text NOT NULL, "state_code" text NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "delivery_zone_countryCode_stateCode_uidx" ON "public"."delivery_zone" ("country_code", "state_code");

CREATE TABLE "public"."delivery_rate" ("zone_id" uuid NOT NULL, "method_code" text NOT NULL, "tax_class_code" text NOT NULL, "active" boolean NOT NULL DEFAULT true, "created_at" timestamptz NOT NULL DEFAULT now(), "eta_max_days" integer NOT NULL, "eta_min_days" integer NOT NULL, "free_threshold_cents" bigint NULL, "price_cents" bigint NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("zone_id", "method_code"), CONSTRAINT "delivery_rate_method_code_fkey" FOREIGN KEY ("method_code") REFERENCES "public"."delivery_method" ("code") ON DELETE CASCADE, CONSTRAINT "delivery_rate_tax_class_code_fkey" FOREIGN KEY ("tax_class_code") REFERENCES "public"."tax_class" ("code") ON DELETE CASCADE, CONSTRAINT "delivery_rate_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zone" ("id") ON DELETE CASCADE);

CREATE INDEX "delivery_rate_methodCode_idx" ON "public"."delivery_rate" ("method_code");

CREATE INDEX "delivery_rate_taxClassCode_idx" ON "public"."delivery_rate" ("tax_class_code");

CREATE INDEX "delivery_rate_zoneId_idx" ON "public"."delivery_rate" ("zone_id");

CREATE TABLE "public"."checkout_quote" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "address_id" uuid NOT NULL, "cart_id" uuid NOT NULL, "coupon_id" uuid NULL, "method_code" text NOT NULL, "zone_id" uuid NOT NULL, "cart_revision" bigint NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "expires_at" timestamptz NOT NULL, "pricing_digest" text NOT NULL, "summary" jsonb NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "checkout_quote_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "public"."address" ("id") ON DELETE CASCADE, CONSTRAINT "checkout_quote_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."cart" ("id") ON DELETE CASCADE, CONSTRAINT "checkout_quote_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupon" ("id") ON DELETE SET NULL, CONSTRAINT "checkout_quote_zone_id_method_code_fkey" FOREIGN KEY ("zone_id", "method_code") REFERENCES "public"."delivery_rate" ("zone_id", "method_code") ON DELETE CASCADE);

CREATE INDEX "checkout_quote_cartId_expiresAt_idx" ON "public"."checkout_quote" ("cart_id", "expires_at");

CREATE INDEX "checkout_quote_addressId_idx" ON "public"."checkout_quote" ("address_id");

CREATE INDEX "checkout_quote_cartId_idx" ON "public"."checkout_quote" ("cart_id");

CREATE INDEX "checkout_quote_couponId_idx" ON "public"."checkout_quote" ("coupon_id");

CREATE INDEX "checkout_quote_zoneId_methodCode_idx" ON "public"."checkout_quote" ("zone_id", "method_code");

CREATE TABLE "public"."customer_order" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "cart_id" uuid NOT NULL, "quote_id" uuid NOT NULL, "user_uid" text NOT NULL, "confirmed_at" timestamptz NOT NULL, "contact_email" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "currency" text NOT NULL DEFAULT 'MXN', "discount_cents" bigint NOT NULL, "folio" text NOT NULL, "items_tax_cents" bigint NOT NULL, "shipping_cents" bigint NOT NULL, "shipping_tax_bps" integer NOT NULL, "shipping_tax_cents" bigint NOT NULL, "status" text NOT NULL DEFAULT 'PAID', "subtotal_cents" bigint NOT NULL, "total_cents" bigint NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "customer_order_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."cart" ("id") ON DELETE CASCADE, CONSTRAINT "customer_order_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."checkout_quote" ("id") ON DELETE CASCADE, CONSTRAINT "customer_order_user_uid_fkey" FOREIGN KEY ("user_uid") REFERENCES "public"."app_user" ("uid") ON DELETE CASCADE);

CREATE INDEX "customer_order_userUid_createdAt_id_idx" ON "public"."customer_order" ("user_uid", "created_at", "id");

CREATE INDEX "customer_order_status_createdAt_id_idx" ON "public"."customer_order" ("status", "created_at", "id");

CREATE INDEX "customer_order_cartId_idx" ON "public"."customer_order" ("cart_id");

CREATE INDEX "customer_order_quoteId_idx" ON "public"."customer_order" ("quote_id");

CREATE INDEX "customer_order_userUid_idx" ON "public"."customer_order" ("user_uid");

CREATE UNIQUE INDEX "customer_order_cartId_uidx" ON "public"."customer_order" ("cart_id");

CREATE UNIQUE INDEX "customer_order_quoteId_uidx" ON "public"."customer_order" ("quote_id");

CREATE UNIQUE INDEX "customer_order_folio_uidx" ON "public"."customer_order" ("folio");

CREATE TABLE "public"."coupon_redemption" ("order_id" uuid NOT NULL, "coupon_id" uuid NOT NULL, "code_snapshot" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("order_id"), CONSTRAINT "coupon_redemption_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupon" ("id") ON DELETE CASCADE, CONSTRAINT "coupon_redemption_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order" ("id") ON DELETE CASCADE);

CREATE INDEX "coupon_redemption_couponId_orderId_idx" ON "public"."coupon_redemption" ("coupon_id", "order_id");

CREATE INDEX "coupon_redemption_couponId_idx" ON "public"."coupon_redemption" ("coupon_id");

CREATE INDEX "coupon_redemption_orderId_idx" ON "public"."coupon_redemption" ("order_id");

CREATE TABLE "public"."favorite" ("user_uid" text NOT NULL, "product_id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("user_uid", "product_id"), CONSTRAINT "favorite_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product" ("id") ON DELETE CASCADE, CONSTRAINT "favorite_user_uid_fkey" FOREIGN KEY ("user_uid") REFERENCES "public"."app_user" ("uid") ON DELETE CASCADE);

CREATE INDEX "favorite_productId_idx" ON "public"."favorite" ("product_id");

CREATE INDEX "favorite_userUid_idx" ON "public"."favorite" ("user_uid");

CREATE TABLE "public"."order_item" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "order_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "description_snapshot" text NOT NULL, "discount_cents" bigint NOT NULL, "name_snapshot" text NOT NULL, "option_snapshot" text NOT NULL, "quantity" integer NOT NULL, "sku_snapshot" text NOT NULL, "tax_bps" integer NOT NULL, "tax_cents" bigint NOT NULL, "unit_price_cents" bigint NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order" ("id") ON DELETE CASCADE, CONSTRAINT "order_item_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant" ("id") ON DELETE CASCADE);

CREATE INDEX "order_item_orderId_idx" ON "public"."order_item" ("order_id");

CREATE INDEX "order_item_variantId_idx" ON "public"."order_item" ("variant_id");

CREATE UNIQUE INDEX "order_item_orderId_variantId_uidx" ON "public"."order_item" ("order_id", "variant_id");

CREATE TABLE "public"."return_request" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "assigned_to_uid" text NULL, "order_id" uuid NOT NULL, "closed_at" timestamptz NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "description" text NOT NULL, "folio" text NOT NULL, "kind" text NOT NULL, "reason_code" text NOT NULL, "resolution_code" text NULL, "resolution_note" text NULL, "status" text NOT NULL DEFAULT 'SUBMITTED', "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "return_request_assigned_to_uid_fkey" FOREIGN KEY ("assigned_to_uid") REFERENCES "public"."app_user" ("uid") ON DELETE SET NULL, CONSTRAINT "return_request_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order" ("id") ON DELETE CASCADE);

CREATE INDEX "return_request_status_createdAt_id_idx" ON "public"."return_request" ("status", "created_at", "id");

CREATE INDEX "return_request_assignedToUid_idx" ON "public"."return_request" ("assigned_to_uid");

CREATE INDEX "return_request_orderId_idx" ON "public"."return_request" ("order_id");

CREATE UNIQUE INDEX "return_request_folio_uidx" ON "public"."return_request" ("folio");

CREATE TABLE "public"."return_item" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "order_item_id" uuid NOT NULL, "return_request_id" uuid NOT NULL, "approved_qty" integer NULL, "condition_code" text NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "inspection_note" text NULL, "received_qty" integer NOT NULL DEFAULT 0, "requested_qty" integer NOT NULL, "restocked_qty" integer NOT NULL DEFAULT 0, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "return_item_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item" ("id") ON DELETE CASCADE, CONSTRAINT "return_item_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_request" ("id") ON DELETE CASCADE);

CREATE INDEX "return_item_orderItemId_idx" ON "public"."return_item" ("order_item_id");

CREATE INDEX "return_item_returnRequestId_idx" ON "public"."return_item" ("return_request_id");

CREATE UNIQUE INDEX "return_item_returnRequestId_orderItemId_uidx" ON "public"."return_item" ("return_request_id", "order_item_id");

CREATE TABLE "public"."inventory_movement" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "command_id" uuid NULL, "order_item_id" uuid NULL, "return_item_id" uuid NULL, "variant_id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "delta" integer NOT NULL, "kind" text NOT NULL, "reason" text NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "inventory_movement_command_id_fkey" FOREIGN KEY ("command_id") REFERENCES "public"."commerce_command" ("id") ON DELETE SET NULL, CONSTRAINT "inventory_movement_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item" ("id") ON DELETE SET NULL, CONSTRAINT "inventory_movement_return_item_id_fkey" FOREIGN KEY ("return_item_id") REFERENCES "public"."return_item" ("id") ON DELETE SET NULL, CONSTRAINT "inventory_movement_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant" ("id") ON DELETE CASCADE);

CREATE INDEX "inventory_movement_variantId_createdAt_id_idx" ON "public"."inventory_movement" ("variant_id", "created_at", "id");

CREATE INDEX "inventory_movement_commandId_idx" ON "public"."inventory_movement" ("command_id");

CREATE INDEX "inventory_movement_orderItemId_idx" ON "public"."inventory_movement" ("order_item_id");

CREATE INDEX "inventory_movement_returnItemId_idx" ON "public"."inventory_movement" ("return_item_id");

CREATE INDEX "inventory_movement_variantId_idx" ON "public"."inventory_movement" ("variant_id");

CREATE TABLE "public"."support_ticket" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "assigned_to_uid" text NULL, "order_id" uuid NULL, "requester_uid" text NOT NULL, "closed_at" timestamptz NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "folio" text NOT NULL, "status" text NOT NULL DEFAULT 'OPEN', "subject" text NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "support_ticket_assigned_to_uid_fkey" FOREIGN KEY ("assigned_to_uid") REFERENCES "public"."app_user" ("uid") ON DELETE SET NULL, CONSTRAINT "support_ticket_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order" ("id") ON DELETE SET NULL, CONSTRAINT "support_ticket_requester_uid_fkey" FOREIGN KEY ("requester_uid") REFERENCES "public"."app_user" ("uid") ON DELETE CASCADE);

CREATE INDEX "support_ticket_requesterUid_createdAt_id_idx" ON "public"."support_ticket" ("requester_uid", "created_at", "id");

CREATE INDEX "support_ticket_assignedToUid_idx" ON "public"."support_ticket" ("assigned_to_uid");

CREATE INDEX "support_ticket_orderId_idx" ON "public"."support_ticket" ("order_id");

CREATE INDEX "support_ticket_requesterUid_idx" ON "public"."support_ticket" ("requester_uid");

CREATE UNIQUE INDEX "support_ticket_folio_uidx" ON "public"."support_ticket" ("folio");

CREATE TABLE "public"."notification" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "command_id" uuid NOT NULL, "order_id" uuid NULL, "return_request_id" uuid NULL, "support_ticket_id" uuid NULL, "user_uid" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "kind" text NOT NULL, "read_at" timestamptz NULL, PRIMARY KEY ("id"), CONSTRAINT "notification_command_id_fkey" FOREIGN KEY ("command_id") REFERENCES "public"."commerce_command" ("id") ON DELETE CASCADE, CONSTRAINT "notification_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order" ("id") ON DELETE SET NULL, CONSTRAINT "notification_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_request" ("id") ON DELETE SET NULL, CONSTRAINT "notification_support_ticket_id_fkey" FOREIGN KEY ("support_ticket_id") REFERENCES "public"."support_ticket" ("id") ON DELETE SET NULL, CONSTRAINT "notification_user_uid_fkey" FOREIGN KEY ("user_uid") REFERENCES "public"."app_user" ("uid") ON DELETE CASCADE);

CREATE INDEX "notification_userUid_readAt_createdAt_idx" ON "public"."notification" ("user_uid", "read_at", "created_at");

CREATE INDEX "notification_commandId_idx" ON "public"."notification" ("command_id");

CREATE INDEX "notification_orderId_idx" ON "public"."notification" ("order_id");

CREATE INDEX "notification_returnRequestId_idx" ON "public"."notification" ("return_request_id");

CREATE INDEX "notification_supportTicketId_idx" ON "public"."notification" ("support_ticket_id");

CREATE INDEX "notification_userUid_idx" ON "public"."notification" ("user_uid");

CREATE UNIQUE INDEX "notification_commandId_userUid_kind_uidx" ON "public"."notification" ("command_id", "user_uid", "kind");

CREATE TABLE "public"."order_address" ("order_id" uuid NOT NULL, "city" text NOT NULL, "country_code" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "district" text NOT NULL, "line1" text NOT NULL, "line2" text NULL, "phone" text NOT NULL, "postal_code" text NOT NULL, "recipient" text NOT NULL, "state_code" text NOT NULL, PRIMARY KEY ("order_id"), CONSTRAINT "order_address_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order" ("id") ON DELETE CASCADE);

CREATE INDEX "order_address_orderId_idx" ON "public"."order_address" ("order_id");

CREATE TABLE "public"."order_status_event" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "command_id" uuid NOT NULL, "order_id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "new_status" text NOT NULL, "previous_status" text NULL, "reason" text NULL, PRIMARY KEY ("id"), CONSTRAINT "order_status_event_command_id_fkey" FOREIGN KEY ("command_id") REFERENCES "public"."commerce_command" ("id") ON DELETE CASCADE, CONSTRAINT "order_status_event_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order" ("id") ON DELETE CASCADE);

CREATE INDEX "order_status_event_orderId_createdAt_id_idx" ON "public"."order_status_event" ("order_id", "created_at", "id");

CREATE INDEX "order_status_event_commandId_idx" ON "public"."order_status_event" ("command_id");

CREATE INDEX "order_status_event_orderId_idx" ON "public"."order_status_event" ("order_id");

CREATE TABLE "public"."payment" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "checkout_command_id" uuid NOT NULL, "order_id" uuid NULL, "quote_id" uuid NOT NULL, "amount_cents" bigint NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "decided_at" timestamptz NULL, "decision_code" text NULL, "provider" text NOT NULL DEFAULT 'SIMULATED', "provider_reference" text NOT NULL, "status" text NOT NULL, "terms_accepted_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "payment_checkout_command_id_fkey" FOREIGN KEY ("checkout_command_id") REFERENCES "public"."commerce_command" ("id") ON DELETE CASCADE, CONSTRAINT "payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order" ("id") ON DELETE SET NULL, CONSTRAINT "payment_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."checkout_quote" ("id") ON DELETE CASCADE);

CREATE INDEX "payment_checkoutCommandId_idx" ON "public"."payment" ("checkout_command_id");

CREATE INDEX "payment_orderId_idx" ON "public"."payment" ("order_id");

CREATE INDEX "payment_quoteId_idx" ON "public"."payment" ("quote_id");

CREATE UNIQUE INDEX "payment_checkoutCommandId_uidx" ON "public"."payment" ("checkout_command_id");

CREATE UNIQUE INDEX "payment_orderId_uidx" ON "public"."payment" ("order_id");

CREATE UNIQUE INDEX "payment_providerReference_uidx" ON "public"."payment" ("provider_reference");

CREATE TABLE "public"."product_image" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "product_id" uuid NOT NULL, "alt" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "credit" text NULL, "position" integer NOT NULL, "src" text NOT NULL, PRIMARY KEY ("id"), CONSTRAINT "product_image_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product" ("id") ON DELETE CASCADE);

CREATE INDEX "product_image_productId_idx" ON "public"."product_image" ("product_id");

CREATE UNIQUE INDEX "product_image_productId_position_uidx" ON "public"."product_image" ("product_id", "position");

CREATE TABLE "public"."refund" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "command_id" uuid NOT NULL, "payment_id" uuid NOT NULL, "return_request_id" uuid NOT NULL, "amount_cents" bigint NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "decided_at" timestamptz NULL, "provider_reference" text NOT NULL, "shipping_refund_cents" bigint NOT NULL DEFAULT 0::bigint, "status" text NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "refund_command_id_fkey" FOREIGN KEY ("command_id") REFERENCES "public"."commerce_command" ("id") ON DELETE CASCADE, CONSTRAINT "refund_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payment" ("id") ON DELETE CASCADE, CONSTRAINT "refund_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_request" ("id") ON DELETE CASCADE);

CREATE INDEX "refund_paymentId_status_idx" ON "public"."refund" ("payment_id", "status");

CREATE INDEX "refund_commandId_idx" ON "public"."refund" ("command_id");

CREATE INDEX "refund_paymentId_idx" ON "public"."refund" ("payment_id");

CREATE INDEX "refund_returnRequestId_idx" ON "public"."refund" ("return_request_id");

CREATE UNIQUE INDEX "refund_providerReference_uidx" ON "public"."refund" ("provider_reference");

CREATE TABLE "public"."refund_item" ("refund_id" uuid NOT NULL, "return_item_id" uuid NOT NULL, "amount_cents" bigint NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("refund_id", "return_item_id"), CONSTRAINT "refund_item_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "public"."refund" ("id") ON DELETE CASCADE, CONSTRAINT "refund_item_return_item_id_fkey" FOREIGN KEY ("return_item_id") REFERENCES "public"."return_item" ("id") ON DELETE CASCADE);

CREATE INDEX "refund_item_refundId_idx" ON "public"."refund_item" ("refund_id");

CREATE INDEX "refund_item_returnItemId_idx" ON "public"."refund_item" ("return_item_id");

CREATE TABLE "public"."return_event" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "command_id" uuid NOT NULL, "return_request_id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "new_status" text NOT NULL, "previous_status" text NULL, "public_detail" text NULL, PRIMARY KEY ("id"), CONSTRAINT "return_event_command_id_fkey" FOREIGN KEY ("command_id") REFERENCES "public"."commerce_command" ("id") ON DELETE CASCADE, CONSTRAINT "return_event_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_request" ("id") ON DELETE CASCADE);

CREATE INDEX "return_event_returnRequestId_createdAt_id_idx" ON "public"."return_event" ("return_request_id", "created_at", "id");

CREATE INDEX "return_event_commandId_idx" ON "public"."return_event" ("command_id");

CREATE INDEX "return_event_returnRequestId_idx" ON "public"."return_event" ("return_request_id");

CREATE TABLE "public"."return_evidence" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "return_request_id" uuid NOT NULL, "uploaded_by_uid" text NOT NULL, "content_b64" text NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz NULL, "media_type" text NOT NULL, "sha256" text NOT NULL, "size_bytes" integer NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "return_evidence_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_request" ("id") ON DELETE CASCADE, CONSTRAINT "return_evidence_uploaded_by_uid_fkey" FOREIGN KEY ("uploaded_by_uid") REFERENCES "public"."app_user" ("uid") ON DELETE CASCADE);

CREATE INDEX "return_evidence_returnRequestId_idx" ON "public"."return_evidence" ("return_request_id");

CREATE INDEX "return_evidence_uploadedByUid_idx" ON "public"."return_evidence" ("uploaded_by_uid");

CREATE UNIQUE INDEX "return_evidence_returnRequestId_sha256_uidx" ON "public"."return_evidence" ("return_request_id", "sha256");

CREATE TABLE "public"."review" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "author_uid" text NOT NULL, "moderated_by_uid" text NULL, "order_item_id" uuid NOT NULL, "product_id" uuid NOT NULL, "body" text NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "moderated_at" timestamptz NULL, "moderation_status" text NOT NULL DEFAULT 'PENDING', "rating" integer NOT NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "review_author_uid_fkey" FOREIGN KEY ("author_uid") REFERENCES "public"."app_user" ("uid") ON DELETE CASCADE, CONSTRAINT "review_moderated_by_uid_fkey" FOREIGN KEY ("moderated_by_uid") REFERENCES "public"."app_user" ("uid") ON DELETE SET NULL, CONSTRAINT "review_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item" ("id") ON DELETE CASCADE, CONSTRAINT "review_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product" ("id") ON DELETE CASCADE);

CREATE INDEX "review_authorUid_idx" ON "public"."review" ("author_uid");

CREATE INDEX "review_moderatedByUid_idx" ON "public"."review" ("moderated_by_uid");

CREATE INDEX "review_orderItemId_idx" ON "public"."review" ("order_item_id");

CREATE INDEX "review_productId_idx" ON "public"."review" ("product_id");

CREATE UNIQUE INDEX "review_authorUid_productId_uidx" ON "public"."review" ("author_uid", "product_id");

CREATE UNIQUE INDEX "review_orderItemId_uidx" ON "public"."review" ("order_item_id");

CREATE TABLE "public"."shipment" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "order_id" uuid NOT NULL, "carrier" text NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "delivered_at" timestamptz NULL, "estimated_from" date NOT NULL, "estimated_to" date NOT NULL, "method_snapshot" text NOT NULL, "shipped_at" timestamptz NULL, "status" text NOT NULL DEFAULT 'PLANNED', "tracking_code" text NULL, "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "shipment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order" ("id") ON DELETE CASCADE);

CREATE INDEX "shipment_orderId_idx" ON "public"."shipment" ("order_id");

CREATE UNIQUE INDEX "shipment_orderId_uidx" ON "public"."shipment" ("order_id");

CREATE TABLE "public"."shipment_event" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "command_id" uuid NOT NULL, "shipment_id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "event_type" text NOT NULL, "occurred_at" timestamptz NOT NULL, "public_detail" text NULL, PRIMARY KEY ("id"), CONSTRAINT "shipment_event_command_id_fkey" FOREIGN KEY ("command_id") REFERENCES "public"."commerce_command" ("id") ON DELETE CASCADE, CONSTRAINT "shipment_event_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipment" ("id") ON DELETE CASCADE);

CREATE INDEX "shipment_event_shipmentId_occurredAt_id_idx" ON "public"."shipment_event" ("shipment_id", "occurred_at", "id");

CREATE INDEX "shipment_event_commandId_idx" ON "public"."shipment_event" ("command_id");

CREATE INDEX "shipment_event_shipmentId_idx" ON "public"."shipment_event" ("shipment_id");

CREATE TABLE "public"."support_message" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "author_uid" text NOT NULL, "ticket_id" uuid NOT NULL, "body" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "visibility" text NOT NULL DEFAULT 'CUSTOMER_VISIBLE', PRIMARY KEY ("id"), CONSTRAINT "support_message_author_uid_fkey" FOREIGN KEY ("author_uid") REFERENCES "public"."app_user" ("uid") ON DELETE CASCADE, CONSTRAINT "support_message_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket" ("id") ON DELETE CASCADE);

CREATE INDEX "support_message_ticketId_createdAt_id_idx" ON "public"."support_message" ("ticket_id", "created_at", "id");

CREATE INDEX "support_message_authorUid_idx" ON "public"."support_message" ("author_uid");

CREATE INDEX "support_message_ticketId_idx" ON "public"."support_message" ("ticket_id");

CREATE TABLE "public"."legal_document" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "body" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "kind" text NOT NULL, "published_at" timestamptz NULL, "sha256" text NOT NULL, "title" text NOT NULL, "version" integer NOT NULL, "withdrawn_at" timestamptz NULL, PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "legal_document_kind_version_uidx" ON "public"."legal_document" ("kind", "version");

CREATE TABLE "public"."terms_acceptance" ("order_id" uuid NOT NULL, "legal_document_id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "evidence_kind" text NOT NULL, "presented_at" timestamptz NOT NULL, PRIMARY KEY ("order_id", "legal_document_id"), CONSTRAINT "terms_acceptance_legal_document_id_fkey" FOREIGN KEY ("legal_document_id") REFERENCES "public"."legal_document" ("id") ON DELETE CASCADE, CONSTRAINT "terms_acceptance_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."customer_order" ("id") ON DELETE CASCADE);

CREATE INDEX "terms_acceptance_legalDocumentId_idx" ON "public"."terms_acceptance" ("legal_document_id");

CREATE INDEX "terms_acceptance_orderId_idx" ON "public"."terms_acceptance" ("order_id");

CREATE TABLE "public"."role" ("code" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "label" text NOT NULL, PRIMARY KEY ("code"));

CREATE TABLE "public"."user_role" ("user_uid" text NOT NULL, "role_code" text NOT NULL, "granted_by_uid" text NULL, "created_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("user_uid", "role_code"), CONSTRAINT "user_role_granted_by_uid_fkey" FOREIGN KEY ("granted_by_uid") REFERENCES "public"."app_user" ("uid") ON DELETE SET NULL, CONSTRAINT "user_role_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "public"."role" ("code") ON DELETE CASCADE, CONSTRAINT "user_role_user_uid_fkey" FOREIGN KEY ("user_uid") REFERENCES "public"."app_user" ("uid") ON DELETE CASCADE);

CREATE INDEX "user_role_grantedByUid_idx" ON "public"."user_role" ("granted_by_uid");

CREATE INDEX "user_role_roleCode_idx" ON "public"."user_role" ("role_code");

CREATE INDEX "user_role_userUid_idx" ON "public"."user_role" ("user_uid");
