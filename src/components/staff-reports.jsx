import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminReports, getOperationTotals, listLowStock, listReturnSummary, listSkuSales } from '../lib/staff-api.js';
import { useResource } from '../hooks/useResource.js';
import { canonicalUuid, exactMoney, orderStatus } from '../lib/commerce.js';
import { collectPages, labelFor, orderStates, textValue } from '../lib/operations.js';
import { readStaff } from '../lib/staff.js';
import { Pager, RecordList } from './operations.jsx';
import { PurchaseResource } from './purchase.jsx';

const count = value => BigInt(value ?? 0).toLocaleString('es-MX');
const day = 86400000;
const todayInMatamoros = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Matamoros', year: 'numeric', month: '2-digit', day: '2-digit',
});
const isoDay = millis => new Date(millis).toISOString().slice(0, 10);

export function OverviewTotals({ uid, compact = false }) {
  const read = useCallback(async () => (await readStaff(uid, getOperationTotals)).staffOperationTotals[0], [uid]);
  const totals = useResource(read);
  return <section className="surface form-stack">
    <h2>{compact ? 'Indicadores de operación' : 'Acumulado de la tienda'}</h2>
    <PurchaseResource resource={totals} label="Consultando indicadores…">{value => {
      if (!value) return <p className="muted">Indicadores no disponibles para esta cuenta.</p>;
      const metrics = [
        ['Pedidos registrados', count(value.orderCount)],
        ['Ventas simuladas netas', exactMoney(BigInt(value.grossCents) - BigInt(value.refundedCents))],
        ['Unidades disponibles', count(value.availableUnits)],
        ['Variantes con bajo inventario', count(value.lowStockVariants)],
        ['Cobros simulados brutos', exactMoney(value.grossCents)],
        ['Importe reembolsado', exactMoney(value.refundedCents)],
        ['Reembolsos aprobados', count(value.refundCount)],
        ['Canjes registrados', count(value.couponUses)],
      ];
      return <>
        <dl className="metric-grid">{(compact ? metrics.slice(0, 4) : metrics).map(([label, amount]) =>
          <div key={label}><dt>{label}</dt><dd>{amount}</dd></div>)}</dl>
        {compact ? <Link className="text-link" to="/administracion/reportes">Ver reportes de operación</Link> : <>
          <p className="muted">Las ventas netas descuentan los reembolsos aprobados. Las existencias incluyen las variantes vendibles.</p>
          <div className="operation-columns">
            <section className="form-stack">
              <h3>Pedidos por estado actual</h3>
              <dl className="purchase-totals">{orderStates.map(status =>
                <div key={status}><dt>{orderStatus(status)}</dt><dd>{count(value.ordersByStatus[status])}</dd></div>)}</dl>
            </section>
            <section className="form-stack">
              <h3>Solicitudes por tipo</h3>
              <dl className="purchase-totals">{[
                ['Cancelación', value.cancellationRequests], ['Devolución', value.returnRequests],
                ['Cambio', value.exchangeRequests], ['Garantía', value.warrantyRequests],
              ].map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{count(amount)}</dd></div>)}</dl>
            </section>
          </div>
        </>}
      </>;
    }}</PurchaseResource>
  </section>;
}

export function LowStock({ uid, compact = false }) {
  const [offset, setOffset] = useState(0);
  const read = useCallback(async () => (await readStaff(uid, listLowStock, { offset })).staffStockAlerts, [uid, offset]);
  const alerts = useResource(read);
  return <section className="surface admin-panel form-stack">
    <h2>Alertas de existencias</h2>
    <PurchaseResource resource={alerts} label="Consultando alertas…">{items => <>
      <RecordList items={compact ? items.slice(0, 5) : items} empty="Sin alertas de existencias." render={item =>
        <li key={item.variantId}><Link className="text-link" to={'/administracion/inventario/' + canonicalUuid(item.variantId)}>{item.sku}</Link>
          <span>{item.stockOnHand} uds. · umbral {item.lowStockThreshold}</span></li>} />
      {!compact && <Pager offset={offset} count={items.length} onChange={setOffset} label="Páginas de alertas" />}
    </>}</PurchaseResource>
    {compact && <Link className="text-link" to="/administracion/inventario">Gestionar existencias</Link>}
  </section>;
}

function PeriodReport({ uid }) {
  const today = todayInMatamoros.format(new Date());
  const [period, setPeriod] = useState(() => ({ start: today.slice(0, 8) + '01', end: isoDay(Date.parse(today) + day) }));
  const [error, setError] = useState('');
  const read = useCallback(async () => {
    const [daily, sku, cases] = await Promise.all([
      readStaff(uid, getAdminReports, period).then(result => result.staffDailySales),
      collectPages(async offset => (await readStaff(uid, listSkuSales, { ...period, offset })).staffSkuSales, 100),
      collectPages(async offset => (await readStaff(uid, listReturnSummary, { ...period, offset })).staffReturnSummaries, 100),
    ]);
    const units = new Map();
    for (const row of sku) units.set(row.sku, (units.get(row.sku) ?? 0n) + BigInt(row.grossUnits));
    const ranking = [...units].sort(([first, a], [second, b]) => (a > b ? -1 : a < b ? 1 : first.localeCompare(second)));
    const caseCounts = new Map();
    for (const row of cases) {
      const group = [labelFor(row.kind), labelFor(row.status), labelFor(row.reasonCode)].join(' · ');
      caseCounts.set(group, (caseCounts.get(group) ?? 0n) + BigInt(row.requestCount));
    }
    return { daily, ranking, caseCounts: [...caseCounts].sort() };
  }, [uid, period]);
  const report = useResource(read);
  function selectPeriod(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = textValue(form, 'start');
    const end = Date.parse(textValue(form, 'end')) + day;
    const duration = (end - Date.parse(start)) / day;
    if (!(duration >= 1 && duration <= 366)) {
      setError('Elige un periodo de 1 a 366 días.');
      return;
    }
    setError('');
    setPeriod({ start, end: isoDay(end) });
  }
  return <section className="surface form-stack">
    <h2>Actividad por periodo</h2>
    <p className="muted">Fechas incluidas en hora de Matamoros.</p>
    <form className="operation-fields" onSubmit={selectPeriod}>
      <label>Desde<input type="date" name="start" required defaultValue={period.start} /></label>
      <label>Hasta<input type="date" name="end" required defaultValue={isoDay(Date.parse(period.end) - day)} /></label>
      <button className="button secondary">Consultar periodo</button>
    </form>
    {error && <p className="feedback error" role="alert">{error}</p>}
    <PurchaseResource resource={report} label="Calculando actividad…">{({ daily, ranking, caseCounts }) => <>
      <div className="operation-columns">
        <section className="form-stack">
          <h3>Productos más vendidos por SKU</h3>
          <p className="muted">Primeros 10 por unidades brutas de pedidos sin cancelación. Incluye unidades reembolsadas.</p>
          <RecordList items={ranking.slice(0, 10)} render={([sku, amount]) =>
            <li key={sku}><strong>{sku}</strong><span>{count(amount)} uds.</span></li>} />
        </section>
        <section className="form-stack">
          <h3>Posventa por tipo, estado y motivo</h3>
          <RecordList items={caseCounts} render={([group, amount]) => <li key={group}><span>{group}</span><strong>{count(amount)}</strong></li>} />
        </section>
      </div>
      <section className="form-stack">
        <h3>Ventas simuladas por día</h3>
        <p className="muted">Los cobros y los reembolsos se contabilizan en sus fechas de aprobación.</p>
        <RecordList items={daily} render={row => <li key={row.day}><time dateTime={row.day}>{row.day}</time>
          <span>{count(row.orderCount)} cobros</span><strong>{exactMoney(row.netCents)}</strong></li>} />
      </section>
    </>}</PurchaseResource>
  </section>;
}

export function StaffReports({ uid }) {
  return <div className="checkout-steps"><OverviewTotals uid={uid} /><PeriodReport uid={uid} /></div>;
}
