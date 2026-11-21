import { useCallback } from 'react';
import { ProductCard } from '../components/product-card.jsx';
import { CatalogLink, PageHeading, Resource, State } from '../components/ui.jsx';
import { useBasket } from '../context/basket.js';
import { useResource } from '../hooks/useResource.js';
import { loadProducts } from '../lib/catalog.js';

function MissingFavorite({ slug }) {
  const { toggle, favoritesLocked } = useBasket();
  return <div className="surface removed-favorite">
    <p>Producto retirado del catálogo</p><button className="button secondary" disabled={favoritesLocked} onClick={() => toggle(slug)}>Quitar de favoritos</button>
  </div>;
}

export function Wishlist() {
  const { favorites, signedIn, favoriteList } = useBasket();
  const load = useCallback(() => loadProducts(favorites), [favorites]);
  const resource = useResource(load, favorites.length > 0);
  return <div className="wrap page">
    <PageHeading title="Favoritos">{signedIn ? 'Tus productos guardados en la cuenta.' : 'Tus productos guardados en este navegador.'}</PageHeading>
    {favoriteList.pending || favoriteList.error ? <Resource value={favoriteList} label="Cargando favoritos…">{() => null}</Resource> : !favorites.length
      ? <State title="Aún no tienes favoritos" action={<CatalogLink />}>Usa el corazón para guardar un producto.</State>
      : <Resource value={resource} label="Cargando favoritos…">{products => <div className="product-grid">
        {products.map((product, index) => product
          ? <ProductCard key={product.id} product={product} />
          : <MissingFavorite key={favorites[index]} slug={favorites[index]} />)}
      </div>}</Resource>}
  </div>;
}
