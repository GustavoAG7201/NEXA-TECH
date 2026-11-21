import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Address_Key {
  id: UUIDString;
  __typename?: 'Address_Key';
}

export interface AdjustInventoryData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface AdjustInventoryVariables {
  key: UUIDString;
  variantId: UUIDString;
  delta: number;
  reason: string;
}

export interface AppUser_Key {
  uid: string;
  __typename?: 'AppUser_Key';
}

export interface ApproveRefundData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface ApproveRefundVariables {
  key: UUIDString;
  id: UUIDString;
  shipping: boolean;
  detail: string;
}

export interface ArchiveProductData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface ArchiveProductVariables {
  key: UUIDString;
  id: UUIDString;
}

export interface AssignCaseData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface AssignCaseVariables {
  key: UUIDString;
  id: UUIDString;
  assignedTo?: string | null;
}

export interface AssignTicketData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface AssignTicketVariables {
  key: UUIDString;
  id: UUIDString;
  assignedTo?: string | null;
}

export interface AuditLog_Key {
  id: UUIDString;
  __typename?: 'AuditLog_Key';
}

export interface CartItem_Key {
  cartId: UUIDString;
  variantId: UUIDString;
  __typename?: 'CartItem_Key';
}

export interface Cart_Key {
  id: UUIDString;
  __typename?: 'Cart_Key';
}

export interface Category_Key {
  id: UUIDString;
  __typename?: 'Category_Key';
}

export interface ChangeUserRoleData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface ChangeUserRoleVariables {
  key: UUIDString;
  uid: string;
  role: string;
  enabled: boolean;
}

export interface CheckoutQuote_Key {
  id: UUIDString;
  __typename?: 'CheckoutQuote_Key';
}

export interface CommerceCommand_Key {
  id: UUIDString;
  __typename?: 'CommerceCommand_Key';
}

export interface CouponRedemption_Key {
  orderId: UUIDString;
  __typename?: 'CouponRedemption_Key';
}

export interface Coupon_Key {
  id: UUIDString;
  __typename?: 'Coupon_Key';
}

export interface CustomerOrder_Key {
  id: UUIDString;
  __typename?: 'CustomerOrder_Key';
}

export interface DeliveryMethod_Key {
  code: string;
  __typename?: 'DeliveryMethod_Key';
}

export interface DeliveryRate_Key {
  zoneId: UUIDString;
  methodCode: string;
  __typename?: 'DeliveryRate_Key';
}

export interface DeliveryZone_Key {
  id: UUIDString;
  __typename?: 'DeliveryZone_Key';
}

export interface Favorite_Key {
  userUid: string;
  productId: UUIDString;
  __typename?: 'Favorite_Key';
}

export interface GetAdminReportsData {
  staffDailySales: ({
    day?: DateString | null;
    orderCount?: Int64String | null;
    netCents?: Int64String | null;
  })[];
}

export interface GetAdminReportsVariables {
  start: DateString;
  end: DateString;
}

export interface GetOperationTotalsData {
  staffOperationTotals: ({
    orderCount?: Int64String | null;
    ordersByStatus?: unknown | null;
    availableUnits?: Int64String | null;
    lowStockVariants?: Int64String | null;
    grossCents?: Int64String | null;
    refundedCents?: Int64String | null;
    refundCount?: Int64String | null;
    cancellationRequests?: Int64String | null;
    returnRequests?: Int64String | null;
    exchangeRequests?: Int64String | null;
    warrantyRequests?: Int64String | null;
    couponUses?: Int64String | null;
  })[];
}

export interface GetStaffCaseRefundsData {
  staffOrders: ({
    order?: {
      returnRequests_on_order: ({
        refunds_on_request: ({
          id: UUIDString;
          amountCents: Int64String;
          shippingRefundCents: Int64String;
          decidedAt?: TimestampString | null;
        } & Refund_Key)[];
      })[];
    };
  })[];
}

export interface GetStaffCaseRefundsVariables {
  orderId: UUIDString;
  id: UUIDString;
}

export interface GetStaffOrderData {
  staffOrders: ({
    order?: {
      id: UUIDString;
      folio: string;
      userUid: string;
      status: string;
      subtotalCents: Int64String;
      discountCents: Int64String;
      totalCents: Int64String;
      confirmedAt: TimestampString;
      orderItems_on_order: ({
        id: UUIDString;
        nameSnapshot: string;
        skuSnapshot: string;
        quantity: number;
        unitPriceCents: Int64String;
      } & OrderItem_Key)[];
      orderAddress_on_order?: {
        recipient: string;
        phone: string;
        line1: string;
        line2?: string | null;
        district: string;
        city: string;
        stateCode: string;
        postalCode: string;
      };
      shipment_on_order?: {
        id: UUIDString;
        status: string;
        carrier?: string | null;
        trackingCode?: string | null;
        estimatedFrom: DateString;
        estimatedTo: DateString;
        shippedAt?: TimestampString | null;
        deliveredAt?: TimestampString | null;
        shipmentEvents_on_shipment: ({
          eventType: string;
          publicDetail?: string | null;
          occurredAt: TimestampString;
        })[];
      } & Shipment_Key;
      orderStatusEvents_on_order: ({
        newStatus: string;
        reason?: string | null;
        createdAt: TimestampString;
      })[];
      payment_on_order?: {
        status: string;
        amountCents: Int64String;
      };
    } & CustomerOrder_Key;
  })[];
}

export interface GetStaffOrderVariables {
  id: UUIDString;
}

export interface GetStaffProductData {
  staffCatalogProducts: ({
    product?: {
      id: UUIDString;
      name: string;
      slug: string;
      status: string;
      categoryId: UUIDString;
      description: string;
      specs?: unknown | null;
      featured: boolean;
      productVariants_on_product: ({
        id: UUIDString;
        sku: string;
        optionLabel: string;
        unitPriceCents: Int64String;
        stockOnHand: number;
        archivedAt?: TimestampString | null;
      } & ProductVariant_Key)[];
    } & Product_Key;
  })[];
}

export interface GetStaffProductVariables {
  id: UUIDString;
  variantOffset: number;
}

export interface GetStaffReturnEvidenceData {
  staffReturnCases: ({
    request?: {
      returnEvidences_on_request: ({
        id: UUIDString;
        mediaType: string;
        sizeBytes: number;
        contentB64?: string | null;
        sha256: string;
      } & ReturnEvidence_Key)[];
    };
  })[];
}

export interface GetStaffReturnEvidenceVariables {
  requestId: UUIDString;
  id: UUIDString;
}

export interface GetStaffReturnRequestData {
  staffReturnCases: ({
    request?: {
      id: UUIDString;
      orderId: UUIDString;
      folio: string;
      kind: string;
      status: string;
      reasonCode: string;
      description: string;
      assignedToUid?: string | null;
      resolutionCode?: string | null;
      resolutionNote?: string | null;
      createdAt: TimestampString;
      closedAt?: TimestampString | null;
      order: {
        folio: string;
        status: string;
      };
      returnItems_on_request: ({
        id: UUIDString;
        orderItemId: UUIDString;
        requestedQty: number;
        approvedQty?: number | null;
        receivedQty: number;
        restockedQty: number;
        conditionCode?: string | null;
        inspectionNote?: string | null;
        orderItem: {
          skuSnapshot: string;
          nameSnapshot: string;
        };
      } & ReturnItem_Key)[];
      returnEvidences_on_request: ({
        id: UUIDString;
        mediaType: string;
        sizeBytes: number;
        sha256: string;
      } & ReturnEvidence_Key)[];
      returnEvents_on_request: ({
        newStatus: string;
        publicDetail?: string | null;
        createdAt: TimestampString;
      })[];
    } & ReturnRequest_Key;
  })[];
}

export interface GetStaffReturnRequestVariables {
  id: UUIDString;
}

export interface GetStaffTicketData {
  staffTickets: ({
    ticket?: {
      id: UUIDString;
      folio: string;
      status: string;
      subject: string;
      orderId?: UUIDString | null;
      assignedToUid?: string | null;
      createdAt: TimestampString;
      closedAt?: TimestampString | null;
      supportMessages_on_ticket: ({
        id: UUIDString;
        body: string;
        visibility: string;
        createdAt: TimestampString;
        authorUid: string;
      } & SupportMessage_Key)[];
    } & SupportTicket_Key;
  })[];
}

export interface GetStaffTicketVariables {
  id: UUIDString;
  messageOffset?: number | null;
}

export interface InventoryMovement_Key {
  id: UUIDString;
  __typename?: 'InventoryMovement_Key';
}

export interface LegalDocument_Key {
  id: UUIDString;
  __typename?: 'LegalDocument_Key';
}

export interface ListAuditEventsData {
  staffAuditEvents: ({
    event?: {
      id: UUIDString;
      actorUid?: string | null;
      action: string;
      entityType: string;
      entityKey: string;
      metadata?: unknown | null;
      createdAt: TimestampString;
    } & AuditLog_Key;
  })[];
}

export interface ListAuditEventsVariables {
  offset: number;
}

export interface ListCouponRedemptionsData {
  staffCoupons: ({
    coupon?: {
      couponRedemptions_on_coupon: ({
        orderId: UUIDString;
        codeSnapshot: string;
        createdAt: TimestampString;
        order: {
          folio: string;
          status: string;
          discountCents: Int64String;
        };
      } & CouponRedemption_Key)[];
    };
  })[];
}

export interface ListCouponRedemptionsVariables {
  id: UUIDString;
  offset: number;
}

export interface ListCustomersData {
  staffCustomers: ({
    customer?: {
      uid: string;
      displayName: string;
      status: string;
      createdAt: TimestampString;
      userRoles_on_user: ({
        roleCode: string;
      })[];
    } & AppUser_Key;
  })[];
}

export interface ListCustomersVariables {
  offset: number;
}

export interface ListInventoryMovementsData {
  staffInventories: ({
    movement?: {
      id: UUIDString;
      variantId: UUIDString;
      kind: string;
      delta: number;
      reason: string;
      createdAt: TimestampString;
      command?: {
        actorUid: string;
      };
      variant: {
        sku: string;
        stockOnHand: number;
        lowStockThreshold: number;
      };
    } & InventoryMovement_Key;
  })[];
}

export interface ListInventoryMovementsVariables {
  variantId?: UUIDString | null;
  offset: number;
}

export interface ListLowStockData {
  staffStockAlerts: ({
    variantId?: UUIDString | null;
    sku?: string | null;
    stockOnHand?: number | null;
    lowStockThreshold?: number | null;
  })[];
}

export interface ListLowStockVariables {
  offset: number;
}

export interface ListReturnSummaryData {
  staffReturnSummaries: ({
    day?: DateString | null;
    kind?: string | null;
    status?: string | null;
    reasonCode?: string | null;
    requestCount?: Int64String | null;
  })[];
}

export interface ListReturnSummaryVariables {
  start: DateString;
  end: DateString;
  offset: number;
}

export interface ListSkuSalesData {
  staffSkuSales: ({
    day?: DateString | null;
    sku?: string | null;
    grossUnits?: Int64String | null;
  })[];
}

export interface ListSkuSalesVariables {
  start: DateString;
  end: DateString;
  offset: number;
}

export interface ListStaffCategoriesData {
  staffCategories: ({
    category?: {
      id: UUIDString;
      slug: string;
      name: string;
      description?: string | null;
      archivedAt?: TimestampString | null;
    } & Category_Key;
  })[];
}

export interface ListStaffCategoriesVariables {
  offset: number;
}

export interface ListStaffCouponsData {
  staffCoupons: ({
    redemptionCount?: Int64String | null;
    coupon?: {
      id: UUIDString;
      code: string;
      kind: string;
      fixedAmountCents?: Int64String | null;
      percentageBps?: number | null;
      minSubtotalCents: Int64String;
      startsAt: TimestampString;
      endsAt: TimestampString;
      totalLimit?: number | null;
      perUserLimit?: number | null;
      archivedAt?: TimestampString | null;
    } & Coupon_Key;
  })[];
}

export interface ListStaffCouponsVariables {
  offset: number;
  id?: UUIDString | null;
}

export interface ListStaffOperatorsData {
  staffOperators: ({
    uid?: string | null;
    displayName?: string | null;
  })[];
}

export interface ListStaffOperatorsVariables {
  offset: number;
}

export interface ListStaffOrdersData {
  staffOrders: ({
    order?: {
      id: UUIDString;
      folio: string;
      status: string;
      userUid: string;
      currency: string;
      totalCents: Int64String;
      confirmedAt: TimestampString;
    } & CustomerOrder_Key;
  })[];
}

export interface ListStaffOrdersVariables {
  offset: number;
  status?: string | null;
}

export interface ListStaffProductsData {
  staffCatalogProducts: ({
    product?: {
      id: UUIDString;
      name: string;
      slug: string;
      status: string;
      category: {
        name: string;
      };
    } & Product_Key;
  })[];
}

export interface ListStaffProductsVariables {
  offset: number;
  search?: string | null;
  status?: string | null;
}

export interface ListStaffReturnRequestsData {
  staffReturnCases: ({
    request?: {
      id: UUIDString;
      folio: string;
      kind: string;
      status: string;
      createdAt: TimestampString;
      order: {
        folio: string;
      };
    } & ReturnRequest_Key;
  })[];
}

export interface ListStaffReturnRequestsVariables {
  offset: number;
  orderId?: UUIDString | null;
}

export interface ListStaffTaxClassesData {
  staffCatalogTaxes: ({
    code?: string | null;
    label?: string | null;
    rateBps?: number | null;
  })[];
}

export interface ListStaffTicketsData {
  staffTickets: ({
    ticket?: {
      id: UUIDString;
      folio: string;
      subject: string;
      status: string;
      assignedToUid?: string | null;
      updatedAt: TimestampString;
    } & SupportTicket_Key;
  })[];
}

export interface ListStaffTicketsVariables {
  offset: number;
}

export interface ListStaffVariantsData {
  staffCatalogVariants: ({
    variant?: {
      id: UUIDString;
      productId: UUIDString;
      sku: string;
      optionLabel: string;
      color?: string | null;
      taxClassCode: string;
      unitPriceCents: Int64String;
      compareAtCents?: Int64String | null;
      unitCostCents?: Int64String | null;
      stockOnHand: number;
      lowStockThreshold: number;
      weightG?: number | null;
      lengthMm?: number | null;
      widthMm?: number | null;
      heightMm?: number | null;
      archivedAt?: TimestampString | null;
      product: {
        name: string;
        status: string;
      };
    } & ProductVariant_Key;
  })[];
}

export interface ListStaffVariantsVariables {
  offset: number;
  id?: UUIDString | null;
  productId?: UUIDString | null;
  sku?: string | null;
}

export interface ListSupportQueueData {
  staffQueueEntries: ({
    id?: UUIDString | null;
    kind?: string | null;
    status?: string | null;
    createdAt?: TimestampString | null;
    assigned?: boolean | null;
  })[];
}

export interface ListSupportQueueVariables {
  offset: number;
}

export interface ModerateReviewData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface ModerateReviewVariables {
  key: UUIDString;
  id: UUIDString;
  approve: boolean;
}

export interface Notification_Key {
  id: UUIDString;
  __typename?: 'Notification_Key';
}

export interface OrderAddress_Key {
  orderId: UUIDString;
  __typename?: 'OrderAddress_Key';
}

export interface OrderItem_Key {
  id: UUIDString;
  __typename?: 'OrderItem_Key';
}

export interface OrderStatusEvent_Key {
  id: UUIDString;
  __typename?: 'OrderStatusEvent_Key';
}

export interface Payment_Key {
  id: UUIDString;
  __typename?: 'Payment_Key';
}

export interface ProductImage_Key {
  id: UUIDString;
  __typename?: 'ProductImage_Key';
}

export interface ProductVariant_Key {
  id: UUIDString;
  __typename?: 'ProductVariant_Key';
}

export interface Product_Key {
  id: UUIDString;
  __typename?: 'Product_Key';
}

export interface PublishPolicyData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface PublishPolicyVariables {
  key: UUIDString;
  kind: string;
  title: string;
  body: string;
}

export interface RecordInspectionData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface RecordInspectionVariables {
  key: UUIDString;
  id: UUIDString;
  items: unknown;
  detail?: string | null;
}

export interface RecordShipmentEventData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface RecordShipmentEventVariables {
  key: UUIDString;
  orderId: UUIDString;
  event: string;
  carrier?: string | null;
  trackingCode?: string | null;
  detail?: string | null;
}

export interface RefundItem_Key {
  refundId: UUIDString;
  returnItemId: UUIDString;
  __typename?: 'RefundItem_Key';
}

export interface Refund_Key {
  id: UUIDString;
  __typename?: 'Refund_Key';
}

export interface ReplyToCustomerData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface ReplyToCustomerVariables {
  key: UUIDString;
  id: UUIDString;
  body: string;
  internal: boolean;
  close: boolean;
}

export interface ResolveReplacementData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface ResolveReplacementVariables {
  key: UUIDString;
  id: UUIDString;
  detail: string;
}

export interface ReturnEvent_Key {
  id: UUIDString;
  __typename?: 'ReturnEvent_Key';
}

export interface ReturnEvidence_Key {
  id: UUIDString;
  __typename?: 'ReturnEvidence_Key';
}

export interface ReturnItem_Key {
  id: UUIDString;
  __typename?: 'ReturnItem_Key';
}

export interface ReturnRequest_Key {
  id: UUIDString;
  __typename?: 'ReturnRequest_Key';
}

export interface ReviewReturnRequestData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface ReviewReturnRequestVariables {
  key: UUIDString;
  id: UUIDString;
  state: string;
  detail?: string | null;
  resolution?: string | null;
}

export interface Review_Key {
  id: UUIDString;
  __typename?: 'Review_Key';
}

export interface Role_Key {
  code: string;
  __typename?: 'Role_Key';
}

export interface SaveCategoryData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface SaveCategoryVariables {
  key: UUIDString;
  id?: UUIDString | null;
  slug: string;
  name: string;
  description?: string | null;
  archived: boolean;
}

export interface SaveCouponData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface SaveCouponVariables {
  key: UUIDString;
  id?: UUIDString | null;
  code: string;
  kind: string;
  fixed?: Int64String | null;
  bps?: number | null;
  minimum: Int64String;
  startsAt: TimestampString;
  endsAt: TimestampString;
  maxUses?: number | null;
  maxPerUser?: number | null;
  archived: boolean;
}

export interface SaveProductData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface SaveProductImageData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface SaveProductImageVariables {
  key: UUIDString;
  id?: UUIDString | null;
  productId: UUIDString;
  src: string;
  alt: string;
  position: number;
  credit?: string | null;
}

export interface SaveProductVariables {
  key: UUIDString;
  id?: UUIDString | null;
  categoryId: UUIDString;
  slug: string;
  name: string;
  description: string;
  specs?: unknown | null;
  status: string;
  featured: boolean;
}

export interface SaveVariantData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface SaveVariantVariables {
  key: UUIDString;
  id?: UUIDString | null;
  productId: UUIDString;
  taxClass: string;
  sku: string;
  label: string;
  color?: string | null;
  price: Int64String;
  compareAt?: Int64String | null;
  cost?: Int64String | null;
  threshold: number;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  archived: boolean;
}

export interface ShipmentEvent_Key {
  id: UUIDString;
  __typename?: 'ShipmentEvent_Key';
}

export interface Shipment_Key {
  id: UUIDString;
  __typename?: 'Shipment_Key';
}

export interface SupportMessage_Key {
  id: UUIDString;
  __typename?: 'SupportMessage_Key';
}

export interface SupportTicket_Key {
  id: UUIDString;
  __typename?: 'SupportTicket_Key';
}

export interface TaxClass_Key {
  code: string;
  __typename?: 'TaxClass_Key';
}

export interface TermsAcceptance_Key {
  orderId: UUIDString;
  legalDocumentId: UUIDString;
  __typename?: 'TermsAcceptance_Key';
}

export interface UserRole_Key {
  userUid: string;
  roleCode: string;
  __typename?: 'UserRole_Key';
}

interface SaveCategoryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SaveCategoryVariables): MutationRef<SaveCategoryData, SaveCategoryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SaveCategoryVariables): MutationRef<SaveCategoryData, SaveCategoryVariables>;
  operationName: string;
}
export const saveCategoryRef: SaveCategoryRef;

export function saveCategory(vars: SaveCategoryVariables): MutationPromise<SaveCategoryData, SaveCategoryVariables>;
export function saveCategory(dc: DataConnect, vars: SaveCategoryVariables): MutationPromise<SaveCategoryData, SaveCategoryVariables>;

interface SaveProductRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SaveProductVariables): MutationRef<SaveProductData, SaveProductVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SaveProductVariables): MutationRef<SaveProductData, SaveProductVariables>;
  operationName: string;
}
export const saveProductRef: SaveProductRef;

export function saveProduct(vars: SaveProductVariables): MutationPromise<SaveProductData, SaveProductVariables>;
export function saveProduct(dc: DataConnect, vars: SaveProductVariables): MutationPromise<SaveProductData, SaveProductVariables>;

interface ArchiveProductRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ArchiveProductVariables): MutationRef<ArchiveProductData, ArchiveProductVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ArchiveProductVariables): MutationRef<ArchiveProductData, ArchiveProductVariables>;
  operationName: string;
}
export const archiveProductRef: ArchiveProductRef;

export function archiveProduct(vars: ArchiveProductVariables): MutationPromise<ArchiveProductData, ArchiveProductVariables>;
export function archiveProduct(dc: DataConnect, vars: ArchiveProductVariables): MutationPromise<ArchiveProductData, ArchiveProductVariables>;

interface SaveVariantRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SaveVariantVariables): MutationRef<SaveVariantData, SaveVariantVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SaveVariantVariables): MutationRef<SaveVariantData, SaveVariantVariables>;
  operationName: string;
}
export const saveVariantRef: SaveVariantRef;

export function saveVariant(vars: SaveVariantVariables): MutationPromise<SaveVariantData, SaveVariantVariables>;
export function saveVariant(dc: DataConnect, vars: SaveVariantVariables): MutationPromise<SaveVariantData, SaveVariantVariables>;

interface SaveProductImageRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SaveProductImageVariables): MutationRef<SaveProductImageData, SaveProductImageVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SaveProductImageVariables): MutationRef<SaveProductImageData, SaveProductImageVariables>;
  operationName: string;
}
export const saveProductImageRef: SaveProductImageRef;

export function saveProductImage(vars: SaveProductImageVariables): MutationPromise<SaveProductImageData, SaveProductImageVariables>;
export function saveProductImage(dc: DataConnect, vars: SaveProductImageVariables): MutationPromise<SaveProductImageData, SaveProductImageVariables>;

interface AdjustInventoryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdjustInventoryVariables): MutationRef<AdjustInventoryData, AdjustInventoryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdjustInventoryVariables): MutationRef<AdjustInventoryData, AdjustInventoryVariables>;
  operationName: string;
}
export const adjustInventoryRef: AdjustInventoryRef;

export function adjustInventory(vars: AdjustInventoryVariables): MutationPromise<AdjustInventoryData, AdjustInventoryVariables>;
export function adjustInventory(dc: DataConnect, vars: AdjustInventoryVariables): MutationPromise<AdjustInventoryData, AdjustInventoryVariables>;

interface SaveCouponRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SaveCouponVariables): MutationRef<SaveCouponData, SaveCouponVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SaveCouponVariables): MutationRef<SaveCouponData, SaveCouponVariables>;
  operationName: string;
}
export const saveCouponRef: SaveCouponRef;

export function saveCoupon(vars: SaveCouponVariables): MutationPromise<SaveCouponData, SaveCouponVariables>;
export function saveCoupon(dc: DataConnect, vars: SaveCouponVariables): MutationPromise<SaveCouponData, SaveCouponVariables>;

interface ModerateReviewRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ModerateReviewVariables): MutationRef<ModerateReviewData, ModerateReviewVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ModerateReviewVariables): MutationRef<ModerateReviewData, ModerateReviewVariables>;
  operationName: string;
}
export const moderateReviewRef: ModerateReviewRef;

export function moderateReview(vars: ModerateReviewVariables): MutationPromise<ModerateReviewData, ModerateReviewVariables>;
export function moderateReview(dc: DataConnect, vars: ModerateReviewVariables): MutationPromise<ModerateReviewData, ModerateReviewVariables>;

interface PublishPolicyRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: PublishPolicyVariables): MutationRef<PublishPolicyData, PublishPolicyVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: PublishPolicyVariables): MutationRef<PublishPolicyData, PublishPolicyVariables>;
  operationName: string;
}
export const publishPolicyRef: PublishPolicyRef;

export function publishPolicy(vars: PublishPolicyVariables): MutationPromise<PublishPolicyData, PublishPolicyVariables>;
export function publishPolicy(dc: DataConnect, vars: PublishPolicyVariables): MutationPromise<PublishPolicyData, PublishPolicyVariables>;

interface ChangeUserRoleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ChangeUserRoleVariables): MutationRef<ChangeUserRoleData, ChangeUserRoleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ChangeUserRoleVariables): MutationRef<ChangeUserRoleData, ChangeUserRoleVariables>;
  operationName: string;
}
export const changeUserRoleRef: ChangeUserRoleRef;

export function changeUserRole(vars: ChangeUserRoleVariables): MutationPromise<ChangeUserRoleData, ChangeUserRoleVariables>;
export function changeUserRole(dc: DataConnect, vars: ChangeUserRoleVariables): MutationPromise<ChangeUserRoleData, ChangeUserRoleVariables>;

interface RecordShipmentEventRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RecordShipmentEventVariables): MutationRef<RecordShipmentEventData, RecordShipmentEventVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RecordShipmentEventVariables): MutationRef<RecordShipmentEventData, RecordShipmentEventVariables>;
  operationName: string;
}
export const recordShipmentEventRef: RecordShipmentEventRef;

export function recordShipmentEvent(vars: RecordShipmentEventVariables): MutationPromise<RecordShipmentEventData, RecordShipmentEventVariables>;
export function recordShipmentEvent(dc: DataConnect, vars: RecordShipmentEventVariables): MutationPromise<RecordShipmentEventData, RecordShipmentEventVariables>;

interface AssignCaseRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AssignCaseVariables): MutationRef<AssignCaseData, AssignCaseVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AssignCaseVariables): MutationRef<AssignCaseData, AssignCaseVariables>;
  operationName: string;
}
export const assignCaseRef: AssignCaseRef;

export function assignCase(vars: AssignCaseVariables): MutationPromise<AssignCaseData, AssignCaseVariables>;
export function assignCase(dc: DataConnect, vars: AssignCaseVariables): MutationPromise<AssignCaseData, AssignCaseVariables>;

interface ReviewReturnRequestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReviewReturnRequestVariables): MutationRef<ReviewReturnRequestData, ReviewReturnRequestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReviewReturnRequestVariables): MutationRef<ReviewReturnRequestData, ReviewReturnRequestVariables>;
  operationName: string;
}
export const reviewReturnRequestRef: ReviewReturnRequestRef;

export function reviewReturnRequest(vars: ReviewReturnRequestVariables): MutationPromise<ReviewReturnRequestData, ReviewReturnRequestVariables>;
export function reviewReturnRequest(dc: DataConnect, vars: ReviewReturnRequestVariables): MutationPromise<ReviewReturnRequestData, ReviewReturnRequestVariables>;

interface RecordInspectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RecordInspectionVariables): MutationRef<RecordInspectionData, RecordInspectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RecordInspectionVariables): MutationRef<RecordInspectionData, RecordInspectionVariables>;
  operationName: string;
}
export const recordInspectionRef: RecordInspectionRef;

export function recordInspection(vars: RecordInspectionVariables): MutationPromise<RecordInspectionData, RecordInspectionVariables>;
export function recordInspection(dc: DataConnect, vars: RecordInspectionVariables): MutationPromise<RecordInspectionData, RecordInspectionVariables>;

interface ApproveRefundRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ApproveRefundVariables): MutationRef<ApproveRefundData, ApproveRefundVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ApproveRefundVariables): MutationRef<ApproveRefundData, ApproveRefundVariables>;
  operationName: string;
}
export const approveRefundRef: ApproveRefundRef;

export function approveRefund(vars: ApproveRefundVariables): MutationPromise<ApproveRefundData, ApproveRefundVariables>;
export function approveRefund(dc: DataConnect, vars: ApproveRefundVariables): MutationPromise<ApproveRefundData, ApproveRefundVariables>;

interface ResolveReplacementRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ResolveReplacementVariables): MutationRef<ResolveReplacementData, ResolveReplacementVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ResolveReplacementVariables): MutationRef<ResolveReplacementData, ResolveReplacementVariables>;
  operationName: string;
}
export const resolveReplacementRef: ResolveReplacementRef;

export function resolveReplacement(vars: ResolveReplacementVariables): MutationPromise<ResolveReplacementData, ResolveReplacementVariables>;
export function resolveReplacement(dc: DataConnect, vars: ResolveReplacementVariables): MutationPromise<ResolveReplacementData, ResolveReplacementVariables>;

interface AssignTicketRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AssignTicketVariables): MutationRef<AssignTicketData, AssignTicketVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AssignTicketVariables): MutationRef<AssignTicketData, AssignTicketVariables>;
  operationName: string;
}
export const assignTicketRef: AssignTicketRef;

export function assignTicket(vars: AssignTicketVariables): MutationPromise<AssignTicketData, AssignTicketVariables>;
export function assignTicket(dc: DataConnect, vars: AssignTicketVariables): MutationPromise<AssignTicketData, AssignTicketVariables>;

interface ReplyToCustomerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReplyToCustomerVariables): MutationRef<ReplyToCustomerData, ReplyToCustomerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReplyToCustomerVariables): MutationRef<ReplyToCustomerData, ReplyToCustomerVariables>;
  operationName: string;
}
export const replyToCustomerRef: ReplyToCustomerRef;

export function replyToCustomer(vars: ReplyToCustomerVariables): MutationPromise<ReplyToCustomerData, ReplyToCustomerVariables>;
export function replyToCustomer(dc: DataConnect, vars: ReplyToCustomerVariables): MutationPromise<ReplyToCustomerData, ReplyToCustomerVariables>;

interface ListStaffOrdersRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStaffOrdersVariables): QueryRef<ListStaffOrdersData, ListStaffOrdersVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListStaffOrdersVariables): QueryRef<ListStaffOrdersData, ListStaffOrdersVariables>;
  operationName: string;
}
export const listStaffOrdersRef: ListStaffOrdersRef;

export function listStaffOrders(vars: ListStaffOrdersVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffOrdersData, ListStaffOrdersVariables>;
export function listStaffOrders(dc: DataConnect, vars: ListStaffOrdersVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffOrdersData, ListStaffOrdersVariables>;

interface GetStaffOrderRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetStaffOrderVariables): QueryRef<GetStaffOrderData, GetStaffOrderVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetStaffOrderVariables): QueryRef<GetStaffOrderData, GetStaffOrderVariables>;
  operationName: string;
}
export const getStaffOrderRef: GetStaffOrderRef;

export function getStaffOrder(vars: GetStaffOrderVariables, options?: ExecuteQueryOptions): QueryPromise<GetStaffOrderData, GetStaffOrderVariables>;
export function getStaffOrder(dc: DataConnect, vars: GetStaffOrderVariables, options?: ExecuteQueryOptions): QueryPromise<GetStaffOrderData, GetStaffOrderVariables>;

interface ListCustomersRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListCustomersVariables): QueryRef<ListCustomersData, ListCustomersVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListCustomersVariables): QueryRef<ListCustomersData, ListCustomersVariables>;
  operationName: string;
}
export const listCustomersRef: ListCustomersRef;

export function listCustomers(vars: ListCustomersVariables, options?: ExecuteQueryOptions): QueryPromise<ListCustomersData, ListCustomersVariables>;
export function listCustomers(dc: DataConnect, vars: ListCustomersVariables, options?: ExecuteQueryOptions): QueryPromise<ListCustomersData, ListCustomersVariables>;

interface ListStaffCategoriesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStaffCategoriesVariables): QueryRef<ListStaffCategoriesData, ListStaffCategoriesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListStaffCategoriesVariables): QueryRef<ListStaffCategoriesData, ListStaffCategoriesVariables>;
  operationName: string;
}
export const listStaffCategoriesRef: ListStaffCategoriesRef;

export function listStaffCategories(vars: ListStaffCategoriesVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffCategoriesData, ListStaffCategoriesVariables>;
export function listStaffCategories(dc: DataConnect, vars: ListStaffCategoriesVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffCategoriesData, ListStaffCategoriesVariables>;

interface ListInventoryMovementsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListInventoryMovementsVariables): QueryRef<ListInventoryMovementsData, ListInventoryMovementsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListInventoryMovementsVariables): QueryRef<ListInventoryMovementsData, ListInventoryMovementsVariables>;
  operationName: string;
}
export const listInventoryMovementsRef: ListInventoryMovementsRef;

export function listInventoryMovements(vars: ListInventoryMovementsVariables, options?: ExecuteQueryOptions): QueryPromise<ListInventoryMovementsData, ListInventoryMovementsVariables>;
export function listInventoryMovements(dc: DataConnect, vars: ListInventoryMovementsVariables, options?: ExecuteQueryOptions): QueryPromise<ListInventoryMovementsData, ListInventoryMovementsVariables>;

interface ListAuditEventsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListAuditEventsVariables): QueryRef<ListAuditEventsData, ListAuditEventsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListAuditEventsVariables): QueryRef<ListAuditEventsData, ListAuditEventsVariables>;
  operationName: string;
}
export const listAuditEventsRef: ListAuditEventsRef;

export function listAuditEvents(vars: ListAuditEventsVariables, options?: ExecuteQueryOptions): QueryPromise<ListAuditEventsData, ListAuditEventsVariables>;
export function listAuditEvents(dc: DataConnect, vars: ListAuditEventsVariables, options?: ExecuteQueryOptions): QueryPromise<ListAuditEventsData, ListAuditEventsVariables>;

interface ListSupportQueueRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListSupportQueueVariables): QueryRef<ListSupportQueueData, ListSupportQueueVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListSupportQueueVariables): QueryRef<ListSupportQueueData, ListSupportQueueVariables>;
  operationName: string;
}
export const listSupportQueueRef: ListSupportQueueRef;

export function listSupportQueue(vars: ListSupportQueueVariables, options?: ExecuteQueryOptions): QueryPromise<ListSupportQueueData, ListSupportQueueVariables>;
export function listSupportQueue(dc: DataConnect, vars: ListSupportQueueVariables, options?: ExecuteQueryOptions): QueryPromise<ListSupportQueueData, ListSupportQueueVariables>;

interface GetStaffReturnRequestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetStaffReturnRequestVariables): QueryRef<GetStaffReturnRequestData, GetStaffReturnRequestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetStaffReturnRequestVariables): QueryRef<GetStaffReturnRequestData, GetStaffReturnRequestVariables>;
  operationName: string;
}
export const getStaffReturnRequestRef: GetStaffReturnRequestRef;

export function getStaffReturnRequest(vars: GetStaffReturnRequestVariables, options?: ExecuteQueryOptions): QueryPromise<GetStaffReturnRequestData, GetStaffReturnRequestVariables>;
export function getStaffReturnRequest(dc: DataConnect, vars: GetStaffReturnRequestVariables, options?: ExecuteQueryOptions): QueryPromise<GetStaffReturnRequestData, GetStaffReturnRequestVariables>;

interface GetStaffReturnEvidenceRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetStaffReturnEvidenceVariables): QueryRef<GetStaffReturnEvidenceData, GetStaffReturnEvidenceVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetStaffReturnEvidenceVariables): QueryRef<GetStaffReturnEvidenceData, GetStaffReturnEvidenceVariables>;
  operationName: string;
}
export const getStaffReturnEvidenceRef: GetStaffReturnEvidenceRef;

export function getStaffReturnEvidence(vars: GetStaffReturnEvidenceVariables, options?: ExecuteQueryOptions): QueryPromise<GetStaffReturnEvidenceData, GetStaffReturnEvidenceVariables>;
export function getStaffReturnEvidence(dc: DataConnect, vars: GetStaffReturnEvidenceVariables, options?: ExecuteQueryOptions): QueryPromise<GetStaffReturnEvidenceData, GetStaffReturnEvidenceVariables>;

interface GetStaffCaseRefundsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetStaffCaseRefundsVariables): QueryRef<GetStaffCaseRefundsData, GetStaffCaseRefundsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetStaffCaseRefundsVariables): QueryRef<GetStaffCaseRefundsData, GetStaffCaseRefundsVariables>;
  operationName: string;
}
export const getStaffCaseRefundsRef: GetStaffCaseRefundsRef;

export function getStaffCaseRefunds(vars: GetStaffCaseRefundsVariables, options?: ExecuteQueryOptions): QueryPromise<GetStaffCaseRefundsData, GetStaffCaseRefundsVariables>;
export function getStaffCaseRefunds(dc: DataConnect, vars: GetStaffCaseRefundsVariables, options?: ExecuteQueryOptions): QueryPromise<GetStaffCaseRefundsData, GetStaffCaseRefundsVariables>;

interface GetStaffTicketRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetStaffTicketVariables): QueryRef<GetStaffTicketData, GetStaffTicketVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetStaffTicketVariables): QueryRef<GetStaffTicketData, GetStaffTicketVariables>;
  operationName: string;
}
export const getStaffTicketRef: GetStaffTicketRef;

export function getStaffTicket(vars: GetStaffTicketVariables, options?: ExecuteQueryOptions): QueryPromise<GetStaffTicketData, GetStaffTicketVariables>;
export function getStaffTicket(dc: DataConnect, vars: GetStaffTicketVariables, options?: ExecuteQueryOptions): QueryPromise<GetStaffTicketData, GetStaffTicketVariables>;

interface GetAdminReportsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetAdminReportsVariables): QueryRef<GetAdminReportsData, GetAdminReportsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetAdminReportsVariables): QueryRef<GetAdminReportsData, GetAdminReportsVariables>;
  operationName: string;
}
export const getAdminReportsRef: GetAdminReportsRef;

export function getAdminReports(vars: GetAdminReportsVariables, options?: ExecuteQueryOptions): QueryPromise<GetAdminReportsData, GetAdminReportsVariables>;
export function getAdminReports(dc: DataConnect, vars: GetAdminReportsVariables, options?: ExecuteQueryOptions): QueryPromise<GetAdminReportsData, GetAdminReportsVariables>;

interface ListLowStockRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListLowStockVariables): QueryRef<ListLowStockData, ListLowStockVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListLowStockVariables): QueryRef<ListLowStockData, ListLowStockVariables>;
  operationName: string;
}
export const listLowStockRef: ListLowStockRef;

export function listLowStock(vars: ListLowStockVariables, options?: ExecuteQueryOptions): QueryPromise<ListLowStockData, ListLowStockVariables>;
export function listLowStock(dc: DataConnect, vars: ListLowStockVariables, options?: ExecuteQueryOptions): QueryPromise<ListLowStockData, ListLowStockVariables>;

interface ListSkuSalesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListSkuSalesVariables): QueryRef<ListSkuSalesData, ListSkuSalesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListSkuSalesVariables): QueryRef<ListSkuSalesData, ListSkuSalesVariables>;
  operationName: string;
}
export const listSkuSalesRef: ListSkuSalesRef;

export function listSkuSales(vars: ListSkuSalesVariables, options?: ExecuteQueryOptions): QueryPromise<ListSkuSalesData, ListSkuSalesVariables>;
export function listSkuSales(dc: DataConnect, vars: ListSkuSalesVariables, options?: ExecuteQueryOptions): QueryPromise<ListSkuSalesData, ListSkuSalesVariables>;

interface ListReturnSummaryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListReturnSummaryVariables): QueryRef<ListReturnSummaryData, ListReturnSummaryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListReturnSummaryVariables): QueryRef<ListReturnSummaryData, ListReturnSummaryVariables>;
  operationName: string;
}
export const listReturnSummaryRef: ListReturnSummaryRef;

export function listReturnSummary(vars: ListReturnSummaryVariables, options?: ExecuteQueryOptions): QueryPromise<ListReturnSummaryData, ListReturnSummaryVariables>;
export function listReturnSummary(dc: DataConnect, vars: ListReturnSummaryVariables, options?: ExecuteQueryOptions): QueryPromise<ListReturnSummaryData, ListReturnSummaryVariables>;

interface ListStaffProductsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStaffProductsVariables): QueryRef<ListStaffProductsData, ListStaffProductsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListStaffProductsVariables): QueryRef<ListStaffProductsData, ListStaffProductsVariables>;
  operationName: string;
}
export const listStaffProductsRef: ListStaffProductsRef;

export function listStaffProducts(vars: ListStaffProductsVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffProductsData, ListStaffProductsVariables>;
export function listStaffProducts(dc: DataConnect, vars: ListStaffProductsVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffProductsData, ListStaffProductsVariables>;

interface GetStaffProductRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetStaffProductVariables): QueryRef<GetStaffProductData, GetStaffProductVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetStaffProductVariables): QueryRef<GetStaffProductData, GetStaffProductVariables>;
  operationName: string;
}
export const getStaffProductRef: GetStaffProductRef;

export function getStaffProduct(vars: GetStaffProductVariables, options?: ExecuteQueryOptions): QueryPromise<GetStaffProductData, GetStaffProductVariables>;
export function getStaffProduct(dc: DataConnect, vars: GetStaffProductVariables, options?: ExecuteQueryOptions): QueryPromise<GetStaffProductData, GetStaffProductVariables>;

interface ListStaffVariantsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStaffVariantsVariables): QueryRef<ListStaffVariantsData, ListStaffVariantsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListStaffVariantsVariables): QueryRef<ListStaffVariantsData, ListStaffVariantsVariables>;
  operationName: string;
}
export const listStaffVariantsRef: ListStaffVariantsRef;

export function listStaffVariants(vars: ListStaffVariantsVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffVariantsData, ListStaffVariantsVariables>;
export function listStaffVariants(dc: DataConnect, vars: ListStaffVariantsVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffVariantsData, ListStaffVariantsVariables>;

interface ListStaffTaxClassesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListStaffTaxClassesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListStaffTaxClassesData, undefined>;
  operationName: string;
}
export const listStaffTaxClassesRef: ListStaffTaxClassesRef;

export function listStaffTaxClasses(options?: ExecuteQueryOptions): QueryPromise<ListStaffTaxClassesData, undefined>;
export function listStaffTaxClasses(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListStaffTaxClassesData, undefined>;

interface ListStaffCouponsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStaffCouponsVariables): QueryRef<ListStaffCouponsData, ListStaffCouponsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListStaffCouponsVariables): QueryRef<ListStaffCouponsData, ListStaffCouponsVariables>;
  operationName: string;
}
export const listStaffCouponsRef: ListStaffCouponsRef;

export function listStaffCoupons(vars: ListStaffCouponsVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffCouponsData, ListStaffCouponsVariables>;
export function listStaffCoupons(dc: DataConnect, vars: ListStaffCouponsVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffCouponsData, ListStaffCouponsVariables>;

interface ListCouponRedemptionsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListCouponRedemptionsVariables): QueryRef<ListCouponRedemptionsData, ListCouponRedemptionsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListCouponRedemptionsVariables): QueryRef<ListCouponRedemptionsData, ListCouponRedemptionsVariables>;
  operationName: string;
}
export const listCouponRedemptionsRef: ListCouponRedemptionsRef;

export function listCouponRedemptions(vars: ListCouponRedemptionsVariables, options?: ExecuteQueryOptions): QueryPromise<ListCouponRedemptionsData, ListCouponRedemptionsVariables>;
export function listCouponRedemptions(dc: DataConnect, vars: ListCouponRedemptionsVariables, options?: ExecuteQueryOptions): QueryPromise<ListCouponRedemptionsData, ListCouponRedemptionsVariables>;

interface ListStaffReturnRequestsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStaffReturnRequestsVariables): QueryRef<ListStaffReturnRequestsData, ListStaffReturnRequestsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListStaffReturnRequestsVariables): QueryRef<ListStaffReturnRequestsData, ListStaffReturnRequestsVariables>;
  operationName: string;
}
export const listStaffReturnRequestsRef: ListStaffReturnRequestsRef;

export function listStaffReturnRequests(vars: ListStaffReturnRequestsVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffReturnRequestsData, ListStaffReturnRequestsVariables>;
export function listStaffReturnRequests(dc: DataConnect, vars: ListStaffReturnRequestsVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffReturnRequestsData, ListStaffReturnRequestsVariables>;

interface ListStaffTicketsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStaffTicketsVariables): QueryRef<ListStaffTicketsData, ListStaffTicketsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListStaffTicketsVariables): QueryRef<ListStaffTicketsData, ListStaffTicketsVariables>;
  operationName: string;
}
export const listStaffTicketsRef: ListStaffTicketsRef;

export function listStaffTickets(vars: ListStaffTicketsVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffTicketsData, ListStaffTicketsVariables>;
export function listStaffTickets(dc: DataConnect, vars: ListStaffTicketsVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffTicketsData, ListStaffTicketsVariables>;

interface ListStaffOperatorsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStaffOperatorsVariables): QueryRef<ListStaffOperatorsData, ListStaffOperatorsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListStaffOperatorsVariables): QueryRef<ListStaffOperatorsData, ListStaffOperatorsVariables>;
  operationName: string;
}
export const listStaffOperatorsRef: ListStaffOperatorsRef;

export function listStaffOperators(vars: ListStaffOperatorsVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffOperatorsData, ListStaffOperatorsVariables>;
export function listStaffOperators(dc: DataConnect, vars: ListStaffOperatorsVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffOperatorsData, ListStaffOperatorsVariables>;

interface GetOperationTotalsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetOperationTotalsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetOperationTotalsData, undefined>;
  operationName: string;
}
export const getOperationTotalsRef: GetOperationTotalsRef;

export function getOperationTotals(options?: ExecuteQueryOptions): QueryPromise<GetOperationTotalsData, undefined>;
export function getOperationTotals(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetOperationTotalsData, undefined>;

