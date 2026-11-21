import { useRef, useState } from 'react';
import { saveAddress } from '../dataconnect-generated/account/esm/index.esm.js';
import { commerceMessage, resultId, runCommand } from '../lib/commerce.js';
import { AddressText } from './purchase.jsx';

const fields = [
  ['recipient', 'Persona que recibe', 'shipping name', 120],
  ['phone', 'Teléfono de entrega', 'shipping tel', 25],
  ['line1', 'Calle y número', 'shipping address-line1', 150],
  ['line2', 'Interior o referencia (opcional)', 'shipping address-line2', 150],
  ['district', 'Colonia', 'shipping address-level3', 100],
  ['city', 'Municipio o alcaldía', 'shipping address-level2', 100],
];
const regions = { TAM: 'Tamaulipas', CMX: 'Ciudad de México' };

function AddressForm({ uid, address, first, saved, cancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef(null);
  const submitting = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries([...form].map(([field, value]) => [field, value.trim()]));
    if (fields.some(([field]) => field !== 'line2' && !values[field]) || !values.stateCode || !/^\d{5}$/.test(values.postalCode)) {
      setError('La dirección está incompleta. Revisa los campos obligatorios y el código postal de cinco dígitos.');
      return;
    }
    const payload = {
      ...values, id: address?.id, label: values.label || 'Entrega',
      line2: values.line2 || undefined, primary: form.has('primary'),
    };
    const signature = JSON.stringify(payload);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const id = resultId(await runCommand(uid, saveAddress, { ...payload, key: attempt.current.key }));
      saved(id);
    } catch (failure) {
      setError(failure.code === 'INVALID_DATA' ? 'La dirección está incompleta o contiene datos inválidos.' : commerceMessage(failure));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return <form className="form-stack address-form" onSubmit={submit}>
    <fieldset disabled={busy}>
      <legend>{address ? 'Editar dirección' : 'Nueva dirección'}</legend>
      <div className="address-fields">
        {fields.map(([name, label, autoComplete, maxLength]) => <label key={name}>{label}
          <input name={name} autoComplete={autoComplete} maxLength={maxLength} type={name === 'phone' ? 'tel' : 'text'}
            required={name !== 'line2'} defaultValue={address?.[name] ?? ''} />
        </label>)}
        <label>Estado<select name="stateCode" required autoComplete="shipping address-level1" defaultValue={address?.stateCode ?? ''}>
          <option value="">Selecciona un estado</option>
          {address && !regions[address.stateCode] && <option value={address.stateCode}>{address.stateCode}</option>}
          {Object.entries(regions).map(([code, name]) => <option value={code} key={code}>{name}</option>)}
        </select></label>
        <label>Código postal<input name="postalCode" inputMode="numeric" autoComplete="shipping postal-code" maxLength={5}
          pattern="[0-9]{5}" required defaultValue={address?.postalCode ?? ''} /></label>
        <label>Nombre para esta dirección (opcional)<input name="label" maxLength={48} defaultValue={address?.label ?? ''} /></label>
      </div>
      <label className="check-field"><input type="checkbox" name="primary" defaultChecked={address?.isDefault ?? first} /> Usar como dirección predeterminada</label>
      <div className="action-row">
        <button className="button primary">{busy ? 'Guardando…' : 'Guardar dirección'}</button>
        {!first && <button type="button" className="button secondary" onClick={cancel}>Cancelar edición</button>}
      </div>
    </fieldset>
    {error && <p role="alert" className="feedback error">{error}</p>}
  </form>;
}

export function Delivery({ uid, addresses, address, select, editor, edit, saved, disabled }) {
  const editing = editor !== null || !addresses.length;
  const existing = addresses.find(item => item.id === editor);
  return <section className="surface form-stack" aria-labelledby="delivery-title">
    <div><h2 id="delivery-title">Dirección de entrega</h2>
      <p className="muted">Usa datos ficticios. La entrega simulada cubre Tamaulipas y Ciudad de México.</p></div>
    {addresses.length > 0 && <>
      <label>Dirección guardada<select value={address?.id ?? ''} disabled={disabled || editing} onChange={event => select(event.target.value)}>
        {addresses.map(item => <option key={item.id} value={item.id}>{item.label} · {item.line1}</option>)}
      </select></label>
      {address && <AddressText address={address} />}
      {!editing && <div className="action-row">
        <button className="button secondary" disabled={disabled} onClick={() => edit('new')}>Agregar dirección</button>
        <button className="button secondary" disabled={disabled || !address} onClick={() => edit(address.id)}>Editar dirección</button>
      </div>}
    </>}
    {editing && <AddressForm key={editor ?? 'first'} uid={uid} address={existing} first={!addresses.length}
      saved={saved} cancel={() => edit(null)} />}
  </section>;
}
