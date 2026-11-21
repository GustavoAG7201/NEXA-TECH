import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as staff from '../lib/staff-api.js';
import { useResource } from '../hooks/useResource.js';
import { loadCategories } from '../lib/catalog.js';
import { canonicalUuid, exactMoney, orderDate } from '../lib/commerce.js';
import { formNumber, labelFor, OperationInputError, optionalNumber, optionalText, parseDecimal, textValue } from '../lib/operations.js';
import { readStaff } from '../lib/staff.js';
import { CommandForm, Pager, RecordList } from './operations.jsx';
import { PurchaseResource } from './purchase.jsx';
import { State } from './ui.jsx';

const productRoute = '/administracion/productos';
const variantRoute = '/administracion/variantes';
const inventoryRoute = '/administracion/inventario';
const productStates = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

export function StaffProducts({ uid }) {
  const [filter, setFilter] = useState({});
  const [offset, setOffset] = useState(0);
  const read = useCallback(async () => (await readStaff(uid, staff.listStaffProducts, { offset, ...filter }))
    .staffCatalogProducts.map(row => row.product), [uid, offset, filter]);
  const products = useResource(read);
  return <section className="surface form-stack">
    <div className="operation-heading"><h2>Catálogo de productos</h2>
      <Link className="button primary" to={productRoute + '/nuevo'}>Crear producto</Link></div>
    <form className="operation-fields" onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setFilter({ search: optionalText(form, 'search'), status: optionalText(form, 'status') });
      setOffset(0);
    }}>
      <label>Nombre del producto<input type="search" name="search" /></label>
      <label>Disponibilidad<select name="status"><option value="">Todas</option>
        {productStates.map(status => <option key={status} value={status}>{labelFor(status)}</option>)}
      </select></label>
      <button className="button secondary">Filtrar productos</button>
    </form>
    <PurchaseResource resource={products} label="Consultando catálogo administrativo…">{items => <>
      <RecordList items={items} render={product => <li key={product.id}>
        <div><Link className="text-link" to={productRoute + '/' + canonicalUuid(product.id)}>{product.name}</Link>
          <p className="muted">{product.category.name}</p></div><span>{labelFor(product.status)}</span>
      </li>} />
      <Pager offset={offset} count={items.length} onChange={setOffset} label="Páginas de productos" />
    </>}</PurchaseResource>
  </section>;
}

function readSpecs(value) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // The same field error covers a malformed JSON document and a non-object.
  }
  throw new OperationInputError('Escribe las características como un objeto JSON válido.');
}

function productSpecs(product, form) {
  const specs = { ...product?.specs };
  const brand = optionalText(form, 'brand');
  const features = readSpecs(textValue(form, 'specs'));
  if (brand) specs.marca = brand;
  else delete specs.marca;
  if (features) specs.caracteristicas = features;
  else delete specs.caracteristicas;
  return Object.keys(specs).length ? specs : undefined;
}

function ProductForm({ uid, product, reload, saved }) {
  const categories = useResource(loadCategories);
  const navigate = useNavigate();
  return <PurchaseResource resource={categories} label="Consultando categorías…">{items =>
    <CommandForm uid={uid} command={staff.saveProduct} className="surface product-editor"
      title={product ? 'Editar ficha de producto' : 'Nueva ficha de producto'}
      submitLabel={product ? 'Guardar producto' : 'Crear borrador'} onSaved={id => {
        if (product) reload('Producto guardado.');
        else navigate(productRoute + '/' + canonicalUuid(id), { replace: true, state: { productCreated: true } });
      }}
      values={form => ({
        id: canonicalUuid(product?.id) ?? undefined, categoryId: canonicalUuid(textValue(form, 'categoryId')),
        slug: textValue(form, 'slug'), name: textValue(form, 'name'), description: textValue(form, 'description'),
        specs: productSpecs(product, form), status: textValue(form, 'status') || 'DRAFT',
        featured: form.has('featured'),
      })}>
      {saved && <p role="status" className="feedback">{saved}</p>}
      {product && <p>Estado actual <strong>{labelFor(product.status)}</strong></p>}
      <div className="operation-fields">
        <label>Nombre<input name="name" required maxLength={160} defaultValue={product?.name} /></label>
        <label>Marca<input name="brand" maxLength={120} defaultValue={product?.specs?.marca ?? ''} /></label>
        <label>Identificador de URL<input name="slug" required maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*"
          readOnly={Boolean(product)} defaultValue={product?.slug} placeholder="ejemplo-de-producto" /></label>
        <label>Categoría<select name="categoryId" required defaultValue={canonicalUuid(product?.categoryId) ?? ''}>
          <option value="">Selecciona una categoría</option>
          {product && !items.some(item => canonicalUuid(item.id) === canonicalUuid(product.categoryId)) &&
            <option value={canonicalUuid(product.categoryId)}>Categoría archivada actual</option>}
          {items.map(item => <option key={item.id} value={canonicalUuid(item.id)}>{item.name}</option>)}
        </select></label>
        {product && <label>Disponibilidad<select name="status" defaultValue={product.status === 'ARCHIVED' ? 'DRAFT' : product.status}>
          <option value="DRAFT">Borrador</option><option value="ACTIVE">Activo</option>
        </select></label>}
      </div>
      <label>Descripción<textarea name="description" rows={4} maxLength={6000} required defaultValue={product?.description} /></label>
      <label>Características (JSON)<textarea name="specs" rows={6} maxLength={16000}
        placeholder={'{"Memoria": "16 GB", "Peso": "1.2 kg"}'}
        defaultValue={product?.specs?.caracteristicas == null ? '' : JSON.stringify(product.specs.caracteristicas, null, 2)} /></label>
      <label className="check-field"><input type="checkbox" name="featured" defaultChecked={product?.featured} /> Mostrar como destacado</label>
    </CommandForm>}
  </PurchaseResource>;
}

export function StaffProduct({ uid, id, created = false }) {
  const [offset, setOffset] = useState(0);
  const [saved, setSaved] = useState(created ? 'Borrador creado. Agrega una variante para activar el producto.' : '');
  const read = useCallback(async () => (await readStaff(uid, staff.getStaffProduct, { id, variantOffset: offset }))
    .staffCatalogProducts[0]?.product, [uid, id, offset]);
  const product = useResource(read, Boolean(id && id !== 'nuevo'));
  const reload = message => { setSaved(message); product.retry(); };
  return <div className="checkout-steps">
    <Link className="text-link" to={productRoute}>Volver a productos</Link>
    {id === 'nuevo' ? <ProductForm uid={uid} /> : <PurchaseResource resource={product} label="Consultando ficha…">{value => value ? <>
      <div className="operation-columns">
        <ProductForm uid={uid} product={value} reload={reload} saved={saved} />
        <section className="surface form-stack">
          <h2>Variantes de {value.name}</h2>
          <Link className="button secondary" to={variantRoute + '/nuevo?producto=' + id}>Crear variante</Link>
          <RecordList items={value.productVariants_on_product} empty="Agrega la primera variante."
            render={item => <li key={item.id}>
              <div><Link className="text-link" to={variantRoute + '/' + canonicalUuid(item.id)}>{item.sku}</Link>
                <p>{item.optionLabel} · {item.stockOnHand} uds.{item.archivedAt && ' · Archivada'}</p>
                <Link className="text-link" to={inventoryRoute + '/' + canonicalUuid(item.id)}>Ver inventario</Link></div>
              <strong>{exactMoney(item.unitPriceCents)}</strong>
            </li>} />
          <Pager offset={offset} count={value.productVariants_on_product.length} onChange={setOffset} label="Páginas de variantes" />
        </section>
      </div>
      {value.status !== 'ARCHIVED' && <CommandForm uid={uid} command={staff.archiveProduct}
        className="surface" title="Archivar ficha" submitLabel="Archivar producto" values={() => ({ id })}
        onSaved={() => reload('Producto archivado.')} />}
    </> : <State title="Producto no disponible" />}</PurchaseResource>}
  </div>;
}

function VariantForm({ uid, productId, variant, reload }) {
  const read = useCallback(async () => (await readStaff(uid, staff.listStaffTaxClasses)).staffCatalogTaxes, [uid]);
  const taxes = useResource(read);
  const navigate = useNavigate();
  const intFields = [
    ['weight', 'Peso (g)', variant?.weightG], ['length', 'Largo (mm)', variant?.lengthMm],
    ['width', 'Ancho (mm)', variant?.widthMm], ['height', 'Alto (mm)', variant?.heightMm],
  ];
  return <PurchaseResource resource={taxes} label="Consultando tasas…">{items =>
    <CommandForm uid={uid} command={staff.saveVariant} className="surface variant-editor"
      title={variant ? 'Editar variante' : 'Nueva variante'} submitLabel="Guardar variante" onSaved={id => {
        if (variant) reload();
        else navigate(variantRoute + '/' + canonicalUuid(id), { replace: true });
      }}
      values={form => {
        const dimensions = ['length', 'width', 'height'].map(name => optionalNumber(form, name));
        const filled = dimensions.filter(value => value != null).length;
        if (filled && filled !== dimensions.length) throw new OperationInputError('Completa largo, ancho y alto juntos.');
        return {
          id: canonicalUuid(variant?.id) ?? undefined, productId, taxClass: textValue(form, 'taxClass'),
          sku: textValue(form, 'sku').toUpperCase(), label: textValue(form, 'label'), color: optionalText(form, 'color'),
          price: parseDecimal(textValue(form, 'price')),
          compareAt: optionalText(form, 'compareAt') ? parseDecimal(textValue(form, 'compareAt')) : undefined,
          cost: optionalText(form, 'cost') ? parseDecimal(textValue(form, 'cost')) : undefined,
          threshold: Number(form.get('threshold')), weight: optionalNumber(form, 'weight'),
          length: dimensions[0], width: dimensions[1], height: dimensions[2], archived: form.has('archived'),
        };
      }}>
      <div className="operation-fields">
        <label>SKU<input name="sku" pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*" required maxLength={64}
          readOnly={Boolean(variant)} defaultValue={variant?.sku} /></label>
        <label>Nombre de variante<input name="label" required maxLength={120} defaultValue={variant?.optionLabel} /></label>
        <label>Color<input name="color" maxLength={60} defaultValue={variant?.color ?? ''} /></label>
        <label>Clase fiscal<select name="taxClass" required defaultValue={variant?.taxClassCode ?? ''}>
          <option value="">Selecciona una clase fiscal</option>
          {items.map(tax => <option key={tax.code} value={tax.code}>{tax.label} · {tax.rateBps / 100}%</option>)}
        </select></label>
        {[['price', 'Precio (MXN)', variant?.unitPriceCents], ['compareAt', 'Precio anterior (MXN)', variant?.compareAtCents],
          ['cost', 'Costo (MXN)', variant?.unitCostCents]].map(([name, label, initial]) =>
          <label key={name}>{label}<input name={name} type="number" min={0} max={10000000000} step=".01"
            required={name === 'price'} defaultValue={formNumber(initial)} /></label>)}
        <label>Umbral de inventario bajo<input name="threshold" type="number" min={0} max={2147483647}
          required defaultValue={variant?.lowStockThreshold ?? 0} /></label>
        {intFields.map(([name, label, initial]) => <label key={name}>{label}
          <input type="number" name={name} min={1} max={2147483647} defaultValue={initial ?? ''} /></label>)}
      </div>
      {variant && <label className="check-field"><input type="checkbox" name="archived" defaultChecked={Boolean(variant.archivedAt)} /> Archivar variante</label>}
    </CommandForm>}
  </PurchaseResource>;
}

export function StaffVariant({ uid, id, parentId }) {
  const [saved, setSaved] = useState(false);
  const read = useCallback(async () => (await readStaff(uid, staff.listStaffVariants, { offset: 0, id }))
    .staffCatalogVariants[0]?.variant, [uid, id]);
  const variant = useResource(read, Boolean(id && id !== 'nuevo'));
  return <div className="checkout-steps">
    {saved && <p role="status" className="feedback">Variante guardada.</p>}
    {id === 'nuevo' && parentId ? <>
      <Link className="text-link" to={productRoute + '/' + parentId}>Volver al producto</Link>
      <VariantForm uid={uid} productId={parentId} />
    </> : <PurchaseResource resource={variant} label="Consultando variante…">{item => item ? <>
      <div className="action-row">
        <Link className="text-link" to={productRoute + '/' + canonicalUuid(item.productId)}>Volver a {item.product.name}</Link>
        <Link className="text-link" to={inventoryRoute + '/' + id}>Ver inventario</Link>
      </div>
      <VariantForm uid={uid} productId={canonicalUuid(item.productId)} variant={item} reload={() => {
        setSaved(true); variant.retry();
      }} />
    </> : <State title="Variante no disponible" action={<Link className="button secondary" to={productRoute}>Abrir catálogo</Link>} />}
    </PurchaseResource>}
  </div>;
}

function InventoryMovements({ uid, id }) {
  const [offset, setOffset] = useState(0);
  const read = useCallback(async () => (await readStaff(uid, staff.listInventoryMovements, { variantId: id, offset }))
    .staffInventories.map(row => row.movement), [uid, id, offset]);
  const movements = useResource(read);
  return <section className="surface form-stack">
    <h2>Movimientos de inventario</h2>
    <PurchaseResource resource={movements} label="Consultando movimientos…">{items => <>
      <RecordList items={items} empty="Aún no hay movimientos." render={item => <li key={item.id}>
        <div><Link className="text-link" to={inventoryRoute + '/' + canonicalUuid(item.variantId)}>{item.variant.sku}</Link>
          <p className="preserve-lines">{item.reason}</p>
          <p className="muted">{item.command?.actorUid ?? 'Carga de apertura'} · <time dateTime={item.createdAt}>{orderDate(item.createdAt)}</time></p>
        </div>
        <strong>{item.delta > 0 && '+'}{item.delta} · {labelFor(item.kind)}</strong>
      </li>} />
      <Pager offset={offset} count={items.length} onChange={setOffset} label="Páginas de movimientos" />
    </>}</PurchaseResource>
  </section>;
}

export function InventorySearch({ uid }) {
  const [sku, setSku] = useState('');
  const [offset, setOffset] = useState(0);
  const read = useCallback(async () => (await readStaff(uid, staff.listStaffVariants, { sku: sku || undefined, offset }))
    .staffCatalogVariants.map(row => row.variant), [uid, sku, offset]);
  const variants = useResource(read);
  return <div className="checkout-steps">
    <section className="surface form-stack">
      <h2>Existencias por SKU</h2>
      <form className="operation-fields" onSubmit={event => {
        event.preventDefault();
        setSku(textValue(new FormData(event.currentTarget), 'sku').toUpperCase());
        setOffset(0);
      }}><label>Buscar SKU<input type="search" name="sku" /></label><button className="button secondary">Consultar existencias</button></form>
      <PurchaseResource resource={variants} label="Consultando existencias…">{items => <>
        <RecordList items={items} render={item => <li key={item.id}>
          <div><Link className="text-link" to={inventoryRoute + '/' + canonicalUuid(item.id)}>{item.sku}</Link>
            <p className="muted">{item.product.name} · {item.optionLabel}{item.archivedAt && ' · Archivada'}</p></div>
          <strong>{item.stockOnHand} uds.</strong>
        </li>} />
        <Pager offset={offset} count={items.length} onChange={setOffset} label="Páginas de existencias" />
      </>}</PurchaseResource>
    </section>
    <InventoryMovements uid={uid} />
  </div>;
}

export function InventoryDetail({ uid, id }) {
  const [revision, setRevision] = useState(0);
  const read = useCallback(async () => id ? (await readStaff(uid, staff.listStaffVariants, { id, offset: 0 }))
    .staffCatalogVariants[0]?.variant : null, [uid, id]);
  const item = useResource(read);
  return <div className="checkout-steps">
    <Link className="text-link" to={inventoryRoute}>Volver a inventario</Link>
    {revision > 0 && <p role="status" className="feedback">Ajuste registrado.</p>}
    <PurchaseResource resource={item} label="Consultando variante…">{value => value ? <>
      <section className="surface form-stack">
        <h2>{value.sku}</h2><p>{value.product.name} · {value.optionLabel}</p>
        <p>Existencias <strong>{value.stockOnHand} uds.</strong> · Umbral {value.lowStockThreshold}</p>
        <Link className="text-link" to={variantRoute + '/' + id}>Editar variante</Link>
      </section>
      <CommandForm uid={uid} command={staff.adjustInventory} className="surface inventory-adjustment"
        title="Registrar ajuste" submitLabel="Aplicar ajuste"
        values={form => {
          const delta = Number(form.get('delta'));
          if (!delta) throw new OperationInputError('Escribe una variación distinta de cero.');
          return { variantId: id, delta, reason: textValue(form, 'reason') };
        }} onSaved={() => { setRevision(value => value + 1); item.retry(); }}>
        <label>Variación en unidades<input name="delta" type="number" min={-2147483648} max={2147483647} required /></label>
        <label>Motivo del ajuste<textarea name="reason" rows={3} maxLength={480} required /></label>
      </CommandForm>
      <InventoryMovements uid={uid} id={id} key={revision} />
    </> : <State title="Variante no disponible" />}</PurchaseResource>
  </div>;
}
