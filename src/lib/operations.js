import { executeMutation } from 'firebase/data-connect';
import { checkSession, orderStatus, resultId, runCommand } from './commerce.js';
import { firebaseProjectId } from './firebase.js';

export const pageSize = 30;
export const messagePageSize = 100;
export const orderStates = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

export const operationalLabels = {
  // Catálogo y logística
  DRAFT: 'Borrador', ACTIVE: 'Activo', ARCHIVED: 'Archivado', PLANNED: 'Programado',
  DISABLED: 'Desactivado', CUSTOMER: 'Cliente', ADMIN: 'Administración', SUPPORT: 'Soporte',
  DELIVERY_ATTEMPT_FAILED: 'Intento de entrega fallido', INCIDENT: 'Incidencia',
  RETURNED_TO_SENDER: 'Devuelto al remitente',
  OPENING: 'Apertura', ADJUSTMENT: 'Ajuste', SALE: 'Venta', RESTOCK: 'Reingreso vendible',
  CANCELLED: 'Cancelado',
  // Expedientes
  CANCELLATION: 'Cancelación', RETURN: 'Devolución', EXCHANGE: 'Cambio', WARRANTY: 'Garantía', TICKET: 'Ticket',
  SUBMITTED: 'Recibido', IN_REVIEW: 'En revisión', NEEDS_INFO: 'Requiere información',
  APPROVED: 'Autorizado', REJECTED: 'Rechazado', AWAITING_ITEM: 'En espera del artículo',
  RECEIVED: 'Artículo recibido', INSPECTED: 'Inspeccionado', RESOLVED: 'Resuelto',
  REFUND: 'Reembolso simulado', REPLACEMENT: 'Reposición', REPAIR: 'Reparación', NO_REFUND: 'Cierre sin reembolso',
  OPEN: 'Abierto', IN_PROGRESS: 'En curso', WAITING_CUSTOMER: 'En espera del cliente',
  DEFECT: 'Falla o defecto', DAMAGED: 'Daño', WRONG_ITEM: 'Artículo incorrecto', CHANGED_MIND: 'Cambio de decisión',
  OTHER: 'Otro motivo', SELLABLE: 'Vendible', NON_SELLABLE: 'No vendible', NOT_RECEIVED: 'No recibido',
};

export const labelFor = value => operationalLabels[value] ?? value;
export const shipmentLabel = state => orderStatus(labelFor(state));
export const textValue = (form, name) => form.get(name)?.trim() ?? '';
export const optionalText = (form, name) => textValue(form, name) || undefined;
export const optionalNumber = (form, name) => textValue(form, name) ? Number(form.get(name)) : undefined;

export class OperationInputError extends Error {}

export function formNumber(value) {
  if (value == null) return '';
  const integer = BigInt(value);
  return String(integer / 100n) + '.' + String(integer % 100n).padStart(2, '0');
}

export function parseDecimal(input) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) throw new OperationInputError('Escribe un importe con hasta dos decimales.');
  const [whole, decimals = ''] = input.split('.');
  return (BigInt(whole) * 100n + BigInt(decimals.padEnd(2, '0'))).toString();
}

export async function collectPages(load, size = pageSize) {
  const result = [];
  for (let offset = 0; ; offset += size) {
    const page = await load(offset);
    result.push(...page);
    if (page.length < size) return result;
  }
}

export async function executeOperation(uid, mutationRef, variables, connector) {
  checkSession(uid);
  const payload = JSON.stringify([firebaseProjectId, uid, mutationRef.operationName, variables]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const name = 'nexatech:operacion:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const reserve = () => {
    checkSession(uid);
    const key = localStorage.getItem(name) ?? crypto.randomUUID();
    localStorage.setItem(name, key);
    return key;
  };
  const key = navigator.locks ? await navigator.locks.request(name, reserve) : reserve();
  const submit = (db, input) => executeMutation(mutationRef(db, input));
  const result = await runCommand(uid, submit, { ...variables, key }, connector);
  checkSession(uid);
  if (localStorage.getItem(name) === key) localStorage.removeItem(name);
  return resultId(result);
}
