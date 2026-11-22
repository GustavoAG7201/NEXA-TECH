import { Link, useParams } from 'react-router-dom';
import { PageHeading, Resource, State } from '../components/ui.jsx';
import { useResource } from '../hooks/useResource.js';
import { request } from '../lib/api.js';
import { loadPolicies } from '../lib/catalog.js';
import { policyPath, policyRoutes } from '../lib/policies.js';

const loadContact = () => request('legal-contact');
const contactFields = {
  PRIVACY: [['responsible', 'Responsable'], ['address', 'Domicilio'], ['privacyEmail', 'Contacto de privacidad']],
  TERMS: [['responsible', 'Proveedor'], ['address', 'Domicilio'], ['supportEmail', 'Correo de atención'], ['supportPhone', 'Teléfono de atención']],
  SUPPORT: [['supportEmail', 'Correo de atención'], ['supportPhone', 'Teléfono de atención']],
};

export function Help() {
  return <div className="wrap page reading-page">
    <PageHeading title="Centro de ayuda">Consulta cómo hacer y gestionar tus pedidos.</PageHeading>
    <div className="faq">
      <details><summary>¿Cómo consulto el precio y la disponibilidad?</summary><p>Cada ficha muestra el precio en pesos mexicanos y las existencias por variante. La cotización incluye los impuestos, los descuentos y el envío aplicables.</p></details>
      <details><summary>¿Dónde encuentro mis artículos guardados?</summary><p>Abre el carrito y los favoritos desde el encabezado. Al iniciar sesión, tu selección de visitante se agrega al carrito de tu cuenta. Los favoritos de visitante se conservan en el navegador y los que guardes con sesión iniciada se asocian a tu cuenta.</p></details>
      <details><summary>¿Cómo confirmo un pedido?</summary><p>Selecciona una dirección, cotiza el pedido y acepta los términos para confirmarlo. No se realizan cargos reales. Descarga el comprobante desde <Link className="text-link" to="/pedidos">Mis pedidos</Link>.</p></details>
      <details><summary>¿Dónde consulto las condiciones de un pedido?</summary><p>Las <Link className="text-link" to="/politicas">políticas de la tienda</Link> explican cómo se registran los envíos, las cancelaciones, las devoluciones y las garantías.</p></details>
    </div>
    <div className="action-row">
      <Link className="button primary" to="/cuenta/soporte">Abrir centro de soporte</Link>
      <Link className="button secondary" to="/politicas">Consultar políticas</Link>
    </div>
  </div>;
}

export function Policies() {
  const { kind } = useParams();
  const policies = useResource(loadPolicies);
  const contact = useResource(loadContact);
  const section = Object.entries(policyRoutes).find(([, [slug]]) => slug === kind)?.[0];
  return <div className="wrap page reading-page">
    <PageHeading title="Políticas de la tienda" />
    <Resource value={policies} label="Cargando políticas…">{items => {
      const available = items.filter(item => Object.hasOwn(policyRoutes, item.kind));
      const visible = kind ? available.filter(item => item.kind === section) : available;
      return <>
        <nav className="chips" aria-label="Tipos de políticas">
          <Link to="/politicas" aria-current={!kind ? 'page' : undefined}>Todas</Link>
          {available.map(item => <Link key={item.id} aria-current={item.kind === section ? 'page' : undefined}
            to={policyPath(item.kind)}>{policyRoutes[item.kind][1]}</Link>)}
        </nav>
        {visible.length ? <div className="policy-list">{visible.map(item => <article className="surface" key={item.id}>
          <h2>{item.title}</h2>
          <PolicyBody body={item.body} />
          {contactFields[item.kind] && <Resource value={contact} label="Consultando datos de contacto…">{value =>
            <dl className="policy-contact">{contactFields[item.kind].map(([field, label]) => <div key={field}>
              <dt>{label}</dt><dd>{value[field] || 'Pendiente de validación administrativa'}</dd>
            </div>)}</dl>}
          </Resource>}
          {item.kind === 'SUPPORT' && <Link className="text-link" to="/cuenta/soporte">Abrir una solicitud de soporte</Link>}
        </article>)}</div> : <State title="Política no disponible" action={<Link className="button secondary" to="/politicas">Ver todas</Link>} />}
      </>;
    }}</Resource>
  </div>;
}

function PolicyBody({ body }) {
  return <div className="policy-body">{body.split(/\r?\n\s*\r?\n/).map((paragraph, index) =>
    <p key={index}>{paragraph}</p>)}</div>;
}
