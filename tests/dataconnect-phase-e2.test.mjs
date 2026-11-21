import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import { applyActionCode, connectAuthEmulator, createUserWithEmailAndPassword, getAuth, sendEmailVerification } from 'firebase/auth';
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import * as account from '../src/dataconnect-generated/account/esm/index.esm.js';
import * as staff from '../src/dataconnect-generated/staff/esm/index.esm.js';
import { applyLocalSql } from '../scripts/local-dataconnect.mjs';
import { authPort, connectPort, connectStoreDatabase, localProject, localWork, startStorefront } from '../scripts/local-store.mjs';
import { openBrowser, until } from './helpers/local-browser.mjs';

const browsers = [
  ['Chrome', process.env.NEXATECH_TEST_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
  ['Edge', process.env.NEXATECH_TEST_EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
];
const authOrigin = 'http://127.0.0.1:' + authPort;
const password = 'nexatech-e2-' + randomUUID();
const apps = [];
const server = { fetchPolicy: 'SERVER_ONLY' };
let db;
let vite;
let origin;

before(async () => {
  db = await connectStoreDatabase();
  await applyLocalSql(db, { catalog: true });
  vite = await startStorefront(0);
  origin = 'http://127.0.0.1:' + vite.httpServer.address().port;
});
after(async () => {
  await Promise.all(apps.map(deleteApp));
  await vite?.close();
  await db?.end();
});
const sql = async (query, variables) => (await db.query(query, variables)).rows;
const one = async (query, variables) => (await sql(query, variables))[0];

async function identity(name, role) {
  const app = initializeApp({ projectId: localProject, apiKey: 'demo-key' }, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, authOrigin, { disableWarnings: true });
  const connectors = Object.fromEntries(Object.entries({ account, staff }).map(([key, sdk]) => {
    const connector = getDataConnect(app, sdk.connectorConfig);
    connectDataConnectEmulator(connector, '127.0.0.1', connectPort);
    return [key, connector];
  }));
  const email = name + '@nexatech.test';
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await account.ensureProfile(connectors.account, { displayName: 'Cliente de prueba' });
  await sendEmailVerification(user);
  const { oobCodes } = await fetch(authOrigin + '/emulator/v1/projects/' + localProject + '/oobCodes').then(r => r.json());
  await applyActionCode(auth, oobCodes.find(code => code.email === email).oobCode);
  await user.reload();
  await user.getIdToken(true);
  if (role) await sql('INSERT INTO public.user_role(user_uid, role_code) VALUES ($1, $2)', [user.uid, role]);
  return { ...connectors, uid: user.uid, email };
}

async function command(actor, connector, operation, input) {
  const key = randomUUID();
  await operation(connector, { key, ...input });
  const result = (await account.getMyCommandResult(actor.account, { key }, server)).data.commerceCommands[0];
  assert.equal(result.status, 'SUCCEEDED', result.resultCode);
  return result.resultId;
}

async function fill(browser, selector, fields) {
  await until(() => browser.evaluate(query => {
    const form = document.querySelector(query);
    return form && !form.querySelector('fieldset:disabled');
  }, selector), 'form ready ' + selector);
  await browser.evaluate(({ selector, fields }) => {
    const form = document.querySelector(selector);
    for (const [field, value] of Object.entries(fields)) {
      const input = form.elements[field];
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
    }
    form.requestSubmit();
  }, { selector, fields });
}

async function signIn(browser, identity, from = '/login') {
  await browser.go(origin + from);
  await browser.waitText('main h1', 'Inicia sesión');
  await fill(browser, 'main form', { email: identity.email, password });
}
async function signOut(browser) {
  await browser.go(origin + '/perfil');
  await browser.waitText('.session-panel', 'Cerrar sesión');
  await browser.evaluate(() => [...document.querySelectorAll('.session-panel button')]
    .find(button => button.textContent.includes('Cerrar sesión')).click());
  await browser.waitText('main h1', 'Inicia sesión');
}

async function accessible(browser, selectors) {
  for (const width of [360, 768, 1440]) {
    await browser.viewport(width, 900);
    assert.ok(await browser.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow at ' + width);
  }
  const samples = await browser.evaluate(selectors => {
    const luminance = rgb => rgb.match(/\d+/g).slice(0, 3).map(channel => {
      const value = Number(channel) / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    }).reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);
    return selectors.map(selector => {
      const element = document.querySelector(selector);
      let node = element;
      while (getComputedStyle(node).backgroundColor === 'rgba(0, 0, 0, 0)') node = node.parentElement;
      const foreground = luminance(getComputedStyle(element).color);
      const background = luminance(getComputedStyle(node).backgroundColor);
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    });
  }, selectors);
  assert.ok(samples.every(contrast => contrast >= 4.5), JSON.stringify(samples));
}

const confirmButton = '.checkout-steps section form button.primary';
const receiptButton = '.summary button.primary';
const accept = browser => browser.click('section form input[type="checkbox"]');
const quote = async (browser, coupon = '') => {
  await fill(browser, 'form:has(input[name="coupon"])', { coupon });
  await until(async () => {
    const alert = await browser.text('main [role="alert"]');
    assert.ok(!alert, alert);
    return (await browser.text('#quote-title')) === 'Cotización del pedido';
  }, 'cotización visible');
};
const cartQuantity = uid => one(`SELECT ci.quantity FROM public.cart_item ci JOIN public.cart c ON c.id=ci.cart_id
  WHERE c.user_uid=$1 AND c.status='ACTIVE'`, [uid]);
const totals = ['subtotal', 'discount', 'items_tax', 'shipping', 'shipping_tax', 'total'];
const pesos = (value, negative = false) =>
  (negative && Number(value) ? '-' : '') + new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', currencyDisplay: 'narrowSymbol',
  }).format(Number(value) / 100) + ' MXN';

async function download(browser, dir, folio) {
  await mkdir(dir);
  await browser.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
  await browser.click(receiptButton);
  await browser.waitText('.summary [role="status"]', 'Descarga del comprobante iniciada.');
  const file = join(dir, 'NexaTech-' + folio + '.pdf');
  const bytes = await until(() => readFile(file).catch(() => null), 'downloaded receipt file');
  const document = bytes.toString('ascii');
  assert.match(document, /^%PDF-1\.4/);
  assert.match(document, /%%EOF\n$/);
  const xref = Number(document.match(/startxref\n(\d+)/)[1]);
  assert.equal(document.slice(xref, xref + 4), 'xref');
  for (const [index, entry] of [...document.slice(xref).matchAll(/^(\d{10}) 00000 n /gm)].entries()) {
    assert.ok(document.startsWith((index + 1) + ' 0 obj', Number(entry[1])), 'xref offset ' + index);
  }
  const decoder = new TextDecoder('windows-1252');
  return [...document.matchAll(/<([0-9a-f]+)> Tj/g)].map(match => decoder.decode(Buffer.from(match[1], 'hex')));
}

for (const [name, executable] of browsers) {
  test('E2 · compra transaccional, recuperación y autorización en ' + name, {
    skip: !existsSync(executable), timeout: 180000,
  }, async () => {
    const suffix = name.toLowerCase();
    const browser = await openBrowser(executable, localWork, 'e2-' + suffix);
    const buyer = await identity('comprador-' + suffix);
    const intruder = await identity('otro-' + suffix, 'SUPPORT');
    const admin = await identity('gestion-' + suffix, 'ADMIN');
    const sku = name === 'Chrome' ? 'NX-E1-A04-01' : 'NX-E1-A04-02';
    const product = await one(`SELECT v.id, v.stock_on_hand, v.unit_price_cents, p.slug, p.name
      FROM public.product_variant v JOIN public.product p ON p.id=v.product_id WHERE v.sku=$1`, [sku]);
    const adjust = delta => command(admin, admin.staff, staff.adjustInventory,
      { variantId: product.id, delta, reason: 'Escenario sintético de fase E2' });
    await command(buyer, buyer.account, account.setCartItem, { variantId: product.id, quantity: 1 });

    // Intercept only the local response after an actual mutation has committed.
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      const original = window.fetch.bind(window);
      window.fetch = async (url, config) => {
        const operation = typeof config?.body === 'string' && String(url).includes('/connectors/')
          ? JSON.parse(config.body).operationName : '';
        if (window.e2LostResult && operation === 'GetMyCommandResult') throw new TypeError('Respuesta perdida');
        const response = await original(url, config);
        if (window.e2DropOperation === operation && operation) {
          window.e2LostResult = true;
          throw new TypeError('Respuesta perdida');
        }
        return response;
      };
    })();` });
    try {
      await browser.go(origin + '/productos?pagina=13');
      await browser.waitText('.results-count', '153 productos · Mostrando 145–153');
      await browser.waitText('.pagination', 'Página 13 de 13');
      await browser.go(origin + '/productos?q=NX-E1-S05-08');
      await browser.waitText('.results-count', '1 producto');
      await browser.waitText('.product-card h3', 'Nexa Prisma Plus 8');

      await browser.go(origin + '/producto/' + product.slug);
      await browser.waitText('main h1', product.name);
      await browser.click('.buy-row .button.primary');
      await browser.waitText('dialog .cart-line', product.name);
      await browser.press('Escape');
      await browser.go(origin + '/checkout');
      await browser.waitText('main', 'Vista previa');
      await browser.go(origin + '/login?continuar=checkout');
      await browser.waitText('main h1', 'Inicia sesión');
      await browser.evaluate(() => { window.e2DropOperation = 'MergeCart'; });
      await fill(browser, 'main form', { email: buyer.email, password });
      await browser.waitText('main [role="alert"]', 'Tu selección de visitante sigue guardada');
      const draft = JSON.parse(await browser.evaluate(() => localStorage.getItem('nexa-cart')));
      assert.equal(draft.lines[0].sku, sku);
      assert.ok(draft.pending.key);
      assert.equal((await cartQuantity(buyer.uid)).quantity, 2);
      await browser.evaluate(() => { window.e2DropOperation = ''; window.e2LostResult = false; });
      await browser.click('main a[href="/carrito"].text-link');
      const retryMerge = 'main section[aria-label="Selección pendiente"] button';
      await until(() => browser.evaluate(selector => Boolean(document.querySelector(selector + ':enabled')), retryMerge), 'merge retry enabled');
      await browser.click(retryMerge);
      await browser.waitText('main .cart-line', product.name);
      await until(() => browser.evaluate(() => !document.querySelector('main .cart-line button:disabled')), 'cart controls enabled');
      assert.equal((await cartQuantity(buyer.uid)).quantity, 2);
      await browser.click('main .cart-line button[aria-label="Aumentar cantidad"]');
      await browser.waitText('main .cart-line output', '3');
      assert.equal((await cartQuantity(buyer.uid)).quantity, 3);
      await browser.click('main .cart-line button[aria-label="Disminuir cantidad"]');
      await browser.waitText('main .cart-line output', '2');
      await browser.click('main a[href="/checkout"]');
      await browser.waitText('.address-form legend', 'Nueva dirección');
      assert.equal((await cartQuantity(buyer.uid)).quantity, 2);
      assert.deepEqual(JSON.parse(await browser.evaluate(() => localStorage.getItem('nexa-cart'))).lines, []);
      await accessible(browser, ['.address-form label', '.address-form button.primary']);
      assert.ok(await browser.evaluate(() => [...document.querySelectorAll('.address-form input, .address-form select')]
        .every(control => control.labels?.length > 0)));
      await browser.evaluate(() => {
        const form = document.querySelector('.address-form');
        form.querySelector('[name="recipient"]').focus();
      });
      await browser.press('Tab');
      assert.equal(await browser.evaluate(() => document.activeElement.name), 'phone');
      assert.equal(await browser.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'solid');
      assert.equal(await browser.evaluate(() => document.querySelector('.address-form').checkValidity()), false);
      const address = {
        recipient: 'María de Prueba', phone: '0000000000', line1: 'Calle Académica 42',
        district: 'Colonia Ficticia', city: 'Matamoros', stateCode: 'TAM', postalCode: '87300',
      };
      await fill(browser, '.address-form', { ...address, recipient: '   ' });
      await browser.waitText('.address-form [role="alert"]', 'dirección está incompleta');
      await fill(browser, '.address-form', address);
      await browser.waitText('.address-text', 'Calle Académica 42');
      await browser.evaluate(() => [...document.querySelectorAll('main button')].find(b => b.textContent === 'Editar dirección').click());
      await fill(browser, '.address-form', { line2: 'Interior 5' });
      await browser.waitText('.address-text', 'Interior 5');
      await browser.evaluate(() => [...document.querySelectorAll('main button')].find(b => b.textContent === 'Agregar dirección').click());
      await fill(browser, '.address-form', { ...address, label: 'Alternativa', line1: 'Avenida Ensayo 9' });
      await browser.waitText('.address-text', 'Avenida Ensayo 9');
      await browser.evaluate(() => {
        const select = document.querySelector('main label select');
        select.value = select.options[0].value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await browser.waitText('.address-text', 'Interior 5');

      await quote(browser, 'DEMO10');
      const expired = await one(`INSERT INTO public.checkout_quote
          (cart_id, address_id, zone_id, method_code, coupon_id, cart_revision, pricing_digest, summary, created_at, expires_at)
        SELECT q.cart_id, q.address_id, q.zone_id, q.method_code, q.coupon_id, q.cart_revision, q.pricing_digest,
          q.summary, now() - interval '16 minutes', now() - interval '1 minute'
        FROM public.checkout_quote q JOIN public.cart c ON c.id=q.cart_id
        WHERE c.user_uid=$1 ORDER BY q.created_at DESC LIMIT 1
        RETURNING id, summary->'documents'->>'TERMS' AS terms_id`, [buyer.uid]);
      const expiryKey = randomUUID();
      await account.confirmCheckout(buyer.account,
        { key: expiryKey, quoteId: expired.id, termsId: expired.terms_id, accepted: true, scenario: 'APPROVE' });
      const expiry = (await account.getMyCommandResult(buyer.account, { key: expiryKey }, server)).data.commerceCommands[0];
      assert.equal(expiry.resultCode, 'QUOTE_EXPIRED');
      assert.ok(await browser.evaluate(selector => document.querySelector(selector).disabled, confirmButton));
      await accept(browser);
      await browser.evaluate(() => {
        const now = Date.now;
        Date.now = () => now() + 16 * 60 * 1000;
      });
      await browser.click(confirmButton);
      await browser.waitText('main [role="alert"]', 'La cotización venció');
      await browser.evaluate(() => { Date.now = (() => new Date().getTime()); });
      assert.equal((await cartQuantity(buyer.uid)).quantity, 2);

      await quote(browser, 'DEMO10');
      await accept(browser);
      await browser.evaluate(() => {
        const select = document.querySelector('details select');
        select.closest('details').open = true;
        select.value = 'DECLINE';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await browser.click(confirmButton);
      await browser.waitText('main [role="alert"]', 'pago simulado fue rechazado');
      assert.equal((await cartQuantity(buyer.uid)).quantity, 2);
      assert.equal((await one('SELECT stock_on_hand FROM public.product_variant WHERE id=$1', [product.id])).stock_on_hand, product.stock_on_hand);

      await quote(browser, 'DEMO10');
      await adjust(-product.stock_on_hand);
      await accept(browser);
      await browser.click(confirmButton);
      await browser.waitText('main [role="alert"]', 'Inventario insuficiente');
      assert.equal((await cartQuantity(buyer.uid)).quantity, 2);
      await browser.go(origin + '/carrito');
      await browser.waitText('.cart-line .stock', 'Variante sin disponibilidad');
      assert.equal(await browser.evaluate(() => Boolean(document.querySelector('main a[href="/checkout"]'))), false);
      await adjust(product.stock_on_hand);
      await browser.go(origin + '/checkout');
      await browser.waitText('.address-text', 'Interior 5');
      await browser.send('Network.setBlockedURLs', { urls: ['*127.0.0.1:' + connectPort + '/*'] });
      await fill(browser, 'form:has(input[name="coupon"])', { coupon: 'DEMO10' });
      await browser.waitText('main [role="alert"]', 'No se pudo conectar');
      await browser.send('Network.setBlockedURLs', { urls: [] });
      await quote(browser, 'DEMO10');
      const before = await browser.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-amount]')]
        .map(node => [node.dataset.amount, node.textContent])));
      assert.notEqual(before.shippingCents, '$0.00 MXN');
      assert.match(before.discountCents, /^-/);
      await accept(browser);
      await browser.evaluate(selector => {
        window.e2DropOperation = 'ConfirmCheckout';
        const form = document.querySelector(selector).form;
        form.requestSubmit();
        form.requestSubmit();
      }, confirmButton);
      await browser.waitText('#purchase-progress', 'Confirmación del pedido');
      await browser.waitText('main [role="alert"]', 'No se pudo conectar');
      const orders = await sql('SELECT * FROM public.customer_order WHERE user_uid=$1', [buyer.uid]);
      assert.equal(orders.length, 1);
      const [order] = orders;
      assert.match(order.folio, /^NX-[0-9A-F]{24}$/);
      assert.equal(await cartQuantity(buyer.uid), undefined);
      const [sale] = await sql(`SELECT oi.quantity, oi.unit_price_cents, m.delta FROM public.order_item oi
        JOIN public.inventory_movement m ON m.order_item_id=oi.id AND m.kind='SALE' WHERE oi.order_id=$1`, [order.id]);
      assert.deepEqual(sale, { quantity: 2, unit_price_cents: product.unit_price_cents, delta: -2 });
      assert.equal((await one('SELECT stock_on_hand FROM public.product_variant WHERE id=$1', [product.id])).stock_on_hand, product.stock_on_hand - 2);
      const payment = await one('SELECT status, provider, amount_cents FROM public.payment WHERE order_id=$1', [order.id]);
      assert.deepEqual(payment, { status: 'APPROVED', provider: 'SIMULATED', amount_cents: order.total_cents });
      const terms = await one(`SELECT d.version, t.evidence_kind FROM public.terms_acceptance t
        JOIN public.legal_document d ON d.id=t.legal_document_id WHERE t.order_id=$1 AND d.kind='TERMS'`, [order.id]);
      assert.deepEqual(terms, { version: 1, evidence_kind: 'ACCEPTED' });
      await browser.go(origin + '/checkout');
      await browser.waitText('main', 'Reintentar compra');
      await browser.click('main section > button.primary');
      await browser.waitText('main h1', 'Compra simulada confirmada');
      await browser.waitText('main .lede', order.folio);
      assert.equal((await one('SELECT count(*)::int AS count FROM public.customer_order WHERE user_uid=$1', [buyer.uid])).count, 1);
      assert.equal((await one(`SELECT count(*)::int AS count FROM public.commerce_command
        WHERE actor_uid=$1 AND result_code='ORDER_CONFIRMED'`, [buyer.uid])).count, 1);
      await accessible(browser, ['.summary .muted', receiptButton]);
      const receipt = await download(browser, join(localWork, 'pdf-' + suffix), order.folio);
      for (const value of ['NexaTech', 'Folio ' + order.folio, buyer.email, 'María de Prueba', 'Calle Académica 42',
        'Interior 5', 'Pedido Pagado | Pago simulado Aprobado', product.name, '2', pesos(product.unit_price_cents),
        'Comprobante académico de compra simulada — Sin validez fiscal']) {
        assert.ok(receipt.includes(value), 'receipt includes ' + value);
      }
      assert.ok(receipt.some(line => line.includes(sku)));
      for (const field of totals) {
        const value = pesos(order[field + '_cents'], field === 'discount');
        assert.ok(receipt.includes(value), 'receipt amount ' + field + ' ' + value);
        const key = field.replace(/_([a-z])/g, (_, character) => character.toUpperCase()) + 'Cents';
        assert.equal(before[key], value);
        assert.equal(await browser.text('[data-amount="' + key + '"]'), value);
      }

      await signOut(browser);
      await signIn(browser, buyer);
      await browser.waitText('.session-email', buyer.email);
      await browser.click('.session-panel a[href="/pedidos"]');
      await browser.waitText('.order-folio', order.folio);
      await accessible(browser, ['.order-folio', '.purchase-lines .muted']);
      await browser.click('.order-folio');
      await browser.waitText('main h1', 'Detalle de tu pedido');
      assert.deepEqual(await download(browser, join(localWork, 'historial-' + suffix), order.folio), receipt);

      await signOut(browser);
      await signIn(browser, intruder);
      await browser.waitText('.session-email', intruder.email);
      await browser.go(origin + '/pedidos/' + order.id + '/confirmacion');
      await browser.waitText('.state h2', 'Pedido no disponible');
      assert.equal(await browser.evaluate(selector => Boolean(document.querySelector(selector)), receiptButton), false);
      assert.equal((await account.getMyOrder(intruder.account, { id: order.id }, server)).data.customerOrders.length, 0);
      assert.equal((await staff.getStaffOrder(intruder.staff, { id: order.id }, server)).data.staffOrders.length, 0);
      await browser.go(origin + '/administracion/pedidos/' + order.id);
      await browser.waitText('.state h2', 'Acceso restringido');

      await signOut(browser);
      await signIn(browser, admin);
      await browser.waitText('.session-email', admin.email);
      await browser.go(origin + '/administracion');
      await browser.waitText('.staff-orders', order.folio);
      await browser.click('a[href="/administracion/pedidos/' + order.id + '"]');
      await browser.waitText('main h2', order.folio);
      await browser.waitText('main .total-row', pesos(order.total_cents));
      await accessible(browser, ['.purchase-lines strong', '.total-row strong']);
      assert.deepEqual(browser.errors, []);
      assert.deepEqual(browser.requests.filter(request => /^https?:/.test(request) && new URL(request).hostname !== '127.0.0.1'), []);
    } finally {
      await browser.close();
    }
  });
}
