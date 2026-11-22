import { orderDate, orderStatus } from '../lib/commerce.js';
import { shipmentLabel } from '../lib/operations.js';
import { HistoryEvents } from './operations.jsx';

const localDay = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' });
const formatDay = date => localDay.format(new Date(date.slice(0, 10) + 'T00:00:00Z'));

export function ShipmentTracking({ shipment, orderEvents }) {
  if (!shipment) return null;
  return <section className="surface form-stack">
    <h2>Seguimiento del envío</h2>
    <p className="muted">Seguimiento de referencia. No se realizan entregas físicas.</p>
    <p>Estado del envío <strong>{shipmentLabel(shipment.status)}</strong></p>
    {shipment.trackingCode && <p>Guía de referencia <strong>{shipment.trackingCode}</strong> · {shipment.carrier === 'NexaTech Académico' ? 'NexaTech' : shipment.carrier}</p>}
    {shipment.estimatedFrom && shipment.estimatedTo && <p>Periodo estimado de referencia del {formatDay(shipment.estimatedFrom)} al {formatDay(shipment.estimatedTo)}</p>}
    {shipment.shippedAt && <p>Despacho <time dateTime={shipment.shippedAt}>{orderDate(shipment.shippedAt)}</time></p>}
    {shipment.deliveredAt && <p>Entrega <time dateTime={shipment.deliveredAt}>{orderDate(shipment.deliveredAt)}</time></p>}
    <HistoryEvents title="Eventos de envío" statusLabel={shipmentLabel} events={shipment.shipmentEvents_on_shipment?.map(event => ({
      state: event.eventType, detail: event.publicDetail, time: event.occurredAt,
    }))} />
    <HistoryEvents title="Estados del pedido" statusLabel={orderStatus} events={orderEvents?.map(event => ({
      state: event.newStatus, detail: event.reason, time: event.createdAt,
    }))} />
  </section>;
}
