import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listCouponRedemptions, listStaffCoupons, saveCouponRef } from '../dataconnect-generated/staff/esm/index.esm.js';
import { useResource } from '../hooks/useResource.js';
import { canonicalUuid, exactMoney, orderDate, orderStatus } from '../lib/commerce.js';
import { formNumber, OperationInputError, optionalNumber, parseDecimal, textValue } from '../lib/operations.js';
import { readStaff, staffDb } from '../lib/staff.js';
import { CommandForm, Pager, RecordList } from './operations.jsx';
import { PurchaseResource } from './purchase.jsx';
import { State } from './ui.jsx';

const route = '/administracion/cupones';
const localInput = timestamp => timestamp ? new Date(timestamp).toISOString().slice(0, 19) : '';
const discount = coupon => coupon.kind === 'FIXED' ? exactMoney(coupon.fixedAmountCents) : formNumber(coupon.percentageBps) + '%';

function couponStatus(coupon) {
  if (coupon.archivedAt) return 'Desactivado';
  const now = Date.now();
  if (Date.parse(coupon.startsAt) > now) return 'Programado';
  return Date.parse(coupon.endsAt) <= now ? 'Vencido' : 'Vigente';
}

export function StaffCoupons({ uid }) {
  const [offset, setOffset] = useState(0);
  const read = useCallback(async () => (await readStaff(uid, listStaffCoupons, { offset })).staffCoupons, [uid, offset]);
  const coupons = useResource(read);
  return <section className="surface form-stack">
    <div className="operation-heading">
      <h2>Cupones y promociones</h2><Link className="button primary" to={route + '/nuevo'}>Crear cupón</Link>
    </div>
    <PurchaseResource resource={coupons} label="Consultando cupones…">{items => <>
      <RecordList items={items} render={({ coupon, redemptionCount }) => <li key={coupon.id}>
        <div><Link className="text-link" to={route + '/' + canonicalUuid(coupon.id)}>{coupon.code}</Link>
          <p className="muted">{couponStatus(coupon)} · {redemptionCount} canjes</p></div>
        <strong>{discount(coupon)}</strong>
      </li>} />
      <Pager offset={offset} count={items.length} onChange={setOffset} label="Páginas de cupones" />
    </>}</PurchaseResource>
  </section>;
}

function CouponForm({ uid, coupon, onSaved }) {
  const [kind, setKind] = useState(coupon?.kind ?? 'PERCENTAGE');
  const navigate = useNavigate();
  return <CommandForm uid={uid} connector={staffDb} command={saveCouponRef} className="surface coupon-editor"
    title={coupon ? 'Editar cupón' : 'Nuevo cupón'} submitLabel="Guardar cupón"
    onSaved={id => coupon ? onSaved() : navigate(route + '/' + canonicalUuid(id), { replace: true })}
    values={form => {
      const startsAt = new Date(textValue(form, 'startsAt') + 'Z').toISOString();
      const endsAt = new Date(textValue(form, 'endsAt') + 'Z').toISOString();
      if (endsAt <= startsAt) throw new OperationInputError('El fin de vigencia debe ser posterior al inicio.');
      const amount = parseDecimal(textValue(form, 'amount'));
      const maxUses = optionalNumber(form, 'maxUses');
      const maxPerUser = optionalNumber(form, 'maxPerUser');
      if (maxUses != null && maxPerUser > maxUses) throw new OperationInputError('El límite por cliente supera el límite total.');
      return {
        id: canonicalUuid(coupon?.id) ?? undefined, code: textValue(form, 'code').toUpperCase(), kind,
        fixed: kind === 'FIXED' ? amount : undefined, bps: kind === 'PERCENTAGE' ? Number(amount) : undefined,
        minimum: parseDecimal(textValue(form, 'minimum')), startsAt, endsAt,
        maxUses, maxPerUser, archived: form.has('archived'),
      };
    }}>
    <div className="operation-fields">
      <label>Código<input name="code" pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*"
        maxLength={48} required readOnly={Boolean(coupon)} defaultValue={coupon?.code} /></label>
      <label>Tipo de descuento<select value={kind} onChange={event => setKind(event.target.value)}>
        <option value="PERCENTAGE">Porcentaje</option><option value="FIXED">Importe fijo</option>
      </select></label>
      <label>{kind === 'FIXED' ? 'Descuento (MXN)' : 'Descuento (%)'}
        <input key={kind} type="number" name="amount" min=".01" step=".01"
          max={kind === 'PERCENTAGE' ? 100 : undefined} defaultValue={formNumber(
            kind === 'PERCENTAGE' ? coupon?.percentageBps : coupon?.fixedAmountCents)} required /></label>
      <label>Subtotal mínimo (MXN)<input name="minimum" type="number" min={0} step=".01"
        defaultValue={formNumber(coupon?.minSubtotalCents ?? 0)} required /></label>
      <label>Inicio de vigencia (UTC)<input name="startsAt" type="datetime-local" step="1" defaultValue={localInput(coupon?.startsAt)} required /></label>
      <label>Fin de vigencia (UTC)<input name="endsAt" type="datetime-local" step="1" defaultValue={localInput(coupon?.endsAt)} required /></label>
      <label>Límite total<input name="maxUses" type="number" min={1} max={2147483647} defaultValue={coupon?.totalLimit ?? ''} /></label>
      <label>Límite por cliente<input name="maxPerUser" type="number" min={1} max={2147483647} defaultValue={coupon?.perUserLimit ?? ''} /></label>
    </div>
    {coupon && <label className="check-field"><input type="checkbox" name="archived" defaultChecked={Boolean(coupon.archivedAt)} /> Desactivar promoción</label>}
  </CommandForm>;
}

function CouponRedemptions({ uid, id }) {
  const [offset, setOffset] = useState(0);
  const read = useCallback(async () => {
    const data = await readStaff(uid, listCouponRedemptions, { id, offset });
    return data.staffCoupons[0]?.coupon.couponRedemptions_on_coupon ?? [];
  }, [uid, id, offset]);
  const uses = useResource(read);
  return <section className="surface form-stack">
    <h2>Canjes registrados</h2>
    <PurchaseResource resource={uses} label="Consultando canjes…">{items => <>
      <RecordList items={items} empty="Este cupón todavía no tiene canjes." render={item => <li key={item.orderId}>
        <div><Link className="text-link" to={'/administracion/pedidos/' + canonicalUuid(item.orderId)}>{item.order.folio}</Link>
          <p>{orderStatus(item.order.status)} · <time dateTime={item.createdAt}>{orderDate(item.createdAt)}</time></p></div>
        <strong>{exactMoney(item.order.discountCents)}</strong>
      </li>} />
      <Pager offset={offset} count={items.length} onChange={setOffset} label="Páginas de canjes" />
    </>}</PurchaseResource>
  </section>;
}

export function StaffCoupon({ uid, id }) {
  const [saved, setSaved] = useState(false);
  const read = useCallback(async () => (await readStaff(uid, listStaffCoupons, { id, offset: 0 })).staffCoupons[0], [uid, id]);
  const coupon = useResource(read, Boolean(id && id !== 'nuevo'));
  return <div className="checkout-steps">
    <Link className="text-link" to={route}>Volver a cupones</Link>
    {saved && <p role="status" className="feedback">Cupón guardado.</p>}
    {id === 'nuevo' ? <CouponForm uid={uid} /> : <PurchaseResource resource={coupon} label="Consultando cupón…">{row => row ? <>
      <p>{row.coupon.code} · {couponStatus(row.coupon)} · {row.redemptionCount} canjes</p>
      <div className="operation-columns">
        <CouponForm uid={uid} coupon={row.coupon} onSaved={() => { setSaved(true); coupon.retry(); }} />
        <CouponRedemptions uid={uid} id={id} />
      </div>
    </> : <State title="Cupón no disponible" />}</PurchaseResource>}
  </div>;
}
