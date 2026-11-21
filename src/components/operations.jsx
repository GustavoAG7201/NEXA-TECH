import { useRef, useState } from 'react';
import { commerceMessage, orderDate } from '../lib/commerce.js';
import { executeOperation, labelFor, OperationInputError, pageSize } from '../lib/operations.js';

export function CommandForm({ uid, command, values, onSaved, submitLabel, title, children, className = '' }) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const submitting = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    submitting.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const variables = await values(form);
      const id = await executeOperation(uid, command, variables);
      setFeedback({ message: 'Guardado en NexaTech.' });
      onSaved?.(id);
    } catch (error) {
      setFeedback({
        error: true,
        message: error instanceof OperationInputError ? error.message : commerceMessage(error),
      });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return <form className={'form-stack ' + className} onSubmit={submit}>
    <fieldset disabled={busy}>
      {title && <legend>{title}</legend>}
      {children}
      <button className="button primary">{busy ? 'Guardando…' : submitLabel}</button>
    </fieldset>
    {feedback && <p className={'feedback' + (feedback.error ? ' error' : '')}
      role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
  </form>;
}

export function Pager({ offset, count, onChange, size = pageSize, label = 'Páginas de resultados' }) {
  if (!offset && count < size) return null;
  return <nav className="pagination" aria-label={label}>
    {offset > 0 && <button type="button" className="button secondary" onClick={() => onChange(offset - size)}>Anterior</button>}
    <span>Página {offset / size + 1}</span>
    {count === size && <button type="button" className="button secondary" onClick={() => onChange(offset + size)}>Siguiente</button>}
  </nav>;
}

export function RecordList({ items, render, empty = 'Sin resultados.' }) {
  return items.length ? <ul className="purchase-lines operation-list">{items.map(render)}</ul> : <p className="muted">{empty}</p>;
}

export function HistoryEvents({ events, title = 'Historial', statusLabel = labelFor }) {
  if (!events?.length) return null;
  return <section className="form-stack">
    <h3>{title}</h3>
    <ol className="purchase-lines operation-list">{events.map(({ state, detail, time }, index) =>
      <li key={index}><div><strong>{statusLabel(state)}</strong>{detail && <p className="preserve-lines">{detail}</p>}</div>
        <time className="muted" dateTime={time}>{orderDate(time)}</time></li>)}</ol>
  </section>;
}

