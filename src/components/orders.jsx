import { Link } from 'react-router-dom';
import { canonicalUuid, exactMoney, orderDate, orderStatus } from '../lib/commerce.js';

export const ordersPageSize = 30;

export function OrderList({ orders, offset, setOffset, route }) {
  if (!orders.length && !offset) return <p className="muted">Aún no hay pedidos.</p>;
  return <>
    <ul className="purchase-lines">{orders.map(order => <li key={order.id}>
      <div>
        <Link className="text-link order-folio" to={route + '/' + canonicalUuid(order.id)}>{order.folio}</Link>
        <p className="muted"><time dateTime={order.confirmedAt}>{orderDate(order.confirmedAt)}</time> · {orderStatus(order.status)}</p>
      </div>
      <strong>{exactMoney(order.totalCents)}</strong>
    </li>)}</ul>
    {(offset > 0 || orders.length === ordersPageSize) && <nav className="pagination" aria-label="Páginas de pedidos">
      {offset > 0 && <button className="button secondary" onClick={() => setOffset(offset - ordersPageSize)}>Anterior</button>}
      <span>Página {offset / ordersPageSize + 1}</span>
      {orders.length === ordersPageSize && <button className="button secondary" onClick={() => setOffset(offset + ordersPageSize)}>Siguiente</button>}
    </nav>}
  </>;
}
