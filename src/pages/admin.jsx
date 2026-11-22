import { useCallback } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { InventoryDetail, InventorySearch, StaffProduct, StaffProducts, StaffVariant } from '../components/staff-catalog.jsx';
import { StaffCategories, StaffCustomers } from '../components/staff-accounts.jsx';
import { StaffQueue, StaffReturnDetail, StaffReturns, StaffTicketDetail, StaffTickets } from '../components/staff-cases.jsx';
import { StaffCoupon, StaffCoupons } from '../components/staff-coupons.jsx';
import { StaffOrder, StaffOrders } from '../components/staff-orders.jsx';
import { LowStock, OverviewTotals, StaffReports } from '../components/staff-reports.jsx';
import { PageHeading, Resource, State } from '../components/ui.jsx';
import { useAuthSession } from '../context/auth-session.js';
import { useResource } from '../hooks/useResource.js';
import { identityError, loadMyProfile } from '../lib/account.js';
import { canonicalUuid } from '../lib/commerce.js';

const root = '/administracion';
const sections = [
  ['', 'Resumen', false], ['productos', 'Productos', true], ['inventario', 'Inventario', true],
  ['categorias', 'Categorías', true], ['clientes', 'Clientes', true],
  ['pedidos', 'Pedidos y envíos', true], ['cupones', 'Cupones', true], ['posventa', 'Posventa', false],
  ['soporte', 'Soporte', false], ['cola', 'Cola de atención', false], ['reportes', 'Reportes', true],
];
const adminSections = ['productos', 'variantes', 'inventario', 'categorias', 'clientes', 'pedidos', 'cupones', 'reportes'];

function StaffOverview({ uid, admin }) {
  return <div className="checkout-steps">
    {admin && <OverviewTotals uid={uid} compact />}
    <div className="admin-grid">
      {admin && <StaffOrders uid={uid} overview />}
      <div className="checkout-steps">
        {admin && <LowStock uid={uid} compact />}
        <StaffQueue uid={uid} admin={admin} compact />
      </div>
    </div>
  </div>;
}

function StaffContent({ uid, admin, section, parameter }) {
  const [params] = useSearchParams();
  const { state } = useLocation();
  const id = canonicalUuid(parameter);
  const orderId = canonicalUuid(params.get('pedido')) ?? undefined;
  const editableId = parameter === 'nuevo' ? parameter : id;
  switch (section) {
    case undefined: return <StaffOverview uid={uid} admin={admin} />;
    case 'productos': return parameter ? <StaffProduct uid={uid} id={editableId} created={state?.productCreated} /> : <StaffProducts uid={uid} />;
    case 'categorias': return <StaffCategories uid={uid} />;
    case 'clientes': return <StaffCustomers uid={uid} />;
    case 'variantes': return <StaffVariant uid={uid} id={editableId} parentId={canonicalUuid(params.get('producto'))} />;
    case 'inventario': return parameter ? <InventoryDetail uid={uid} id={id} /> : <div className="checkout-steps">
      <LowStock uid={uid} /><InventorySearch uid={uid} />
    </div>;
    case 'pedidos': return parameter ? <StaffOrder uid={uid} id={id} /> : <StaffOrders uid={uid} />;
    case 'cupones': return parameter ? <StaffCoupon uid={uid} id={editableId} /> : <StaffCoupons uid={uid} />;
    case 'posventa': return parameter ? <StaffReturnDetail uid={uid} id={id} admin={admin} />
      : <StaffReturns key={orderId} uid={uid} admin={admin} orderId={orderId} />;
    case 'soporte': return parameter ? <StaffTicketDetail uid={uid} id={id} admin={admin} /> : <StaffTickets uid={uid} />;
    case 'cola': return <StaffQueue uid={uid} admin={admin} />;
    case 'reportes': return <StaffReports uid={uid} />;
    default: return <State title="Sección no disponible" />;
  }
}

export function Admin() {
  const { user, pending, error } = useAuthSession();
  const { section, id } = useParams();
  const uid = user?.uid;
  const load = useCallback(() => loadMyProfile(uid), [uid]);
  const profile = useResource(load, Boolean(uid));
  if (pending) return <div className="wrap page"><p role="status">Comprobando sesión…</p></div>;
  if (error) return <div className="wrap page"><p role="alert">{identityError(error)}</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <div className="wrap page">
    <PageHeading title={section === 'pedidos' && id ? 'Consulta de pedido' : 'Panel de personal'} />
    <Resource value={profile} label="Comprobando permisos…">{value => {
      const roles = value?.userRoles_on_user.map(role => role.roleCode) ?? [];
      const admin = roles.includes('ADMIN');
      if (!user.emailVerified || (!admin && (!roles.includes('SUPPORT') || adminSections.includes(section)))) {
        return <State title="Acceso restringido" action={<Link className="button primary" to="/perfil">Ir a mi perfil</Link>}>
          El panel requiere un correo verificado y un rol de personal autorizado.
        </State>;
      }
      const active = section === 'variantes' ? 'productos' : section ?? '';
      return <>
        <nav className="chips staff-nav" aria-label="Panel de personal">
          {sections.filter(([, , onlyAdmin]) => admin || !onlyAdmin).map(([path, label]) =>
            <Link key={path} to={path ? root + '/' + path : root} aria-current={active === path ? 'page' : undefined}>{label}</Link>)}
        </nav>
        <StaffContent key={[uid, admin, section, id].join(':')} uid={uid} admin={admin} section={section} parameter={id} />
      </>;
    }}</Resource>
  </div>;
}
