import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as account from '../dataconnect-generated/account/esm/index.esm.js';
import { useResource } from '../hooks/useResource.js';
import { canonicalUuid, loadOrder, orderDate, readOwned } from '../lib/commerce.js';
import { labelFor, messagePageSize, textValue } from '../lib/operations.js';
import { TicketMessages } from './cases.jsx';
import { CommandForm, Pager, RecordList } from './operations.jsx';
import { PurchaseResource, PurchaseSession } from './purchase.jsx';
import { PageHeading, State } from './ui.jsx';

const route = '/cuenta/soporte';

function TicketList({ uid }) {
  const [offset, setOffset] = useState(0);
  const read = useCallback(async () => (await readOwned(uid, account.getMyTickets, { offset })).supportTickets, [uid, offset]);
  const resource = useResource(read);
  return <section className="surface form-stack">
    <Link className="button primary" to={route + '/nuevo'}>Abrir ticket</Link>
    <PurchaseResource resource={resource} label="Consultando tickets…">{items => <>
      <RecordList items={items} empty="Aún no tienes tickets de soporte." render={item => <li key={item.id}>
        <div><Link className="text-link" to={route + '/' + canonicalUuid(item.id)}>{item.subject}</Link><p className="muted">{item.folio}</p></div>
        <span>{labelFor(item.status)}</span>
      </li>} />
      <Pager offset={offset} count={items.length} onChange={setOffset} label="Páginas de tickets" />
    </>}</PurchaseResource>
  </section>;
}

function OpenTicket({ uid, orderId }) {
  const read = useCallback(() => loadOrder(uid, orderId), [uid, orderId]);
  const order = useResource(read, Boolean(orderId));
  const navigate = useNavigate();
  return <div className="checkout-steps">
    <Link className="text-link" to={route}>Volver a mis tickets</Link>
    <PurchaseResource resource={order} label="Consultando pedido…">{value => orderId && !value ? <State title="Pedido no disponible"
      action={<Link className="button secondary" to={route + '/nuevo'}>Abrir ticket general</Link>} /> :
      <CommandForm uid={uid} command={account.openSupportTicketRef} className="surface open-ticket"
        title="Datos de la solicitud" submitLabel="Enviar a soporte" onSaved={id => navigate(route + '/' + canonicalUuid(id))}
        values={form => ({ orderId, subject: textValue(form, 'subject'), body: textValue(form, 'body') })}>
        {value && <p>Asociado al pedido {value.folio}</p>}
        <label>Asunto<input name="subject" maxLength={180} required /></label>
        <label>Mensaje<textarea name="body" maxLength={2500} rows={5} required /></label>
      </CommandForm>}
    </PurchaseResource>
  </div>;
}

function TicketDetail({ uid, id }) {
  const [offset, setOffset] = useState(0);
  const [saved, setSaved] = useState(false);
  const read = useCallback(async () => id ? (await readOwned(uid, account.getMyTicket, { id, messageOffset: offset })).supportTickets[0]
    : null, [uid, id, offset]);
  const resource = useResource(read);
  return <div className="checkout-steps">
    <Link className="text-link" to={route}>Volver a mis tickets</Link>
    {saved && <p role="status" className="feedback">Respuesta enviada.</p>}
    <PurchaseResource resource={resource} label="Consultando conversación…">{ticket => ticket ? <>
      <section className="surface form-stack">
        <h2>{ticket.subject}</h2>
        <p>{ticket.folio} · <strong>{labelFor(ticket.status)}</strong></p>
        {ticket.closedAt && <p>Cerrado <time dateTime={ticket.closedAt}>{orderDate(ticket.closedAt)}</time></p>}
        {ticket.orderId && <Link className="text-link" to={'/pedidos/' + canonicalUuid(ticket.orderId)}>Ver pedido asociado</Link>}
        <TicketMessages uid={uid} messages={ticket.supportMessages_on_ticket} />
        <Pager size={messagePageSize} offset={offset} count={ticket.supportMessages_on_ticket.length}
          onChange={setOffset} label="Páginas de conversación" />
      </section>
      <CommandForm uid={uid} command={account.replyToTicketRef} className="surface customer-reply"
        title="Responder al expediente" submitLabel={ticket.status === 'RESOLVED' ? 'Reabrir con respuesta' : 'Enviar respuesta'}
        values={form => ({ id, body: textValue(form, 'body') })}
        onSaved={() => { setSaved(true); setOffset(0); resource.retry(); }}>
        <label>Mensaje<textarea name="body" maxLength={2500} rows={4} required /></label>
      </CommandForm>
    </> : <State title="Ticket no disponible" />}</PurchaseResource>
  </div>;
}

export function MySupport() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const orderId = canonicalUuid(params.get('pedido')) ?? undefined;
  return <PurchaseSession>{user => <div className="wrap page">
    <PageHeading title={id === 'nuevo' ? 'Nuevo ticket de soporte' : id ? 'Ticket de soporte' : 'Mis tickets de soporte'} />
    {id === 'nuevo' ? <OpenTicket key={user.uid + (orderId ?? '')} uid={user.uid} orderId={orderId} />
      : id ? <TicketDetail key={user.uid + id} uid={user.uid} id={canonicalUuid(id)} /> : <TicketList key={user.uid} uid={user.uid} />}
  </div>}</PurchaseSession>;
}
