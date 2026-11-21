import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as account from '../dataconnect-generated/account/esm/index.esm.js';
import { useResource } from '../hooks/useResource.js';
import { canonicalUuid, readOwned } from '../lib/commerce.js';
import { labelFor, OperationInputError, textValue } from '../lib/operations.js';
import { EvidenceList, RefundDetails, ReturnDetails, ReturnList } from './cases.jsx';
import { CommandForm, Pager } from './operations.jsx';
import { PurchaseResource, PurchaseSession } from './purchase.jsx';
import { PageHeading, State } from './ui.jsx';

const route = '/cuenta/solicitudes';
const closed = ['REJECTED', 'RESOLVED'];
const reasons = ['DEFECT', 'DAMAGED', 'WRONG_ITEM', 'CHANGED_MIND', 'OTHER'];
const afterDispatch = ['RETURN', 'EXCHANGE', 'WARRANTY'];

function ReturnForm({ uid, order, kinds }) {
  const [kind, setKind] = useState(kinds[0]);
  const navigate = useNavigate();
  const lines = order.orderItems_on_order.map(item => ({ ...item, id: canonicalUuid(item.id) }));
  return <CommandForm uid={uid} command={account.createReturnRequestRef} title="Nueva solicitud"
    className="return-request-form" submitLabel="Enviar solicitud"
    onSaved={id => navigate(route + '/' + canonicalUuid(id))}
    values={form => {
      const items = kind === 'CANCELLATION' ? undefined : lines
        .map(item => ({ id: item.id, quantity: Number(form.get(item.id)) })).filter(item => item.quantity > 0);
      if (items && !items.length) throw new OperationInputError('Selecciona al menos una unidad.');
      return { orderId: canonicalUuid(order.id), kind, reason: textValue(form, 'reason'),
        description: textValue(form, 'description'), items };
    }}>
    <label>Tipo de solicitud<select name="kind" value={kind} onChange={event => setKind(event.target.value)}>
      {kinds.map(value => <option key={value} value={value}>{labelFor(value)}</option>)}
    </select></label>
    <label>Motivo<select name="reason" required>
      <option value="">Selecciona un motivo</option>
      {reasons.map(value => <option key={value} value={value}>{labelFor(value)}</option>)}
    </select></label>
    <label>Descripción<textarea name="description" maxLength={2000} rows={3} required /></label>
    {kind === 'CANCELLATION' ? <p className="muted">La cancelación se solicita para el pedido completo.</p> :
      <div className="form-stack">
        <p>Indica las unidades por partida.</p>
        {lines.map(item => <label key={item.id}>{item.nameSnapshot} · {item.skuSnapshot}
          <input type="number" name={item.id} min={0} max={item.quantity} defaultValue={0} required /></label>)}
      </div>}
  </CommandForm>;
}

export function OrderAfterSale({ uid, order }) {
  const id = canonicalUuid(order.id);
  const kinds = ['PAID', 'PREPARING'].includes(order.status) ? ['CANCELLATION']
    : ['SHIPPED', 'DELIVERED'].includes(order.status) ? afterDispatch : [];
  return <section className="surface form-stack">
    <h2>Solicitudes del pedido</h2>
    <div className="action-row">
      <Link className="text-link" to={route + '?pedido=' + id}>Ver expedientes del pedido</Link>
      <Link className="text-link" to={'/cuenta/soporte/nuevo?pedido=' + id}>Contactar a soporte</Link>
    </div>
    {kinds.length ? <ReturnForm uid={uid} order={order} kinds={kinds} /> :
      <p className="muted">El estado actual del pedido no admite nuevas solicitudes de posventa.</p>}
  </section>;
}

async function readEvidenceFile(form) {
  const file = form.get('evidence');
  if (!file || !['image/png', 'image/jpeg'].includes(file.type) || file.size < 4 || file.size > 262144) {
    throw new OperationInputError('Selecciona un PNG o JPEG de hasta 256 KiB.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }
  return { content: btoa(chunks.join('')), media: file.type };
}

function CustomerReturnDetail({ uid, id }) {
  const [saved, setSaved] = useState(false);
  const read = useCallback(async () => id ? (await readOwned(uid, account.getMyReturnRequest, { id })).returnRequests[0] : null, [uid, id]);
  const resource = useResource(read);
  const loadEvidence = async evidenceId => (await readOwned(uid, account.getMyReturnEvidence, { id: evidenceId })).returnEvidences[0];
  return <div className="checkout-steps">
    <Link className="text-link" to={route}>Volver a mis solicitudes</Link>
    {saved && <p role="status" className="feedback">Evidencia adjuntada.</p>}
    <PurchaseResource resource={resource} label="Consultando expediente…">{value => value ? <>
      <article className="surface form-stack">
        <h2>{value.folio}</h2>
        <Link className="text-link" to={'/pedidos/' + canonicalUuid(value.orderId)}>Ver el pedido</Link>
        <ReturnDetails value={value} />
        <RefundDetails refunds={value.refunds_on_request} />
      </article>
      <section className="surface form-stack">
        <EvidenceList items={value.returnEvidences_on_request} load={loadEvidence} />
        {!closed.includes(value.status) && value.returnEvidences_on_request.length < 5 &&
          <CommandForm uid={uid} command={account.uploadReturnEvidenceRef} title="Agregar evidencia" submitLabel="Adjuntar evidencia"
            values={async form => ({ id, ...await readEvidenceFile(form) })}
            onSaved={() => { setSaved(true); resource.retry(); }}>
            <label>Archivo PNG o JPEG (máx. 256 KiB)<input type="file" name="evidence" accept="image/png,image/jpeg" required /></label>
          </CommandForm>}
        {value.status === 'NEEDS_INFO' && <Link className="text-link" to={'/cuenta/soporte/nuevo?pedido=' + canonicalUuid(value.orderId)}>
          Enviar información adicional a soporte</Link>}
      </section>
    </> : <State title="Expediente no disponible" />}</PurchaseResource>
  </div>;
}

function CustomerReturns({ uid, orderId }) {
  const [offset, setOffset] = useState(0);
  const read = useCallback(async () => (await readOwned(uid, account.listMyReturnRequests, { offset, orderId })).returnRequests,
    [uid, offset, orderId]);
  const resource = useResource(read);
  return <section className="surface form-stack">
    <div className="action-row">
      <Link className="text-link" to={orderId ? '/pedidos/' + orderId : '/pedidos'}>Volver a {orderId ? 'este pedido' : 'mis pedidos'}</Link>
      {orderId && <Link className="text-link" to={route}>Ver todas mis solicitudes</Link>}
    </div>
    <PurchaseResource resource={resource} label="Consultando solicitudes…">{items => <>
      <ReturnList items={items} route={route} />
      <Pager offset={offset} count={items.length} onChange={setOffset} label="Páginas de solicitudes" />
    </>}</PurchaseResource>
  </section>;
}

export function MyReturns() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const orderId = canonicalUuid(params.get('pedido')) ?? undefined;
  return <PurchaseSession>{user => <div className="wrap page">
    <PageHeading title={id ? 'Detalle de solicitud' : 'Mis solicitudes'} />
    {id ? <CustomerReturnDetail key={user.uid + id} uid={user.uid} id={canonicalUuid(id)} />
      : <CustomerReturns key={user.uid + (orderId ?? '')} uid={user.uid} orderId={orderId} />}
  </div>}</PurchaseSession>;
}
