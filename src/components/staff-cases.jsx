import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as staff from '../dataconnect-generated/staff/esm/index.esm.js';
import { useResource } from '../hooks/useResource.js';
import { canonicalUuid, orderDate, orderStatus } from '../lib/commerce.js';
import { collectPages, labelFor, messagePageSize, OperationInputError, optionalText, textValue } from '../lib/operations.js';
import { readStaff, staffDb } from '../lib/staff.js';
import { EvidenceList, RefundDetails, ReturnDetails, ReturnList, TicketMessages } from './cases.jsx';
import { CommandForm, Pager, RecordList } from './operations.jsx';
import { PurchaseResource } from './purchase.jsx';
import { State } from './ui.jsx';

const returnRoute = '/administracion/posventa';
const ticketRoute = '/administracion/soporte';
const closed = ['RESOLVED', 'REJECTED'];

export function StaffQueue({ uid, admin, compact = false }) {
  const [offset, setOffset] = useState(0);
  const read = useCallback(async () => (await readStaff(uid, staff.listSupportQueue, { offset })).staffQueueEntries, [uid, offset]);
  const queue = useResource(read);
  const navigate = useNavigate();
  return <section className="surface admin-panel form-stack">
    <h2>Cola de soporte</h2>
    <PurchaseResource resource={queue} label="Consultando cola…">{items => {
      const visible = compact ? items.slice(0, 5) : items;
      return <>
        <RecordList items={visible} empty="Sin casos en la cola." render={item => {
          const ticket = item.kind === 'TICKET';
          const id = canonicalUuid(item.id);
          const to = (ticket ? ticketRoute : returnRoute) + '/' + id;
          return <li key={id}>
            <div><strong>{labelFor(item.kind)}</strong><p>{labelFor(item.status)}</p>
              <p className="muted"><time dateTime={item.createdAt}>{orderDate(item.createdAt)}</time></p></div>
            {admin || item.assigned ? <Link className="text-link" to={to}>Abrir {ticket ? 'ticket' : 'expediente'}</Link>
              : <CommandForm uid={uid} connector={staffDb} command={ticket ? staff.assignTicketRef : staff.assignCaseRef}
                submitLabel={ticket ? 'Tomar ticket' : 'Tomar expediente'} values={() => ({ id })} onSaved={() => navigate(to)} />}
          </li>;
        }} />
        {!compact && <Pager offset={offset} count={items.length} onChange={setOffset} label="Páginas de cola" />}
      </>;
    }}</PurchaseResource>
    {compact && <Link className="text-link" to="/administracion/cola">Ver cola completa</Link>}
  </section>;
}

function AssignOperator({ uid, id, assigned, command, onSaved }) {
  const read = useCallback(() => collectPages(async offset => (await readStaff(uid, staff.listStaffOperators, { offset })).staffOperators), [uid]);
  const resource = useResource(read);
  return <PurchaseResource resource={resource} label="Consultando personal…">{operators =>
    <CommandForm uid={uid} connector={staffDb} command={command} title="Asignación" submitLabel="Asignar expediente"
      values={form => ({ id, assignedTo: textValue(form, 'assignedTo') })} onSaved={onSaved}>
      <label>Responsable<select name="assignedTo" defaultValue={operators.some(item => item.uid === assigned) ? assigned : uid} required>
        {operators.map(item => <option key={item.uid} value={item.uid}>
          {item.displayName} · {item.uid === uid ? 'Mi cuenta' : item.uid}
        </option>)}
      </select></label>
    </CommandForm>}
  </PurchaseResource>;
}

export function StaffReturns({ uid, admin, orderId }) {
  const [offset, setOffset] = useState(0);
  const read = useCallback(async () => (await readStaff(uid, staff.listStaffReturnRequests, { offset, orderId }))
    .staffReturnCases.map(row => row.request), [uid, offset, orderId]);
  const resource = useResource(read);
  return <section className="surface form-stack">
    <h2>Cancelaciones, devoluciones y garantías</h2>
    <div className="action-row">
      {orderId && <Link className="text-link" to={'/administracion/pedidos/' + orderId}>Volver al pedido</Link>}
      {orderId && <Link className="text-link" to={returnRoute}>Ver todos los expedientes</Link>}
      {!admin && <Link className="text-link" to="/administracion/cola">Ir a la cola de soporte</Link>}
    </div>
    <PurchaseResource resource={resource} label="Consultando expedientes…">{items => <>
      <ReturnList items={items} route={returnRoute} />
      <Pager count={items.length} offset={offset} onChange={setOffset} label="Páginas de expedientes" />
    </>}</PurchaseResource>
  </section>;
}

function ReviewCase({ uid, id, request, onSaved }) {
  const transitions = {
    SUBMITTED: ['IN_REVIEW'], IN_REVIEW: ['APPROVED', 'NEEDS_INFO', 'REJECTED'], NEEDS_INFO: ['IN_REVIEW'],
    APPROVED: request.kind !== 'CANCELLATION' ? ['AWAITING_ITEM'] : [],
    INSPECTED: ['RESOLVED'],
  };
  const states = transitions[request.status] ?? [];
  const [next, setNext] = useState(states[0]);
  if (!states.length) return null;
  return <CommandForm uid={uid} connector={staffDb} command={staff.reviewReturnRequestRef}
    title="Revisar solicitud" submitLabel="Actualizar expediente" className="review-case" onSaved={onSaved}
    values={form => ({ id, state: next, detail: optionalText(form, 'detail'), resolution: optionalText(form, 'resolution') })}>
    <label>Nuevo estado<select name="state" value={next} onChange={event => setNext(event.target.value)}>
      {states.map(state => <option key={state} value={state}>{labelFor(state)}</option>)}
    </select></label>
    {next === 'RESOLVED' && <label>Resolución<select name="resolution">
      <option value="NO_REFUND">Cierre sin reembolso</option><option value="REPAIR">Reparación</option>
    </select></label>}
    <label>Nota para el comprador<textarea name="detail" rows={3} maxLength={1000}
      required={['NEEDS_INFO', 'REJECTED', 'RESOLVED'].includes(next)} /></label>
  </CommandForm>;
}

function InspectCase({ uid, id, request, admin, onSaved }) {
  const items = request.returnItems_on_request.map(item => ({ ...item, id: canonicalUuid(item.id) }));
  return <CommandForm uid={uid} connector={staffDb} command={staff.recordInspectionRef} title="Inspección de mercancía"
    submitLabel="Registrar inspección" className="inspect-case" onSaved={onSaved} values={form => ({
      id, detail: optionalText(form, 'detail'),
      items: items.map(item => {
        const quantity = Number(form.get('quantity-' + item.id));
        const restock = admin ? Number(form.get('restock-' + item.id)) : 0;
        const condition = textValue(form, 'condition-' + item.id);
        if (restock > quantity || (restock > 0 && condition !== 'SELLABLE')) {
          throw new OperationInputError('El reingreso admite únicamente unidades recibidas en condición vendible.');
        }
        return { id: item.id, quantity, restock, condition };
      }),
    })}>
    {items.map(item => <div className="inspection-line form-stack" key={item.id}>
      <p><strong>{item.orderItem.skuSnapshot}</strong> · {item.approvedQty} autorizadas</p>
      <div className="operation-fields">
        <label>Unidades recibidas<input type="number" name={'quantity-' + item.id}
          min={0} max={item.approvedQty} defaultValue={item.approvedQty} required /></label>
        <label>Condición<select name={'condition-' + item.id} defaultValue="" required>
          <option value="">Selecciona la condición</option>
          {['SELLABLE', 'NON_SELLABLE', 'NOT_RECEIVED'].map(condition => <option key={condition} value={condition}>{labelFor(condition)}</option>)}
        </select></label>
        {admin && <label>Reingreso a existencias<input type="number" name={'restock-' + item.id}
          min={0} max={item.approvedQty} defaultValue={0} required /></label>}
      </div>
    </div>)}
    <label>Nota de inspección<textarea name="detail" rows={3} maxLength={1000} /></label>
  </CommandForm>;
}

function ResolveCase({ uid, id, request, onSaved }) {
  const cancellation = request.kind === 'CANCELLATION';
  const replacement = ['WARRANTY', 'EXCHANGE'].includes(request.kind);
  const [action, setAction] = useState('refund');
  return <CommandForm uid={uid} connector={staffDb}
    command={action === 'replacement' ? staff.resolveReplacementRef : staff.approveRefundRef}
    title={cancellation ? 'Ejecutar cancelación' : 'Resolver expediente'} className="resolve-case" onSaved={onSaved}
    submitLabel={cancellation ? 'Cancelar pedido y simular reembolso' : action === 'replacement' ? 'Registrar reposición' : 'Ejecutar reembolso simulado'}
    values={form => {
      const detail = textValue(form, 'detail');
      return action === 'replacement' ? { id, detail } : { id, detail, shipping: cancellation || form.has('shipping') };
    }}>
    {replacement && <label>Acción<select name="action" value={action} onChange={event => setAction(event.target.value)}>
      <option value="refund">Reembolso simulado</option><option value="replacement">Reposición</option>
    </select></label>}
    {!cancellation && action === 'refund' &&
      <label className="check-field"><input type="checkbox" name="shipping" /> Solicitar devolución del envío elegible</label>}
    <p className="muted">{action === 'replacement' ? 'PostgreSQL comprueba las existencias para la reposición.'
      : 'PostgreSQL calcula el importe elegible. El reembolso es académico.'}</p>
    <label>Motivo de resolución<textarea name="detail" rows={3} maxLength={1000} required /></label>
  </CommandForm>;
}

export function StaffReturnDetail({ uid, id, admin }) {
  const [saved, setSaved] = useState(false);
  const read = useCallback(async () => {
    if (!id) return null;
    const result = await readStaff(uid, staff.getStaffReturnRequest, { id });
    const request = result.staffReturnCases[0]?.request;
    if (!request || !admin) return request;
    const records = await readStaff(uid, staff.getStaffCaseRefunds, { orderId: canonicalUuid(request.orderId), id });
    return { ...request, refunds: records.staffOrders[0]?.order.returnRequests_on_order[0]?.refunds_on_request ?? [] };
  }, [uid, id, admin]);
  const resource = useResource(read);
  const reload = () => { setSaved(true); resource.retry(); };
  const evidence = async evidenceId => (await readStaff(uid, staff.getStaffReturnEvidence,
    { requestId: id, id: evidenceId })).staffReturnCases[0]?.request.returnEvidences_on_request[0];
  return <div className="checkout-steps">
    <Link className="text-link" to={returnRoute}>Volver a expedientes</Link>
    {saved && <p role="status" className="feedback">Expediente actualizado.</p>}
    <PurchaseResource resource={resource} label="Consultando expediente…">{request => request ? <div className="operation-columns">
      <article className="surface form-stack">
        <h2>{request.folio}</h2>
        <p>Pedido {request.order.folio} · {orderStatus(request.order.status)}</p>
        {admin && <Link className="text-link" to={'/administracion/pedidos/' + canonicalUuid(request.orderId)}>Ver pedido</Link>}
        <ReturnDetails value={request} />
        {admin && <RefundDetails refunds={request.refunds} />}
      </article>
      <section className="surface form-stack case-actions">
        <h2>Gestión del expediente</h2>
        <EvidenceList items={request.returnEvidences_on_request} load={evidence} />
        {!closed.includes(request.status) && <>
          {admin && <AssignOperator uid={uid} id={id} assigned={request.assignedToUid} command={staff.assignCaseRef} onSaved={reload} />}
          <ReviewCase uid={uid} id={id} request={request} onSaved={reload} />
          {['AWAITING_ITEM', 'RECEIVED'].includes(request.status) &&
            <InspectCase uid={uid} id={id} request={request} admin={admin} onSaved={reload} />}
          {admin && (request.status === 'INSPECTED' || (request.status === 'APPROVED' && request.kind === 'CANCELLATION')) &&
            <ResolveCase uid={uid} id={id} request={request} onSaved={reload} />}
        </>}
      </section>
    </div> : <State title="Expediente no disponible" />}</PurchaseResource>
  </div>;
}

export function StaffTickets({ uid }) {
  const [offset, setOffset] = useState(0);
  const read = useCallback(async () => (await readStaff(uid, staff.listStaffTickets, { offset })).staffTickets.map(row => row.ticket), [uid, offset]);
  const resource = useResource(read);
  return <section className="surface form-stack">
    <h2>Tickets de atención</h2>
    <Link className="text-link" to="/administracion/cola">Ir a la cola de soporte</Link>
    <PurchaseResource resource={resource} label="Consultando tickets…">{items => <>
      <RecordList items={items} empty="Sin tickets disponibles para esta cuenta." render={item => <li key={item.id}>
        <div><Link className="text-link" to={ticketRoute + '/' + canonicalUuid(item.id)}>{item.subject}</Link>
          <p className="muted">{item.folio} · {item.assignedToUid ? 'Asignado' : 'Sin asignar'}</p></div>
        <span>{labelFor(item.status)}</span>
      </li>} />
      <Pager count={items.length} offset={offset} onChange={setOffset} label="Páginas de tickets" />
    </>}</PurchaseResource>
  </section>;
}

function AnswerTicket({ uid, id, status, reload }) {
  const [action, setAction] = useState('reply');
  return <CommandForm uid={uid} connector={staffDb} command={staff.replyToCustomerRef} title="Seguimiento del ticket"
    submitLabel={action === 'close' ? 'Responder y cerrar' : action === 'note' ? 'Guardar nota' : 'Enviar al cliente'}
    className="staff-reply" onSaved={reload}
    values={form => ({ id, body: textValue(form, 'body'), internal: action === 'note', close: action === 'close' })}>
    <label>Acción<select name="action" value={action} onChange={event => setAction(event.target.value)}>
      <option value="reply">{status === 'RESOLVED' ? 'Reabrir y esperar respuesta' : 'Responder y esperar al cliente'}</option>
      <option value="close">Responder y marcar resuelto</option>
      <option value="note">Agregar nota interna</option>
    </select></label>
    <label>Mensaje<textarea name="body" maxLength={2500} rows={4} required /></label>
  </CommandForm>;
}

export function StaffTicketDetail({ uid, id, admin }) {
  const [offset, setOffset] = useState(0);
  const [saved, setSaved] = useState(false);
  const read = useCallback(async () => id ? (await readStaff(uid, staff.getStaffTicket,
    { id, messageOffset: offset })).staffTickets[0]?.ticket : null, [uid, id, offset]);
  const resource = useResource(read);
  const reload = () => { setSaved(true); setOffset(0); resource.retry(); };
  return <div className="checkout-steps">
    <Link className="text-link" to={ticketRoute}>Volver a tickets</Link>
    {saved && <p role="status" className="feedback">Ticket actualizado.</p>}
    <PurchaseResource resource={resource} label="Consultando ticket…">{ticket => ticket ? <div className="operation-columns">
      <article className="surface form-stack">
        <h2>{ticket.subject}</h2>
        <p>{ticket.folio} · <strong>{labelFor(ticket.status)}</strong></p>
        {ticket.closedAt && <p>Cerrado <time dateTime={ticket.closedAt}>{orderDate(ticket.closedAt)}</time></p>}
        {ticket.orderId && admin && <Link className="text-link" to={'/administracion/pedidos/' + canonicalUuid(ticket.orderId)}>Ver pedido asociado</Link>}
        <TicketMessages uid={uid} staff messages={ticket.supportMessages_on_ticket} />
        <Pager size={messagePageSize} count={ticket.supportMessages_on_ticket.length} offset={offset}
          onChange={setOffset} label="Páginas de conversación" />
      </article>
      <section className="surface form-stack case-actions">
        <h2>Atención al cliente</h2>
        {admin && <AssignOperator uid={uid} id={id} assigned={ticket.assignedToUid} command={staff.assignTicketRef} onSaved={reload} />}
        <AnswerTicket uid={uid} id={id} status={ticket.status} reload={reload} />
      </section>
    </div> : <State title="Ticket no disponible" />}</PurchaseResource>
  </div>;
}
