import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { identity as createIdentity, operation, startStandalone } from './helpers/standalone.mjs';
import { openBrowser, until } from './helpers/local-browser.mjs';

const password = 'nexatech-e3-' + randomUUID();
const scopes = {
  chrome: process.env.NEXATECH_TEST_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  edge: process.env.NEXATECH_TEST_EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
};
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP7sAAAAASUVORK5CYII=';
let db;
let store, localWork;
let origin;

before(async () => {
  store = await startStandalone('operations');
  ({ db, origin, work: localWork } = store);
});
after(async () => store?.close());

const sql = async (query, args) => (await db.query(query, args)).rows;
const row = async (query, args) => (await sql(query, args))[0];
const amount = cents => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', currencyDisplay: 'narrowSymbol',
}).format(Number(cents) / 100) + ' MXN';

const identity = (name, role, verified = true) =>
  createIdentity(store, name + '@nexatech.test', password, name, role, verified);

async function command(actor, name, variables, expected = 'OK') {
  if (expected === 'FORBIDDEN') {
    await assert.rejects(operation(name, actor, { ...variables, key: randomUUID() }), { status: 403 });
    return null;
  }
  const result = await operation(name, actor, { ...variables, key: randomUUID() });
  assert.equal(result.resultCode, expected);
  return result.resultId;
}

async function buy(buyer, variantId, addressId, quantity, couponCode) {
  const cartId = await command(buyer, 'SetCartItem', { variantId, quantity });
  const quoteId = await command(buyer, 'QuoteCheckout', { cartId, addressId, couponCode, deliveryMethod: 'DEMO_PARCEL' });
  const quote = (await operation('GetMyQuote', buyer, { id: quoteId })).checkoutQuotes[0];
  const id = await command(buyer, 'ConfirmCheckout', {
    quoteId, termsId: quote.summary.documents.TERMS, accepted: true, scenario: 'APPROVE',
  }, 'ORDER_CONFIRMED');
  return row('SELECT id, folio, total_cents FROM public.customer_order WHERE id=$1', [id]);
}

async function fill(browser, selector, fields = {}) {
  await until(() => browser.evaluate(selector => {
    const form = document.querySelector(selector);
    return form && !form.querySelector('fieldset:disabled');
  }, selector), 'ready form ' + selector);
  await browser.evaluate(({ selector, fields }) => {
    const form = document.querySelector(selector);
    for (const [name, value] of Object.entries(fields)) {
      const field = form.elements.namedItem(name);
      if (!field) throw new Error('Missing field ' + name + ' on ' + selector);
      if (field.type === 'checkbox') field.checked = value;
      else field.value = value;
    }
    if (!form.checkValidity()) {
      const invalid = [...form.elements].filter(field => field.validity && !field.validity.valid).map(field => field.name);
      throw new Error('Invalid fields in ' + selector + ' — ' + invalid.join(', '));
    }
    form.requestSubmit();
  }, { selector, fields });
}

async function choose(browser, selector, value) {
  await until(() => browser.evaluate(selector => Boolean(document.querySelector(selector)), selector), 'select ' + selector);
  await browser.evaluate(({ selector, value }) => {
    const input = document.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { selector, value });
}

const go = (browser, path) => browser.go(origin + path);
const adminPath = (section, id = '') => '/administracion/' + section + (id ? '/' + id : '');
const casePath = id => adminPath('posventa', id);

async function signIn(browser, actor) {
  await go(browser, '/login');
  await fill(browser, 'main form', { email: actor.email, password });
  await browser.waitText('.session-email', actor.email);
}

async function signOut(browser) {
  await go(browser, '/perfil');
  await browser.waitText('.session-panel', 'Cerrar sesión');
  await browser.click('.session-panel button:last-of-type');
  await browser.waitText('main h1', 'Inicia sesión');
}

async function responsive(browser) {
  for (const width of [360, 768, 1440]) {
    await browser.viewport(width, 900);
    assert.ok(await browser.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow at ' + width);
  }
  assert.ok(await browser.evaluate(() => [...document.querySelectorAll('main input, main select, main textarea')]
    .every(field => field.labels?.length)), 'labels on every control');
}

async function readId(browser, prefix) {
  return until(() => browser.evaluate(prefix => {
    const path = location.pathname;
    return path.startsWith(prefix + '/') && /^[\da-f-]{36}$/i.test(path.split('/').at(-1)) ? path.split('/').at(-1) : null;
  }, prefix), 'detail id on ' + prefix);
}

async function review(browser, state, detail) {
  await choose(browser, '.review-case select[name="state"]', state);
  await fill(browser, '.review-case', detail ? { detail } : {});
  await browser.waitText('main > .page > .checkout-steps > [role="status"]', 'Expediente actualizado');
}

async function agree(browser, id, next) {
  await go(browser, casePath(id));
  await review(browser, 'IN_REVIEW');
  await until(() => browser.evaluate(() => Boolean(document.querySelector('.review-case select option[value="APPROVED"]'))), 'approval available');
  await review(browser, 'APPROVED');
  await until(async () => (await row('SELECT status FROM public.return_request WHERE id=$1', [id])).status === 'APPROVED',
    'approved in PostgreSQL');
  if (next) await review(browser, 'AWAITING_ITEM');
}

async function compareReports(browser, admin, sku) {
  const audit = await row(`
    SELECT (SELECT count(*) FROM public.customer_order) AS orders,
      (SELECT count(*) FROM public.customer_order WHERE status='CANCELLED') AS cancellations,
      (SELECT count(*) FROM public.customer_order WHERE status='DELIVERED') AS deliveries,
      (SELECT count(*) FROM public.customer_order WHERE status='REFUNDED') AS order_refunds,
      (SELECT coalesce(sum(amount_cents),0)::bigint FROM public.payment WHERE status IN ('APPROVED','REFUNDED')) AS gross,
      (SELECT coalesce(sum(amount_cents),0)::bigint FROM public.refund WHERE status='APPROVED') AS refunds,
      (SELECT count(*) FROM public.refund WHERE status='APPROVED') AS refund_count,
      (SELECT count(*) FROM public.coupon_redemption) AS redemptions,
      (SELECT count(*) FROM public.return_request WHERE kind='RETURN') AS return_requests,
      (SELECT count(*) FROM public.return_request WHERE kind='WARRANTY') AS warranties,
      (SELECT count(*) FROM public.return_request WHERE kind='CANCELLATION') AS requested_cancels,
      (SELECT sum(v.stock_on_hand) FROM public.product_variant v JOIN public.product p ON p.id=v.product_id
        JOIN public.category c ON c.id=p.category_id WHERE p.status='ACTIVE' AND v.archived_at IS NULL AND c.archived_at IS NULL) AS stock,
      (SELECT count(*) FROM public.product_variant v JOIN public.product p ON p.id=v.product_id
        JOIN public.category c ON c.id=p.category_id WHERE p.status='ACTIVE' AND v.archived_at IS NULL
        AND c.archived_at IS NULL AND v.stock_on_hand<=v.low_stock_threshold) AS low_stock
  `);
  const [totals] = (await operation('GetOperationTotals', admin)).staffOperationTotals;
  assert.deepEqual([totals.orderCount, totals.grossCents, totals.refundedCents, totals.refundCount, totals.couponUses,
    totals.availableUnits, totals.lowStockVariants, totals.returnRequests, totals.warrantyRequests, totals.cancellationRequests],
  [audit.orders, audit.gross, audit.refunds, audit.refund_count, audit.redemptions, audit.stock, audit.low_stock,
    audit.return_requests, audit.warranties, audit.requested_cancels]);
  assert.deepEqual(['CANCELLED', 'DELIVERED', 'REFUNDED'].map(state => String(totals.ordersByStatus[state] ?? 0)),
    [audit.cancellations, audit.deliveries, audit.order_refunds]);
  await go(browser, adminPath('reportes'));
  await browser.waitText('.metric-grid', amount(BigInt(audit.gross) - BigInt(audit.refunds)));
  await browser.waitText('main', 'Pedidos por estado actual');
  await browser.waitText('main', sku);
  await responsive(browser);
}

for (const [name, executable] of Object.entries(scopes)) {
  test('E3 · operación y posventa en ' + name, { skip: !existsSync(executable), timeout: 240000 }, async () => {
    const admin = await identity('admin-' + name, 'ADMIN');
    const support = await identity('soporte-' + name, 'SUPPORT');
    const buyer = await identity('cliente-' + name);
    const other = await identity('otro-' + name);
    const unverified = await identity('sin-verificar-' + name, 'SUPPORT', false);
    const browser = await openBrowser(executable, localWork, 'e3-' + name);
    const sku = 'NEXA-E3-' + name.toUpperCase();
    const slug = 'phase-e3-' + name;
    const code = 'PROMO-E3-' + name.toUpperCase();
    const categoryId = (await row('SELECT id FROM public.category WHERE archived_at IS NULL ORDER BY slug LIMIT 1')).id;
    const taxClass = (await row('SELECT code FROM public.tax_class WHERE rate_bps=1600 ORDER BY code LIMIT 1')).code;
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      const original = window.fetch.bind(window);
      window.fetch = async (url, config) => {
        const operation = String(url).split('/api/operations/')[1] ?? '';
        if (window.e3Lost && operation === 'GetMyCommandResult') throw new TypeError('Respuesta perdida');
        const response = await original(url, config);
        if (window.e3Drop && operation === 'AdjustInventory') {
          window.e3Lost = true;
          throw new TypeError('Respuesta perdida');
        }
        return response;
      };
    })();` });
    try {
      assert.equal((await row("SELECT count(*)::int AS total FROM public.product WHERE slug NOT LIKE 'phase-e3-%'")).total, 153);
      await signIn(browser, admin);
      await go(browser, adminPath('clientes'));
      await browser.waitText('main h2', 'Cuentas de clientes');
      await browser.waitText('.operation-list', buyer.uid);
      await go(browser, adminPath('categorias'));
      const categorySlug = 'g1-categoria-' + name;
      await browser.waitText('main details > summary', 'Nueva categoría');
      await browser.click('main details > summary');
      await fill(browser, 'main details form', { slug: categorySlug, name: 'Categoría G1 ' + name });
      const categoryDetails = 'main li details:has(input[name="slug"][value="' + categorySlug + '"])';
      await browser.waitText(categoryDetails + ' summary', 'Categoría G1 ' + name);
      await browser.click(categoryDetails + ' summary');
      await fill(browser, categoryDetails + ' form', { archived: true });
      await browser.waitText(categoryDetails + ' summary', 'archivada');
      assert.ok((await row('SELECT archived_at FROM public.category WHERE slug=$1', [categorySlug])).archived_at);
      await browser.click(categoryDetails + ' summary');
      await fill(browser, categoryDetails + ' form', { archived: false });
      await until(async () => (await row('SELECT archived_at FROM public.category WHERE slug=$1', [categorySlug])).archived_at === null,
        'category restored');
      await go(browser, adminPath('productos', 'nuevo'));
      await browser.waitText('.product-editor legend', 'Nueva ficha');
      await responsive(browser);
      await browser.evaluate(() => document.querySelector('.product-editor [name="name"]').focus());
      await browser.press('Tab');
      assert.equal(await browser.evaluate(() => document.activeElement.name), 'brand');
      assert.equal(await browser.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'solid');
      await fill(browser, '.product-editor', {
        name: 'Equipo E3 ' + name, brand: 'NexaTech', slug, categoryId, description: 'Ficha inicial', specs: '{"Memoria":"8 GB"}',
      });
      const productId = await readId(browser, adminPath('productos'));
      assert.equal((await row('SELECT status FROM public.product WHERE id=$1', [productId])).status, 'DRAFT');
      await browser.waitText('.product-editor', 'Borrador creado');
      await browser.click('a[href="' + adminPath('variantes', 'nuevo') + '?producto=' + productId + '"]');
      await fill(browser, '.variant-editor', { sku, label: 'Estándar', taxClass, price: '987.65', threshold: 8 });
      const variantId = await readId(browser, adminPath('variantes'));
      await fill(browser, '.variant-editor', { price: '999.12' });
      await browser.waitText('main', 'Variante guardada');
      assert.deepEqual(await row('SELECT unit_price_cents,stock_on_hand FROM public.product_variant WHERE id=$1', [variantId]),
        { unit_price_cents: '99912', stock_on_hand: 0 });
      await go(browser, adminPath('productos', productId));
      await fill(browser, '.product-editor', { status: 'ACTIVE', description: 'Ficha E3 actualizada', specs: '{"Memoria":"16 GB"}' });
      await browser.waitText('.product-editor', 'Producto guardado');
      assert.deepEqual(await row('SELECT status,description,specs FROM public.product WHERE id=$1', [productId]),
        { status: 'ACTIVE', description: 'Ficha E3 actualizada', specs: { marca: 'NexaTech', caracteristicas: { Memoria: '16 GB' } } });

      const inventory = adminPath('inventario', variantId);
      await go(browser, inventory);
      await browser.evaluate(() => { window.e3Drop = true; });
      const adjustment = { delta: 6, reason: 'Apertura académica E3 mediante ajuste' };
      await fill(browser, '.inventory-adjustment', adjustment);
      await browser.waitText('.inventory-adjustment [role="alert"]', 'No se pudo conectar');
      assert.equal((await row('SELECT stock_on_hand FROM public.product_variant WHERE id=$1', [variantId])).stock_on_hand, 6);
      assert.equal(await browser.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('nexatech:operacion:')).length), 1);
      await go(browser, inventory);
      await fill(browser, '.inventory-adjustment', adjustment);
      await browser.waitText('main', 'Ajuste registrado');
      await browser.waitText('main', adjustment.reason);
      assert.deepEqual(await sql(`SELECT m.delta,m.reason,c.actor_uid,a.action
        FROM public.inventory_movement m JOIN public.commerce_command c ON c.id=m.command_id
        JOIN public.audit_log a ON a.command_id=c.id WHERE m.variant_id=$1`, [variantId]),
      [{ delta: 6, reason: adjustment.reason, actor_uid: admin.uid, action: 'ADJUST_INVENTORY' }]);
      await go(browser, adminPath('inventario'));
      await browser.waitText('.admin-panel', sku);

      await go(browser, adminPath('cupones', 'nuevo'));
      const activeFrom = new Date(Date.now() - 86400000).toISOString().slice(0, 19);
      const activeTo = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 19);
      if (name === 'chrome') await choose(browser, '.coupon-editor select', 'FIXED');
      await fill(browser, '.coupon-editor', {
        code, amount: name === 'chrome' ? '50.25' : '10', minimum: '100', startsAt: activeFrom, endsAt: activeTo, maxUses: 3, maxPerUser: 2,
      });
      const couponId = await readId(browser, adminPath('cupones'));
      await fill(browser, '.coupon-editor:has(input[name="archived"])', { archived: true, maxUses: 4 });
      await browser.waitText('main', 'Desactivado');
      const edited = await row('SELECT kind,total_limit,per_user_limit,archived_at FROM public.coupon WHERE id=$1', [couponId]);
      assert.ok(edited.archived_at);
      assert.deepEqual([edited.kind, edited.total_limit, edited.per_user_limit], [name === 'chrome' ? 'FIXED' : 'PERCENTAGE', 4, 2]);
      await fill(browser, '.coupon-editor', { archived: false });
      await browser.waitText('main', 'Vigente');

      const addressId = await command(buyer, 'SaveAddress', {
        label: 'Casa', recipient: 'Cliente de prueba', phone: '0000000000', line1: 'Calle de ejemplo 1',
        district: 'Centro', city: 'Matamoros', stateCode: 'TAM', postalCode: '87300', primary: true,
      });
      const order = await buy(buyer, variantId, addressId, 2, code);
      const cancel = await buy(buyer, variantId, addressId, 1);
      const item = await row(`SELECT id, unit_price_cents * quantity - discount_cents + tax_cents AS line_total
        FROM public.order_item WHERE order_id=$1`, [order.id]);
      await go(browser, adminPath('cupones', couponId));
      await browser.waitText('.operation-columns', order.folio);
      assert.equal((await row('SELECT count(*)::int AS total FROM public.coupon_redemption WHERE coupon_id=$1', [couponId])).total, 1);
      await go(browser, '/administracion');
      await browser.waitText('.staff-orders', order.folio);
      await browser.click('a[href="' + adminPath('pedidos', order.id) + '"]');
      await browser.waitText('main h2', order.folio);
      await responsive(browser);
      await fill(browser, 'form:has(legend)', { detail: 'Preparación académica' });
      await until(() => browser.evaluate(() => Boolean(document.querySelector('input[name="trackingCode"]'))), 'dispatch form');
      await fill(browser, 'form:has(input[name="trackingCode"])', { trackingCode: 'GUIA-' + sku, detail: 'Salida de almacén' });
      await browser.waitText('main', 'GUIA-' + sku);
      await choose(browser, 'form select', 'INCIDENT');
      await fill(browser, 'form:has(legend)', { detail: 'Incidencia de prueba' });
      await browser.waitText('main', 'Incidencia de prueba');
      await choose(browser, 'form select', 'DELIVERED');
      await fill(browser, 'form:has(legend)', { detail: 'Entrega académica' });
      await browser.waitText('main', 'Entrega académica');
      assert.deepEqual((await sql(`SELECT s.event_type AS state FROM public.shipment_event s JOIN public.shipment h ON h.id=s.shipment_id
        WHERE h.order_id=$1 ORDER BY s.occurred_at`, [order.id])).map(entry => entry.state), ['PREPARING', 'SHIPPED', 'INCIDENT', 'DELIVERED']);

      await signOut(browser);
      await signIn(browser, buyer);
      await go(browser, '/pedidos/' + cancel.id);
      await fill(browser, '.return-request-form', { reason: 'CHANGED_MIND', description: 'Cancelación de prueba' });
      const cancellationId = await readId(browser, '/cuenta/solicitudes');
      await go(browser, '/pedidos/' + order.id);
      await browser.waitText('main', 'GUIA-' + sku);
      await browser.waitText('main', 'Incidencia de prueba');
      await responsive(browser);
      assert.ok(await browser.evaluate(() => !document.querySelector('select[name="kind"] option[value="CANCELLATION"]')));
      await command(buyer, 'CreateReturnRequest', {
        orderId: order.id, kind: 'CANCELLATION', reason: 'OTHER', description: 'Demasiado tarde',
      }, 'CANCELLATION_UNAVAILABLE');
      await fill(browser, '.return-request-form', { reason: 'DEFECT', description: 'Devolución académica', [item.id]: 1 });
      const returnId = await readId(browser, '/cuenta/solicitudes');
      await browser.waitText('main', 'Devolución académica');
      await browser.evaluate(data => {
        const input = document.querySelector('input[type="file"]');
        const bytes = Uint8Array.from(atob(data), byte => byte.charCodeAt(0));
        const transfer = new DataTransfer();
        transfer.items.add(new File([bytes], 'evidencia.png', { type: 'image/png' }));
        input.files = transfer.files;
        input.form.requestSubmit();
      }, png);
      await browser.waitText('main', 'Evidencia adjuntada');
      const evidenceId = (await row('SELECT id FROM public.return_evidence WHERE return_request_id=$1', [returnId])).id;
      assert.deepEqual((await operation('GetMyReturnEvidence', other, { id: evidenceId })).returnEvidences, []);
      assert.deepEqual((await operation('GetStaffReturnEvidence', support, { requestId: returnId, id: evidenceId })).staffReturnCases, []);
      assert.equal((await operation('GetStaffReturnEvidence', admin, { requestId: returnId, id: evidenceId }))
        .staffReturnCases[0].request.returnEvidences_on_request[0].contentB64, png);
      await go(browser, '/pedidos/' + order.id);
      await choose(browser, 'select[name="kind"]', 'WARRANTY');
      await fill(browser, '.return-request-form', { reason: 'DEFECT', description: 'Garantía académica', [item.id]: 1 });
      const warrantyId = await readId(browser, '/cuenta/solicitudes');
      await command(buyer, 'CreateReturnRequest', {
        orderId: order.id, kind: 'RETURN', reason: 'OTHER', description: 'Exceso', items: [{ id: item.id, quantity: 1 }],
      }, 'RETURN_QUANTITY_UNAVAILABLE');
      await go(browser, '/cuenta/soporte/nuevo?pedido=' + order.id);
      await fill(browser, '.open-ticket', { subject: 'Consulta de entrega ' + name, body: 'Mensaje inicial del cliente' });
      const ticketId = await readId(browser, '/cuenta/soporte');
      await browser.waitText('main', 'Mensaje inicial del cliente');

      const forbidden = [
        ['ListStaffProducts', { offset: 0 }],
        ['ListStaffVariants', { offset: 0 }],
        ['ListCouponRedemptions', { offset: 0, id: couponId }],
        ['GetOperationTotals', {}],
        ['GetStaffCaseRefunds', { orderId: order.id, id: returnId }],
      ];
      for (const actor of [buyer, support]) {
        for (const [name, args] of forbidden) {
          await assert.rejects(operation(name, actor, args), { status: 403 });
        }
        await command(actor, 'AdjustInventory', { variantId, delta: 1, reason: 'Denegado' }, 'FORBIDDEN');
        await command(actor, 'ApproveRefund', { id: returnId, shipping: false, detail: 'Denegado' }, 'FORBIDDEN');
      }
      await assert.rejects(operation('GetOperationTotals', unverified), { status: 403 });
      await command(buyer, 'ChangeUserRole', { uid: buyer.uid, role: 'ADMIN', enabled: true }, 'FORBIDDEN');
      assert.deepEqual((await operation('GetMyTicket', other, { id: ticketId, messageOffset: 0 })).supportTickets, []);
      await command(other, 'ReplyToTicket', { id: ticketId, body: 'Denegado' }, 'TICKET_UNAVAILABLE');
      await go(browser, adminPath('reportes'));
      await browser.waitText('.state h2', 'Acceso restringido');

      await signOut(browser);
      await signIn(browser, support);
      await go(browser, adminPath('soporte', ticketId));
      await browser.waitText('.state h2', 'Ticket no disponible');
      await go(browser, adminPath('cola'));
      await browser.waitText('main', 'Tomar ticket');
      await browser.evaluate(() => [...document.querySelectorAll('main button')].find(button => button.textContent === 'Tomar ticket').click());
      await browser.waitText('main', 'Mensaje inicial del cliente');
      await choose(browser, '.staff-reply select', 'note');
      await fill(browser, '.staff-reply', { body: 'Nota privada de seguimiento' });
      await browser.waitText('main', 'Nota privada de seguimiento');
      await fill(browser, '.staff-reply', { body: 'Respuesta visible del personal' });
      await browser.waitText('main', 'En espera del cliente');
      assert.equal((await row('SELECT assigned_to_uid FROM public.support_ticket WHERE id=$1', [ticketId])).assigned_to_uid, support.uid);
      await go(browser, adminPath('inventario'));
      await browser.waitText('.state h2', 'Acceso restringido');

      await signOut(browser);
      await signIn(browser, buyer);
      await go(browser, '/cuenta/soporte/' + ticketId);
      await browser.waitText('main', 'Respuesta visible del personal');
      assert.ok(!(await browser.text('main')).includes('Nota privada de seguimiento'));
      await fill(browser, '.customer-reply', { body: 'Confirmación de lectura del cliente' });
      await browser.waitText('main', 'Confirmación de lectura del cliente');
      assert.equal((await row('SELECT status FROM public.support_ticket WHERE id=$1', [ticketId])).status, 'IN_PROGRESS');

      await signOut(browser);
      await signIn(browser, admin);
      await go(browser, adminPath('soporte', ticketId));
      await choose(browser, '.staff-reply select', 'close');
      await fill(browser, '.staff-reply', { body: 'Cierre de soporte de prueba' });
      await browser.waitText('main', 'Cierre de soporte de prueba');
      assert.equal((await row('SELECT status FROM public.support_ticket WHERE id=$1', [ticketId])).status, 'RESOLVED');
      await agree(browser, cancellationId);
      await fill(browser, '.resolve-case', { detail: 'Cancelación aprobada por administración' });
      await browser.waitText('main', 'Cancelación aprobada por administración');
      assert.equal((await row('SELECT status FROM public.customer_order WHERE id=$1', [cancel.id])).status, 'CANCELLED');
      assert.equal((await row('SELECT amount_cents FROM public.refund WHERE return_request_id=$1', [cancellationId])).amount_cents, cancel.total_cents);

      for (const [id, restock] of [[returnId, 1], [warrantyId, 0]]) {
        await agree(browser, id, true);
        const line = (await row('SELECT id FROM public.return_item WHERE return_request_id=$1', [id])).id;
        await fill(browser, '.inspect-case', {
          ['quantity-' + line]: 1, ['restock-' + line]: restock, ['condition-' + line]: restock ? 'SELLABLE' : 'NON_SELLABLE', detail: 'Inspección E3',
        });
        await browser.waitText('main', 'Inspeccionado');
        assert.equal((await row('SELECT restocked_qty FROM public.return_item WHERE id=$1', [line])).restocked_qty, restock);
        if (!restock) await choose(browser, '.resolve-case select', 'replacement');
        await fill(browser, '.resolve-case', { detail: restock ? 'Reembolso parcial académico' : 'Reposición académica de garantía' });
        await browser.waitText('main', restock ? 'Reembolso parcial académico' : 'Reposición académica de garantía');
        assert.equal((await row('SELECT resolution_code FROM public.return_request WHERE id=$1', [id])).resolution_code,
          restock ? 'REFUND' : 'REPLACEMENT');
        const movement = await row('SELECT count(*)::int AS total FROM public.inventory_movement WHERE return_item_id=$1', [line]);
        assert.equal(movement.total, 1);
        if (restock) {
          const refund = await row('SELECT amount_cents, provider_reference FROM public.refund WHERE return_request_id=$1', [id]);
          assert.equal(BigInt(refund.amount_cents), (BigInt(item.line_total) + 1n) / 2n);
          assert.match(refund.provider_reference, /^SIM-R-/);
          await browser.waitText('main', amount(refund.amount_cents));
          await command(admin, 'ApproveRefund', { id, shipping: false, detail: 'Duplicado' }, 'INVALID_TRANSITION');
          await command(admin, 'RecordInspection', {
            id, items: [{ id: line, quantity: 1, restock: 1, condition: 'SELLABLE' }],
          }, 'INVALID_TRANSITION');
        }
      }
      assert.equal((await row('SELECT stock_on_hand FROM public.product_variant WHERE id=$1', [variantId])).stock_on_hand, 4);
      await compareReports(browser, admin, sku);
      assert.deepEqual(browser.errors, []);
      assert.deepEqual(browser.requests.filter(request => /^https?:/.test(request) && new URL(request).hostname !== '127.0.0.1'), []);
    } finally {
      await browser.close();
    }
  });
}
