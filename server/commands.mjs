// The trigger in 005_dispatch.sql executes and audits these commands.
export const commands = {
  UpdateMyProfile: {
    access: "customer", variables: {"key":"UUID!","name":"String!","phone":"String"},
    kind: "UPDATE_PROFILE", input: {"name":"@name","phone":"@phone"},
  },
  SaveAddress: {
    access: "customer", variables: {"key":"UUID!","id":"UUID","label":"String!","recipient":"String!","phone":"String!","line1":"String!","line2":"String","district":"String!","city":"String!","stateCode":"String!","postalCode":"String!","primary":"Boolean!"},
    kind: "SAVE_ADDRESS", input: {"id":"@id","label":"@label","recipient":"@recipient","phone":"@phone","line1":"@line1","line2":"@line2","district":"@district","city":"@city","stateCode":"@stateCode","postalCode":"@postalCode","primary":"@primary"},
  },
  ArchiveAddress: {
    access: "customer", variables: {"key":"UUID!","id":"UUID!"},
    kind: "ARCHIVE_ADDRESS", input: {"id":"@id"},
  },
  SetFavorite: {
    access: "customer", variables: {"key":"UUID!","productId":"UUID!","enabled":"Boolean!"},
    kind: "SET_FAVORITE", input: {"productId":"@productId","enabled":"@enabled"},
  },
  SetCartItem: {
    access: "customer", variables: {"key":"UUID!","variantId":"UUID!","quantity":"Int!"},
    kind: "SET_CART_ITEM", input: {"variantId":"@variantId","quantity":"@quantity"},
  },
  RemoveCartItem: {
    access: "customer", variables: {"key":"UUID!","variantId":"UUID!"},
    kind: "SET_CART_ITEM", input: {"variantId":"@variantId","quantity":0},
  },
  MergeCart: {
    access: "customer", variables: {"key":"UUID!","items":"Any!"},
    kind: "MERGE_CART", input: {"items":"@items"},
  },
  QuoteCheckout: {
    access: "customer", variables: {"key":"UUID!","cartId":"UUID!","addressId":"UUID!","deliveryMethod":"String!","couponCode":"String"},
    kind: "QUOTE_CHECKOUT", input: {"cartId":"@cartId","addressId":"@addressId","deliveryMethod":"@deliveryMethod","couponCode":"@couponCode"},
  },
  ConfirmCheckout: {
    access: "customer", variables: {"key":"UUID!","quoteId":"UUID!","termsId":"UUID!","accepted":"Boolean!","scenario":"String!"},
    kind: "CONFIRM_CHECKOUT", input: {"quoteId":"@quoteId","termsId":"@termsId","accepted":"@accepted","scenario":"@scenario","email":"@email"},
  },
  ResolveSimulatedPayment: {
    access: "customer", variables: {"key":"UUID!","paymentId":"UUID!","scenario":"String!"},
    kind: "RESOLVE_PAYMENT", input: {"paymentId":"@paymentId","scenario":"@scenario","email":"@email"},
  },
  MarkMyNotificationRead: {
    access: "customer", variables: {"key":"UUID!","id":"UUID!"},
    kind: "MARK_NOTIFICATION_READ", input: {"id":"@id"},
  },
  SubmitReview: {
    access: "customer", variables: {"key":"UUID!","orderItemId":"UUID!","rating":"Int!","body":"String"},
    kind: "SUBMIT_REVIEW", input: {"orderItemId":"@orderItemId","rating":"@rating","body":"@body"},
  },
  CreateReturnRequest: {
    access: "customer", variables: {"key":"UUID!","orderId":"UUID!","kind":"String!","reason":"String!","description":"String!","items":"Any"},
    kind: "CREATE_RETURN", input: {"orderId":"@orderId","kind":"@kind","reason":"@reason","description":"@description","items":"@items"},
  },
  UploadReturnEvidence: {
    access: "customer", variables: {"key":"UUID!","id":"UUID!","content":"String!","media":"String!"},
    kind: "UPLOAD_EVIDENCE", input: {"id":"@id","content":"@content","media":"@media"},
  },
  OpenSupportTicket: {
    access: "customer", variables: {"key":"UUID!","orderId":"UUID","subject":"String!","body":"String!"},
    kind: "OPEN_TICKET", input: {"orderId":"@orderId","subject":"@subject","body":"@body"},
  },
  ReplyToTicket: {
    access: "customer", variables: {"key":"UUID!","id":"UUID!","body":"String!"},
    kind: "REPLY_TICKET", input: {"id":"@id","body":"@body"},
  },
  SaveCategory: {
    access: "admin", variables: {"key":"UUID!","id":"UUID","slug":"String!","name":"String!","description":"String","archived":"Boolean!"},
    kind: "SAVE_CATEGORY", input: {"id":"@id","slug":"@slug","name":"@name","description":"@description","archived":"@archived"},
  },
  SaveProduct: {
    access: "admin", variables: {"key":"UUID!","id":"UUID","categoryId":"UUID!","slug":"String!","name":"String!","description":"String!","specs":"Any","status":"String!","featured":"Boolean!"},
    kind: "SAVE_PRODUCT", input: {"id":"@id","categoryId":"@categoryId","slug":"@slug","name":"@name","description":"@description","specs":"@specs","status":"@status","featured":"@featured"},
  },
  ArchiveProduct: {
    access: "admin", variables: {"key":"UUID!","id":"UUID!"},
    kind: "ARCHIVE_PRODUCT", input: {"id":"@id"},
  },
  SaveVariant: {
    access: "admin", variables: {"key":"UUID!","id":"UUID","productId":"UUID!","taxClass":"String!","sku":"String!","label":"String!","color":"String","price":"Int64!","compareAt":"Int64","cost":"Int64","threshold":"Int!","weight":"Int","length":"Int","width":"Int","height":"Int","archived":"Boolean!"},
    kind: "SAVE_VARIANT", input: {"id":"@id","productId":"@productId","taxClass":"@taxClass","sku":"@sku","label":"@label","color":"@color","price":"@price","compareAt":"@compareAt","cost":"@cost","threshold":"@threshold","weight":"@weight","length":"@length","width":"@width","height":"@height","archived":"@archived"},
  },
  SaveProductImage: {
    access: "admin", variables: {"key":"UUID!","id":"UUID","productId":"UUID!","src":"String!","alt":"String!","position":"Int!","credit":"String"},
    kind: "SAVE_PRODUCT_IMAGE", input: {"id":"@id","productId":"@productId","src":"@src","alt":"@alt","position":"@position","credit":"@credit"},
  },
  AdjustInventory: {
    access: "admin", variables: {"key":"UUID!","variantId":"UUID!","delta":"Int!","reason":"String!"},
    kind: "ADJUST_INVENTORY", input: {"variantId":"@variantId","delta":"@delta","reason":"@reason"},
  },
  SaveCoupon: {
    access: "admin", variables: {"key":"UUID!","id":"UUID","code":"String!","kind":"String!","fixed":"Int64","bps":"Int","minimum":"Int64!","startsAt":"Timestamp!","endsAt":"Timestamp!","maxUses":"Int","maxPerUser":"Int","archived":"Boolean!"},
    kind: "SAVE_COUPON", input: {"id":"@id","code":"@code","kind":"@kind","fixed":"@fixed","bps":"@bps","minimum":"@minimum","startsAt":"@startsAt","endsAt":"@endsAt","maxUses":"@maxUses","maxPerUser":"@maxPerUser","archived":"@archived"},
  },
  ModerateReview: {
    access: "admin", variables: {"key":"UUID!","id":"UUID!","approve":"Boolean!"},
    kind: "MODERATE_REVIEW", input: {"id":"@id","approve":"@approve"},
  },
  PublishPolicy: {
    access: "admin", variables: {"key":"UUID!","kind":"String!","title":"String!","body":"String!"},
    kind: "PUBLISH_POLICY", input: {"kind":"@kind","title":"@title","body":"@body"},
  },
  ChangeUserRole: {
    access: "admin", variables: {"key":"UUID!","uid":"String!","role":"String!","enabled":"Boolean!"},
    kind: "CHANGE_USER_ROLE", input: {"uid":"@uid","role":"@role","enabled":"@enabled"},
  },
  RecordShipmentEvent: {
    access: "admin", variables: {"key":"UUID!","orderId":"UUID!","event":"String!","carrier":"String","trackingCode":"String","detail":"String"},
    kind: "RECORD_SHIPMENT", input: {"orderId":"@orderId","event":"@event","carrier":"@carrier","trackingCode":"@trackingCode","detail":"@detail"},
  },
  AssignCase: {
    access: "staff", variables: {"key":"UUID!","id":"UUID!","assignedTo":"String"},
    kind: "ASSIGN_CASE", input: {"id":"@id","assignedTo":"@assignedTo"},
  },
  ReviewReturnRequest: {
    access: "staff", variables: {"key":"UUID!","id":"UUID!","state":"String!","detail":"String","resolution":"String"},
    kind: "REVIEW_RETURN", input: {"id":"@id","state":"@state","detail":"@detail","resolution":"@resolution"},
  },
  RecordInspection: {
    access: "staff", variables: {"key":"UUID!","id":"UUID!","items":"Any!","detail":"String"},
    kind: "RECORD_INSPECTION", input: {"id":"@id","items":"@items","detail":"@detail"},
  },
  ApproveRefund: {
    access: "admin", variables: {"key":"UUID!","id":"UUID!","shipping":"Boolean!","detail":"String!"},
    kind: "APPROVE_REFUND", input: {"id":"@id","shipping":"@shipping","detail":"@detail"},
  },
  ResolveReplacement: {
    access: "admin", variables: {"key":"UUID!","id":"UUID!","detail":"String!"},
    kind: "RESOLVE_REPLACEMENT", input: {"id":"@id","detail":"@detail"},
  },
  AssignTicket: {
    access: "staff", variables: {"key":"UUID!","id":"UUID!","assignedTo":"String"},
    kind: "ASSIGN_TICKET", input: {"id":"@id","assignedTo":"@assignedTo"},
  },
  ReplyToCustomer: {
    access: "staff", variables: {"key":"UUID!","id":"UUID!","body":"String!","internal":"Boolean!","close":"Boolean!"},
    kind: "REPLY_TO_CUSTOMER", input: {"id":"@id","body":"@body","internal":"@internal","close":"@close"},
  },
};
