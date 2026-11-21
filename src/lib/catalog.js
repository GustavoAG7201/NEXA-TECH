import {
  getProduct, getPublishedPolicies, listCatalog, listCategories,
} from '../dataconnect-generated/storefront/esm/index.esm.js';
import { serverOnly, storefrontDb } from './firebase.js';

const legacy = {
  1: ['novabook-air-14', 'NX-NBA14-TI'],
  2: ['auralis-pro', 'NX-AUP-GR'],
  3: ['nexa-one', 'NX-NO-BK'],
  4: ['pulse-watch-s', 'NX-PWS-SL'],
  5: ['studio-display-27', 'NX-SD27-WH'],
  6: ['arc-keyboard', 'NX-ARK-BK'],
};

export function productSlug(value) {
  return Object.hasOwn(legacy, value) ? legacy[value][0] : String(value ?? '');
}

export function legacySku(value) {
  return Object.hasOwn(legacy, value) ? legacy[value][1] : undefined;
}

export const primaryCategories = ['computadoras', 'audio', 'smartphones'];
export const normalize = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const formatMXN = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', currencyDisplay: 'narrowSymbol',
});
export const money = cents => formatMXN.format(Number(cents) / 100);

export async function loadCategories() {
  const { data } = await listCategories(storefrontDb, serverOnly);
  return data.categories.sort((a, b) => {
    const rank = slug => primaryCategories.includes(slug) ? primaryCategories.indexOf(slug) : primaryCategories.length;
    return rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name, 'es-MX');
  });
}

export async function loadProduct(slug) {
  const { data } = await getProduct(storefrontDb, { slug: productSlug(slug) }, serverOnly);
  const [product] = data.products;
  if (!product) return null;
  return {
    ...product,
    images: product.productImages_on_product,
    variants: product.productVariants_on_product.toSorted((a, b) =>
      Number(a.unitPriceCents) - Number(b.unitPriceCents) || a.sku.localeCompare(b.sku)),
  };
}

export async function loadProducts(slugs) {
  return Promise.all(slugs.map(loadProduct));
}

export function preferredVariant(product) {
  return product.variants.find(variant => variant.stockOnHand > 0) ?? product.variants[0];
}

export async function loadCatalog(filters) {
  const { categoryId, minimum, maximum, available, search, sort } = filters;
  const pageSize = 30; // ListCatalog fixes this limit in the connector.
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data } = await listCatalog(storefrontDb, { offset, categoryId, minimum, maximum, available }, serverOnly);
    rows.push(...data.productVariants);
    if (data.productVariants.length < pageSize) break;
  }

  const grouped = new Map();
  const words = normalize(search.trim()).split(/\s+/).filter(Boolean);
  for (const { product, ...variant } of rows) {
    const searchable = normalize([product.name, product.description, product.specs?.marca, variant.sku].join(' '));
    if (!words.every(word => searchable.includes(word))) continue;
    if (!grouped.has(product.id)) {
      grouped.set(product.id, { ...product, images: product.productImages_on_product, variants: [] });
    }
    grouped.get(product.id).variants.push(variant);
  }

  const alphabetical = (a, b) => a.name.localeCompare(b.name, 'es-MX') || a.slug.localeCompare(b.slug);
  const price = product => Number(preferredVariant(product).unitPriceCents);
  return [...grouped.values()].sort((a, b) => {
    const order = { price: price(a) - price(b), 'price-desc': price(b) - price(a), name: 0 };
    return (order[sort] ?? Number(b.featured) - Number(a.featured)) || alphabetical(a, b);
  });
}

export async function loadPolicies() {
  const { data } = await getPublishedPolicies(storefrontDb, serverOnly);
  const current = new Map();
  for (const policy of data.legalDocuments) {
    if (!current.has(policy.kind) || policy.version > current.get(policy.kind).version) current.set(policy.kind, policy);
  }
  return [...current.values()];
}
