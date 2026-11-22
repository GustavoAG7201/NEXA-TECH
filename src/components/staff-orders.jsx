import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStaffOrder, listStaffOrders, recordShipmentEvent } from '../lib/staff-api.js';
import { useResource } from '../hooks/useResource.js';
import { canonicalUuid, exactMoney, orderDate, orderStatus, paymentStatus } from '../lib/commerce.js';
import { optionalText, orderStates, shipmentLabel, textValue } from '../lib/operations.js';
import { readStaff } from '../lib/staff.js';
import { CommandForm } from './operations.jsx';
import { OrderList } from './orders.jsx';
import { AddressText, PurchaseResource } from './purchase.jsx';
import { ShipmentTracking } from './shipment.jsx';
import { State } from './ui.jsx';

export function StaffOrders({ uid, overview = false }) {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState('');
  const read = useCallback(async () => {
    const data = await readStaff(uid, listStaffOrders, { offset, status: status || undefined });
    return data.staffOrders.map(item => item.order);
  }, [uid, offset, status]);
  const orders = useResource(read);
  return <section className="surface form-stack staff-orders">
    <h2>Pedidos recibidos</h2>
    <label>Estado del pedido
      <select value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }}>
        <option value="">Todos</option>
        {orderStates.map(state => <option key={state} value={state}>{orderStatus(state)}</option>)}
      </select>
    </label>
    <PurchaseResource resource={orders} label="Consultando pedidos de la tienda…">
      {items => <OrderList orders={overview ? items.slice(0, 6) : items} route="/administracion/pedidos" offset={offset} setOffset={setOffset} />}
    </PurchaseResource>
    {overview && <Link className="text-link" to="/administracion/pedidos">Ver todos los pedidos</Link>}
  </section>;
}

const shipmentActions = {
  PLANNED: [['PREPARING', 'Preparar pedido']],
  PREPARING: [['SHIPPED', 'Registrar despacho']],
  SHIPPED: [['DELIVERED', 'Marcar entrega'], ['INCIDENT', 'Registrar incidencia'],
    ['DELIVERY_ATTEMPT_FAILED', 'Registrar intento fallido'], ['RETURNED_TO_SENDER', 'Registrar devolución al remitente']],
};

function ShipmentForm({ uid, order, reload }) {
  const actions = shipmentActions[order.shipment_on_order?.status] ?? [];
  const [selected, setSelected] = useState(actions[0]?.[0]);
  if (!actions.length || ['CANCELLED', 'REFUNDED'].includes(order.status)) return null;
  const dispatch = selected === 'SHIPPED';
  const choice = actions.find(([code]) => code === selected);
  return <CommandForm uid={uid} command={recordShipmentEvent} className="surface"
    title="Operar envío" submitLabel={choice[1]} onSaved={reload}
    values={form => ({
      orderId: canonicalUuid(order.id), event: selected, detail: optionalText(form, 'detail'),
      carrier: dispatch ? textValue(form, 'carrier') : undefined,
      trackingCode: dispatch ? textValue(form, 'trackingCode') : undefined,
    })}>
    {actions.length > 1 && <label>Evento<select value={selected} onChange={event => setSelected(event.target.value)}>
      {actions.map(([code]) => <option key={code} value={code}>{shipmentLabel(code)}</option>)}
    </select></label>}
    {dispatch && <div className="operation-fields">
      <label>Transportista de referencia<input name="carrier" required maxLength={80} defaultValue="NexaTech" /></label>
      <label>Guía de referencia<input name="trackingCode" required maxLength={100} defaultValue={'GUIA-' + order.folio} /></label>
    </div>}
    <label>Nota visible al comprador<textarea name="detail" rows={2} maxLength={500}
      required={selected === 'INCIDENT' || selected === 'DELIVERY_ATTEMPT_FAILED'} /></label>
  </CommandForm>;
}

export function StaffOrder({ uid, id }) {
  const [saved, setSaved] = useState(false);
  const read = useCallback(async () => {
    if (!id) return null;
    const data = await readStaff(uid, getStaffOrder, { id });
    return data.staffOrders[0]?.order ?? null;
  }, [uid, id]);
  const order = useResource(read);
  return <div className="checkout-steps">
    <Link className="text-link" to="/administracion/pedidos">Volver a pedidos recibidos</Link>
    {saved && <p role="status" className="feedback">Evento de envío registrado.</p>}
    <PurchaseResource resource={order} label="Consultando pedido…">{value => value ? <>
      <article className="surface form-stack">
        <h2>{value.folio}</h2>
        <p><time dateTime={value.confirmedAt}>{orderDate(value.confirmedAt)}</time> · {orderStatus(value.status)}</p>
        <p>Validación del pedido <strong>{paymentStatus(value.payment_on_order?.status)}</strong></p>
        <ul className="purchase-lines">{value.orderItems_on_order.map(item => <li key={item.id}>
          <div><strong>{item.skuSnapshot}</strong><p>{item.nameSnapshot}</p></div>
          <span>{item.quantity} × {exactMoney(item.unitPriceCents)}</span>
        </li>)}</ul>
        <p className="total-row"><strong>Total</strong><strong>{exactMoney(value.totalCents)}</strong></p>
        {value.orderAddress_on_order && <AddressText address={value.orderAddress_on_order} />}
        <Link className="text-link" to={'/administracion/posventa?pedido=' + id}>Expedientes de este pedido</Link>
      </article>
      <div className="operation-columns">
        <ShipmentTracking shipment={value.shipment_on_order} orderEvents={value.orderStatusEvents_on_order} />
        <ShipmentForm key={value.shipment_on_order?.status} uid={uid} order={value} reload={() => { setSaved(true); order.retry(); }} />
      </div>
    </> : <State title="Pedido no disponible" />}</PurchaseResource>
  </div>;
}
