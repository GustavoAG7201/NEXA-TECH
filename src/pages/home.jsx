import { Headphones, Laptop, ShieldCheck, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductCard, ProductPrice } from '../components/product-card.jsx';
import { ProductImage, Resource, State } from '../components/ui.jsx';
import { loadCategories, loadProducts, preferredVariant, primaryCategories } from '../lib/catalog.js';
import { useResource } from '../hooks/useResource.js';

const categoryVisual = {
  computadoras: ['portatil-detalle', Laptop, 'Equipos para estudiar, trabajar y crear.'],
  audio: ['audifonos-detalle', Headphones, 'Audífonos y altavoces para cada espacio.'],
  smartphones: ['telefono-perfil', Smartphone, 'Celulares para tu día a día.'],
};
const featured = () => loadProducts(['novabook-air-14', 'auralis-pro', 'nexa-one', 'pulse-watch-s']);

export function Home() {
  const categories = useResource(loadCategories);
  const highlights = useResource(featured);
  const heroProduct = highlights.data?.[0];
  const phone = highlights.data?.[2];
  return <>
    <section className="hero">
      <div className="wrap hero-layout">
        <div className="hero-copy">
          <p className="eyebrow">Tecnología para tu día a día</p>
          <h1>Tecnología a tu ritmo<span>.</span></h1>
          <p>Encuentra computadoras, audio y smartphones para trabajar, crear y disfrutar.</p>
          <Link className="button hero-button" to="/productos">Explorar catálogo</Link>
        </div>
        <div className="hero-showcase">
          <div className="hero-image">
            <ProductImage image={heroProduct?.images[0]} eager />
          </div>
          {heroProduct && <div className="hero-caption">
            <div><p className="eyebrow">{heroProduct.specs?.marca ?? 'Computadoras'}</p>
              <Link to={'/producto/' + heroProduct.slug}>{heroProduct.name}</Link></div>
            <ProductPrice variant={preferredVariant(heroProduct)} />
          </div>}
        </div>
      </div>
    </section>
    <section className="wrap section">
      <div className="section-top"><h2>Explora por categoría</h2><Link className="text-link" to="/productos">Ver todas</Link></div>
      <Resource value={categories} label="Cargando categorías…">{items => {
        const main = items.filter(category => primaryCategories.includes(category.slug));
        if (!main.length) return <State title="Categorías sin publicar" />;
        return <div className="category-grid">{main.map(category => {
          const [image, Icon, copy] = categoryVisual[category.slug];
          return <Link key={category.id} to={'/productos?cat=' + category.slug} className="category-tile">
            <div><Icon aria-hidden="true" /><h3>{category.name}</h3><p>{copy}</p></div>
            <img src={'/catalogo/' + image + '.jpg'} alt="" loading="lazy" />
          </Link>;
        })}</div>;
      }}</Resource>
    </section>
    <section className="wrap section">
      <div className="section-top"><h2>Selección Nexa</h2>
        <Link className="text-link" to="/productos">Ver catálogo</Link></div>
      <Resource value={highlights} label="Cargando selección…">{items => items.some(Boolean)
        ? <div className="product-grid">{items.filter(Boolean).map(item => <ProductCard key={item.id} product={item} />)}</div>
        : <State title="Selección sin productos disponibles" />}
      </Resource>
    </section>
    {phone && <section className="wrap section">
      <div className="campaign">
        <div><p className="eyebrow">Selección de smartphones</p><h2>{phone.name}</h2><p>{phone.description}</p>
          <Link className="button primary" to={'/producto/' + phone.slug}>Ver ficha</Link></div>
        <ProductImage image={phone.images[0]} />
      </div>
    </section>}
    <section id="beneficios" tabIndex="-1" className="wrap section help-strip">
      <ShieldCheck aria-hidden="true" />
      <div><h2>¿Necesitas ayuda con tu pedido?</h2><p>Consulta las políticas de envío, devoluciones y garantías.</p></div>
      <Link className="button secondary" to="/ayuda">Centro de ayuda</Link>
    </section>
  </>;
}
