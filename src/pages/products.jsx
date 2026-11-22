import { useCallback } from 'react';
import { Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/product-card.jsx';
import { PageHeading, Resource, State } from '../components/ui.jsx';
import { loadCatalog, loadCategories, normalize } from '../lib/catalog.js';
import { useResource } from '../hooks/useResource.js';

const pageSize = 12;
const sorts = { featured: 'Destacados', price: 'Menor precio', 'price-desc': 'Mayor precio', name: 'Nombre de A a Z' };
const pesosToCents = value => /^\d{1,8}(\.\d{1,2})?$/.test(value ?? '') ? String(Math.round(Number(value) * 100)) : undefined;

function FilterForm({ params, setParams }) {
  function submit(event) {
    event.preventDefault();
    const filters = new URLSearchParams();
    const form = new FormData(event.currentTarget);
    if (params.has('cat')) filters.set('cat', params.get('cat'));
    for (const [name, value] of form) {
      if (value.trim() && !(name === 'orden' && value === 'featured')) filters.set(name, value.trim());
    }
    setParams(filters);
  }
  return <form className="catalog-filters" onSubmit={submit}>
    <label className="filter-search">Buscar producto<input name="q" type="search" maxLength="100" defaultValue={params.get('q') ?? ''} placeholder="Nombre, marca o SKU" /></label>
    <label>Desde (MXN)<input name="min" type="number" min="0" max="99999999.99" step="0.01" defaultValue={params.get('min') ?? ''} /></label>
    <label>Hasta (MXN)<input name="max" type="number" min="0" max="99999999.99"
      step="0.01" defaultValue={params.get('max') ?? ''} /></label>
    <label>Ordenar por<select name="orden" defaultValue={params.get('orden') ?? 'featured'}>
      {Object.entries(sorts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    <label className="check-field"><input name="stock" type="checkbox" value="1" defaultChecked={params.get('stock') === '1'} /> En existencia</label>
    <button className="button primary" type="submit"><Search aria-hidden="true" /> Aplicar</button>
    {params.size > 0 && <Link className="text-link filter-reset" to="/productos">Limpiar filtros</Link>}
  </form>;
}

function CatalogResults({ params, categoryId }) {
  const search = (params.get('q') ?? '').slice(0, 100);
  const minimum = pesosToCents(params.get('min'));
  const maximum = pesosToCents(params.get('max'));
  const available = params.get('stock') === '1' ? 1 : undefined;
  const sort = params.get('orden');
  const valid = minimum === undefined || maximum === undefined || Number(minimum) <= Number(maximum);
  const load = useCallback(() => loadCatalog({ categoryId, search, minimum, maximum, available, sort }),
    [categoryId, search, minimum, maximum, available, sort]);
  const result = useResource(load, valid);
  const pageUrl = next => {
    const updated = new URLSearchParams(params);
    if (next === 1) updated.delete('pagina');
    else updated.set('pagina', next);
    return '?' + updated + '#resultados';
  };

  if (!valid) return <p role="alert" className="feedback error">El precio máximo debe ser igual o mayor al mínimo.</p>;
  return <div id="resultados" tabIndex="-1">
    <Resource value={result} label="Consultando catálogo…">{products => {
      if (!products.length) return <State title="No encontramos productos" action={<Link className="button secondary" to="/productos">Limpiar filtros</Link>}>
        Prueba otra búsqueda o amplía el rango de precio.
      </State>;
      const pages = Math.ceil(products.length / pageSize);
      const requested = Math.floor(Number(params.get('pagina')));
      const page = Math.min(pages, Math.max(1, requested || 1));
      const start = (page - 1) * pageSize;
      return <>
        <p className="results-count" role="status">{products.length} {products.length === 1 ? 'producto' : 'productos'} · Mostrando {start + 1}–{Math.min(start + pageSize, products.length)}</p>
        <div className="product-grid">{products.slice(start, start + pageSize).map(product => <ProductCard key={product.id} product={product} />)}</div>
        {pages > 1 && <nav className="pagination" aria-label="Páginas del catálogo">
          {page > 1 && <Link className="button secondary" to={pageUrl(page - 1)}>Anterior</Link>}
          <span>Página {page} de {pages}</span>
          {page < pages && <Link className="button secondary" to={pageUrl(page + 1)}>Siguiente</Link>}
        </nav>}
      </>;
    }}</Resource>
  </div>;
}

export function Catalog() {
  const [params, setParams] = useSearchParams();
  const categories = useResource(loadCategories);
  const normalized = normalize(params.get('cat') ?? '');
  const active = categories.data?.find(category => category.slug === normalized || normalize(category.name) === normalized);
  const categoryUrl = slug => {
    const next = new URLSearchParams(params);
    next.delete('pagina');
    if (slug) next.set('cat', slug);
    else next.delete('cat');
    return '?' + next;
  };
  return <div className="wrap page">
    <PageHeading title={active?.name ?? 'Catálogo'}>Precios en pesos mexicanos.</PageHeading>
    <Resource value={categories} label="Cargando categorías…">{items => <>
      <nav className="chips" aria-label="Filtrar por categoría">
        <Link to={categoryUrl('')} aria-current={!normalized ? 'true' : undefined}>Todos</Link>
        {items.map(item => <Link key={item.id} aria-current={item.id === active?.id ? 'true' : undefined} to={categoryUrl(item.slug)}>{item.name}</Link>)}
      </nav>
      <FilterForm key={params.toString()} params={params} setParams={setParams} />
      {normalized && !active
        ? <State title="Categoría no disponible" action={<Link className="button secondary" to="/productos">Ver todos</Link>} />
        : <CatalogResults params={params} categoryId={active?.id} />}
    </>}</Resource>
  </div>;
}
