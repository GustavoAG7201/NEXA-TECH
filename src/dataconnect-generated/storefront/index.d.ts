import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions } from 'firebase/data-connect';

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

export interface GetProductData {
  products: ({
    id: UUIDString;
    slug: string;
    legacyId?: number | null;
    name: string;
    description: string;
    specs?: unknown | null;
    status: string;
    category: {
      id: UUIDString;
      slug: string;
      name: string;
    } & Category_Key;
    productImages_on_product: ({
      src: string;
      alt: string;
      position: number;
      credit?: string | null;
    })[];
    productVariants_on_product: ({
      id: UUIDString;
      sku: string;
      optionLabel: string;
      color?: string | null;
      unitPriceCents: Int64String;
      compareAtCents?: Int64String | null;
      stockOnHand: number;
      weightG?: number | null;
      lengthMm?: number | null;
      widthMm?: number | null;
      heightMm?: number | null;
    } & ProductVariant_Key)[];
  } & Product_Key)[];
}

export interface GetProductVariables {
  slug: string;
}

export interface GetPublishedPoliciesData {
  legalDocuments: ({
    id: UUIDString;
    kind: string;
    version: number;
    title: string;
    body: string;
    sha256: string;
    publishedAt?: TimestampString | null;
  } & LegalDocument_Key)[];
}

export interface InventoryMovement_Key {
  id: UUIDString;
  __typename?: 'InventoryMovement_Key';
}

export interface LegalDocument_Key {
  id: UUIDString;
  __typename?: 'LegalDocument_Key';
}

export interface ListCatalogData {
  productVariants: ({
    id: UUIDString;
    sku: string;
    optionLabel: string;
    color?: string | null;
    unitPriceCents: Int64String;
    compareAtCents?: Int64String | null;
    stockOnHand: number;
    product: {
      id: UUIDString;
      slug: string;
      legacyId?: number | null;
      name: string;
      description: string;
      specs?: unknown | null;
      status: string;
      featured: boolean;
      category: {
        id: UUIDString;
        slug: string;
        name: string;
      } & Category_Key;
      productImages_on_product: ({
        src: string;
        alt: string;
      })[];
    } & Product_Key;
  } & ProductVariant_Key)[];
}

export interface ListCatalogVariables {
  search?: string | null;
  categoryId?: UUIDString | null;
  minimum?: Int64String | null;
  maximum?: Int64String | null;
  available?: number | null;
  offset: number;
}

export interface ListCategoriesData {
  categories: ({
    id: UUIDString;
    slug: string;
    name: string;
    description?: string | null;
  } & Category_Key)[];
}

export interface ListProductReviewsData {
  reviews: ({
    id: UUIDString;
    rating: number;
    body?: string | null;
    createdAt: TimestampString;
  } & Review_Key)[];
}

export interface ListProductReviewsVariables {
  productId: UUIDString;
  offset: number;
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

export interface RefundItem_Key {
  refundId: UUIDString;
  returnItemId: UUIDString;
  __typename?: 'RefundItem_Key';
}

export interface Refund_Key {
  id: UUIDString;
  __typename?: 'Refund_Key';
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

interface ListCategoriesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListCategoriesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListCategoriesData, undefined>;
  operationName: string;
}
export const listCategoriesRef: ListCategoriesRef;

export function listCategories(options?: ExecuteQueryOptions): QueryPromise<ListCategoriesData, undefined>;
export function listCategories(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListCategoriesData, undefined>;

interface ListCatalogRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListCatalogVariables): QueryRef<ListCatalogData, ListCatalogVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListCatalogVariables): QueryRef<ListCatalogData, ListCatalogVariables>;
  operationName: string;
}
export const listCatalogRef: ListCatalogRef;

export function listCatalog(vars: ListCatalogVariables, options?: ExecuteQueryOptions): QueryPromise<ListCatalogData, ListCatalogVariables>;
export function listCatalog(dc: DataConnect, vars: ListCatalogVariables, options?: ExecuteQueryOptions): QueryPromise<ListCatalogData, ListCatalogVariables>;

interface GetProductRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetProductVariables): QueryRef<GetProductData, GetProductVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetProductVariables): QueryRef<GetProductData, GetProductVariables>;
  operationName: string;
}
export const getProductRef: GetProductRef;

export function getProduct(vars: GetProductVariables, options?: ExecuteQueryOptions): QueryPromise<GetProductData, GetProductVariables>;
export function getProduct(dc: DataConnect, vars: GetProductVariables, options?: ExecuteQueryOptions): QueryPromise<GetProductData, GetProductVariables>;

interface ListProductReviewsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListProductReviewsVariables): QueryRef<ListProductReviewsData, ListProductReviewsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListProductReviewsVariables): QueryRef<ListProductReviewsData, ListProductReviewsVariables>;
  operationName: string;
}
export const listProductReviewsRef: ListProductReviewsRef;

export function listProductReviews(vars: ListProductReviewsVariables, options?: ExecuteQueryOptions): QueryPromise<ListProductReviewsData, ListProductReviewsVariables>;
export function listProductReviews(dc: DataConnect, vars: ListProductReviewsVariables, options?: ExecuteQueryOptions): QueryPromise<ListProductReviewsData, ListProductReviewsVariables>;

interface GetPublishedPoliciesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetPublishedPoliciesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetPublishedPoliciesData, undefined>;
  operationName: string;
}
export const getPublishedPoliciesRef: GetPublishedPoliciesRef;

export function getPublishedPolicies(options?: ExecuteQueryOptions): QueryPromise<GetPublishedPoliciesData, undefined>;
export function getPublishedPolicies(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetPublishedPoliciesData, undefined>;

