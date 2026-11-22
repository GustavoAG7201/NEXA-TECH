import { Heart, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBasket } from '../context/basket.js';
import { money, preferredVariant } from '../lib/catalog.js';
import { ProductImage } from './ui.jsx';

export function FavoriteButton({ product }) {
  const { favorites, toggle, favoritesLocked } = useBasket();
  const selected = favorites.includes(product.slug);
  return <button className="icon-button favorite-button" type="button" aria-pressed={selected}
    aria-label={'Favorito: ' + product.name} disabled={favoritesLocked} onClick={() => toggle(product.slug, product.id)}>
    <Heart aria-hidden="true" fill={selected ? 'currentColor' : 'none'} />
  </button>;
}

export function ProductPrice({ variant }) {
  const compare = Number(variant.compareAtCents) > Number(variant.unitPriceCents);
  return <span className="product-price">
    <strong>{money(variant.unitPriceCents)}</strong>
    {compare && <del aria-label={'Precio de referencia ' + money(variant.compareAtCents)}>{money(variant.compareAtCents)}</del>}
  </span>;
}

export function ProductCard({ product }) {
  const variant = preferredVariant(product);
  const { add, locked } = useBasket();
  const url = '/producto/' + product.slug;
  const sale = Number(variant.compareAtCents) > Number(variant.unitPriceCents);
  return <article className="product-card">
    <div className="product-photo">
      <Link to={url} tabIndex="-1" aria-hidden="true"><ProductImage image={product.images[0]} /></Link>
      {sale && <span className="photo-label">Oferta</span>}
      <FavoriteButton product={product} />
    </div>
    <div className="product-info">
      <p className="product-meta">{[product.specs?.marca, product.category.name].filter(Boolean).join(' · ')}</p>
      <h3><Link to={url}>{product.name}</Link></h3>
      <p className={variant.stockOnHand ? 'stock in-stock' : 'stock out-of-stock'}>{variant.stockOnHand ? 'Disponible' : 'Agotado'}</p>
      <div className="product-bottom">
        <ProductPrice variant={variant} />
        <button className="icon-button add-button" aria-label={'Agregar ' + product.name + ' al carrito'}
          disabled={locked || variant.stockOnHand === 0} onClick={() => add(product, variant)}>
          <ShoppingBag aria-hidden="true" />
        </button>
      </div>
    </div>
  </article>;
}
