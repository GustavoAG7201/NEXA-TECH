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

export interface AppUser_Key {
  uid: string;
  __typename?: 'AppUser_Key';
}

export interface ArchiveAddressData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface ArchiveAddressVariables {
  key: UUIDString;
  id: UUIDString;
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

export interface CheckoutQuote_Key {
  id: UUIDString;
  __typename?: 'CheckoutQuote_Key';
}

export interface CommerceCommand_Key {
  id: UUIDString;
  __typename?: 'CommerceCommand_Key';
}

export interface ConfirmCheckoutData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface ConfirmCheckoutVariables {
  key: UUIDString;
  quoteId: UUIDString;
  termsId: UUIDString;
  accepted: boolean;
  scenario: string;
}

export interface CouponRedemption_Key {
  orderId: UUIDString;
  __typename?: 'CouponRedemption_Key';
}

export interface Coupon_Key {
  id: UUIDString;
  __typename?: 'Coupon_Key';
}

export interface CreateReturnRequestData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface CreateReturnRequestVariables {
  key: UUIDString;
  orderId: UUIDString;
  kind: string;
  reason: string;
  description: string;
  items?: unknown | null;
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

export interface EnsureProfileData {
  appUser_insert: AppUser_Key;
}

export interface EnsureProfileVariables {
  displayName: string;
}

export interface Favorite_Key {
  userUid: string;
  productId: UUIDString;
  __typename?: 'Favorite_Key';
}

export interface GetMyCartData {
  carts: ({
    id: UUIDString;
    revision: Int64String;
    cartItems_on_cart: ({
      variantId: UUIDString;
      quantity: number;
      variant: {
        sku: string;
        optionLabel: string;
        stockOnHand: number;
        unitPriceCents: Int64String;
        archivedAt?: TimestampString | null;
        product: {
          id: UUIDString;
          slug: string;
          name: string;
          status: string;
        } & Product_Key;
      };
    })[];
  } & Cart_Key)[];
}

export interface GetMyCommandResultData {
  commerceCommands: ({
    kind: string;
    inputVersion: number;
    inputDigest: string;
    status: string;
    resultCode?: string | null;
    resultId?: UUIDString | null;
  })[];
}

export interface GetMyCommandResultVariables {
  key: UUIDString;
}

export interface GetMyOrderData {
  customerOrders: ({
    id: UUIDString;
    folio: string;
    status: string;
    currency: string;
    contactEmail: string;
    subtotalCents: Int64String;
    discountCents: Int64String;
    itemsTaxCents: Int64String;
    shippingCents: Int64String;
    shippingTaxCents: Int64String;
    totalCents: Int64String;
    confirmedAt: TimestampString;
    payment_on_order?: {
      status: string;
    };
    orderItems_on_order: ({
      id: UUIDString;
      skuSnapshot: string;
      nameSnapshot: string;
      optionSnapshot: string;
      quantity: number;
      unitPriceCents: Int64String;
      discountCents: Int64String;
      taxCents: Int64String;
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
      countryCode: string;
    };
    orderStatusEvents_on_order: ({
      newStatus: string;
      createdAt: TimestampString;
    })[];
    shipment_on_order?: {
      status: string;
      methodSnapshot: string;
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
    };
    termsAcceptances_on_order: ({
      evidenceKind: string;
      presentedAt: TimestampString;
      document: {
        id: UUIDString;
        kind: string;
        version: number;
        sha256: string;
        title: string;
        body: string;
      } & LegalDocument_Key;
    })[];
  } & CustomerOrder_Key)[];
}

export interface GetMyOrderVariables {
  id: UUIDString;
}

export interface GetMyPaymentStatusData {
  payments: ({
    id: UUIDString;
    orderId?: UUIDString | null;
    status: string;
    amountCents: Int64String;
    decisionCode?: string | null;
    decidedAt?: TimestampString | null;
  } & Payment_Key)[];
}

export interface GetMyPaymentStatusVariables {
  id: UUIDString;
}

export interface GetMyProfileData {
  appUsers: ({
    uid: string;
    displayName: string;
    phone?: string | null;
    userRoles_on_user: ({
      roleCode: string;
    })[];
  } & AppUser_Key)[];
}

export interface GetMyQuoteData {
  checkoutQuotes: ({
    id: UUIDString;
    cartId: UUIDString;
    addressId: UUIDString;
    methodCode: string;
    cartRevision: Int64String;
    pricingDigest: string;
    summary: unknown;
    expiresAt: TimestampString;
  } & CheckoutQuote_Key)[];
}

export interface GetMyQuoteVariables {
  id: UUIDString;
}

export interface GetMyReturnEvidenceData {
  returnEvidences: ({
    id: UUIDString;
    mediaType: string;
    sizeBytes: number;
    contentB64?: string | null;
    sha256: string;
  } & ReturnEvidence_Key)[];
}

export interface GetMyReturnEvidenceVariables {
  id: UUIDString;
}

export interface GetMyReturnRequestData {
  returnRequests: ({
    id: UUIDString;
    orderId: UUIDString;
    folio: string;
    kind: string;
    status: string;
    reasonCode: string;
    description: string;
    resolutionCode?: string | null;
    resolutionNote?: string | null;
    createdAt: TimestampString;
    closedAt?: TimestampString | null;
    returnItems_on_request: ({
      id: UUIDString;
      orderItemId: UUIDString;
      requestedQty: number;
      approvedQty?: number | null;
      receivedQty: number;
      restockedQty: number;
      conditionCode?: string | null;
      orderItem: {
        skuSnapshot: string;
        nameSnapshot: string;
      };
    } & ReturnItem_Key)[];
    refunds_on_request: ({
      id: UUIDString;
      amountCents: Int64String;
      shippingRefundCents: Int64String;
      decidedAt?: TimestampString | null;
    } & Refund_Key)[];
    returnEvents_on_request: ({
      previousStatus?: string | null;
      newStatus: string;
      publicDetail?: string | null;
      createdAt: TimestampString;
    })[];
    returnEvidences_on_request: ({
      id: UUIDString;
      mediaType: string;
      sizeBytes: number;
      sha256: string;
      createdAt: TimestampString;
    } & ReturnEvidence_Key)[];
  } & ReturnRequest_Key)[];
}

export interface GetMyReturnRequestVariables {
  id: UUIDString;
}

export interface GetMyTicketData {
  supportTickets: ({
    id: UUIDString;
    folio: string;
    subject: string;
    status: string;
    orderId?: UUIDString | null;
    createdAt: TimestampString;
    closedAt?: TimestampString | null;
    supportMessages_on_ticket: ({
      id: UUIDString;
      body: string;
      createdAt: TimestampString;
      authorUid: string;
    } & SupportMessage_Key)[];
  } & SupportTicket_Key)[];
}

export interface GetMyTicketVariables {
  id: UUIDString;
  messageOffset: number;
}

export interface GetMyTicketsData {
  supportTickets: ({
    id: UUIDString;
    folio: string;
    subject: string;
    status: string;
    createdAt: TimestampString;
    closedAt?: TimestampString | null;
    supportMessages_on_ticket: ({
      id: UUIDString;
      body: string;
      createdAt: TimestampString;
    } & SupportMessage_Key)[];
  } & SupportTicket_Key)[];
}

export interface GetMyTicketsVariables {
  offset: number;
}

export interface InventoryMovement_Key {
  id: UUIDString;
  __typename?: 'InventoryMovement_Key';
}

export interface LegalDocument_Key {
  id: UUIDString;
  __typename?: 'LegalDocument_Key';
}

export interface ListMyAddressesData {
  addresses: ({
    id: UUIDString;
    label: string;
    recipient: string;
    phone: string;
    line1: string;
    line2?: string | null;
    district: string;
    city: string;
    stateCode: string;
    postalCode: string;
    countryCode: string;
    isDefault: boolean;
  } & Address_Key)[];
}

export interface ListMyFavoritesData {
  favorites: ({
    productId: UUIDString;
    product: {
      slug: string;
      name: string;
      status: string;
    };
  })[];
}

export interface ListMyFavoritesVariables {
  offset?: number | null;
}

export interface ListMyNotificationsData {
  notifications: ({
    id: UUIDString;
    orderId?: UUIDString | null;
    returnRequestId?: UUIDString | null;
    supportTicketId?: UUIDString | null;
    kind: string;
    readAt?: TimestampString | null;
    createdAt: TimestampString;
  } & Notification_Key)[];
}

export interface ListMyNotificationsVariables {
  offset: number;
}

export interface ListMyOrdersData {
  customerOrders: ({
    id: UUIDString;
    folio: string;
    status: string;
    currency: string;
    totalCents: Int64String;
    confirmedAt: TimestampString;
  } & CustomerOrder_Key)[];
}

export interface ListMyOrdersVariables {
  offset: number;
}

export interface ListMyReturnRequestsData {
  returnRequests: ({
    id: UUIDString;
    orderId: UUIDString;
    folio: string;
    kind: string;
    status: string;
    reasonCode: string;
    resolutionCode?: string | null;
    createdAt: TimestampString;
  } & ReturnRequest_Key)[];
}

export interface ListMyReturnRequestsVariables {
  offset: number;
  orderId?: UUIDString | null;
}

export interface MarkMyNotificationReadData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface MarkMyNotificationReadVariables {
  key: UUIDString;
  id: UUIDString;
}

export interface MergeCartData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface MergeCartVariables {
  key: UUIDString;
  items: unknown;
}

export interface Notification_Key {
  id: UUIDString;
  __typename?: 'Notification_Key';
}

export interface OpenSupportTicketData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface OpenSupportTicketVariables {
  key: UUIDString;
  orderId?: UUIDString | null;
  subject: string;
  body: string;
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

export interface QuoteCheckoutData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface QuoteCheckoutVariables {
  key: UUIDString;
  cartId: UUIDString;
  addressId: UUIDString;
  deliveryMethod: string;
  couponCode?: string | null;
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

export interface RemoveCartItemData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface RemoveCartItemVariables {
  key: UUIDString;
  variantId: UUIDString;
}

export interface ReplyToTicketData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface ReplyToTicketVariables {
  key: UUIDString;
  id: UUIDString;
  body: string;
}

export interface ResolveSimulatedPaymentData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface ResolveSimulatedPaymentVariables {
  key: UUIDString;
  paymentId: UUIDString;
  scenario: string;
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

export interface Review_Key {
  id: UUIDString;
  __typename?: 'Review_Key';
}

export interface Role_Key {
  code: string;
  __typename?: 'Role_Key';
}

export interface SaveAddressData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface SaveAddressVariables {
  key: UUIDString;
  id?: UUIDString | null;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2?: string | null;
  district: string;
  city: string;
  stateCode: string;
  postalCode: string;
  primary: boolean;
}

export interface SetCartItemData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface SetCartItemVariables {
  key: UUIDString;
  variantId: UUIDString;
  quantity: number;
}

export interface SetFavoriteData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface SetFavoriteVariables {
  key: UUIDString;
  productId: UUIDString;
  enabled: boolean;
}

export interface ShipmentEvent_Key {
  id: UUIDString;
  __typename?: 'ShipmentEvent_Key';
}

export interface Shipment_Key {
  id: UUIDString;
  __typename?: 'Shipment_Key';
}

export interface SubmitReviewData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface SubmitReviewVariables {
  key: UUIDString;
  orderItemId: UUIDString;
  rating: number;
  body?: string | null;
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

export interface UpdateMyProfileData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface UpdateMyProfileVariables {
  key: UUIDString;
  name: string;
  phone?: string | null;
}

export interface UploadReturnEvidenceData {
  commerceCommand_insert: CommerceCommand_Key;
}

export interface UploadReturnEvidenceVariables {
  key: UUIDString;
  id: UUIDString;
  content: string;
  media: string;
}

export interface UserRole_Key {
  userUid: string;
  roleCode: string;
  __typename?: 'UserRole_Key';
}

interface UpdateMyProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMyProfileVariables): MutationRef<UpdateMyProfileData, UpdateMyProfileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateMyProfileVariables): MutationRef<UpdateMyProfileData, UpdateMyProfileVariables>;
  operationName: string;
}
export const updateMyProfileRef: UpdateMyProfileRef;

export function updateMyProfile(vars: UpdateMyProfileVariables): MutationPromise<UpdateMyProfileData, UpdateMyProfileVariables>;
export function updateMyProfile(dc: DataConnect, vars: UpdateMyProfileVariables): MutationPromise<UpdateMyProfileData, UpdateMyProfileVariables>;

interface SaveAddressRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SaveAddressVariables): MutationRef<SaveAddressData, SaveAddressVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SaveAddressVariables): MutationRef<SaveAddressData, SaveAddressVariables>;
  operationName: string;
}
export const saveAddressRef: SaveAddressRef;

export function saveAddress(vars: SaveAddressVariables): MutationPromise<SaveAddressData, SaveAddressVariables>;
export function saveAddress(dc: DataConnect, vars: SaveAddressVariables): MutationPromise<SaveAddressData, SaveAddressVariables>;

interface ArchiveAddressRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ArchiveAddressVariables): MutationRef<ArchiveAddressData, ArchiveAddressVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ArchiveAddressVariables): MutationRef<ArchiveAddressData, ArchiveAddressVariables>;
  operationName: string;
}
export const archiveAddressRef: ArchiveAddressRef;

export function archiveAddress(vars: ArchiveAddressVariables): MutationPromise<ArchiveAddressData, ArchiveAddressVariables>;
export function archiveAddress(dc: DataConnect, vars: ArchiveAddressVariables): MutationPromise<ArchiveAddressData, ArchiveAddressVariables>;

interface SetFavoriteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SetFavoriteVariables): MutationRef<SetFavoriteData, SetFavoriteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SetFavoriteVariables): MutationRef<SetFavoriteData, SetFavoriteVariables>;
  operationName: string;
}
export const setFavoriteRef: SetFavoriteRef;

export function setFavorite(vars: SetFavoriteVariables): MutationPromise<SetFavoriteData, SetFavoriteVariables>;
export function setFavorite(dc: DataConnect, vars: SetFavoriteVariables): MutationPromise<SetFavoriteData, SetFavoriteVariables>;

interface SetCartItemRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SetCartItemVariables): MutationRef<SetCartItemData, SetCartItemVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SetCartItemVariables): MutationRef<SetCartItemData, SetCartItemVariables>;
  operationName: string;
}
export const setCartItemRef: SetCartItemRef;

export function setCartItem(vars: SetCartItemVariables): MutationPromise<SetCartItemData, SetCartItemVariables>;
export function setCartItem(dc: DataConnect, vars: SetCartItemVariables): MutationPromise<SetCartItemData, SetCartItemVariables>;

interface RemoveCartItemRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveCartItemVariables): MutationRef<RemoveCartItemData, RemoveCartItemVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RemoveCartItemVariables): MutationRef<RemoveCartItemData, RemoveCartItemVariables>;
  operationName: string;
}
export const removeCartItemRef: RemoveCartItemRef;

export function removeCartItem(vars: RemoveCartItemVariables): MutationPromise<RemoveCartItemData, RemoveCartItemVariables>;
export function removeCartItem(dc: DataConnect, vars: RemoveCartItemVariables): MutationPromise<RemoveCartItemData, RemoveCartItemVariables>;

interface MergeCartRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MergeCartVariables): MutationRef<MergeCartData, MergeCartVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MergeCartVariables): MutationRef<MergeCartData, MergeCartVariables>;
  operationName: string;
}
export const mergeCartRef: MergeCartRef;

export function mergeCart(vars: MergeCartVariables): MutationPromise<MergeCartData, MergeCartVariables>;
export function mergeCart(dc: DataConnect, vars: MergeCartVariables): MutationPromise<MergeCartData, MergeCartVariables>;

interface QuoteCheckoutRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: QuoteCheckoutVariables): MutationRef<QuoteCheckoutData, QuoteCheckoutVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: QuoteCheckoutVariables): MutationRef<QuoteCheckoutData, QuoteCheckoutVariables>;
  operationName: string;
}
export const quoteCheckoutRef: QuoteCheckoutRef;

export function quoteCheckout(vars: QuoteCheckoutVariables): MutationPromise<QuoteCheckoutData, QuoteCheckoutVariables>;
export function quoteCheckout(dc: DataConnect, vars: QuoteCheckoutVariables): MutationPromise<QuoteCheckoutData, QuoteCheckoutVariables>;

interface ConfirmCheckoutRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ConfirmCheckoutVariables): MutationRef<ConfirmCheckoutData, ConfirmCheckoutVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ConfirmCheckoutVariables): MutationRef<ConfirmCheckoutData, ConfirmCheckoutVariables>;
  operationName: string;
}
export const confirmCheckoutRef: ConfirmCheckoutRef;

export function confirmCheckout(vars: ConfirmCheckoutVariables): MutationPromise<ConfirmCheckoutData, ConfirmCheckoutVariables>;
export function confirmCheckout(dc: DataConnect, vars: ConfirmCheckoutVariables): MutationPromise<ConfirmCheckoutData, ConfirmCheckoutVariables>;

interface ResolveSimulatedPaymentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ResolveSimulatedPaymentVariables): MutationRef<ResolveSimulatedPaymentData, ResolveSimulatedPaymentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ResolveSimulatedPaymentVariables): MutationRef<ResolveSimulatedPaymentData, ResolveSimulatedPaymentVariables>;
  operationName: string;
}
export const resolveSimulatedPaymentRef: ResolveSimulatedPaymentRef;

export function resolveSimulatedPayment(vars: ResolveSimulatedPaymentVariables): MutationPromise<ResolveSimulatedPaymentData, ResolveSimulatedPaymentVariables>;
export function resolveSimulatedPayment(dc: DataConnect, vars: ResolveSimulatedPaymentVariables): MutationPromise<ResolveSimulatedPaymentData, ResolveSimulatedPaymentVariables>;

interface MarkMyNotificationReadRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkMyNotificationReadVariables): MutationRef<MarkMyNotificationReadData, MarkMyNotificationReadVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkMyNotificationReadVariables): MutationRef<MarkMyNotificationReadData, MarkMyNotificationReadVariables>;
  operationName: string;
}
export const markMyNotificationReadRef: MarkMyNotificationReadRef;

export function markMyNotificationRead(vars: MarkMyNotificationReadVariables): MutationPromise<MarkMyNotificationReadData, MarkMyNotificationReadVariables>;
export function markMyNotificationRead(dc: DataConnect, vars: MarkMyNotificationReadVariables): MutationPromise<MarkMyNotificationReadData, MarkMyNotificationReadVariables>;

interface SubmitReviewRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SubmitReviewVariables): MutationRef<SubmitReviewData, SubmitReviewVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SubmitReviewVariables): MutationRef<SubmitReviewData, SubmitReviewVariables>;
  operationName: string;
}
export const submitReviewRef: SubmitReviewRef;

export function submitReview(vars: SubmitReviewVariables): MutationPromise<SubmitReviewData, SubmitReviewVariables>;
export function submitReview(dc: DataConnect, vars: SubmitReviewVariables): MutationPromise<SubmitReviewData, SubmitReviewVariables>;

interface CreateReturnRequestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateReturnRequestVariables): MutationRef<CreateReturnRequestData, CreateReturnRequestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateReturnRequestVariables): MutationRef<CreateReturnRequestData, CreateReturnRequestVariables>;
  operationName: string;
}
export const createReturnRequestRef: CreateReturnRequestRef;

export function createReturnRequest(vars: CreateReturnRequestVariables): MutationPromise<CreateReturnRequestData, CreateReturnRequestVariables>;
export function createReturnRequest(dc: DataConnect, vars: CreateReturnRequestVariables): MutationPromise<CreateReturnRequestData, CreateReturnRequestVariables>;

interface UploadReturnEvidenceRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UploadReturnEvidenceVariables): MutationRef<UploadReturnEvidenceData, UploadReturnEvidenceVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UploadReturnEvidenceVariables): MutationRef<UploadReturnEvidenceData, UploadReturnEvidenceVariables>;
  operationName: string;
}
export const uploadReturnEvidenceRef: UploadReturnEvidenceRef;

export function uploadReturnEvidence(vars: UploadReturnEvidenceVariables): MutationPromise<UploadReturnEvidenceData, UploadReturnEvidenceVariables>;
export function uploadReturnEvidence(dc: DataConnect, vars: UploadReturnEvidenceVariables): MutationPromise<UploadReturnEvidenceData, UploadReturnEvidenceVariables>;

interface OpenSupportTicketRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: OpenSupportTicketVariables): MutationRef<OpenSupportTicketData, OpenSupportTicketVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: OpenSupportTicketVariables): MutationRef<OpenSupportTicketData, OpenSupportTicketVariables>;
  operationName: string;
}
export const openSupportTicketRef: OpenSupportTicketRef;

export function openSupportTicket(vars: OpenSupportTicketVariables): MutationPromise<OpenSupportTicketData, OpenSupportTicketVariables>;
export function openSupportTicket(dc: DataConnect, vars: OpenSupportTicketVariables): MutationPromise<OpenSupportTicketData, OpenSupportTicketVariables>;

interface ReplyToTicketRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReplyToTicketVariables): MutationRef<ReplyToTicketData, ReplyToTicketVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReplyToTicketVariables): MutationRef<ReplyToTicketData, ReplyToTicketVariables>;
  operationName: string;
}
export const replyToTicketRef: ReplyToTicketRef;

export function replyToTicket(vars: ReplyToTicketVariables): MutationPromise<ReplyToTicketData, ReplyToTicketVariables>;
export function replyToTicket(dc: DataConnect, vars: ReplyToTicketVariables): MutationPromise<ReplyToTicketData, ReplyToTicketVariables>;

interface EnsureProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: EnsureProfileVariables): MutationRef<EnsureProfileData, EnsureProfileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: EnsureProfileVariables): MutationRef<EnsureProfileData, EnsureProfileVariables>;
  operationName: string;
}
export const ensureProfileRef: EnsureProfileRef;

export function ensureProfile(vars: EnsureProfileVariables): MutationPromise<EnsureProfileData, EnsureProfileVariables>;
export function ensureProfile(dc: DataConnect, vars: EnsureProfileVariables): MutationPromise<EnsureProfileData, EnsureProfileVariables>;

interface GetMyProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyProfileData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyProfileData, undefined>;
  operationName: string;
}
export const getMyProfileRef: GetMyProfileRef;

export function getMyProfile(options?: ExecuteQueryOptions): QueryPromise<GetMyProfileData, undefined>;
export function getMyProfile(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyProfileData, undefined>;

interface ListMyAddressesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyAddressesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMyAddressesData, undefined>;
  operationName: string;
}
export const listMyAddressesRef: ListMyAddressesRef;

export function listMyAddresses(options?: ExecuteQueryOptions): QueryPromise<ListMyAddressesData, undefined>;
export function listMyAddresses(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyAddressesData, undefined>;

interface GetMyCartRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyCartData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyCartData, undefined>;
  operationName: string;
}
export const getMyCartRef: GetMyCartRef;

export function getMyCart(options?: ExecuteQueryOptions): QueryPromise<GetMyCartData, undefined>;
export function getMyCart(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyCartData, undefined>;

interface ListMyFavoritesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListMyFavoritesVariables): QueryRef<ListMyFavoritesData, ListMyFavoritesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListMyFavoritesVariables): QueryRef<ListMyFavoritesData, ListMyFavoritesVariables>;
  operationName: string;
}
export const listMyFavoritesRef: ListMyFavoritesRef;

export function listMyFavorites(vars?: ListMyFavoritesVariables, options?: ExecuteQueryOptions): QueryPromise<ListMyFavoritesData, ListMyFavoritesVariables>;
export function listMyFavorites(dc: DataConnect, vars?: ListMyFavoritesVariables, options?: ExecuteQueryOptions): QueryPromise<ListMyFavoritesData, ListMyFavoritesVariables>;

interface ListMyOrdersRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListMyOrdersVariables): QueryRef<ListMyOrdersData, ListMyOrdersVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListMyOrdersVariables): QueryRef<ListMyOrdersData, ListMyOrdersVariables>;
  operationName: string;
}
export const listMyOrdersRef: ListMyOrdersRef;

export function listMyOrders(vars: ListMyOrdersVariables, options?: ExecuteQueryOptions): QueryPromise<ListMyOrdersData, ListMyOrdersVariables>;
export function listMyOrders(dc: DataConnect, vars: ListMyOrdersVariables, options?: ExecuteQueryOptions): QueryPromise<ListMyOrdersData, ListMyOrdersVariables>;

interface GetMyOrderRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyOrderVariables): QueryRef<GetMyOrderData, GetMyOrderVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyOrderVariables): QueryRef<GetMyOrderData, GetMyOrderVariables>;
  operationName: string;
}
export const getMyOrderRef: GetMyOrderRef;

export function getMyOrder(vars: GetMyOrderVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyOrderData, GetMyOrderVariables>;
export function getMyOrder(dc: DataConnect, vars: GetMyOrderVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyOrderData, GetMyOrderVariables>;

interface GetMyPaymentStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyPaymentStatusVariables): QueryRef<GetMyPaymentStatusData, GetMyPaymentStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyPaymentStatusVariables): QueryRef<GetMyPaymentStatusData, GetMyPaymentStatusVariables>;
  operationName: string;
}
export const getMyPaymentStatusRef: GetMyPaymentStatusRef;

export function getMyPaymentStatus(vars: GetMyPaymentStatusVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyPaymentStatusData, GetMyPaymentStatusVariables>;
export function getMyPaymentStatus(dc: DataConnect, vars: GetMyPaymentStatusVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyPaymentStatusData, GetMyPaymentStatusVariables>;

interface ListMyNotificationsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListMyNotificationsVariables): QueryRef<ListMyNotificationsData, ListMyNotificationsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListMyNotificationsVariables): QueryRef<ListMyNotificationsData, ListMyNotificationsVariables>;
  operationName: string;
}
export const listMyNotificationsRef: ListMyNotificationsRef;

export function listMyNotifications(vars: ListMyNotificationsVariables, options?: ExecuteQueryOptions): QueryPromise<ListMyNotificationsData, ListMyNotificationsVariables>;
export function listMyNotifications(dc: DataConnect, vars: ListMyNotificationsVariables, options?: ExecuteQueryOptions): QueryPromise<ListMyNotificationsData, ListMyNotificationsVariables>;

interface ListMyReturnRequestsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListMyReturnRequestsVariables): QueryRef<ListMyReturnRequestsData, ListMyReturnRequestsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListMyReturnRequestsVariables): QueryRef<ListMyReturnRequestsData, ListMyReturnRequestsVariables>;
  operationName: string;
}
export const listMyReturnRequestsRef: ListMyReturnRequestsRef;

export function listMyReturnRequests(vars: ListMyReturnRequestsVariables, options?: ExecuteQueryOptions): QueryPromise<ListMyReturnRequestsData, ListMyReturnRequestsVariables>;
export function listMyReturnRequests(dc: DataConnect, vars: ListMyReturnRequestsVariables, options?: ExecuteQueryOptions): QueryPromise<ListMyReturnRequestsData, ListMyReturnRequestsVariables>;

interface GetMyReturnRequestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyReturnRequestVariables): QueryRef<GetMyReturnRequestData, GetMyReturnRequestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyReturnRequestVariables): QueryRef<GetMyReturnRequestData, GetMyReturnRequestVariables>;
  operationName: string;
}
export const getMyReturnRequestRef: GetMyReturnRequestRef;

export function getMyReturnRequest(vars: GetMyReturnRequestVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyReturnRequestData, GetMyReturnRequestVariables>;
export function getMyReturnRequest(dc: DataConnect, vars: GetMyReturnRequestVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyReturnRequestData, GetMyReturnRequestVariables>;

interface GetMyReturnEvidenceRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyReturnEvidenceVariables): QueryRef<GetMyReturnEvidenceData, GetMyReturnEvidenceVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyReturnEvidenceVariables): QueryRef<GetMyReturnEvidenceData, GetMyReturnEvidenceVariables>;
  operationName: string;
}
export const getMyReturnEvidenceRef: GetMyReturnEvidenceRef;

export function getMyReturnEvidence(vars: GetMyReturnEvidenceVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyReturnEvidenceData, GetMyReturnEvidenceVariables>;
export function getMyReturnEvidence(dc: DataConnect, vars: GetMyReturnEvidenceVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyReturnEvidenceData, GetMyReturnEvidenceVariables>;

interface GetMyTicketsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyTicketsVariables): QueryRef<GetMyTicketsData, GetMyTicketsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyTicketsVariables): QueryRef<GetMyTicketsData, GetMyTicketsVariables>;
  operationName: string;
}
export const getMyTicketsRef: GetMyTicketsRef;

export function getMyTickets(vars: GetMyTicketsVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyTicketsData, GetMyTicketsVariables>;
export function getMyTickets(dc: DataConnect, vars: GetMyTicketsVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyTicketsData, GetMyTicketsVariables>;

interface GetMyTicketRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyTicketVariables): QueryRef<GetMyTicketData, GetMyTicketVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyTicketVariables): QueryRef<GetMyTicketData, GetMyTicketVariables>;
  operationName: string;
}
export const getMyTicketRef: GetMyTicketRef;

export function getMyTicket(vars: GetMyTicketVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyTicketData, GetMyTicketVariables>;
export function getMyTicket(dc: DataConnect, vars: GetMyTicketVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyTicketData, GetMyTicketVariables>;

interface GetMyCommandResultRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyCommandResultVariables): QueryRef<GetMyCommandResultData, GetMyCommandResultVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyCommandResultVariables): QueryRef<GetMyCommandResultData, GetMyCommandResultVariables>;
  operationName: string;
}
export const getMyCommandResultRef: GetMyCommandResultRef;

export function getMyCommandResult(vars: GetMyCommandResultVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyCommandResultData, GetMyCommandResultVariables>;
export function getMyCommandResult(dc: DataConnect, vars: GetMyCommandResultVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyCommandResultData, GetMyCommandResultVariables>;

interface GetMyQuoteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyQuoteVariables): QueryRef<GetMyQuoteData, GetMyQuoteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyQuoteVariables): QueryRef<GetMyQuoteData, GetMyQuoteVariables>;
  operationName: string;
}
export const getMyQuoteRef: GetMyQuoteRef;

export function getMyQuote(vars: GetMyQuoteVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyQuoteData, GetMyQuoteVariables>;
export function getMyQuote(dc: DataConnect, vars: GetMyQuoteVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyQuoteData, GetMyQuoteVariables>;

