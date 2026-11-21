import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuthSession } from '../context/auth-session.js';
import { addressLines, commerceMessage, totalAmount, totals } from '../lib/commerce.js';

export function PurchaseResource({ resource, label, children }) {
  if (resource.pending) return <p role="status">{label}</p>;
  if (resource.error) return <div className="feedback error">
    <p role="alert">{commerceMessage(resource.error)}</p>
    <button type="button" className="button secondary" onClick={resource.retry}>Reintentar consulta</button>
  </div>;
  return children(resource.data);
}

export function PurchaseSession({ children }) {
  const { user, pending, error } = useAuthSession();
  const location = useLocation();
  if (pending) return <div className="wrap page"><p role="status">Comprobando sesión…</p></div>;
  if (error) return <div className="wrap page"><p role="alert">{commerceMessage(error)}</p>
    <Link className="button secondary" to="/login">Iniciar sesión</Link></div>;
  if (!user) return <Navigate to="/login" state={{ returnTo: location.pathname + location.search }} replace />;
  return children(user);
}

export function Amounts({ data }) {
  return <dl className="purchase-totals">
    {totals.map(([label, field]) => <div key={field} className={field === 'totalCents' ? 'total-row' : ''}>
      <dt>{label}</dt><dd data-amount={field}>{totalAmount(data, field)}</dd>
    </div>)}
  </dl>;
}

export function AddressText({ address }) {
  return <address className="address-text">
    <strong>{address.recipient}</strong>
    {addressLines(address).map((line, index) => <span key={index}>{line}</span>)}
    <span>{address.phone}</span>
  </address>;
}
