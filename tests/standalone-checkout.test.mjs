import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { getLegalContact } from '../server/legal-contact.mjs';
import { identity as createIdentity, operation, startStandalone } from './helpers/standalone.mjs';
import { openBrowser, until } from './helpers/local-browser.mjs';

const browsers = [
  ['Chrome', process.env.NEXATECH_TEST_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
  ['Edge', process.env.NEXATECH_TEST_EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
];
const password = 'nexatech-e2-' + randomUUID();
let db;
let store, localWork;
let origin;

before(async () => {
  store = await startStandalone('checkout');
  ({ db, origin, work: localWork } = store);
});
after(async () => store?.close());
const sql = async (query, variables) => (await db.query(query, variables)).rows;
const one = async (query, variables) => (await sql(query, variables))[0];
const systemTheme = (browser, value) => browser.send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-color-scheme', value }],
});

const identity = (name, role, verified = true) =>
  createIdentity(store, name + '@nexatech.test', password, name, role, verified);

async function command(actor, name, input) {
  const result = await operation(name, actor, { key: randomUUID(), ...input });
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

test('Tema inicial, preferencias persistentes y contactos públicos en escritorio y móvil', {
  skip: !existsSync(browsers[0][1]), timeout: 90000,
}, async () => {
  const browser = await openBrowser(browsers[0][1], localWork, 'tema-contacto');
  const contact = getLegalContact();
  const toggle = '.theme-toggle';
  const theme = () => browser.evaluate(() => document.documentElement.dataset.theme);
  try {
    await systemTheme(browser, 'dark');
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      const observeTheme = new MutationObserver(() => {
        window.themeBeforeContent = !document.getElementById('root');
        observeTheme.disconnect();
      });
      observeTheme.observe(document, { attributeFilter: ['data-theme'], subtree: true, attributes: true });
    ` });
    await browser.go(origin + '/');
    await browser.waitText('main h1', 'Tecnología a tu ritmo');
    assert.equal(await theme(), 'dark');
    assert.equal(await browser.evaluate(() => window.themeBeforeContent), true);
    await accessible(browser, ['.theme-toggle', '.site-header .brand']);
    await browser.viewport(320, 900);
    assert.ok(await browser.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await browser.click(toggle);
    assert.equal(await theme(), 'light');
    assert.equal(await browser.evaluate(() => localStorage.getItem('nexa-theme')), 'light');
    await browser.click('footer a[href="/ayuda"]');
    await browser.waitText('main h1', 'Centro de ayuda');
    assert.equal(await theme(), 'light');
    await browser.go(origin + '/productos');
    await browser.waitText('main h1', 'Catálogo');
    assert.equal(await theme(), 'light');
    await browser.click(toggle);
    await systemTheme(browser, 'light');
    assert.equal(await theme(), 'dark');
    await browser.waitText('.results-count', '153 productos');
    await accessible(browser, ['.catalog-filters label', '.product-info h3', '.product-info .stock']);

    for (const [path, values, mail, phone] of [
      ['/politicas/privacidad', [contact.responsible, contact.privacyContact, contact.address], contact.privacyEmail, contact.privacyPhone],
      ['/politicas/terminos', [contact.provider, contact.address], contact.supportEmail, contact.supportPhone],
      ['/politicas/soporte', [], contact.supportEmail, contact.supportPhone],
    ]) {
      await browser.go(origin + path);
      await browser.waitText('.policy-contact', mail);
      assert.equal(await theme(), 'dark');
      const actual = await browser.evaluate(() => ({
        fields: [...document.querySelectorAll('.policy-contact dd')].map(node => node.textContent),
        mail: document.querySelector('.policy-contact a[href^="mailto:"]').getAttribute('href'),
        phone: document.querySelector('.policy-contact a[href^="tel:"]').getAttribute('href'),
      }));
      assert.ok(values.every(value => actual.fields.includes(value)));
      assert.equal(actual.mail, 'mailto:' + mail);
      assert.equal(actual.phone, 'tel:' + phone.replace(/[^\d+]/g, ''));
      await accessible(browser, ['.policy-list h2', '.policy-contact .text-link', 'footer a[href^="mailto:"]']);
    }
    await browser.waitText('a[href="/cuenta/soporte"].text-link', 'Abrir una solicitud de soporte');
    await browser.waitText('footer', contact.provider);
    assert.deepEqual(browser.errors, []);
  } finally {
    await browser.close();
  }
});

test('Registro, perfil, direcciones y políticas desde Chrome', { skip: !existsSync(browsers[0][1]), timeout: 90000 }, async () => {
  const browser = await openBrowser(browsers[0][1], localWork, 'registro');
  try {
    const email = 'registro-navegador@nexatech.test';
    await browser.go(origin + '/registro');
    await fill(browser, 'main form', { name: 'Registro navegador', email, password });
    await browser.waitText('.session-email', email);
    await fill(browser, 'main form', { name: 'Perfil actualizado', phone: 'abc' });
    await browser.waitText('main form [role="alert"]', 'Escribe un teléfono válido');
    await fill(browser, 'main form', { name: 'Perfil actualizado', phone: '8681234567' });
    await browser.waitText('[role="status"].feedback', 'Perfil guardado');
    const profile = await one(`
      SELECT a.display_name, a.phone, r.role_code FROM public.app_user a
      JOIN nexa_auth.identity i ON i.uid = a.uid JOIN public.user_role r ON r.user_uid = a.uid WHERE i.email = $1`, [email]);
    assert.deepEqual(profile, { display_name: 'Perfil actualizado', phone: '8681234567', role_code: 'CUSTOMER' });
    await browser.waitText('#delivery-title', 'Mis direcciones');
    await fill(browser, '.address-form', {
      recipient: 'Cliente de prueba', phone: '8681234567', line1: 'Calle Prueba 10', district: 'Centro',
      city: 'Matamoros', stateCode: 'TAM', postalCode: '87300', label: 'Casa',
    });
    await browser.waitText('.address-text', 'Calle Prueba 10');
    await browser.waitText('[aria-labelledby="delivery-title"] + [role="status"]', 'Dirección guardada.');
    await signOut(browser);
    await signIn(browser, { email });
    await browser.waitText('.session-email', email);
    await browser.waitText('.address-text', 'Calle Prueba 10');
    await browser.go(origin + '/politicas/privacidad');
    await browser.waitText('.policy-list h2', 'Aviso de privacidad');
    await browser.waitText('.policy-body', '(ARCO)');
    assert.equal(await browser.evaluate(() => document.querySelectorAll('footer nav a[href^="/politicas/"]').length), 7);
    await accessible(browser, ['.policy-list h2', '.policy-contact dd']);
    await browser.click('footer a[href="/politicas/soporte"]');
    await browser.waitText('.policy-list h2', 'Atención a clientes y soporte');
    assert.deepEqual(browser.errors, []);
  } finally {
    await browser.close();
  }
});

for (const [name, executable] of browsers) {
  test('E2 · compra transaccional, recuperación y autorización en ' + name, {
    skip: !existsSync(executable), timeout: 180000,
  }, async () => {
    const suffix = name.toLowerCase();
    const browser = await openBrowser(executable, localWork, 'e2-' + suffix);
    await systemTheme(browser, name === 'Edge' ? 'dark' : 'light');
    const buyer = await identity('comprador-' + suffix);
    const intruder = await identity('otro-' + suffix, 'SUPPORT');
    const admin = await identity('gestion-' + suffix, 'ADMIN');
    const sku = name === 'Chrome' ? 'NX-E1-A04-01' : 'NX-E1-A04-02';
    const product = await one(`SELECT v.id, v.stock_on_hand, v.unit_price_cents, p.slug, p.name
      FROM public.product_variant v JOIN public.product p ON p.id=v.product_id WHERE v.sku=$1`, [sku]);
    const adjust = delta => command(admin, 'AdjustInventory',
      { variantId: product.id, delta, reason: 'Escenario sintético de fase E2' });
    await command(buyer, 'SetCartItem', { variantId: product.id, quantity: 1 });

    // Intercept only the local response after an actual mutation has committed.
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      const original = window.fetch.bind(window);
      window.fetch = async (url, config) => {
        const operation = String(url).split('/api/operations/')[1] ?? '';
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
      await until(() => browser.evaluate(() => Boolean(document.querySelector('.buy-row .button.primary:enabled'))), 'purchase button enabled');
      await browser.click('.buy-row .button.primary');
      await browser.waitText('dialog .cart-line', product.name);
      await browser.press('Escape');
      await browser.go(origin + '/checkout');
      await browser.waitText('main', 'Cuenta y entrega');
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
      await operation('ConfirmCheckout', buyer,
        { key: expiryKey, quoteId: expired.id, termsId: expired.terms_id, accepted: true, scenario: 'APPROVE' });
      const expiry = (await operation('GetMyCommandResult', buyer, { key: expiryKey })).commerceCommands[0];
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
      const declinedQuote = await one(`SELECT q.id, q.summary->'documents'->>'TERMS' AS terms_id
        FROM public.checkout_quote q JOIN public.cart c ON c.id = q.cart_id
        WHERE c.user_uid = $1 ORDER BY q.created_at DESC LIMIT 1`, [buyer.uid]);
      const decline = await operation('ConfirmCheckout', buyer, {
        key: randomUUID(), quoteId: declinedQuote.id, termsId: declinedQuote.terms_id, accepted: true, scenario: 'DECLINE',
      });
      assert.equal(decline.resultCode, 'PAYMENT_DECLINED');
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
      await browser.send('Network.setBlockedURLs', { urls: ['*/api/operations/QuoteCheckout'] });
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
      assert.deepEqual(terms, { version: 3, evidence_kind: 'ACCEPTED' });
      await browser.go(origin + '/checkout');
      await browser.waitText('main', 'Reintentar confirmación');
      await browser.click('main section > button.primary');
      await browser.waitText('main h1', 'Confirmación de pedido');
      await browser.waitText('main .lede', order.folio);
      assert.equal((await one('SELECT count(*)::int AS count FROM public.customer_order WHERE user_uid=$1', [buyer.uid])).count, 1);
      assert.equal((await one(`SELECT count(*)::int AS count FROM public.commerce_command
        WHERE actor_uid=$1 AND result_code='ORDER_CONFIRMED'`, [buyer.uid])).count, 1);
      await accessible(browser, ['.summary .muted', receiptButton]);
      const receipt = await download(browser, join(localWork, 'pdf-' + suffix), order.folio);
      for (const value of ['NexaTech', 'Folio ' + order.folio, buyer.email, 'María de Prueba', 'Calle Académica 42',
        'Interior 5', 'Estado del pedido Confirmado', product.name, '2', pesos(product.unit_price_cents),
        'Comprobante de pedido · Sin validez fiscal', 'No se realizan cargos reales.']) {
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
      assert.equal((await operation('GetMyOrder', intruder, { id: order.id })).customerOrders.length, 0);
      await assert.rejects(operation('GetStaffOrder', intruder, { id: order.id }), { status: 403 });
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
