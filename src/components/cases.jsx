import { useState } from 'react';
import { Link } from 'react-router-dom';
import { canonicalUuid, commerceMessage, exactMoney, orderDate } from '../lib/commerce.js';
import { labelFor } from '../lib/operations.js';
import { HistoryEvents, RecordList } from './operations.jsx';

export function ReturnList({ items, route }) {
  return <RecordList items={items} empty="Aún no hay solicitudes." render={item => <li key={item.id}>
    <div><Link className="text-link" to={route + '/' + canonicalUuid(item.id)}>{item.folio}</Link>
      <p className="muted">{labelFor(item.kind)}{item.order && ' · ' + item.order.folio}</p></div>
    <span>{labelFor(item.status)}</span>
  </li>} />;
}

export function ReturnDetails({ value }) {
  return <>
    <p>{labelFor(value.kind)} · <strong>{labelFor(value.status)}</strong></p>
    <p><strong>Motivo</strong> {labelFor(value.reasonCode)}</p>
    <p className="preserve-lines">{value.description}</p>
    <section className="form-stack">
      <h3>Partidas del expediente</h3>
      <RecordList items={value.returnItems_on_request} render={item => <li key={item.id}>
        <div><strong>{item.orderItem.nameSnapshot}</strong><p>{item.orderItem.skuSnapshot}</p>
          {item.conditionCode && <p>{labelFor(item.conditionCode)}</p>}
          {item.inspectionNote && <p className="preserve-lines">{item.inspectionNote}</p>}</div>
        <dl className="line-quantities">
          <div><dt>Solicitadas</dt><dd>{item.requestedQty}</dd></div>
          {item.approvedQty != null && <div><dt>Autorizadas</dt><dd>{item.approvedQty}</dd></div>}
          <div><dt>Recibidas</dt><dd>{item.receivedQty}</dd></div>
          <div><dt>Reingreso a stock</dt><dd>{item.restockedQty}</dd></div>
        </dl>
      </li>} />
    </section>
    {value.resolutionCode && <section className="form-stack">
      <h3>Resolución · {labelFor(value.resolutionCode)}</h3>
      {value.resolutionNote && <p className="preserve-lines">{value.resolutionNote}</p>}
    </section>}
    <HistoryEvents title="Historial de resolución" events={value.returnEvents_on_request.map(event => ({
      state: event.newStatus, detail: event.publicDetail, time: event.createdAt,
    }))} />
  </>;
}

export function RefundDetails({ refunds }) {
  if (!refunds.length) return null;
  return <section className="form-stack">
    <h3>Reembolsos registrados</h3>
    <p className="muted">Estos importes se muestran como referencia.</p>
    <RecordList items={refunds} render={refund => <li key={refund.id}>
      <div><strong>{exactMoney(refund.amountCents)}</strong><p>Parte del envío {exactMoney(refund.shippingRefundCents)}</p></div>
      <time dateTime={refund.decidedAt}>{orderDate(refund.decidedAt)}</time>
    </li>} />
  </section>;
}

function EvidenceFile({ item, load }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    setBusy(true);
    setError('');
    try {
      const evidence = await load(canonicalUuid(item.id));
      if (!evidence?.contentB64) {
        setError('El archivo ya no está disponible para esta cuenta.');
        return;
      }
      const bytes = Uint8Array.from(atob(evidence.contentB64), byte => byte.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: evidence.mediaType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Evidencia-' + canonicalUuid(item.id) + (evidence.mediaType === 'image/png' ? '.png' : '.jpg');
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(commerceMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return <li>
    <div><p>{item.mediaType === 'image/png' ? 'PNG' : 'JPEG'} · {Math.ceil(item.sizeBytes / 1024)} KiB</p>
      {error && <p role="alert" className="feedback error">{error}</p>}</div>
    <button type="button" className="button secondary" onClick={download} disabled={busy}>{busy ? 'Consultando…' : 'Descargar evidencia'}</button>
  </li>;
}

export function EvidenceList({ items, load }) {
  return <section className="form-stack">
    <h3>Evidencia adjunta</h3>
    <RecordList items={items} empty="Aún no hay archivos adjuntos." render={item => <EvidenceFile key={item.id} item={item} load={load} />} />
  </section>;
}

export function TicketMessages({ uid, messages, staff = false }) {
  return <section className="form-stack">
    <h3>Conversación · más recientes primero</h3>
    <RecordList items={messages} empty="Aún no hay mensajes." render={message => {
      const author = message.authorUid === uid ? 'Tú' : staff ? 'Participante' : 'Equipo de soporte';
      return <li key={message.id} className="ticket-message">
        <p><strong>{author}</strong>{message.visibility === 'STAFF_ONLY' && ' · Nota interna'} · <time dateTime={message.createdAt}>
          {orderDate(message.createdAt)}</time></p>
        <p className="preserve-lines">{message.body}</p>
      </li>;
    }} />
  </section>;
}
