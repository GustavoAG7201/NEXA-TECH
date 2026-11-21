import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { after, before, test } from 'node:test';
import { bootstrapFirstAdmin } from '../server/auth.mjs';
import { createPool } from '../server/db.mjs';
import { queries } from '../server/queries.mjs';
import { identity, operation, post, startStandalone } from './helpers/standalone.mjs';

const messages = [];
const smtp = createServer(socket => {
  socket.setEncoding('utf8');
  socket.write('220 localhost SMTP de pruebas\r\n');
  let buffer = '';
  let contents = null;
  socket.on('data', chunk => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\r\n')) !== -1) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (contents !== null) {
        if (line === '.') {
          messages.push(contents);
          contents = null;
          socket.write('250 Capturado\r\n');
        } else contents += line + '\r\n';
      } else if (line === 'DATA') {
        contents = '';
        socket.write('354 Introduzca mensaje\r\n');
      } else if (line === 'QUIT') {
        socket.end('221 Cerrado\r\n');
      } else socket.write('250 OK\r\n');
    }
  });
});
let store;
const password = 'prueba-' + randomUUID();
const backup = process.env.NEXATECH_TEST_BACKUP;
before(async () => {
  await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
  store = await startStandalone('api', backup, {
    SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.address().port), SMTP_FROM: 'prueba@nexatech.test',
    SMTP_REQUIRE_TLS: 'false', SMTP_USER: '', SMTP_PASSWORD: '',
  });
});
after(async () => {
  await store?.close();
  await new Promise(resolve => smtp.close(resolve));
});

const actorFor = (response, origin = store.origin) => ({
  origin, uid: response.data.user.uid, cookie: response.cookie.split(';')[0],
});
const auth = (name, body, actor) => post(store.origin, 'auth/' + name, body, actor);
const command = (name, actor, data) => operation(name, actor, { key: randomUUID(), ...data });
const lastMailToken = address => {
  assert.match(messages.at(-1), new RegExp(address.replaceAll('.', '\\.')));
  const match = /#([a-f0-9]{64})/.exec(messages.at(-1).replaceAll('=\r\n', ''));
  assert.ok(match, 'Enlace de un solo uso en SMTP local');
  return match[1];
};

test('SQL compilado con rol restringido y catálogo de 153 productos' + (backup ? ' restaurado' : ''), async () => {
  const pool = createPool(store.env.DATABASE_URL);
  try {
    for (const [name, query] of Object.entries(queries)) {
      await assert.doesNotReject(pool.query('EXPLAIN ' + query.sql, query.params.map(() => null)), name);
    }
    const publicActor = { origin: store.origin };
    const products = [];
    for (let offset = 0, page; ; offset += 30) {
      page = (await operation('ListCatalog', publicActor, { offset })).productVariants;
      products.push(...page.map(item => item.product.id));
      if (page.length < 30) break;
    }
    assert.equal(new Set(products).size, 153);
    if (backup) {
      for (const name of ['public.app_user', 'public.address', 'public.commerce_command', 'public.customer_order',
        'nexa_auth.identity', 'nexa_auth.session', 'nexa_auth.email_token', 'nexa_auth.rate_limit']) {
        assert.equal((await store.db.query('SELECT count(*) FROM ' + name)).rows[0].count, '0');
      }
    }
    await assert.rejects(pool.query('UPDATE public.product_variant SET stock_on_hand = 0'), { code: '42501' });
    await assert.rejects(pool.query('SELECT nexa_internal.commerce_schema_ready()'), { code: '42501' });
  } finally {
    await pool.end();
  }
});

test('Registro, CSRF, límite persistido, roles, verificación y recuperación SMTP', async () => {
  const email = 'usuario@nexatech.test';
  const newPassword = 'nueva-' + randomUUID();
  await assert.rejects(post(store.origin, 'auth/register', {}, null, { Origin: 'https://otro.example' }),
    { status: 403, code: 'CSRF' });
  const registration = await auth('register', { email, password, name: 'Usuario de prueba', role: 'ADMIN' });
  assert.match(registration.cookie, /; HttpOnly; SameSite=Lax;/);
  const customer = actorFor(registration);
  assert.deepEqual((await operation('GetMyProfile', customer)).appUsers[0].userRoles_on_user, [{ roleCode: 'CUSTOMER' }]);
  await assert.rejects(operation('ListCustomers', customer, { offset: 0 }), { status: 403 });
  await assert.rejects(operation('GetMyCart', { ...customer, uid: randomUUID() }), { code: 'SESSION_CHANGED' });
  await auth('request-verification', {}, customer);
  const verify = lastMailToken(email);
  await auth('verify', { token: verify });
  await assert.rejects(auth('verify', { token: verify }), { code: 'INVALID_TOKEN' });
  const getSession = cookie => fetch(store.origin + '/api/auth/session', { headers: { cookie } }).then(res => res.json());
  assert.equal((await getSession(customer.cookie)).user.emailVerified, true);
  await auth('request-reset', { email });
  const reset = lastMailToken(email);
  await auth('reset', { token: reset, password: newPassword });
  await assert.rejects(auth('reset', { token: reset, password: newPassword }), { code: 'INVALID_TOKEN' });
  assert.equal((await getSession(customer.cookie)).user, null);
  await assert.rejects(auth('login', { email, password }), { status: 401 });
  const signedIn = actorFor(await auth('login', { email, password: newPassword }));
  assert.equal(signedIn.uid, customer.uid);
  await auth('logout', {}, signedIn);
  assert.equal((await getSession(signedIn.cookie)).user, null);

  for (let attempt = 0; attempt < 8; attempt++) {
    await assert.rejects(auth('login', { email: 'inexistente@nexatech.test', password }), { status: 401 });
  }
  await store.stopApi();
  await store.startApi();
  await assert.rejects(auth('login', { email: 'inexistente@nexatech.test', password }), { status: 429 });

  const owner = createPool(store.env.NEXATECH_OWNER_URL);
  const adminEmail = 'admin@nexatech.test';
  try {
    await assert.rejects(bootstrapFirstAdmin(owner, email, password, 'Cuenta existente'), { code: 'EMAIL_IN_USE' });
    await bootstrapFirstAdmin(owner, adminEmail, password, 'Primera administración');
    await assert.rejects(bootstrapFirstAdmin(owner, 'otro-admin@nexatech.test', password, 'Segundo acceso'), { code: 'ADMIN_EXISTS' });
  } finally {
    await owner.end();
  }
  const admin = actorFor(await auth('login', { email: adminEmail, password }));
  assert.equal((await operation('ListCustomers', admin, { offset: 0 })).staffCustomers.length, 2);
  assert.equal((await command('ChangeUserRole', admin, { uid: customer.uid, role: 'SUPPORT', enabled: true })).resultCode, 'OK');
  const support = actorFor(await auth('login', { email, password: newPassword }));
  assert.deepEqual((await operation('ListSupportQueue', support, { offset: 0 })).staffQueueEntries, []);
  assert.equal((await command('ChangeUserRole', admin, { uid: customer.uid, role: 'SUPPORT', enabled: false })).resultCode, 'OK');
  await assert.rejects(operation('ListSupportQueue', support, { offset: 0 }), { status: 403 });
});

test('Compra en base de prueba y persistencia después de reiniciar la API' + (backup ? ' tras restaurar' : ''), async () => {
  const buyer = await identity(store, 'compra@nexatech.test', password, 'Compra de prueba');
  const { rows: [variant] } = await store.db.query('SELECT id, product_id, stock_on_hand FROM public.product_variant WHERE stock_on_hand > 1 LIMIT 1');
  const address = await command('SaveAddress', buyer, {
    label: 'Casa', recipient: 'Comprador ficticio', phone: '8681234567', line1: 'Calle de prueba 123',
    district: 'Centro', city: 'Matamoros', stateCode: 'TAM', postalCode: '87300', primary: true,
  });
  assert.equal(address.resultCode, 'OK');
  const favorite = { productId: variant.product_id, enabled: true };
  assert.equal((await command('SetFavorite', buyer, favorite)).resultCode, 'OK');
  const cart = await command('SetCartItem', buyer, { variantId: variant.id, quantity: 1 });
  assert.equal(cart.resultCode, 'OK');
  await store.stopApi();
  await store.startApi();
  assert.equal((await operation('GetMyCart', buyer)).carts[0].cartItems_on_cart[0].quantity, 1);
  assert.equal((await operation('ListMyFavorites', buyer, { offset: 0 })).favorites[0].productId, favorite.productId);
  const quote = await command('QuoteCheckout', buyer, {
    cartId: cart.resultId, addressId: address.resultId, deliveryMethod: 'DEMO_PARCEL', couponCode: 'DEMO10',
  });
  assert.equal(quote.resultCode, 'OK');
  const { checkoutQuotes: [pricing] } = await operation('GetMyQuote', buyer, { id: quote.resultId });
  const input = { key: randomUUID(), quoteId: quote.resultId, termsId: pricing.summary.documents.TERMS,
    accepted: true, scenario: 'APPROVE', email: 'impostor@nexatech.test', totalCents: 1 };
  const [first, replay] = await Promise.all([operation('ConfirmCheckout', buyer, input), operation('ConfirmCheckout', buyer, input)]);
  assert.equal(first.resultCode, 'ORDER_CONFIRMED');
  assert.equal(first.resultId, replay.resultId);
  await assert.rejects(operation('ConfirmCheckout', buyer, { ...input, accepted: false }), { code: 'IDEMPOTENCY_CONFLICT' });
  const { customerOrders: [order] } = await operation('GetMyOrder', buyer, { id: first.resultId });
  assert.equal(order.contactEmail, buyer.email);
  assert.equal(order.payment_on_order.status, 'APPROVED');
  assert.ok(BigInt(order.discountCents) > 0n);
  assert.equal(order.totalCents, String(pricing.summary.totalCents));
  const { rows: [stock] } = await store.db.query(`
    SELECT v.stock_on_hand, (SELECT count(*) FROM public.inventory_movement WHERE variant_id = v.id AND kind = 'SALE') AS sales
    FROM public.product_variant v WHERE v.id = $1`, [variant.id]);
  assert.deepEqual(stock, { stock_on_hand: variant.stock_on_hand - 1, sales: '1' });
});
