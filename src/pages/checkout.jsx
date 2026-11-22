import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, PackageCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Delivery } from '../components/delivery.jsx';
import { PolicyContact } from '../components/legal-contact.jsx';
import { AddressText, Amounts, PurchaseResource } from '../components/purchase.jsx';
import { CatalogLink, PageHeading, ProductImage, State } from '../components/ui.jsx';
import { useAuthSession } from '../context/auth-session.js';
import { useBasket } from '../context/basket.js';
import { confirmCheckout, quoteCheckout } from '../lib/account-api.js';
import { useResource } from '../hooks/useResource.js';
import { loadPolicies, money } from '../lib/catalog.js';
import { canonicalUuid, checkSession, CommerceError, commerceMessage, exactMoney, loadAddresses, loadQuote, orderDate, resultId, runCommand } from '../lib/commerce.js';
import { storeId } from '../lib/api.js';
import { policyPath } from '../lib/policies.js';
import { CartContents, CartFeedback, CartSubtotal } from './cart.jsx';

const expires = quote => Date.parse(quote.expiresAt) <= Date.now();
const attemptKey = uid => 'nexa-checkout:' + storeId + ':' + uid;

function readAttempt(uid) {
  try { return JSON.parse(localStorage.getItem(attemptKey(uid))); } catch { return null; }
}

function QuotedOrder({ quote, terms, disabled, confirm }) {
  const [accepted, setAccepted] = useState(false);
  const [expired, setExpired] = useState(() => expires(quote));
  useEffect(() => {
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, Date.parse(quote.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [quote.expiresAt]);
  const { summary } = quote;
  const { recipient, phone, line1, line2, district, city, state_code: stateCode, postal_code: postalCode } = summary.address;
  return <section className="surface form-stack" aria-labelledby="quote-title">
    <div><h2 id="quote-title">Cotización del pedido</h2>
      <p className="muted">Paquetería · {summary.etaMinDays}–{summary.etaMaxDays} días de referencia</p>
      <p className="muted">Vigente hasta {orderDate(quote.expiresAt)} (hora de Matamoros).</p>
    </div>
    <AddressText address={{ recipient, phone, line1, line2, district, city, stateCode, postalCode }} />
    <ul className="purchase-lines">{summary.lines.map(line => <li key={line.variantId}>
      <div><strong>{line.name}</strong><p className="muted">{line.option} · {line.sku}</p></div>
      <span>{line.quantity} × {exactMoney(line.priceCents)}</span>
    </li>)}</ul>
    {summary.couponCode && <p>Cupón aplicado <strong>{summary.couponCode}</strong></p>}
    <Amounts data={summary} />
    {expired && <p className="feedback error" role="alert">La cotización venció. Solicita una nueva.</p>}
    <form className="form-stack" onSubmit={event => {
      event.preventDefault();
      if (accepted && !disabled) confirm(quote, terms);
    }}>
      <fieldset disabled={disabled || expired}>
        <legend>Modalidad de pedido</legend>
        <p>Registro de pedido. No se realizan cargos reales.</p>
        <details className="checkout-terms">
          <summary>{terms.title}</summary>
          <p className="policy-body">{terms.body}</p>
          <PolicyContact kind="TERMS" />
        </details>
        <label className="check-field"><input type="checkbox" required checked={accepted}
          onChange={event => setAccepted(event.target.checked)} /> Acepto los términos y condiciones.</label>
        <nav className="action-row" aria-label="Políticas del pedido">
          <Link className="text-link" to={policyPath('PRIVACY')} target="_blank" rel="noopener">Aviso de privacidad</Link>
          <Link className="text-link" to={policyPath('SHIPPING')} target="_blank" rel="noopener">Política de envíos</Link>
          <Link className="text-link" to={policyPath('CANCELLATION')} target="_blank" rel="noopener">Cancelaciones</Link>
          <Link className="text-link" to={policyPath('RETURN')} target="_blank" rel="noopener">Devoluciones</Link>
          <Link className="text-link" to={policyPath('WARRANTY')} target="_blank" rel="noopener">Garantías</Link>
        </nav>
        <button className="button primary" disabled={!accepted}>Confirmar pedido</button>
      </fieldset>
    </form>
  </section>;
}

function CheckoutSession({ uid }) {
  const basket = useBasket();
  const navigate = useNavigate();
  const [selected, setSelected] = useState('');
  const [editor, setEditor] = useState(null);
  const [coupon, setCoupon] = useState('');
  const [quoted, setQuoted] = useState(null);
  const [attempt, setAttempt] = useState(() => readAttempt(uid));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const readAddresses = useCallback(() => loadAddresses(uid), [uid]);
  const addresses = useResource(readAddresses);
  const cart = basket.cartRecord;

  async function act(task) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (failure) {
      setError(commerceMessage(failure));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function requestQuote(event, address) {
    event.preventDefault();
    if (!cart || !address || basket.locked || basket.mergeError) return;
    const couponCode = new FormData(event.currentTarget).get('coupon').trim();
    setCoupon(couponCode);
    setQuoted(null);
    return act(async () => {
      const key = crypto.randomUUID();
      const quoteId = resultId(await runCommand(uid, quoteCheckout, {
        key, cartId: cart.id, addressId: address.id, deliveryMethod: 'DEMO_PARCEL', couponCode: couponCode || undefined,
      }));
      const [quote, policies] = await Promise.all([loadQuote(uid, quoteId), loadPolicies()]);
      if (!quote || expires(quote)) throw new CommerceError(quote ? 'QUOTE_EXPIRED' : 'QUOTE_UNAVAILABLE');
      const termsId = canonicalUuid(quote.summary.documents.TERMS);
      const terms = termsId && policies.find(item => item.kind === 'TERMS' && canonicalUuid(item.id) === termsId);
      if (!terms) throw new CommerceError('POLICY_UNAVAILABLE');
      setQuoted({ quote, terms });
    });
  }

  function confirm(quote, terms) {
    return act(async () => {
      checkSession(uid);
      const purchase = async () => {
        let current = readAttempt(uid);
        if (!current) {
          if (!quote || !terms) throw new CommerceError('QUOTE_UNAVAILABLE');
          if (expires(quote)) {
            setQuoted(null);
            throw new CommerceError('QUOTE_EXPIRED');
          }
          current = { key: quote.id, quoteId: quote.id, termsId: terms.id, accepted: true, scenario: 'APPROVE' };
          localStorage.setItem(attemptKey(uid), JSON.stringify(current));
        }
        setAttempt(current);
        const result = await runCommand(uid, confirmCheckout, current);
        if (result.status === 'REJECTED') {
          localStorage.removeItem(attemptKey(uid));
          setAttempt(null);
          setQuoted(null);
          throw new CommerceError(result.resultCode);
        }
        const id = resultId(result, 'ORDER_CONFIRMED');
        localStorage.removeItem(attemptKey(uid));
        setAttempt(null);
        basket.refresh().catch(() => {});
        navigate('/pedidos/' + canonicalUuid(id) + '/confirmacion', { replace: true });
      };
      if (navigator.locks) await navigator.locks.request(attemptKey(uid), purchase);
      else await purchase();
    });
  }

  if (attempt) return <section className="surface form-stack" aria-labelledby="purchase-progress">
    <h2 id="purchase-progress">Confirmación del pedido</h2>
    {busy ? <p role="status">Verificando el resultado de la compra…</p>
      : <p>La confirmación está pendiente. Reintenta para consultar el resultado del mismo pedido.</p>}
    {error && <p role="alert" className="feedback error">{error}</p>}
    <button type="button" className="button primary" disabled={busy} onClick={() => confirm()}>Reintentar confirmación</button>
    <Link className="text-link" to="/pedidos">Ver historial de pedidos</Link>
  </section>;

  return <>
    <CartFeedback compact />
    <CartContents>{lines => {
      if (!lines.length) return <State title="Tu carrito está vacío" action={<CatalogLink />} />;
      if (lines.some(line => !line.available) || basket.mergeError) return <>
        {error && <p role="alert" className="feedback error">{error}</p>}
        <State title="Revisa tu carrito" action={<Link className="button primary" to="/carrito">Ir al carrito</Link>}>
          Verifica la selección y las existencias antes de cotizar.
        </State>
      </>;
      return <div className="checkout-grid">
        <div className="checkout-steps">
          <PurchaseResource resource={addresses} label="Consultando direcciones…">{items => {
            const address = items.find(item => item.id === selected) ?? items.find(item => item.isDefault) ?? items[0];
            const validQuote = quoted && quoted.quote.cartId === cart?.id && quoted.quote.addressId === address?.id &&
              String(quoted.quote.cartRevision) === String(cart?.revision) ? quoted : null;
            return <>
              <Delivery uid={uid} addresses={items} address={address} editor={editor} disabled={busy}
                select={id => { setSelected(id); setQuoted(null); setError(''); }}
                edit={value => { setEditor(value); setQuoted(null); setError(''); }}
                saved={id => { setSelected(id); setEditor(null); setQuoted(null); addresses.retry(); }} />
              {address && editor === null && <>
                <form className="surface form-stack" onSubmit={event => requestQuote(event, address)}>
                  <h2>Envío y cupón</h2>
                  <p>Cotización disponible para Tamaulipas y Ciudad de México.</p>
                  <fieldset disabled={busy || basket.locked}>
                    <label>Cupón (opcional)<input name="coupon" maxLength={48} value={coupon} onChange={event => {
                      setCoupon(event.target.value);
                      setQuoted(null);
                    }} /></label>
                    <button className="button primary">{busy ? 'Consultando…' : validQuote ? 'Actualizar cotización' : 'Cotizar pedido'}</button>
                  </fieldset>
                  {error && <p role="alert" className="feedback error">{error}</p>}
                </form>
                {validQuote && <QuotedOrder key={validQuote.quote.id} {...validQuote} disabled={busy || basket.locked} confirm={confirm} />}
              </>}
            </>;
          }}</PurchaseResource>
        </div>
        <CartSummary lines={lines} />
      </div>;
    }}</CartContents>
  </>;
}

function CartSummary({ lines }) {
  return <aside className="surface summary">
    <h2>Tu selección</h2>
    <ul className="checkout-lines">{lines.map(line => <li key={line.id}>
      <div className="cart-photo"><ProductImage image={line.product.images[0]} /></div>
      <div><strong>{line.product.name}</strong><p className="muted">{line.variant.optionLabel} · Cantidad {line.quantity}</p></div>
      <span>{money(Number(line.variant.unitPriceCents) * line.quantity)}</span>
    </li>)}</ul>
    <CartSubtotal lines={lines} />
    <p className="muted">El importe definitivo se muestra en la cotización.</p>
  </aside>;
}

export function Checkout() {
  const { user, pending, error } = useAuthSession();
  return <div className="wrap page checkout-steps">
    <div><Link className="back-link" to="/carrito"><ChevronLeft aria-hidden="true" /> Volver al carrito</Link>
      <PageHeading title="Resumen de compra" /></div>
    {pending ? <p role="status">Comprobando sesión…</p> : error ? <p role="alert">{commerceMessage(error)}</p> :
      user ? <CheckoutSession key={user.uid} uid={user.uid} /> :
        <CartContents>{lines => lines.length ? <div className="checkout-grid">
          <section className="surface checkout-step"><PackageCheck aria-hidden="true" /><div>
            <h2>Cuenta y entrega</h2><p>Inicia sesión para guardar tu selección y cotizar el envío.</p>
            <Link className="button primary" to="/login?continuar=checkout">Iniciar sesión</Link>
          </div></section>
          {lines.every(line => line.available) && <CartSummary lines={lines} />}
        </div> : <State title="Tu carrito está vacío" action={<CatalogLink />} />}</CartContents>}
  </div>;
}
