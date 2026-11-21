import * as account from '../dataconnect-generated/account/esm/index.esm.js';
import { accountDb, auth, serverOnly } from './firebase.js';

const messages = {
  SESSION_CHANGED: 'Tu sesión expiró o cambió. Vuelve a iniciar sesión.',
  STOCK_UNAVAILABLE: 'Inventario insuficiente. Revisa las cantidades en tu carrito.',
  VARIANT_UNAVAILABLE: 'Un producto está agotado o dejó de estar disponible. Revisa tu carrito.',
  PRODUCT_UNAVAILABLE: 'El producto dejó de estar disponible.',
  INVALID_QUANTITY: 'Selecciona una cantidad entre 1 y 100.',
  CART_LIMIT: 'El carrito admite hasta 50 variantes distintas.',
  EMPTY_CART: 'Tu carrito está vacío.',
  CART_UNAVAILABLE: 'El carrito cambió o ya se usó. Revisa tu carrito y tu historial.',
  ADDRESS_UNAVAILABLE: 'Selecciona una dirección de entrega disponible.',
  INVALID_DATA: 'Revisa los datos e inténtalo de nuevo.',
  DELIVERY_UNAVAILABLE: 'La entrega simulada no tiene cobertura para esta dirección.',
  COUPON_UNAVAILABLE: 'Ese cupón no está disponible.',
  COUPON_MINIMUM: 'El subtotal no alcanza el mínimo requerido por el cupón.',
  COUPON_LIMIT: 'El cupón alcanzó su límite de uso.',
  QUOTE_EXPIRED: 'La cotización venció. Solicita una nueva.',
  QUOTE_CHANGED: 'Cambió el precio, la entrega o el contenido del carrito. Solicita una nueva cotización.',
  QUOTE_UNAVAILABLE: 'La cotización ya no está disponible. Solicita una nueva.',
  TERMS_REQUIRED: 'Revisa y acepta la versión de términos de la cotización.',
  POLICY_UNAVAILABLE: 'Los términos de compra vigentes no están disponibles. Intenta cotizar de nuevo.',
  PAYMENT_DECLINED: 'El pago simulado fue rechazado. Tu carrito sigue disponible para reintentar.',
  PROFILE_DISABLED: 'Tu perfil comercial no está activo.',
  FORBIDDEN: 'Tu cuenta no tiene permiso para esta operación.',
  CONTACT_EMAIL_REQUIRED: 'La cuenta necesita un correo válido para confirmar.',
  INVALID_TRANSITION: 'El estado actual no admite esta acción. Actualiza la consulta.',
  ORDER_UNAVAILABLE: 'El pedido no está disponible para esta cuenta.',
  TRACKING_REQUIRED: 'Completa el transportista y la guía ficticia.',
  CANCELLATION_UNAVAILABLE: 'Solo se pueden cancelar pedidos pagados antes del despacho.',
  RETURN_UNAVAILABLE: 'El expediente no está disponible o el pedido no admite esta solicitud.',
  RETURN_QUANTITY_UNAVAILABLE: 'La cantidad supera las unidades disponibles para solicitar.',
  INVALID_RETURN_ITEMS: 'Revisa las partidas y las cantidades del expediente.',
  REFUND_QUANTITY_EXCEEDED: 'La cantidad ya fue compensada en otro expediente.',
  REFUND_AMOUNT_UNAVAILABLE: 'El importe supera el saldo elegible o el expediente no tiene un saldo reembolsable.',
  EMPTY_REPLACEMENT: 'Registra las unidades recibidas antes de resolver la reposición.',
  NO_SELLABLE_VARIANT: 'Agrega o habilita una variante antes de activar la ficha.',
  INVALID_EVIDENCE: 'Adjunta un PNG o JPEG válido de hasta 256 KiB.',
  EVIDENCE_LIMIT: 'El expediente admite hasta cinco archivos.',
  TICKET_UNAVAILABLE: 'El ticket no está disponible para esta cuenta.',
  REASON_REQUIRED: 'Escribe el motivo de la decisión.',
  INVENTORY_ADMIN_REQUIRED: 'El ingreso a existencias requiere un administrador.',
  SCHEMA_INCOMPLETE: 'La operación está suspendida mientras se verifican las protecciones de la base.',
};

export class CommerceError extends Error {
  constructor(code) {
    super(messages[code] ?? 'PostgreSQL rechazó la operación. Revisa los datos e inténtalo de nuevo.');
    this.code = code;
  }
}

export function commerceMessage(error) {
  if (error instanceof CommerceError) return error.message;
  if (/unauthenticated|user-token-expired|invalid-user-token/i.test(error?.code ?? '')) return messages.SESSION_CHANGED;
  return 'No se pudo conectar con el servicio. Revisa tu conexión y vuelve a intentarlo.';
}

export function checkSession(uid) {
  if (!uid || auth.currentUser?.uid !== uid) throw new CommerceError('SESSION_CHANGED');
}

export async function readOwned(uid, query, variables) {
  checkSession(uid);
  const { data } = variables === undefined
    ? await query(accountDb, serverOnly) : await query(accountDb, variables, serverOnly);
  checkSession(uid);
  return data;
}

export async function runCommand(uid, mutation, variables, connector = accountDb) {
  const { key } = variables;
  const lookup = async () => (await readOwned(uid, account.getMyCommandResult, { key })).commerceCommands[0];
  let result = await lookup();
  if (result) return result;
  checkSession(uid);
  try {
    await mutation(connector, variables);
  } catch (error) {
    result = await lookup();
    if (result) return result;
    throw error;
  }
  result = await lookup();
  if (!result) throw new Error('Resultado del comando aún no disponible.');
  return result;
}

export function resultId(result, expected = 'OK') {
  if (result.status !== 'SUCCEEDED' || result.resultCode !== expected) throw new CommerceError(result.resultCode);
  return result.resultId;
}

export const loadCart = async uid => (await readOwned(uid, account.getMyCart)).carts[0] ?? null;
export async function loadFavorites(uid) {
  const all = [];
  for (let offset = 0; ; offset += 100) {
    const { favorites } = await readOwned(uid, account.listMyFavorites, { offset });
    all.push(...favorites);
    if (favorites.length < 100) return all;
  }
}
export const loadAddresses = async uid => (await readOwned(uid, account.listMyAddresses)).addresses;
export const loadQuote = async (uid, id) => (await readOwned(uid, account.getMyQuote, { id })).checkoutQuotes[0] ?? null;
export const loadOrder = async (uid, id) => (await readOwned(uid, account.getMyOrder, { id })).customerOrders[0] ?? null;
export const loadOrders = async (uid, offset) => (await readOwned(uid, account.listMyOrders, { offset })).customerOrders;

export function canonicalUuid(value) {
  const match = /^([a-f\d]{8})-?([a-f\d]{4})-?([a-f\d]{4})-?([a-f\d]{4})-?([a-f\d]{12})$/i.exec(value ?? '');
  return match ? match.slice(1).join('-').toLowerCase() : null;
}

export const orderStatus = status => ({
  PAID: 'Pagado', PREPARING: 'En preparación', SHIPPED: 'Enviado', DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado', REFUNDED: 'Reembolsado',
})[status] ?? status;
export const paymentStatus = status => ({
  APPROVED: 'Aprobado', DECLINED: 'Rechazado', PENDING: 'Pendiente', REFUNDED: 'Reembolsado',
})[status] ?? 'No disponible';
export const receiptNotice = 'Comprobante académico de compra simulada — Sin validez fiscal';
export const orderDate = timestamp => new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Matamoros',
}).format(new Date(timestamp));

const formatPesos = new Intl.NumberFormat('es-MX', { minimumIntegerDigits: 1 });
export function exactMoney(cents) {
  const value = BigInt(cents);
  const absolute = value < 0n ? -value : value;
  return (value < 0n ? '-' : '') + '$' + formatPesos.format(absolute / 100n) +
    '.' + String(absolute % 100n).padStart(2, '0') + ' MXN';
}

export const totals = [
  ['Subtotal', 'subtotalCents'], ['Descuentos', 'discountCents'], ['Impuestos de productos', 'itemsTaxCents'],
  ['Envío', 'shippingCents'], ['Impuesto de envío', 'shippingTaxCents'], ['Total', 'totalCents'],
];

export function totalAmount(data, field) {
  return exactMoney(field === 'discountCents' ? -BigInt(data[field]) : data[field]);
}

export function addressLines(address) {
  return [address.line1, address.line2, [address.district, address.city, address.stateCode].join(', '),
    'C. P. ' + address.postalCode + ', México'].filter(Boolean);
}
