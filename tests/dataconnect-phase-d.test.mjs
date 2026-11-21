import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { deleteApp, initializeApp } from 'firebase/app';
import { applyActionCode, connectAuthEmulator, createUserWithEmailAndPassword, getAuth, sendEmailVerification } from 'firebase/auth';
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import * as account from '../src/dataconnect-generated/account/esm/index.esm.js';
import * as staff from '../src/dataconnect-generated/staff/esm/index.esm.js';
import * as storefront from '../src/dataconnect-generated/storefront/esm/index.esm.js';
import { applyLocalSql } from '../scripts/local-dataconnect.mjs';

const env = process.env;
const work = env.NEXATECH_PG18_WORK;
const project = env.NEXATECH_PG18_PROJECT;
const connectPort = Number(env.NEXATECH_PG18_CONNECT_PORT);
const authHost = `127.0.0.1:${env.NEXATECH_PG18_AUTH_PORT}`;
const connectHost = `127.0.0.1:${connectPort}`;
const service = 'nexatech-store';
const connection = new URL(env.FIREBASE_DATACONNECT_POSTGRESQL_STRING);
assert.match(project, /^demo-nexa-[\da-f]{12}$/);
assert.equal(env.GCLOUD_PROJECT, project);
assert.equal(env.FIREBASE_AUTH_EMULATOR_HOST, authHost);
assert.equal(env.FIREBASE_DATACONNECT_EMULATOR_HOST, connectHost);
assert.equal(connection.hostname, '127.0.0.1');
assert.equal(connection.pathname, '/fdcdb');
assert.match(connection.username, /^nexa_[\da-f]{32}$/);

const { Client } = createRequire(join(env.NEXATECH_FIREBASE_TOOLS_DIR, 'package.json'))('pg');
const clients = [];
const apps = [];
const serverOnly = { fetchPolicy: 'SERVER_ONLY' };
const runtime = 'nexa_phase_d_runtime';
let db;
let admin;

async function connect(user = connection.username, database = 'fdcdb') {
  const client = new Client({ host: '127.0.0.1', port: Number(connection.port), user, database,
    connectionTimeoutMillis: 5000, statement_timeout: 12000 });
  await client.connect();
  clients.push(client);
  return client;
}

const row = async (client, sql, params) => (await client.query(sql, params)).rows[0];
const rows = async (client, sql, params) => (await client.query(sql, params)).rows;
const scalar = async (client, sql, params) => Object.values(await row(client, sql, params))[0];

before(async () => {
  db = await connect();
  const version = await scalar(db, 'SHOW server_version_num');
  assert.equal(Math.floor(Number(version) / 10000), 18);
  const dataPath = await scalar(db, 'SHOW data_directory');
  assert.equal(dataPath.replaceAll('\\', '/'), join(work, 'pgdata').replaceAll('\\', '/'));
  await applyLocalSql(db);
  await db.query(`CREATE ROLE ${runtime} LOGIN;
    GRANT INSERT (uid, display_name) ON public.app_user TO ${runtime};
    GRANT SELECT (id, actor_uid, idempotency_key, result_id, result_code, status) ON public.commerce_command TO ${runtime};
    GRANT INSERT (actor_uid, idempotency_key, kind, input) ON public.commerce_command TO ${runtime}`);
});

after(async () => {
  await Promise.all(apps.map(deleteApp));
  await Promise.all(clients.map(client => client.end()));
});

function connectors(name) {
  const app = initializeApp({ projectId: project, apiKey: 'demo-key' }, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://' + authHost, { disableWarnings: true });
  const connections = Object.fromEntries(Object.entries({ account, staff, storefront }).map(([name, sdk]) => {
    const connector = getDataConnect(app, sdk.connectorConfig);
    connectDataConnectEmulator(connector, '127.0.0.1', connectPort);
    return [name, connector];
  }));
  return { auth, ...connections };
}

async function user(name, { verified = false, role } = {}) {
  const sdk = connectors(name);
  const email = name + '@nexatech.test';
  const { user: identity } = await createUserWithEmailAndPassword(sdk.auth, email, 'phase-d-' + randomUUID());
  if (verified) {
    await sendEmailVerification(identity);
    const response = await fetch(`http://${authHost}/emulator/v1/projects/${project}/oobCodes`);
    assert.ok(response.ok);
    const { oobCodes } = await response.json();
    await applyActionCode(sdk.auth, oobCodes.find(code => code.email === email).oobCode);
    await identity.reload();
    await identity.getIdToken(true);
  }
  await account.ensureProfile(sdk.account, { displayName: name });
  if (role) await db.query('INSERT INTO public.user_role(user_uid, role_code) VALUES ($1, $2)', [identity.uid, role]);
  return { ...sdk, uid: identity.uid, email };
}

async function command(actor, operation, args, expected = 'OK', connector = 'account') {
  const key = randomUUID();
  await operation(actor[connector], { key, ...args });
  const { data } = await account.getMyCommandResult(actor.account, { key }, serverOnly);
  assert.equal(data.commerceCommands.length, 1);
  const [result] = data.commerceCommands;
  assert.equal(result.resultCode, expected, JSON.stringify(result));
  assert.equal(result.status, ['OK', 'ORDER_CONFIRMED', 'PAYMENT_PENDING'].includes(expected) ? 'SUCCEEDED' : 'REJECTED');
  return result.resultId;
}

const staffCommand = (actor, operation, args, expected) => command(actor, operation, args, expected, 'staff');
const variant = sku => scalar(db, 'SELECT id FROM public.product_variant WHERE sku = $1', [sku]);
const stock = id => scalar(db, 'SELECT stock_on_hand FROM public.product_variant WHERE id = $1', [id]);

async function prepare(actor, variantId, { quantity = 1, couponCode } = {}) {
  const addressId = await command(actor, account.saveAddress, {
    label: 'Fase D', recipient: 'Cliente de prueba', phone: '0000000000', line1: 'Calle de ejemplo 1',
    district: 'Centro', city: 'Matamoros', stateCode: 'TAM', postalCode: '87300', primary: true,
  });
  const cartId = await command(actor, account.setCartItem, { variantId, quantity });
  const quote = async () => {
    const quoteId = await command(actor, account.quoteCheckout, { cartId, addressId, deliveryMethod: 'DEMO_PARCEL', couponCode });
    const { data } = await account.getMyQuote(actor.account, { id: quoteId }, serverOnly);
    return { quoteId, termsId: data.checkoutQuotes[0].summary.documents.TERMS, accepted: true, scenario: 'APPROVE' };
  };
  return { actor, cartId, input: await quote(), quote };
}

async function insertCommand(client, uid, kind, input, key = randomUUID()) {
  const { id } = await row(client, `INSERT INTO public.commerce_command(actor_uid, idempotency_key, kind, input)
    VALUES ($1, $2, $3, $4) RETURNING id`, [uid, key, kind, input]);
  return row(client, 'SELECT result_id, result_code, status FROM public.commerce_command WHERE id = $1', [id]);
}

function confirm(client, fixture, key, overrides) {
  return insertCommand(client, fixture.actor.uid, 'CONFIRM_CHECKOUT', { ...fixture.input, email: fixture.actor.email, ...overrides }, key);
}

async function race(firstAction, secondAction) {
  const first = await connect(runtime);
  const second = await connect(runtime);
  const [pidFirst, pidSecond] = await Promise.all([first, second].map(client => scalar(client, 'SELECT pg_backend_pid()')));
  await first.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  let secondResult;
  try {
    const result = await firstAction(first);
    secondResult = secondAction(second).then(value => ({ value }), error => ({ error }));
    let blocked = false;
    for (let attempt = 0; attempt < 80 && !blocked; attempt++) {
      blocked = await scalar(db, 'SELECT $1::int = ANY(pg_blocking_pids($2))', [pidFirst, pidSecond]);
      if (!blocked) await setTimeout(25);
    }
    assert.ok(blocked, 'The second backend must actually wait on the first transaction');
    await first.query('COMMIT');
    return [result, await secondResult];
  } finally {
    await first.query('ROLLBACK');
    await secondResult;
  }
}

test('DB-01–04: baseline, migrations, constraints, indexes and minimum SQL command privileges', async () => {
  const config = join(work, 'dataconnect');
  let operations = 0;
  for (const connector of ['storefront', 'account', 'staff']) {
    for (const file of (await readdir(join(config, connector))).filter(name => name.endsWith('.gql'))) {
      const source = await readFile(join(config, connector, file), 'utf8');
      operations += [...source.matchAll(/^(?:query|mutation)\s+\w+/gm)].length;
    }
  }
  assert.equal(operations, 80);
  assert.equal(await scalar(db, "SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public'"), 40);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM nexa_migrations.applied'), 5);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.product'), 18);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.inventory_movement'), 18);
  await applyLocalSql(db);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.inventory_movement'), 18);
  const catalog = await row(db, `SELECT
    (SELECT count(*)::int FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f') AS fks,
    (SELECT count(*)::int FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='c') AS checks,
    (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public') AS indexes,
    (SELECT count(*)::int FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='public'::regnamespace AND i.indpred IS NOT NULL) AS partial,
    (SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal) AS triggers`);
  console.log('PostgreSQL catalog:', JSON.stringify(catalog));
  assert.ok(catalog.fks > 0 && catalog.checks > 0 && catalog.indexes > 0 && catalog.triggers > 0);
  assert.equal(catalog.partial, 7);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM pg_constraint WHERE connamespace='public'::regnamespace
    AND (NOT convalidated OR (contype='f' AND confdeltype IN ('c','n')))`), 0);
  await assert.rejects(db.query('UPDATE public.product_variant SET stock_on_hand = -1'), { code: '23514', constraint: 'variant_valid' });
  await assert.rejects(db.query('UPDATE public.product SET category_id = gen_random_uuid()'), { code: '23503' });
  await assert.rejects(db.query("DELETE FROM public.category WHERE slug = 'audio'"), { code: '23001', constraint: 'product_category_id_fkey' });
  await assert.rejects(db.query('UPDATE public.product SET name = NULL'), { code: '23502' });
  await assert.rejects(db.query("INSERT INTO public.product_variant(product_id,tax_class_code,sku,option_label,unit_price_cents) SELECT product_id,tax_class_code,sku,'Duplicado',unit_price_cents FROM public.product_variant LIMIT 1"), { code: '23505' });
  await assert.rejects(db.query("UPDATE public.inventory_movement SET reason = 'Alterada'"), { code: '23514', message: 'IMMUTABLE_RECORD' });
  const sqlRole = await connect(runtime);
  await assert.rejects(sqlRole.query('SELECT nexa_internal.commerce_schema_ready()'), { code: '42501' });
  await assert.rejects(sqlRole.query('UPDATE public.product_variant SET stock_on_hand = 999'), { code: '42501' });
  await assert.rejects(sqlRole.query('SELECT * FROM public.return_evidence'), { code: '42501' });
  await assert.rejects(sqlRole.query('UPDATE public.commerce_command SET result_code = NULL'), { code: '42501' });
  const runtimeAudit = (await readFile(new URL('../scripts/runtime-audit.sql', import.meta.url), 'utf8'))
    .replaceAll(":'nexa_runtime'", '$1');
  assert.deepEqual(await rows(db, runtimeAudit, [runtime]), []);
  await db.query('BEGIN');
  try {
    await db.query(`GRANT UPDATE (stock_on_hand) ON public.product_variant TO ${runtime}`);
    const failures = await rows(db, runtimeAudit, [runtime]);
    assert.equal(failures.length, 1);
    assert.match(failures[0].issue, /product_variant/);
  } finally {
    await db.query('ROLLBACK');
  }
  const visitor = connectors('visitor');
  assert.equal((await storefront.listCatalog(visitor.storefront, { offset: 0 })).data.productVariants.length, 18);
  await assert.rejects(account.getMyProfile(visitor.account));
  admin = await user('admin', { verified: true, role: 'ADMIN' });
  assert.equal((await staff.listStaffCategories(admin.staff, { offset: 0 }, serverOnly)).data.staffCategories.length, 6);
  const verifiedCustomer = await user('category-visitor', { verified: true });
  assert.deepEqual((await staff.listStaffCategories(verifiedCustomer.staff, { offset: 0 }, serverOnly)).data.staffCategories, []);
  assert.deepEqual((await staff.listCustomers(verifiedCustomer.staff, { offset: 0 }, serverOnly)).data.staffCustomers, []);
});

const count = (table, client = db) => scalar(client, `SELECT count(*)::int FROM public.${table}`);

async function purchaseCounts(client = db) {
  const tables = ['customer_order', 'order_item', 'order_address', 'order_status_event', 'payment',
    'shipment', 'terms_acceptance', 'inventory_movement', 'coupon_redemption', 'notification', 'audit_log', 'commerce_command'];
  return Object.fromEntries(await Promise.all(tables.map(async table => [table, await count(table, client)])));
}

async function assertSinglePurchase(orderId, cartId, units = 1) {
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.customer_order WHERE cart_id = $1', [cartId]), 1);
  assert.deepEqual(await row(db, `SELECT p.status, p.provider, i.delta, (SELECT count(*)::int FROM public.terms_acceptance t
    WHERE t.order_id = o.id) AS terms FROM public.customer_order o JOIN public.payment p ON p.order_id = o.id
    JOIN public.order_item oi ON oi.order_id = o.id JOIN public.inventory_movement i ON i.order_item_id = oi.id
    WHERE o.id = $1 AND i.kind = 'SALE'`, [orderId]), { status: 'APPROVED', provider: 'SIMULATED', delta: -units, terms: 6 });
}

test('TX-01: two buyers contend for the last unit', async () => {
  const id = await variant('NX-AUPL-BK');
  await staffCommand(admin, staff.adjustInventory, { variantId: id, delta: 1 - await stock(id), reason: 'Última unidad de prueba' });
  const first = await prepare(await user('last-stock-a'), id);
  const second = await prepare(await user('last-stock-b'), id);
  const before = await purchaseCounts();
  const [winner, loser] = await race(client => confirm(client, first), client => confirm(client, second));
  assert.equal(winner.result_code, 'ORDER_CONFIRMED');
  assert.equal(loser.value?.result_code, 'STOCK_UNAVAILABLE');
  assert.equal(await stock(id), 0);
  await assertSinglePurchase(winner.result_id, first.cartId);
  assert.equal(await count('customer_order'), before.customer_order + 1);
  assert.equal(await count('payment'), before.payment + 1);
  assert.equal(await count('inventory_movement'), before.inventory_movement + 1);
});

test('TX-02: an identical idempotency key blocks a second payment and returns the original result', async () => {
  const id = await variant('NX-AUP-GR');
  const fixture = await prepare(await user('same-key'), id, { couponCode: 'DEMO10' });
  const before = await purchaseCounts();
  const key = randomUUID();
  const [winner, loser] = await race(client => confirm(client, fixture, key), client => confirm(client, fixture, key));
  assert.equal(winner.result_code, 'ORDER_CONFIRMED');
  assert.equal(loser.error?.code, '23505');
  const original = (await account.getMyCommandResult(fixture.actor.account, { key }, serverOnly)).data.commerceCommands[0];
  assert.equal(original.resultId.replaceAll('-', ''), winner.result_id.replaceAll('-', ''));
  await assert.rejects(confirm(await connect(runtime), fixture, key, { scenario: 'DECLINE' }), { code: '23505' });
  assert.deepEqual((await account.getMyCommandResult(fixture.actor.account, { key }, serverOnly)).data.commerceCommands[0], original);
  await assertSinglePurchase(winner.result_id, fixture.cartId);
  assert.equal(await count('customer_order'), before.customer_order + 1);
  assert.equal(await count('payment'), before.payment + 1);
  assert.equal(await count('inventory_movement'), before.inventory_movement + 1);
  assert.equal(await count('coupon_redemption'), before.coupon_redemption + 1);
});

test('TX-03: different keys and quotes cannot convert the same cart twice', async () => {
  const id = await variant('NX-AUB-WH');
  const fixture = await prepare(await user('same-cart'), id);
  const anotherQuote = await fixture.quote();
  assert.notEqual(anotherQuote.quoteId, fixture.input.quoteId);
  const [winner, loser] = await race(client => confirm(client, fixture), client => confirm(client, { ...fixture, input: anotherQuote }));
  assert.equal(winner.result_code, 'ORDER_CONFIRMED');
  assert.equal(loser.value?.result_code, 'CART_UNAVAILABLE');
  await assertSinglePurchase(winner.result_id, fixture.cartId);
  const duplicateOrder = `INSERT INTO public.customer_order SELECT (jsonb_populate_record(NULL::public.customer_order,
    to_jsonb(o) || jsonb_build_object('id', gen_random_uuid(), 'folio', 'NX-DUPLICATE', 'quote_id', $2::uuid))).*
    FROM public.customer_order o WHERE id = $1`;
  await assert.rejects(db.query(duplicateOrder, [winner.result_id, anotherQuote.quoteId]), { code: '23505' });
});

test('TX-04: two buyers with different SKUs contend for the final coupon use', async () => {
  const [firstId, secondId] = await Promise.all(['NX-SP-BK', 'NX-SD-GR'].map(variant));
  await staffCommand(admin, staff.saveCoupon, { code: 'FASED', kind: 'PERCENTAGE', bps: 1000, minimum: '0',
    startsAt: '2020-01-01T00:00:00Z', endsAt: '2100-01-01T00:00:00Z', maxUses: 1, maxPerUser: 1, archived: false });
  const first = await prepare(await user('last-coupon-a'), firstId, { couponCode: 'FASED' });
  const second = await prepare(await user('last-coupon-b'), secondId, { couponCode: 'FASED' });
  const untouched = await stock(secondId);
  const [winner, loser] = await race(client => confirm(client, first), client => confirm(client, second));
  assert.equal(winner.result_code, 'ORDER_CONFIRMED');
  assert.equal(loser.value?.result_code, 'COUPON_LIMIT');
  assert.equal(await stock(secondId), untouched);
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.coupon_redemption WHERE code_snapshot = 'FASED'"), 1);
  await assertSinglePurchase(winner.result_id, first.cartId);
});

test('PAY-04: a fault at payment insertion rolls back the whole checkout and permits retry with the same key', async () => {
  const id = await variant('NX-NL-SL');
  const fixture = await prepare(await user('fault-checkout'), id);
  const client = await connect(runtime);
  const before = await purchaseCounts();
  const available = await stock(id);
  const key = randomUUID();
  await db.query(`CREATE FUNCTION nexa_internal.phase_d_fault() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'phase D injected payment failure'; END $$;
    CREATE TRIGGER phase_d_fault BEFORE INSERT ON public.payment FOR EACH ROW EXECUTE FUNCTION nexa_internal.phase_d_fault()`);
  try {
    await assert.rejects(confirm(client, fixture, key), { code: 'P0001', message: 'phase D injected payment failure' });
    assert.deepEqual(await purchaseCounts(), before);
    assert.equal(await stock(id), available);
    assert.equal(await scalar(db, 'SELECT status FROM public.cart WHERE id = $1', [fixture.cartId]), 'ACTIVE');
  } finally {
    await db.query('DROP TRIGGER phase_d_fault ON public.payment; DROP FUNCTION nexa_internal.phase_d_fault()');
  }
  const retry = await confirm(client, fixture, key);
  assert.equal(retry.result_code, 'ORDER_CONFIRMED');
  await assertSinglePurchase(retry.result_id, fixture.cartId);
});

const requestInput = (orderId, kind, items) => ({ orderId, kind, items, reason: 'TEST', description: 'Caso académico de fase D' });
const refundInput = (id, shipping = false) => ({ id, shipping, detail: 'Reembolso simulado de fase D' });
const shipment = (orderId, event) => ({ orderId, event, carrier: 'Envío sintético', trackingCode: `D-${orderId.slice(0, 8)}` });
const orderState = id => scalar(db, 'SELECT status FROM public.customer_order WHERE id = $1', [id]);
const shipmentState = id => scalar(db, 'SELECT status FROM public.shipment WHERE order_id = $1', [id]);

async function acceptRequest(actor, id) {
  await staffCommand(actor, staff.assignCase, { id });
  await staffCommand(actor, staff.reviewReturnRequest, { id, state: 'APPROVED' });
}

test('POST-01–02: cancellation and dispatch contend for the same order in both directions', async () => {
  const id = await variant('NX-ARK-BK');
  for (const cancellationFirst of [true, false]) {
    const actor = await user(cancellationFirst ? 'cancel-first' : 'ship-first');
    const { input } = await prepare(actor, id);
    const opening = await stock(id);
    const orderId = await command(actor, account.confirmCheckout, input, 'ORDER_CONFIRMED');
    await staffCommand(admin, staff.recordShipmentEvent, shipment(orderId, 'SHIPPED'), 'INVALID_TRANSITION');
    await staffCommand(admin, staff.recordShipmentEvent, shipment(orderId, 'PREPARING'));
    const requestId = await command(actor, account.createReturnRequest, requestInput(orderId, 'CANCELLATION'));
    await acceptRequest(admin, requestId);
    const cancel = client => insertCommand(client, admin.uid, 'APPROVE_REFUND', refundInput(requestId));
    const ship = client => insertCommand(client, admin.uid, 'RECORD_SHIPMENT', shipment(orderId, 'SHIPPED'));
    const [winner, loser] = await race(cancellationFirst ? cancel : ship, cancellationFirst ? ship : cancel);
    assert.equal(winner.result_code, 'OK');
    assert.equal(loser.value?.result_code, cancellationFirst ? 'INVALID_TRANSITION' : 'CANCELLATION_UNAVAILABLE');
    const state = cancellationFirst ? 'CANCELLED' : 'SHIPPED';
    assert.equal(await orderState(orderId), state);
    assert.equal(await shipmentState(orderId), state);
    assert.equal(await stock(id), opening - Number(!cancellationFirst));
    assert.deepEqual(await row(db, `SELECT p.status, p.amount_cents, coalesce(sum(r.amount_cents),0)::bigint AS refunded
      FROM public.payment p LEFT JOIN public.refund r ON r.payment_id=p.id WHERE p.order_id=$1 GROUP BY p.id`, [orderId])
      .then(payment => [payment.status, payment.refunded === payment.amount_cents]),
    cancellationFirst ? ['REFUNDED', true] : ['APPROVED', false]);
    assert.deepEqual((await rows(db, 'SELECT new_status FROM public.order_status_event WHERE order_id=$1 ORDER BY created_at', [orderId]))
      .map(event => event.new_status), ['PAID', 'PREPARING', state]);
    await staffCommand(admin, staff.approveRefund, refundInput(requestId), 'CANCELLATION_UNAVAILABLE');
  }
});

let restorable;
test('POST-03–04 and AUTH: returns, simulated refunds, evidence, and customer/admin/support boundaries', async () => {
  const shopper = await user('return-owner');
  const other = await user('return-other', { verified: true });
  const support = await user('support', { verified: true, role: 'SUPPORT' });
  const otherSupport = await user('support-other', { verified: true, role: 'SUPPORT' });
  const id = await variant('NX-NC-BK');
  const { input } = await prepare(shopper, id, { quantity: 2 });
  const opening = await stock(id);
  const orderId = await command(shopper, account.confirmCheckout, input, 'ORDER_CONFIRMED');
  const part = await row(db, 'SELECT id, unit_price_cents, tax_cents FROM public.order_item WHERE order_id=$1', [orderId]);
  const request = requestInput(orderId, 'RETURN', [{ id: part.id, quantity: 1 }]);
  await command(shopper, account.createReturnRequest, request, 'RETURN_UNAVAILABLE');
  await command(other, account.createReturnRequest, request, 'ORDER_UNAVAILABLE');
  await assert.rejects(staff.listStaffOrders(shopper.staff, { offset: 0 }, serverOnly));
  assert.deepEqual((await staff.listStaffOrders(other.staff, { offset: 0 }, serverOnly)).data.staffOrders, []);
  assert.deepEqual((await account.getMyOrder(other.account, { id: orderId }, serverOnly)).data.customerOrders, []);
  assert.deepEqual((await staff.getStaffOrder(support.staff, { id: orderId }, serverOnly)).data.staffOrders, []);
  assert.equal((await staff.getStaffOrder(admin.staff, { id: orderId }, serverOnly)).data.staffOrders[0].order.id, orderId);
  await staffCommand(other, staff.changeUserRole, { uid: other.uid, role: 'ADMIN', enabled: true }, 'FORBIDDEN');
  await staffCommand(support, staff.adjustInventory, { variantId: id, delta: 1, reason: 'Denegado' }, 'FORBIDDEN');
  for (const event of ['PREPARING', 'SHIPPED', 'DELIVERY_ATTEMPT_FAILED', 'DELIVERED']) {
    await staffCommand(admin, staff.recordShipmentEvent, shipment(orderId, event));
  }
  assert.equal(await orderState(orderId), 'DELIVERED');
  assert.equal(await shipmentState(orderId), 'DELIVERED');
  assert.equal(await count('shipment_event') >= 4, true);

  const warrantyId = await command(shopper, account.createReturnRequest, { ...request, kind: 'WARRANTY' });
  await staffCommand(support, staff.assignCase, { id: warrantyId });
  await staffCommand(support, staff.reviewReturnRequest, { id: warrantyId, state: 'REJECTED', detail: 'Motivo académico' });
  const submitReturn = client => insertCommand(client, shopper.uid, 'CREATE_RETURN', { ...request, items: [{ id: part.id, quantity: 2 }] });
  const [accepted, refused] = await race(submitReturn, submitReturn);
  assert.equal(accepted.result_code, 'OK');
  assert.equal(refused.value?.result_code, 'RETURN_QUANTITY_UNAVAILABLE');
  // Release the two-unit commitment, then inspect and reimburse separate partial returns.
  await staffCommand(support, staff.assignCase, { id: accepted.result_id });
  await staffCommand(support, staff.reviewReturnRequest, { id: accepted.result_id, state: 'REJECTED', detail: 'Caso de contención' });

  for (const last of [false, true]) {
    const requestId = await command(shopper, account.createReturnRequest, request);
    if (!last) {
      assert.ok((await staff.listSupportQueue(support.staff, { offset: 0 }, serverOnly)).data.staffQueueEntries.some(entry => entry.id === requestId));
      assert.deepEqual((await staff.getStaffReturnRequest(support.staff, { id: requestId }, serverOnly)).data.staffReturnCases, []);
      const invalid = { id: requestId, media: 'image/png', content: Buffer.from('not an image').toString('base64') };
      await command(shopper, account.uploadReturnEvidence, invalid, 'INVALID_EVIDENCE');
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP7sAAAAASUVORK5CYII=';
      const evidenceId = await command(shopper, account.uploadReturnEvidence, { ...invalid, content: png });
      assert.equal((await account.getMyReturnEvidence(shopper.account, { id: evidenceId }, serverOnly)).data.returnEvidences[0].contentB64, png);
      assert.deepEqual((await account.getMyReturnEvidence(other.account, { id: evidenceId }, serverOnly)).data.returnEvidences, []);
      await staffCommand(other, staff.assignCase, { id: requestId }, 'FORBIDDEN');
      await staffCommand(support, staff.assignCase, { id: requestId, assignedTo: otherSupport.uid }, 'FORBIDDEN');
      await acceptRequest(support, requestId);
      assert.equal((await staff.getStaffReturnEvidence(support.staff, { requestId, id: evidenceId }, serverOnly))
        .data.staffReturnCases[0].request.returnEvidences_on_request[0].contentB64, png);
      assert.deepEqual((await staff.getStaffReturnEvidence(otherSupport.staff, { requestId, id: evidenceId }, serverOnly)).data.staffReturnCases, []);
      await staffCommand(otherSupport, staff.reviewReturnRequest, { id: requestId, state: 'AWAITING_ITEM' }, 'RETURN_UNAVAILABLE');
    } else {
      await acceptRequest(support, requestId);
    }
    await staffCommand(support, staff.reviewReturnRequest, { id: requestId, state: 'AWAITING_ITEM' });
    const returnItemId = await scalar(db, 'SELECT id FROM public.return_item WHERE return_request_id=$1', [requestId]);
    const inspection = { id: requestId, items: [{ id: returnItemId, quantity: 1, restock: 1, condition: 'SELLABLE' }] };
    await staffCommand(support, staff.recordInspection, inspection, 'INVENTORY_ADMIN_REQUIRED');
    assert.equal(await scalar(db, 'SELECT received_qty FROM public.return_item WHERE id=$1', [returnItemId]), 0);
    await staffCommand(admin, staff.recordInspection, inspection);
    await staffCommand(support, staff.approveRefund, refundInput(requestId), 'FORBIDDEN');
    const reimburse = client => insertCommand(client, admin.uid, 'APPROVE_REFUND', refundInput(requestId, last));
    const [success, duplicate] = await race(reimburse, reimburse);
    assert.equal(success.result_code, 'OK');
    assert.equal(duplicate.value?.result_code, 'INVALID_TRANSITION');
    assert.equal(await scalar(db, 'SELECT status FROM public.return_request WHERE id=$1', [requestId]), 'RESOLVED');
    if (!last) {
      assert.equal(await orderState(orderId), 'DELIVERED');
      assert.equal(await scalar(db, 'SELECT amount_cents FROM public.refund WHERE id=$1', [success.result_id]),
        String(BigInt(part.unit_price_cents) + (BigInt(part.tax_cents) + 1n) / 2n));
    }
  }
  assert.equal(await orderState(orderId), 'REFUNDED');
  assert.equal(await stock(id), opening);
  const reconciliation = await row(db, `SELECT p.status, p.amount_cents, sum(r.amount_cents)::bigint AS total, count(*)::int AS refunds,
    bool_and(r.provider_reference LIKE 'SIM-R-%') AS simulated FROM public.payment p JOIN public.refund r ON r.payment_id=p.id
    WHERE p.order_id=$1 GROUP BY p.id`, [orderId]);
  assert.deepEqual(reconciliation, { status: 'REFUNDED', amount_cents: reconciliation.total, total: reconciliation.total, refunds: 2, simulated: true });
  await staffCommand(admin, staff.changeUserRole, { uid: support.uid, role: 'SUPPORT', enabled: false });
  assert.deepEqual((await staff.getStaffReturnRequest(support.staff, { id: warrantyId }, serverOnly)).data.staffReturnCases, []);
  await staffCommand(support, staff.assignCase, { id: warrantyId }, 'FORBIDDEN');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.product_variant v WHERE stock_on_hand <> (
    SELECT coalesce(sum(delta),0) FROM public.inventory_movement m WHERE m.variant_id=v.id)`), 0);
  restorable = { shopper, orderId };
});

const quoteIdent = name => '"' + name.replaceAll('"', '""') + '"';

async function schemaSnapshot(client) {
  return rows(client, `SELECT c.relname AS target, con.conname AS name, con.contype::text AS kind,
    pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
    WHERE c.relnamespace='public'::regnamespace
    UNION ALL
    SELECT tablename, indexname, CASE WHEN i.indpred IS NULL THEN 'index' ELSE 'partial' END, indexdef
    FROM pg_indexes JOIN pg_class c ON c.relname=indexname AND c.relnamespace='public'::regnamespace
    JOIN pg_index i ON i.indexrelid=c.oid WHERE schemaname='public'
    UNION ALL
    SELECT c.relname, tgname, 'trigger', pg_get_triggerdef(t.oid) || ' ' || t.tgenabled::text
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT tgisinternal
    UNION ALL
    SELECT 'nexa_internal', p.oid::regprocedure::text, 'routine', pg_get_functiondef(p.oid)
    FROM pg_proc p WHERE pronamespace='nexa_internal'::regnamespace
    ORDER BY 1,2,3`);
}

async function releaseSchemaSnapshot(client) {
  const source = await readFile(new URL('../scripts/schema-audit.sql', import.meta.url), 'utf8');
  const results = await client.query(source);
  return results.find(result => result.command === 'SELECT').rows.map(row => row.entry);
}

async function dataSnapshot(client, omitProbe = false) {
  const tables = await rows(client, `SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname IN ('public', 'nexa_migrations') ORDER BY 1,2`);
  return Object.fromEntries(await Promise.all(tables.map(async ({ schemaname, tablename }) => {
    const table = quoteIdent(schemaname) + '.' + quoteIdent(tablename);
    const document = omitProbe && table === '"public"."tax_class"' ? "(to_jsonb(t) - 'phase_d_probe')" : 'to_jsonb(t)';
    const contents = await scalar(client, `SELECT coalesce(jsonb_agg(${document} ORDER BY ${document}::text COLLATE "C"), '[]')::text FROM ${table} t`);
    return [table, createHash('sha256').update(contents).digest('hex')];
  })));
}

function pgTool(name, args) {
  const extension = process.platform === 'win32' ? '.exe' : '';
  const endpoint = ['-h', '127.0.0.1', '-p', connection.port, '-U', connection.username];
  execFileSync(join(env.NEXATECH_PG_BIN, name + extension), [...endpoint, ...args], { stdio: 'inherit' });
}

const objectKey = ({ target, name, kind }) => JSON.stringify([target, name, kind]);

async function assertSchema(client, expected) {
  const actual = await schemaSnapshot(client);
  assert.deepEqual(actual.map(objectKey), expected.map(objectKey));
  for (const [index, object] of expected.entries()) {
    const definition = actual[index].definition;
    if (object.kind === 'c' && definition !== object.definition) {
      // A CHECK written with BETWEEN can deparse to nested ANDs that PostgreSQL flattens when re-parsed.
      await client.query(`CREATE TEMP TABLE phase_d_normalize (LIKE public.${quoteIdent(object.target)})`);
      try {
        await client.query(`ALTER TABLE pg_temp.phase_d_normalize ADD CONSTRAINT phase_d_check ${object.definition}`);
        const reparsed = await scalar(client, `SELECT pg_get_constraintdef(oid) FROM pg_constraint
          WHERE conrelid='pg_temp.phase_d_normalize'::regclass AND conname='phase_d_check'`);
        assert.equal(definition, reparsed, objectKey(object));
      } finally {
        await client.query('DROP TABLE pg_temp.phase_d_normalize');
      }
    } else {
      assert.equal(definition, object.definition, objectKey(object));
    }
  }
}

async function restoreSupplementalDdl(client, expected) {
  const current = new Map((await schemaSnapshot(client)).map(object => [objectKey(object), object]));
  const changed = expected.filter(object => current.get(objectKey(object))?.definition !== object.definition);
  const counts = Object.fromEntries(['c', 'f', 'partial'].map(kind => [kind, changed.filter(object => object.kind === kind).length]));
  console.log('Supplemental DDL to reapply:', JSON.stringify(counts));
  await client.query('BEGIN');
  try {
    for (const object of changed) {
      const exists = current.has(objectKey(object));
      const table = 'public.' + quoteIdent(object.target);
      const name = quoteIdent(object.name);
      assert.ok(['c', 'f', 'partial'].includes(object.kind), `Unexpected schema drift: ${objectKey(object)}`);
      if (object.kind === 'partial') {
        if (exists) await client.query(`DROP INDEX public.${name}`);
        await client.query(object.definition);
      } else {
        if (exists) await client.query(`ALTER TABLE ${table} DROP CONSTRAINT ${name}`);
        await client.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} ${object.definition}`);
      }
    }
    await assertSchema(client, expected);
    assert.equal(await scalar(client, 'SELECT nexa_internal.commerce_schema_ready()'), true);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  return changed.length;
}

test('DB-04: GraphQL schema reload, fail-closed drift, and transactional recovery of supplemental DDL', async () => {
  const before = await schemaSnapshot(db);
  const baseline = await dataSnapshot(db);
  const releaseBefore = await releaseSchemaSnapshot(db);
  assert.equal(releaseBefore.filter(entry => entry.startsWith('["table", "public",')).length, 40);
  if (env.NEXATECH_G1_SCHEMA_REFERENCE) {
    await writeFile(env.NEXATECH_G1_SCHEMA_REFERENCE, releaseBefore.join('\n') + '\n', { flag: 'wx' });
  }
  await db.query('ALTER TABLE public.commerce_command DISABLE TRIGGER handle_commerce_command');
  try {
    const disabled = await releaseSchemaSnapshot(db);
    const key = '["trigger", "public", "commerce_command", "handle_commerce_command",';
    assert.notEqual(disabled.find(entry => entry.startsWith(key)), releaseBefore.find(entry => entry.startsWith(key)));
  } finally {
    await db.query('ALTER TABLE public.commerce_command ENABLE TRIGGER handle_commerce_command');
  }
  assert.deepEqual(await releaseSchemaSnapshot(db), releaseBefore);
  const path = join(work, 'dataconnect', 'schema', 'schema.gql');
  const source = await readFile(path, 'utf8');
  const updated = source.replace(/type TaxClass[^\n]*\{\r?\n/, '$&  phaseDProbe: String\n');
  assert.notEqual(updated, source);
  const reloadCount = async () => [...(await readFile(join(work, 'dataconnect-debug.log'), 'utf8')).matchAll(/Finished reloading/g)].length;
  const originalReloads = await reloadCount();
  await writeFile(path, updated);
  for (let attempt = 0; attempt < 300 && await reloadCount() === originalReloads; attempt++) {
    await setTimeout(100);
  }
  assert.ok(await reloadCount() > originalReloads, 'Wait for all generated migrations to finish before comparing catalogs');
  const definition = await row(db, `SELECT data_type,is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tax_class' AND column_name='phase_d_probe'`);
  assert.deepEqual(definition, { data_type: 'text', is_nullable: 'YES' });
  assert.deepEqual(await dataSnapshot(db, true), baseline);
  const releaseAfter = await releaseSchemaSnapshot(db);
  const releaseAfterSet = new Set(releaseAfter);
  assert.equal(releaseBefore.filter(entry => !releaseAfterSet.has(entry) &&
    (entry.startsWith('["constraint",') || entry.startsWith('["index",'))).length, 111);
  const ready = await scalar(db, 'SELECT nexa_internal.commerce_schema_ready()');
  if (!ready) await command(admin, account.updateMyProfile, { name: 'Blocked by schema drift' }, 'SCHEMA_INCOMPLETE');
  const repaired = await restoreSupplementalDdl(db, before);
  console.log(`Schema reload: guard before reapplication=${ready}; objects recovered=${repaired}`);
  await command(admin, account.updateMyProfile, { name: 'Admin after schema update' });
  await assert.rejects(db.query('UPDATE public.product_variant SET stock_on_hand=-1'), { code: '23514' });
  await assert.rejects(db.query("DELETE FROM public.category WHERE slug='audio'"), { code: '23001' });
});

test('REC-01: custom-format backup, full comparison, and a new checkout on the restored database', async () => {
  assert.ok(restorable, 'A completed post-sale fixture is required for restore');
  const { shopper, orderId } = restorable;
  const [schema, data] = await Promise.all([schemaSnapshot(db), dataSnapshot(db)]);
  const backup = join(work, 'phase-d.dump');
  const started = performance.now();
  pgTool('pg_dump', ['-Fc', '-f', backup, 'fdcdb']);
  pgTool('createdb', ['fdcdb_restore']);
  pgTool('pg_restore', ['--exit-on-error', '--single-transaction', '-d', 'fdcdb_restore', backup]);
  console.log(`Backup and restore completed in ${((performance.now() - started) / 1000).toFixed(2)} s`);
  const restored = await connect(connection.username, 'fdcdb_restore');
  await assertSchema(restored, schema);
  assert.deepEqual(await dataSnapshot(restored), data);
  assert.equal(await scalar(restored, 'SELECT nexa_internal.commerce_schema_ready()'), true);
  await assert.rejects(restored.query('UPDATE public.product_variant SET stock_on_hand = -1'), { code: '23514' });
  const restoredRole = await connect(runtime, 'fdcdb_restore');
  await assert.rejects(restoredRole.query('SELECT * FROM public.return_evidence'), { code: '42501' });
  const purchase = await row(restored, 'SELECT folio, status, user_uid FROM public.customer_order WHERE id=$1', [orderId]);
  assert.equal(purchase.status, 'REFUNDED');
  assert.equal(purchase.user_uid, shopper.uid);
  // Keep the same synthetic Auth identities while pointing the connector to the restored database.
  const restoreConnection = new URL(connection);
  restoreConnection.pathname = '/fdcdb_restore';
  const response = await fetch(`http://${connectHost}/emulator/configure`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionString: restoreConnection.href, database: 'fdcdb_restore', serviceId: service }),
    signal: AbortSignal.timeout(10000),
  });
  assert.ok(response.ok, await response.text());
  await restoreSupplementalDdl(restored, schema);
  const visible = (await account.getMyOrder(shopper.account, { id: orderId }, serverOnly)).data.customerOrders[0];
  assert.equal(visible.folio, purchase.folio);
  assert.equal(visible.status, 'REFUNDED');
  const restoredBuyer = await prepare(shopper, await variant('NX-NOP-BK'));
  const recovered = await confirm(restoredRole, restoredBuyer);
  assert.equal(recovered.result_code, 'ORDER_CONFIRMED');
  assert.equal(await scalar(restored, 'SELECT count(*)::int FROM public.customer_order WHERE id=$1', [recovered.result_id]), 1);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.customer_order WHERE id=$1', [recovered.result_id]), 0);
});
