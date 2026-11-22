import { useState } from 'react';
import { ImageOff, LoaderCircle, Minus, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ProductImage({ image, eager = false }) {
  return <ImageAsset key={image?.src} image={image} eager={eager} />;
}

function ImageAsset({ image, eager }) {
  const [failed, setFailed] = useState(false);
  if (!image?.src || failed) return <div className="image-placeholder">
    <ImageOff aria-hidden="true" /><span>Imagen no disponible</span>
  </div>;
  return <img src={image.src} alt={image.alt ?? ''} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined}
    decoding="async" onError={() => setFailed(true)} />;
}

export function PageHeading({ title, children, eyebrow }) {
  return <div className="page-heading">
    {eyebrow && <p className="eyebrow">{eyebrow}</p>}
    <h1>{title}</h1>
    {children && <p className="lede">{children}</p>}
  </div>;
}

export function State({ title, children, action }) {
  return <div className="state">
    <h2>{title}</h2>
    {children && <p>{children}</p>}
    {action}
  </div>;
}

export function Resource({ value, label, children }) {
  if (value.pending) return <p className="resource-message" role="status"><LoaderCircle aria-hidden="true" /> {label}</p>;
  if (value.error) return <div className="state">
    <p role="alert">La consulta falló. Revisa tu conexión y vuelve a intentarlo.</p>
    <button className="button secondary" onClick={value.retry}>Reintentar</button>
  </div>;
  return children(value.data);
}

export function Quantity({ value, max, onChange, disabled = false }) {
  return <div className="quantity" role="group" aria-label="Cantidad">
    <button type="button" aria-label="Disminuir cantidad" onClick={() => onChange(value - 1)} disabled={disabled || value <= 1}>
      <Minus aria-hidden="true" />
    </button>
    <output aria-live="polite">{value}</output>
    <button type="button" aria-label="Aumentar cantidad" onClick={() => onChange(value + 1)} disabled={disabled || value >= max}>
      <Plus aria-hidden="true" />
    </button>
  </div>;
}

export function CatalogLink({ children = 'Explorar catálogo' }) {
  return <Link className="button primary" to="/productos">{children}</Link>;
}
