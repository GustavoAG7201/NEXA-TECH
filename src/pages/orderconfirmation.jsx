import { useCallback, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { OrderList } from '../components/orders.jsx';
import { OrderAfterSale } from '../components/customer-returns.jsx';
import { AddressText, Amounts, PurchaseResource, PurchaseSession } from '../components/purchase.jsx';
import { ShipmentTracking } from '../components/shipment.jsx';
import { CatalogLink, PageHeading, State } from '../components/ui.jsx';
import { useResource } from '../hooks/useResource.js';
import {
  canonicalUuid, checkSession, commerceMessage, exactMoney, loadOrder, loadOrders, noChargeNotice, orderDate, orderStatus, receiptNotice,
} from '../lib/commerce.js';

function ReceiptButton({ uid, id }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const downloading = useRef(false);
  async function download() {
    if (downloading.current) return;
    downloading.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const [order, { downloadReceipt }] = await Promise.all([loadOrder(uid, id), import('../lib/receipt.js')]);
      checkSession(uid);
      if (order) {
        downloadReceipt(order);
        setMessage({ text: 'Descarga del comprobante iniciada.' });
      } else {
        setMessage({ error: true, text: 'El comprobante ya no está disponible para esta cuenta.' });
      }
    } catch (failure) {
      setMessage({ error: true, text: commerceMessage(failure) });
    } finally {
      downloading.current = false;
      setBusy(false);
    }
  }
  return <>
    <button type="button" className="button primary" onClick={download} disabled={busy}>
      <Download aria-hidden="true" /> {busy ? 'Preparando comprobante…' : 'Descargar comprobante PDF'}
    </button>
    {message && <p className="feedback" role={message.error ? 'alert' : 'status'}>{message.text}</p>}
  </>;
}

function History({ uid }) {
  const [offset, setOffset] = useState(0);
  const read = useCallback(() => loadOrders(uid, offset), [uid, offset]);
  const orders = useResource(read);
  return <div className="wrap page">
    <PageHeading title="Mis pedidos">Consulta tus compras y descarga sus comprobantes.</PageHeading>
    <div className="action-row order-history-links">
      <Link className="text-link" to="/cuenta/solicitudes">Mis solicitudes</Link>
      <Link className="text-link" to="/cuenta/soporte">Mis tickets de soporte</Link>
    </div>
    <section className="surface form-stack" aria-label="Historial de compras">
      <PurchaseResource resource={orders} label="Consultando tus pedidos…">
        {items => <OrderList orders={items} route="/pedidos" offset={offset} setOffset={setOffset} />}
      </PurchaseResource>
    </section>
  </div>;
}

function OrderDetails({ uid, id, confirmation }) {
  const read = useCallback(() => id ? loadOrder(uid, id) : null, [uid, id]);
  const order = useResource(read);
  return <div className="wrap page">
    <PurchaseResource resource={order} label="Consultando tu pedido…">{value => {
      if (!value) return <State title="Pedido no disponible" action={<Link className="button primary" to="/pedidos">Ir a mis pedidos</Link>} />;
      return <>
        <PageHeading title={confirmation ? 'Confirmación de pedido' : 'Detalle de tu pedido'}>
          Folio {value.folio}
        </PageHeading>
        <div className="checkout-grid">
          <div className="checkout-steps">
            <section className="surface form-stack">
              <h2>Productos del pedido</h2>
              <ul className="purchase-lines">{value.orderItems_on_order.map(item => <li key={item.id}>
                <div><strong>{item.nameSnapshot}</strong><p className="muted">{item.optionSnapshot} · {item.skuSnapshot}</p></div>
                <span>{item.quantity} × {exactMoney(item.unitPriceCents)}</span>
              </li>)}</ul>
            </section>
            <section className="surface form-stack">
              <h2>Entrega</h2>
              {value.orderAddress_on_order && <AddressText address={value.orderAddress_on_order} />}
            </section>
            <ShipmentTracking shipment={value.shipment_on_order} orderEvents={value.orderStatusEvents_on_order} />
            <OrderAfterSale uid={uid} order={value} />
          </div>
          <aside className="surface summary">
            <h2>Resumen del pedido</h2>
            <p className="muted"><time dateTime={value.confirmedAt}>{orderDate(value.confirmedAt)}</time> (hora de Matamoros)</p>
            <p>Estado del pedido <strong>{orderStatus(value.status)}</strong></p>
            <p className="muted">{noChargeNotice}</p>
            <Amounts data={value} />
            <ReceiptButton uid={uid} id={value.id} />
            <p className="muted">{receiptNotice}</p>
          </aside>
        </div>
        <div className="action-row order-actions">
          <Link className="button secondary" to="/pedidos">Ver historial de pedidos</Link>
          <CatalogLink>Continuar comprando</CatalogLink>
        </div>
      </>;
    }}</PurchaseResource>
  </div>;
}

export function Orders() {
  return <PurchaseSession>{user => <History key={user.uid} uid={user.uid} />}</PurchaseSession>;
}

export function OrderConfirmation({ confirmation = false }) {
  const { id } = useParams();
  return <PurchaseSession>{user => <OrderDetails key={user.uid + ':' + id} uid={user.uid} id={canonicalUuid(id)} confirmation={confirmation} />}</PurchaseSession>;
}
