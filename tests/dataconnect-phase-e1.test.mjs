import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  applyActionCode, connectAuthEmulator, createUserWithEmailAndPassword, getAuth,
  sendEmailVerification, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import * as account from '../src/dataconnect-generated/account/esm/index.esm.js';
import * as staff from '../src/dataconnect-generated/staff/esm/index.esm.js';
import * as storefront from '../src/dataconnect-generated/storefront/esm/index.esm.js';
import { applyLocalSql } from '../scripts/local-dataconnect.mjs';
import { authPort, connectPort, connectStoreDatabase, localProject, localWork, startStorefront } from '../scripts/local-store.mjs';
import { openBrowser, until } from './helpers/local-browser.mjs';

const authOrigin = 'http://127.0.0.1:' + authPort;
const apps = [];
const serverOnly = { fetchPolicy: 'SERVER_ONLY' };
const password = 'nexatech-e1-' + randomUUID();
const browsers = [
  ['Chrome', process.env.NEXATECH_TEST_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
  ['Edge', process.env.NEXATECH_TEST_EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
];
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
let db;
let vite;
let origin;
let historic;
const users = {};

const rows = async (sql, values) => (await db.query(sql, values)).rows;
const historicVariants = () => rows(`SELECT p.id, p.slug, p.legacy_id, v.sku, v.id AS variant_id, v.stock_on_hand
  FROM public.product p JOIN public.product_variant v ON p.id = v.product_id
  WHERE p.slug NOT LIKE 'e1-%' ORDER BY p.slug`);

before(async () => {
  db = await connectStoreDatabase();
  await applyLocalSql(db);
  historic = await historicVariants();
  await applyLocalSql(db, { catalog: true });
});
after(async () => {
  await Promise.all(apps.map(deleteApp));
  await vite?.close();
  await db?.end();
});

function clients(name) {
  const app = initializeApp({ projectId: localProject, apiKey: 'demo-key' }, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, authOrigin, { disableWarnings: true });
  const connectors = Object.fromEntries(Object.entries({ storefront, account, staff }).map(([name, sdk]) => {
    const connector = getDataConnect(app, sdk.connectorConfig);
    connectDataConnectEmulator(connector, '127.0.0.1', connectPort);
    return [name, connector];
  }));
  return { auth, ...connectors };
}

async function fixture(name, role) {
  const sdk = clients(name);
  const email = 'phase-e1-' + name + '@nexatech.test';
  const { user } = await createUserWithEmailAndPassword(sdk.auth, email, password);
  await account.ensureProfile(sdk.account, { displayName: 'Prueba ' + name });
  await sendEmailVerification(user);
  const { oobCodes } = await fetch(authOrigin + '/emulator/v1/projects/' + localProject + '/oobCodes').then(response => response.json());
  await applyActionCode(sdk.auth, oobCodes.find(code => code.email === email).oobCode);
  await user.reload();
  await user.getIdToken(true);
  if (role) await db.query('INSERT INTO public.user_role(user_uid, role_code) VALUES ($1,$2)', [user.uid, role]);
  users[name] = { ...sdk, email, uid: user.uid };
  return users[name];
}

test('E1-01 · 153 fichas, semilla repetible, registro de inventario e identidad histórica', async () => {
  assert.equal(historic.length, 18);
  assert.deepEqual(await historicVariants(), historic);
  const counts = await rows(`SELECT c.slug, count(p.id)::int AS total FROM public.category c
    JOIN public.product p ON p.category_id = c.id GROUP BY c.slug ORDER BY c.slug`);
  assert.deepEqual(Object.fromEntries(counts.map(row => [row.slug, row.total])),
    { accesorios: 1, audio: 50, computadoras: 50, monitores: 1, smartphones: 50, wearables: 1 });
  const snapshot = () => rows(`SELECT p.id, p.specs, p.status, v.id AS variant, v.sku, v.unit_price_cents, v.stock_on_hand,
    coalesce((SELECT sum(m.delta)::int FROM public.inventory_movement m WHERE m.variant_id=v.id),0) AS ledger,
    (SELECT json_agg(i ORDER BY position) FROM public.product_image i WHERE i.product_id=p.id) AS images
    FROM public.product p JOIN public.product_variant v ON p.id=v.product_id ORDER BY p.slug`);
  const first = await snapshot();
  assert.equal(first.length, 153);
  assert.equal(new Set(first.map(row => row.sku)).size, 153);
  assert.equal(first.filter(row => row.stock_on_hand === 0).length, 15);
  assert.equal((await rows('SELECT count(*)::int AS total FROM public.inventory_movement'))[0].total, 138);
  for (const item of first) {
    assert.ok(item.specs.marca);
    assert.equal(item.specs.origenPrecio, 'simulado');
    assert.ok(Object.keys(item.specs.caracteristicas).length >= 2);
    assert.equal(item.status, 'ACTIVE');
    assert.equal(item.ledger, item.stock_on_hand);
    assert.ok(item.images.length >= 1);
    for (const image of item.images) {
      assert.match(image.src, /^\/catalogo\/[a-z-]+\.jpg$/);
      assert.ok(existsSync(join(publicRoot, image.src.slice(1))));
      assert.ok(image.alt.trim());
      assert.match(image.credit, /NexaTech/);
    }
  }
  await applyLocalSql(db, { catalog: true });
  assert.deepEqual(await snapshot(), first);
  const [database] = await rows(`SELECT
    (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS tables,
    (SELECT count(*)::int FROM nexa_migrations.applied) AS migrations, nexa_internal.commerce_schema_ready() AS ready`);
  assert.deepEqual(database, { tables: 40, migrations: 5, ready: true });
});

test('E1-02 · proyección pública, precios, filtros y paginación de SQL Connect', async () => {
  const visitor = clients('public-e1');
  const { data: { categories } } = await storefront.listCategories(visitor.storefront, serverOnly);
  const audio = categories.find(category => category.slug === 'audio');
  assert.equal(categories.length, 6);
  const get = async variables => (await storefront.listCatalog(visitor.storefront, { offset: 0, ...variables }, serverOnly)).data.productVariants;
  const pages = await Promise.all([0, 30, 60, 90, 120, 150, 180].map(offset => get({ offset })));
  assert.deepEqual(pages.map(page => page.length), [30, 30, 30, 30, 30, 3, 0]);
  assert.equal(new Set(pages.flat().map(row => row.sku)).size, 153);
  assert.ok(pages.flat().every(row => !Object.hasOwn(row, 'unitCostCents') && !Object.hasOwn(row, 'taxClassCode')));
  const filtered = await get({ categoryId: audio.id, minimum: '70000', maximum: '160000', available: 1 });
  assert.ok(filtered.length > 1 && filtered.length < 30);
  assert.ok(filtered.every(row => row.product.category.slug === 'audio' && row.stockOnHand > 0 &&
    Number(row.unitPriceCents) >= 70000 && Number(row.unitPriceCents) <= 160000));
  const matches = await get({ categoryId: audio.id, search: 'Auralis' });
  assert.ok(matches.length > 3 && matches.every(row => row.product.name.includes('Auralis')));
  const { data: { products: [product] } } = await storefront.getProduct(visitor.storefront, { slug: 'novabook-air-14' }, serverOnly);
  assert.equal(product.legacyId, 1);
  assert.equal(product.productVariants_on_product[0].sku, 'NX-NBA14-TI');
  assert.equal(product.productImages_on_product.length, 2);
  assert.equal((await storefront.getProduct(visitor.storefront, { slug: 'inexistente-e1' }, serverOnly)).data.products.length, 0);
  assert.equal((await storefront.getPublishedPolicies(visitor.storefront, serverOnly)).data.legalDocuments.length, 6);
  await assert.rejects(account.getMyProfile(visitor.account, serverOnly));
  await assert.rejects(staff.listLowStock(visitor.staff, { offset: 0 }, serverOnly));
});

test('E1-03 · autenticación, perfil propio y proyecciones por rol', async () => {
  const [buyer, admin, support] = await Promise.all([
    fixture('customer'), fixture('admin', 'ADMIN'), fixture('support', 'SUPPORT'),
  ]);
  for (const [user, roles] of [[buyer, ['CUSTOMER']], [admin, ['ADMIN','CUSTOMER']], [support, ['CUSTOMER','SUPPORT']]]) {
    const { data: { appUsers } } = await account.getMyProfile(user.account, serverOnly);
    assert.deepEqual(appUsers.map(profile => profile.uid), [user.uid]);
    assert.deepEqual(appUsers[0].userRoles_on_user.map(row => row.roleCode).sort(), roles);
  }
  for (const user of [buyer, support]) {
    assert.equal((await staff.listLowStock(user.staff, { offset: 0 }, serverOnly)).data.staffStockAlerts.length, 0);
  }
  assert.ok((await staff.listLowStock(admin.staff, { offset: 0 }, serverOnly)).data.staffStockAlerts.length >= 15);
  const key = randomUUID();
  await staff.changeUserRole(buyer.staff, { key, uid: buyer.uid, role: 'ADMIN', enabled: true });
  const verdict = (await account.getMyCommandResult(buyer.account, { key }, serverOnly)).data.commerceCommands[0];
  assert.equal(verdict.status, 'REJECTED');
  assert.equal((await rows('SELECT role_code FROM public.user_role WHERE user_uid=$1', [buyer.uid])).length, 1);
  await signOut(buyer.auth);
  await assert.rejects(account.getMyProfile(buyer.account, serverOnly));
  await assert.rejects(signInWithEmailAndPassword(buyer.auth, buyer.email, password + '-incorrecta'));
  const session = await signInWithEmailAndPassword(buyer.auth, buyer.email, password);
  assert.equal(session.user.uid, buyer.uid);
});

async function storefrontOrigin() {
  if (!vite) {
    vite = await startStorefront(0);
    origin = 'http://127.0.0.1:' + vite.httpServer.address().port;
    const response = await fetch(origin);
    assert.ok(response.ok);
  }
  return origin;
}

async function fill(browser, fields, selector = 'main form') {
  await until(() => browser.evaluate(query => {
    const form = document.querySelector(query);
    return form && !form.querySelector('fieldset:disabled');
  }, selector), selector + ' is ready');
  await browser.evaluate(({ query, values }) => {
    const form = document.querySelector(query);
    for (const [field, value] of Object.entries(values)) {
      const control = form.elements[field];
      if (control.type === 'checkbox') control.checked = value;
      else control.value = value;
    }
    form.requestSubmit();
  }, { query: selector, values: fields });
}

async function responsive(browser, width) {
  await browser.viewport(width, 900);
  assert.ok(await browser.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow at ' + width);
}

async function verifyContrast(browser) {
  const samples = await browser.evaluate(() => {
    const luminance = color => {
      const channels = color.match(/\d+\.?\d*/g).slice(0, 3).map(value => {
        const channel = Number(value) / 255;
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
      });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    return ['.hero-button', '.hero-caption small', '.product-card .stock'].map(selector => {
      const node = document.querySelector(selector);
      const foreground = luminance(getComputedStyle(node).color);
      let background = node;
      while (getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement;
      const behind = luminance(getComputedStyle(background).backgroundColor);
      return { selector, ratio: (Math.max(foreground, behind) + .05) / (Math.min(foreground, behind) + .05) };
    });
  });
  for (const { selector, ratio } of samples) assert.ok(ratio >= 4.5, selector + ' contrast: ' + ratio);
}

async function screenshot(browser, path, label) {
  if (!path) return;
  const { data } = await browser.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(path, label + '.png'), Buffer.from(data, 'base64'));
}

for (const [name, executable] of browsers) {
  test('E1 · navegador ' + name, { skip: !existsSync(executable), timeout: 120000 }, async () => {
    const origin = await storefrontOrigin();
    const browser = await openBrowser(executable, localWork, name.toLowerCase());
    const url = path => origin + path;
    const email = 'navegador-' + name.toLowerCase() + '@nexatech.test';
    const captures = process.env.NEXATECH_E1_SCREENSHOTS_DIR;
    try {
      await browser.viewport(1440, 950);
      await browser.go(url('/'));
      await browser.waitText('.hero-caption', 'NovaBook Air 14');
      await browser.waitText('.category-grid', 'Smartphones');
      await browser.waitText('.product-grid', 'NovaBook Air 14');
      await verifyContrast(browser);
      await screenshot(browser, captures, name + '-inicio');
      await browser.press('Tab');
      assert.equal(await browser.evaluate(() => document.activeElement.className), 'skip-link');
      assert.equal(await browser.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'solid');
      await browser.press('Enter');
      assert.equal(await browser.evaluate(() => document.activeElement.id), 'contenido');
      for (const width of [768, 360]) await responsive(browser, width);
      await browser.evaluate(() => scrollTo(0, 0));
      await screenshot(browser, captures, name + '-inicio-360');
      await browser.click('[aria-controls="main-nav"]');
      assert.equal(await browser.evaluate(() => document.querySelector('[aria-controls="main-nav"]').getAttribute('aria-expanded')), 'true');
      await browser.click('#main-nav a[href="/productos?cat=audio"]');
      await browser.waitText('.results-count', '50 productos');
      await responsive(browser, 360);
      await browser.click('.pagination a:last-of-type');
      await browser.waitText('.pagination', 'Página 2 de 5');
      await browser.waitText('.results-count', 'Mostrando 13–24');
      await fill(browser, { q: 'sonus', min: '500', max: '2500', stock: true, orden: 'price-desc' });
      await browser.waitText('.product-grid', 'Sonus');
      const cardPrices = await browser.evaluate(() => Array.from(document.querySelectorAll('.product-price strong'),
        node => Number(node.textContent.replace(/[^\d.]/g, ''))));
      assert.ok(cardPrices.length > 1 && cardPrices.every((price, index) =>
        price >= 500 && price <= 2500 && (index === 0 || price <= cardPrices[index - 1])));
      assert.ok(await browser.evaluate(() => Array.from(document.querySelectorAll('.product-card')).every(card => card.textContent.includes('Disponible'))));
      await fill(browser, { q: 'sku-que-no-existe' });
      await browser.waitText('.state h2', 'No encontramos productos');
      await browser.go(url('/productos'));
      await browser.waitText('.results-count', '153 productos');
      await fill(browser, { q: 'nx-e1-s01-09' });
      await browser.waitText('.results-count', '1 producto ·');
      await browser.waitText('.product-card', 'Agotado');
      assert.equal(await browser.evaluate(() => document.querySelector('.add-button').disabled), true);

      await browser.go(url('/producto/1'));
      await browser.waitText('main h1', 'NovaBook Air 14');
      assert.equal(await browser.evaluate(() => document.querySelector('.detail-photo img').alt), 'Vista ilustrativa de NovaBook Air 14');
      await browser.click('.thumbnail:last-child');
      await until(() => browser.evaluate(() => document.querySelector('.detail-photo img').src.endsWith('portatil-detalle.jpg')), 'product gallery');
      await browser.click('.buy-row .favorite-button');
      await browser.click('.buy-row button[aria-label="Aumentar cantidad"]');
      await browser.click('.buy-row .button.primary');
      await browser.waitText('dialog .cart-line', 'NovaBook Air 14');
      assert.equal(await browser.text('dialog output'), '2');
      await browser.press('Escape');
      assert.ok(await browser.evaluate(() => !document.querySelector('dialog').open && document.activeElement.matches('.buy-row .button.primary')));
      await browser.go(url('/wishlist'));
      await browser.waitText('.product-card', 'NovaBook Air 14');
      await browser.go(url('/carrito'));
      await browser.waitText('main .cart-line', 'NovaBook Air 14');
      assert.equal(await browser.text('main output'), '2');
      await browser.click('main a[href="/checkout"]');
      await browser.waitText('main', 'Vista previa');
      await browser.waitText('.checkout-lines', 'NovaBook Air 14');
      assert.ok(await browser.evaluate(() => !document.querySelector('main form')));
      await responsive(browser, 360);

      await browser.go(url('/registro'));
      await browser.waitText('main form', 'Crear cuenta');
      await fill(browser, { name: 'Cliente ' + name, email, password });
      await browser.waitText('main h1', 'Mi perfil');
      await browser.waitText('main .form-stack', 'Perfil asociado');
      const [registered] = await rows('SELECT uid, display_name FROM public.app_user WHERE display_name=$1', ['Cliente ' + name]);
      assert.ok(registered?.uid);
      await fill(browser, { name: 'Perfil ' + name, phone: '0000000000' });
      await until(async () => (await rows('SELECT display_name FROM public.app_user WHERE uid=$1', [registered.uid]))[0].display_name === 'Perfil ' + name,
        'PostgreSQL profile saved');
      await browser.waitText('.page > .feedback', 'Perfil guardado.');
      await browser.go(url('/wishlist'));
      await browser.waitText('main h2', 'Aún no tienes favoritos');
      await browser.go(url('/producto/1'));
      await browser.waitText('main h1', 'NovaBook Air 14');
      await until(() => browser.evaluate(() => document.querySelector('.favorite-button')?.disabled === false), 'favorite control ready');
      await browser.click('.favorite-button');
      await until(async () => (await rows('SELECT product_id FROM public.favorite WHERE user_uid=$1', [registered.uid])).length === 1,
        'favorite saved in PostgreSQL');
      await browser.go(url('/wishlist'));
      await browser.waitText('.product-card', 'NovaBook Air 14');
      const firstStaff = browser.requests.filter(request => request.includes('/connectors/staff')).length;
      await browser.go(url('/administracion'));
      await browser.waitText('.state h2', 'Acceso restringido');
      assert.equal(browser.requests.filter(request => request.includes('/connectors/staff')).length, firstStaff);
      await browser.go(url('/perfil'));
      await browser.waitText('.session-email', email);
      await browser.click('.session-panel button:last-of-type');
      await browser.waitText('main h1', 'Inicia sesión');
      await fill(browser, { email, password: 'clave-incorrecta' });
      await browser.waitText('[role="alert"]', 'Revisa tu correo');
      await browser.click('main form button[type="button"]');
      await browser.waitText('main [role="status"]', 'enlace de recuperación');
      const resetCodes = await (await fetch(`${authOrigin}/emulator/v1/projects/${localProject}/oobCodes`)).json();
      assert.ok(resetCodes.oobCodes.some(code => code.email === email && code.requestType === 'PASSWORD_RESET'));
      await fill(browser, { email, password });
      await browser.waitText('.session-email', email);
      assert.equal(await browser.evaluate(() => document.querySelector('input[name="name"]').value), 'Perfil ' + name);
      await browser.go(url('/wishlist'));
      await browser.waitText('.product-card', 'NovaBook Air 14');
      await browser.go(url('/carrito'));
      await browser.waitText('main .cart-line', 'NovaBook Air 14');
      assert.equal(await browser.text('main output'), '2');
      await browser.click('main .cart-line button[aria-label^="Quitar"]');
      await browser.waitText('main h2', 'Tu carrito está vacío');
      await browser.go(url('/perfil'));
      await browser.waitText('.session-email', email);
      await browser.click('.session-panel button:last-of-type');
      await browser.waitText('main h1', 'Inicia sesión');
      const staffUser = name === 'Chrome' ? 'admin' : 'support';
      await fill(browser, { email: users[staffUser].email, password });
      await browser.waitText('.session-panel', 'Abrir panel');
      await browser.click('main a[href="/administracion"]');
      await browser.waitText('.admin-grid', 'Sin casos en la cola');
      assert.equal(await browser.evaluate(() => document.querySelector('.admin-grid').textContent.includes('Alertas de existencias')), staffUser === 'admin');
      if (staffUser === 'admin') await browser.waitText('.admin-grid', 'NX-E1');
      await responsive(browser, 360);

      await browser.go(url('/ayuda'));
      await browser.waitText('main h1', 'Centro de ayuda');
      await browser.click('summary');
      assert.ok(await browser.evaluate(() => document.querySelector('details').open));
      await browser.go(url('/politicas/privacidad'));
      await browser.waitText('.policy-list', 'Aviso de privacidad');
      await browser.go(url('/producto/no-existe'));
      await browser.waitText('.state h2', 'Producto no disponible');
      await browser.go(url('/esta-ruta-no-existe'));
      await browser.waitText('.state h2', 'Página no encontrada');
      await browser.go(url('/carrito'));
      await browser.waitText('main h2', 'Tu carrito está vacío');
      await browser.go(url('/perfil'));
      await browser.waitText('.session-email', users[staffUser].email);
      await browser.click('.session-panel button:last-of-type');
      await browser.waitText('main h1', 'Inicia sesión');

      // Recreate the format written by the pre-E1 storefront.
      await browser.evaluate(() => {
        localStorage.setItem('nexa-cart', JSON.stringify([{ id: 2, qty: 1, price: 1 }]));
        localStorage.setItem('nexa-favs', '[2]');
      });
      await browser.go(url('/carrito?legado=1'));
      await browser.waitText('main .cart-line', 'Auralis Pro');
      await browser.waitText('.total-row', '6,499.00');
      await browser.go(url('/wishlist?legado=1'));
      await browser.waitText('.product-card', 'Auralis Pro');

      await browser.send('Network.setBlockedURLs', { urls: ['*127.0.0.1:' + connectPort + '/*'] });
      await browser.go(url('/productos?error=1'));
      await browser.waitText('[role="alert"]', 'La consulta falló');
      await browser.send('Network.setBlockedURLs', { urls: [] });
      await browser.click('.state button');
      await browser.waitText('.results-count', '153 productos');
      await responsive(browser, 360);
      assert.deepEqual(browser.errors, []);
      const external = browser.requests.filter(request => /^https?:/.test(request) && new URL(request).hostname !== '127.0.0.1');
      assert.deepEqual(external, []);
    } finally {
      await browser.close();
    }
  });
}
