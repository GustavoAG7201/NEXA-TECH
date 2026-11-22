import { useCallback, useState } from 'react';
import { ChevronLeft, ShoppingBag } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { FavoriteButton, ProductPrice } from '../components/product-card.jsx';
import { CatalogLink, ProductImage, Quantity, Resource, State } from '../components/ui.jsx';
import { useBasket } from '../context/basket.js';
import { useResource } from '../hooks/useResource.js';
import { loadProduct, preferredVariant, productSlug } from '../lib/catalog.js';

function Gallery({ images }) {
  const [selected, setSelected] = useState(0);
  return <div>
    <div className="detail-photo"><ProductImage image={images[selected]} eager /></div>
    {images.length > 1 && <div className="thumbnails" role="group" aria-label="Galería del producto">
      {images.map((image, index) => <button className="thumbnail" key={image.position} type="button"
        aria-pressed={selected === index} aria-label={image.alt ?? 'Imagen ' + (index + 1)} onClick={() => setSelected(index)}>
        <img src={image.src} alt="" />
      </button>)}
    </div>}
  </div>;
}

function Purchase({ product }) {
  const [selected, setSelected] = useState(() => preferredVariant(product).id);
  const variant = product.variants.find(item => item.id === selected) ?? preferredVariant(product);
  const [quantity, setQuantity] = useState(1);
  const { add, locked } = useBasket();
  const specs = Object.entries(product.specs?.caracteristicas ?? {});
  if (variant.weightG) specs.push(['Peso', variant.weightG + ' g']);
  if (variant.lengthMm) specs.push(['Dimensiones (largo × ancho × alto)', [variant.lengthMm, variant.widthMm, variant.heightMm].join(' × ') + ' mm']);
  return <>
    <div className="detail-price"><ProductPrice variant={variant} /></div>
    <p className="detail-description">{product.description}</p>
    {product.variants.length > 1
      ? <label className="option-field">Variante<select value={variant.id} onChange={event => {
        setSelected(event.target.value);
        setQuantity(1);
      }}>{product.variants.map(item => <option value={item.id} key={item.id}>{item.optionLabel}</option>)}</select></label>
      : <p className="variant-text">Variante <strong>{variant.optionLabel}</strong></p>}
    <p className="product-meta">SKU {variant.sku}</p>
    <p role="status" className={variant.stockOnHand ? 'stock in-stock' : 'stock out-of-stock'}>
      {variant.stockOnHand ? 'En existencia · ' + variant.stockOnHand + ' unidades' : 'Agotado'}
    </p>
    <div className="buy-row">
      {variant.stockOnHand > 0 && <Quantity value={quantity} max={Math.min(variant.stockOnHand, 100)} onChange={setQuantity} />}
      <button className="button primary" disabled={locked || variant.stockOnHand === 0} onClick={() => add(product, variant, quantity)}>
        <ShoppingBag aria-hidden="true" /> Agregar al carrito
      </button>
      <FavoriteButton product={product} />
    </div>
    <p className="shipping-note"><Link className="text-link" to="/politicas/envios">Política de envíos</Link></p>
    {specs.length > 0 && <section className="specs">
      <h2>Especificaciones</h2>
      <dl>{specs.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl>
    </section>}
  </>;
}

export function Detail() {
  const { id } = useParams();
  const slug = productSlug(id);
  const load = useCallback(() => loadProduct(slug), [slug]);
  const resource = useResource(load);
  return <div className="wrap page">
    <Link className="back-link" to="/productos"><ChevronLeft aria-hidden="true" /> Volver al catálogo</Link>
    <Resource value={resource} label="Cargando ficha y disponibilidad…">{product => {
      if (!product) return <State title="Producto no disponible" action={<CatalogLink />}>La ficha puede haberse retirado del catálogo.</State>;
      return <div className="detail-grid" key={product.id}>
        <Gallery images={product.images} />
        <div className="detail-copy">
          <Link className="eyebrow text-link" to={'/productos?cat=' + product.category.slug}>{product.category.name}</Link>
          <h1>{product.name}</h1>
          <p className="muted">{product.specs?.marca}</p>
          <Purchase product={product} />
        </div>
      </div>;
    }}</Resource>
  </div>;
}
