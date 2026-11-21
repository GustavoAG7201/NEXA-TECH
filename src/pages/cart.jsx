import { useCallback, useEffect, useRef } from 'react';
import { ShoppingBag, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CatalogLink, PageHeading, ProductImage, Quantity, Resource, State } from '../components/ui.jsx';
import { useBasket } from '../context/basket.js';
import { useResource } from '../hooks/useResource.js';
import { loadProducts, money } from '../lib/catalog.js';
import { CommerceError, commerceMessage } from '../lib/commerce.js';

function ResolvedLines({ cart, children }) {
  const slugs = [...new Set(cart.map(line => line.slug))].sort().join(',');
  const load = useCallback(() => loadProducts(slugs.split(',')), [slugs]);
  const products = useResource(load, cart.length > 0);
  if (!cart.length) return children([]);
  return <Resource value={products} label="Revisando precios y existencias…">{items => {
    const bySlug = new Map(items.filter(Boolean).map(product => [product.slug, product]));
    return children(cart.map(line => {
      const product = bySlug.get(line.slug);
      const variant = product?.variants.find(item => item.sku === line.sku);
      return { ...line, product, variant, available: Boolean(variant && variant.stockOnHand >= line.quantity) };
    }));
  }}</Resource>;
}

export function CartContents({ children }) {
  const { cart, cartRecord, pending, feedback } = useBasket();
  if (pending) return <p role="status">Consultando tu carrito…</p>;
  if (feedback && cartRecord === undefined) return null;
  return <ResolvedLines key={cartRecord?.id + ':' + cartRecord?.revision} cart={cart}>{children}</ResolvedLines>;
}

export function CartFeedback({ close, compact = false }) {
  const { busy, feedback, mergeError, guestLines, guestLocked, guestBlocked, retry, dismiss, retryMerge, editGuest } = useBasket();
  return <>
    {guestBlocked && <p className="feedback" role="status">Hay una sincronización pendiente. Inicia sesión con la misma cuenta para retomarla.</p>}
    {feedback && <div className="feedback error">
      <p role="alert">{commerceMessage(feedback)}</p>
      <div className="action-row">
        {feedback instanceof CommerceError
          ? <button className="button secondary" onClick={dismiss}>Volver al carrito</button>
          : <button className="button secondary" onClick={retry} disabled={busy}>Reintentar carrito</button>}
      </div>
    </div>}
    {mergeError && <section className="surface form-stack" aria-label="Selección pendiente">
      <p role="alert">Tu selección de visitante sigue guardada. {commerceMessage(mergeError)}</p>
      {compact ? <Link className="text-link" to="/carrito" onClick={close}>Revisar selección y cantidades</Link> : <>
        {!guestLocked && <ResolvedLines cart={guestLines}>{lines => <ul className="cart-lines">
          {lines.map(line => <CartLine key={line.id} line={line} disabled={busy}
            change={(_, quantity) => editGuest(line, quantity)} remove={() => editGuest(line, 0)} />)}
        </ul>}</ResolvedLines>}
        <button className="button secondary" onClick={retryMerge} disabled={busy}>Sincronizar selección</button>
      </>}
    </section>}
  </>;
}

export function CartSubtotal({ lines }) {
  const total = lines.reduce((sum, line) => sum + (line.available ? line.quantity * Number(line.variant.unitPriceCents) : 0), 0);
  return <div className="total-row"><span>Subtotal estimado</span><strong>{money(total)} MXN</strong></div>;
}

function CartLine({ line, change, remove, disabled }) {
  const { id, slug, sku, quantity, product, variant, available } = line;
  const name = product?.name ?? 'Producto retirado';
  const stock = Math.min(variant?.stockOnHand ?? 0, 100);
  return <li className="cart-line">
    <div className="cart-photo"><ProductImage image={product?.images[0]} /></div>
    <div className="cart-line-copy">
      <div className="cart-line-top">
        <div><h2>{product ? <Link to={'/producto/' + slug}>{name}</Link> : name}</h2>
          <p className="muted">{variant?.optionLabel ?? sku}</p></div>
        <button className="icon-button" disabled={disabled} aria-label={'Quitar ' + name} onClick={() => remove(id)}><Trash2 aria-hidden="true" /></button>
      </div>
      {!available && <p role="status" className="stock out-of-stock">{stock ? 'Solo quedan ' + stock + ' unidades' : 'Variante sin disponibilidad'}</p>}
      <div className="cart-line-bottom">
        {stock > 0
          ? <Quantity value={quantity} max={stock} disabled={disabled} onChange={value => change(id, Math.min(value, stock))} />
          : <span>Cantidad {quantity}</span>}
        {available && <strong>{money(Number(variant.unitPriceCents) * quantity)}</strong>}
      </div>
    </div>
  </li>;
}

function CartPanel({ lines, close }) {
  const { change, remove, locked, mergeError } = useBasket();
  if (!lines.length) return <State title="Tu carrito está vacío" action={close
    ? <Link className="button primary" to="/productos" onClick={close}>Explorar catálogo</Link> : <CatalogLink />}>
    Agrega una variante disponible desde el catálogo.
  </State>;
  const valid = lines.every(line => line.available);
  return <div className="cart-layout">
    <ul className="cart-lines">{lines.map(line => <CartLine key={line.id} line={line} change={change} remove={remove} disabled={locked} />)}</ul>
    <aside className="surface summary">
      <h2>Resumen</h2>
      <CartSubtotal lines={lines} />
      <p className="muted">Precios simulados. Envío e impuestos se calcularán al cotizar.</p>
      {valid && !mergeError && !locked && <Link className="button primary" to="/checkout" onClick={close}>Ver resumen de compra</Link>}
      {!valid && <p role="status" className="feedback error">Ajusta las cantidades o quita los productos sin existencia.</p>}
      {close && <Link className="text-link" to="/carrito" onClick={close}>Ver carrito completo</Link>}
    </aside>
  </div>;
}

export function Cart() {
  const { signedIn } = useBasket();
  return <div className="wrap page">
    <PageHeading title="Carrito de compra">{signedIn ? 'Tu carrito se guarda en tu cuenta.' : 'Tu selección se guarda en este navegador.'}</PageHeading>
    <div className="checkout-steps">
      <CartFeedback />
      <CartContents>{lines => <CartPanel lines={lines} />}</CartContents>
    </div>
  </div>;
}

export function CartDrawer() {
  const { drawer, setDrawer } = useBasket();
  const dialog = useRef(null);
  const trigger = useRef(null);
  const close = () => setDrawer(false);
  useEffect(() => {
    const element = dialog.current;
    if (drawer && !element.open) {
      trigger.current = document.activeElement;
      element.showModal();
    }
    if (!drawer && element.open) {
      const wasFocusedInside = element.contains(document.activeElement);
      element.close();
      if (wasFocusedInside && trigger.current instanceof HTMLElement) trigger.current.focus();
    }
  }, [drawer]);
  return <dialog className="cart-drawer" ref={dialog} aria-labelledby="drawer-title"
    onCancel={event => { event.preventDefault(); close(); }}>
    <div className="drawer-title">
      <ShoppingBag aria-hidden="true" /><h2 id="drawer-title">Tu carrito</h2>
      <button className="icon-button" aria-label="Cerrar carrito" onClick={close}><X aria-hidden="true" /></button>
    </div>
    {drawer && <div className="checkout-steps">
      <CartFeedback compact close={close} />
      <CartContents>{lines => <CartPanel lines={lines} close={close} />}</CartContents>
    </div>}
  </dialog>;
}
