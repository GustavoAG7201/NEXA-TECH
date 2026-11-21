import { Link, useParams } from 'react-router-dom';
import { PageHeading, Resource, State } from '../components/ui.jsx';
import { useResource } from '../hooks/useResource.js';
import { loadPolicies } from '../lib/catalog.js';

const sections = {
  TERMS: ['terminos', 'Términos'], PRIVACY: ['privacidad', 'Privacidad'], SHIPPING: ['envios', 'Envíos'],
  CANCELLATION: ['cancelaciones', 'Cancelaciones'], RETURN: ['devoluciones', 'Devoluciones'], WARRANTY: ['garantias', 'Garantías'],
};

export function Help() {
  return <div className="wrap page reading-page">
    <PageHeading title="Centro de ayuda">Información para usar la tienda académica.</PageHeading>
    <div className="faq">
      <details><summary>¿De dónde salen los precios y las existencias?</summary><p>El catálogo consulta PostgreSQL por medio de SQL Connect. Los importes del catálogo de demostración se expresan en MXN y se usan para practicar.</p></details>
      <details><summary>¿Dónde encuentro mis artículos guardados?</summary><p>Abre el carrito y los favoritos desde el encabezado. Al iniciar sesión, tu selección de visitante se agrega al carrito de tu cuenta. Los favoritos de visitante se conservan en el navegador y los que guardes con sesión iniciada se asocian a tu cuenta.</p></details>
      <details><summary>¿Cómo se completa una compra?</summary><p>Selecciona una dirección ficticia, cotiza el pedido y acepta los términos para pagar mediante simulación académica. Descarga el comprobante al confirmar o desde <Link className="text-link" to="/pedidos">Mis pedidos</Link>.</p></details>
      <details><summary>¿Cómo se simulan envíos, devoluciones y garantías?</summary><p>La tienda publica los documentos de cada proceso en <Link className="text-link" to="/politicas">Políticas de la demostración</Link>.</p></details>
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
  return <div className="wrap page reading-page">
    <PageHeading title="Políticas de la demostración">Textos publicados en el entorno académico NexaTech.</PageHeading>
    <Resource value={policies} label="Cargando políticas…">{items => {
      const available = items.filter(item => sections[item.kind]);
      const visible = kind ? available.filter(item => sections[item.kind][0] === kind) : available;
      return <>
        <nav className="chips" aria-label="Tipos de políticas">
          <Link to="/politicas" aria-current={!kind ? 'page' : undefined}>Todas</Link>
          {available.map(item => <Link key={item.id} aria-current={kind === sections[item.kind][0] ? 'page' : undefined}
            to={'/politicas/' + sections[item.kind][0]}>{sections[item.kind][1]}</Link>)}
        </nav>
        {visible.length ? <div className="policy-list">{visible.map(item => <article className="surface" key={item.id}>
          <h2>{item.title}</h2><p className="muted">Versión {item.version}</p><p className="policy-body">{item.body}</p>
        </article>)}</div> : <State title="Política no disponible" action={<Link className="button secondary" to="/politicas">Ver todas</Link>} />}
      </>;
    }}</Resource>
  </div>;
}
