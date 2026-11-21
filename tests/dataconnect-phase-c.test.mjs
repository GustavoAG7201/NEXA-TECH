import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import { applyActionCode, connectAuthEmulator, createUserWithEmailAndPassword, getAuth, sendEmailVerification } from 'firebase/auth';
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import * as account from '../src/dataconnect-generated/account/esm/index.esm.js';
import * as staff from '../src/dataconnect-generated/staff/esm/index.esm.js';
import * as storefront from '../src/dataconnect-generated/storefront/esm/index.esm.js';
import { applyLocalSql, authOrigin, connectLocalDatabase, demoProject, sqlConnectHost, sqlConnectPort } from '../scripts/local-dataconnect.mjs';

let db;
const apps = [];
const serverOnly = { fetchPolicy: 'SERVER_ONLY' };

before(async () => {
  db = await connectLocalDatabase();
  await applyLocalSql(db);
});

after(async () => {
  await Promise.all(apps.map(deleteApp));
  await db?.end();
});

function createClients(name) {
  const app = initializeApp({ projectId: demoProject, apiKey: 'demo-key' }, name);
  apps.push(app);

  const auth = getAuth(app);
  connectAuthEmulator(auth, authOrigin, { disableWarnings: true });
  const connectors = Object.fromEntries(Object.entries({ account, staff, storefront }).map(([id, sdk]) => {
    const connector = getDataConnect(app, sdk.connectorConfig);
    connectDataConnectEmulator(connector, sqlConnectHost, sqlConnectPort);
    return [id, connector];
  }));
  return { auth, ...connectors };
}

async function newUser(name, verified = false) {
  const client = createClients(name);
  const email = name + '@nexatech.test';
  const { user } = await createUserWithEmailAndPassword(client.auth, email, 'local-fixture-' + randomUUID());
  if (verified) {
    await sendEmailVerification(user);
    const response = await fetch(authOrigin + '/emulator/v1/projects/' + demoProject + '/oobCodes');
    const { oobCodes } = await response.json();
    await applyActionCode(client.auth, oobCodes.find(code => code.email === email).oobCode);
    await user.reload();
    await user.getIdToken(true);
  }
  await account.ensureProfile(client.account, { displayName: name });
  return { ...client, uid: user.uid };
}

async function command(client, operation, parameters, useStaff = false, key = randomUUID()) {
  const response = await operation(useStaff ? client.staff : client.account, { key, ...parameters });
  assert.ok(response.data.commerceCommand_insert.id);
  const result = await account.getMyCommandResult(client.account, { key }, serverOnly);
  assert.equal(result.data.commerceCommands.length, 1);
  return result.data.commerceCommands[0];
}

async function success(client, operation, parameters, useStaff = false) {
  const result = await command(client, operation, parameters, useStaff);
  assert.equal(result.status, 'SUCCEEDED', JSON.stringify(result));
  return result.resultId;
}

const addressInput = {
  label: 'Casa de demostración', recipient: 'Cliente de prueba', phone: '0000000000',
  line1: 'Calle de ejemplo 1', district: 'Centro', city: 'Matamoros', stateCode: 'TAM', postalCode: '87300', primary: true,
};

async function prepareQuote(client, variantId, addressId, couponCode) {
  const cartId = await success(client, account.setCartItem, { variantId, quantity: 1 });
  const quoteId = await success(client, account.quoteCheckout, { cartId, addressId, deliveryMethod: 'DEMO_PARCEL', couponCode });
  const { data } = await account.getMyQuote(client.account, { id: quoteId }, serverOnly);
  assert.equal(data.checkoutQuotes.length, 1);
  const { summary } = data.checkoutQuotes[0];
  return { quoteId, summary, termsId: summary.documents.TERMS };
}

test('schema, seed and public catalog over the generated SDK', async () => {
  const { rows: [schema] } = await db.query("SELECT count(*)::int AS tables FROM pg_tables WHERE schemaname = 'public'");
  assert.equal(schema.tables, 40);
  const { rows: [version] } = await db.query('SHOW server_version');
  console.log('Local engine version: ' + version.server_version);

  const visitor = createClients('visitor');
  const { data: { categories } } = await storefront.listCategories(visitor.storefront);
  assert.equal(categories.length, 6);
  const { data: { productVariants } } = await storefront.listCatalog(visitor.storefront, { offset: 0 });
  assert.equal(productVariants.length, 18);
  const audio = categories.find(category => category.slug === 'audio');
  const { data: filtered } = await storefront.listCatalog(visitor.storefront, { categoryId: audio.id, search: 'Auralis', offset: 0 });
  assert.equal(filtered.productVariants.length, 3);
  assert.equal((await storefront.getPublishedPolicies(visitor.storefront)).data.legalDocuments.length, 6);
  await assert.rejects(account.getMyProfile(visitor.account));

  await assert.rejects(db.query(
    "INSERT INTO public.product_variant(product_id, tax_class_code, sku, option_label, unit_price_cents) SELECT product_id, tax_class_code, sku, 'Duplicate SKU', unit_price_cents FROM public.product_variant LIMIT 1"
  ), { code: '23505' });
  await assert.rejects(db.query('UPDATE public.product_variant SET stock_on_hand = -1'), { code: '23514' });
  const { rows: [foreignKeys] } = await db.query(
    "SELECT count(*)::int AS cascading FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype = 'f' AND confdeltype IN ('c','n')"
  );
  assert.equal(foreignKeys.cascading, 0);
});

test('customer checkout, idempotency, ownership, staff authorization and cancellation', async () => {
  const shopper = await newUser('shopper', true);
  const second = await newUser('second');
  const admin = await newUser('admin', true);
  await db.query("INSERT INTO public.user_role(user_uid, role_code) VALUES ($1, 'ADMIN')", [admin.uid]);
  const { data: { productVariants: [product] } } = await storefront.listCatalog(shopper.storefront, { search: 'Auralis Play', offset: 0 });
  const addressId = await success(shopper, account.saveAddress, addressInput);
  assert.deepEqual((await account.listMyAddresses(second.account)).data.addresses, []);
  const quote = await prepareQuote(shopper, product.id, addressId, 'DEMO10');
  assert.equal(quote.summary.totalCents, '84460');
  assert.equal(quote.summary.discountCents, '6990');
  const refused = await command(second, account.confirmCheckout, { quoteId: quote.quoteId, termsId: quote.termsId, accepted: true, scenario: 'APPROVE' });
  assert.equal(refused.resultCode, 'QUOTE_UNAVAILABLE');
  const missingTerms = await command(shopper, account.confirmCheckout, { quoteId: quote.quoteId, termsId: quote.termsId, accepted: false, scenario: 'APPROVE' });
  assert.equal(missingTerms.resultCode, 'TERMS_REQUIRED');
  const key = randomUUID();
  const payment = { quoteId: quote.quoteId, termsId: quote.termsId, accepted: true, scenario: 'APPROVE' };
  const committed = await command(shopper, account.confirmCheckout, payment, false, key);
  assert.equal(committed.resultCode, 'ORDER_CONFIRMED', JSON.stringify(committed));
  const orderId = committed.resultId;
  await assert.rejects(account.confirmCheckout(shopper.account, { key, ...payment }));
  const original = await account.getMyCommandResult(shopper.account, { key }, serverOnly);
  assert.equal(original.data.commerceCommands[0].resultId, orderId);
  const duplicate = await command(shopper, account.confirmCheckout, payment);
  assert.equal(duplicate.resultCode, 'CART_UNAVAILABLE');

  const { data: { customerOrders: [order] } } = await account.getMyOrder(shopper.account, { id: orderId }, serverOnly);
  assert.equal(order.status, 'PAID');
  assert.equal(order.totalCents, '84460');
  assert.equal(order.termsAcceptances_on_order.filter(row => row.evidenceKind === 'ACCEPTED').length, 1);
  assert.equal(order.orderItems_on_order[0].skuSnapshot, 'NX-AUPL-BK');
  assert.deepEqual((await account.getMyOrder(second.account, { id: orderId })).data.customerOrders, []);
  assert.deepEqual((await staff.listStaffOrders(shopper.staff, { offset: 0 })).data.staffOrders, []);
  const attemptedAdjustment = await command(shopper, staff.adjustInventory, { variantId: product.id, delta: 1, reason: 'Denied' }, true);
  assert.equal(attemptedAdjustment.resultCode, 'FORBIDDEN');

  const { data: { staffOrders } } = await staff.listStaffOrders(admin.staff, { offset: 0 });
  assert.equal(staffOrders[0].order.id, orderId);
  const report = await staff.getAdminReports(admin.staff, { start: '2020-01-01', end: '2100-01-01' });
  assert.equal(report.data.staffDailySales[0].netCents, '84460');
  const skuSales = await staff.listSkuSales(admin.staff, { start: '2020-01-01', end: '2100-01-01', offset: 0 });
  assert.equal(skuSales.data.staffSkuSales[0].sku, 'NX-AUPL-BK');
  assert.equal(skuSales.data.staffSkuSales[0].grossUnits, '1');
  const stock = async () => (await db.query('SELECT stock_on_hand FROM public.product_variant WHERE id = $1', [product.id])).rows[0].stock_on_hand;
  assert.equal(await stock(), product.stockOnHand - 1);
  const sales = await db.query("SELECT count(*)::int AS count FROM public.inventory_movement WHERE variant_id = $1 AND kind = 'SALE'", [product.id]);
  assert.equal(sales.rows[0].count, 1);
  const cancelId = await success(shopper, account.createReturnRequest, {
    orderId, kind: 'CANCELLATION', reason: 'TEST', description: 'Escenario local antes del despacho',
  });
  await success(admin, staff.assignCase, { id: cancelId }, true);
  await success(admin, staff.reviewReturnRequest, { id: cancelId, state: 'APPROVED' }, true);
  await success(admin, staff.approveRefund, { id: cancelId, shipping: true, detail: 'Cancelación local autorizada' }, true);
  assert.equal(await stock(), product.stockOnHand);
  assert.equal((await account.getMyOrder(shopper.account, { id: orderId }, serverOnly)).data.customerOrders[0].status, 'CANCELLED');
  const reportAfter = await staff.getAdminReports(admin.staff, { start: '2020-01-01', end: '2100-01-01' }, serverOnly);
  assert.equal(reportAfter.data.staffDailySales[0].netCents, '0');
  const returnSummary = await staff.listReturnSummary(admin.staff, { start: '2020-01-01', end: '2100-01-01', offset: 0 });
  assert.equal(returnSummary.data.staffReturnSummaries[0].status, 'RESOLVED');
});

test('pending and declined payment do not deduct inventory', async () => {
  const customer = await newUser('payment');
  const { data: { productVariants: [product] } } = await storefront.listCatalog(customer.storefront, { search: 'Auralis Pro', offset: 0 });
  const addressId = await success(customer, account.saveAddress, addressInput);
  const { quoteId, termsId } = await prepareQuote(customer, product.id, addressId);
  const pending = await command(customer, account.confirmCheckout, { quoteId, termsId, accepted: true, scenario: 'PENDING' });
  assert.equal(pending.resultCode, 'PAYMENT_PENDING');
  assert.equal((await account.getMyPaymentStatus(customer.account, { id: pending.resultId })).data.payments[0].status, 'PENDING');
  const declined = await command(customer, account.resolveSimulatedPayment, { paymentId: pending.resultId, scenario: 'DECLINE' });
  assert.equal(declined.resultCode, 'PAYMENT_DECLINED');
  assert.equal((await account.getMyPaymentStatus(customer.account, { id: pending.resultId }, serverOnly)).data.payments[0].status, 'DECLINED');
  assert.equal((await db.query('SELECT stock_on_hand FROM public.product_variant WHERE id = $1', [product.id])).rows[0].stock_on_hand, product.stockOnHand);
});

test('schema guard refuses business writes after a supplemental constraint disappears', async () => {
  const customer = await newUser('drift');
  await db.query('ALTER TABLE public.product_variant DROP CONSTRAINT variant_valid');
  const change = await command(customer, account.updateMyProfile, { name: 'Must not change' });
  assert.equal(change.resultCode, 'SCHEMA_INCOMPLETE');
  const { data } = await account.getMyProfile(customer.account, serverOnly);
  assert.equal(data.appUsers[0].displayName, 'drift');
});
