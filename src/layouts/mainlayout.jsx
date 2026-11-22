import { useEffect, useState, useSyncExternalStore } from 'react';
import { Heart, Menu, Moon, Search, ShoppingBag, Sun, UserRound, X, Zap } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthSession } from '../context/auth-session.js';
import { useBasket } from '../context/basket.js';
import { SupportLinks } from '../components/legal-contact.jsx';
import { useResource } from '../hooks/useResource.js';
import { request } from '../lib/api.js';
import { commerceMessage } from '../lib/commerce.js';
import { policyPath, policyRoutes } from '../lib/policies.js';
import { CartDrawer } from '../pages/cart.jsx';

const navigation = [
  ['Catálogo', '/productos'], ['Computadoras', '/productos?cat=computadoras'],
  ['Audio', '/productos?cat=audio'], ['Smartphones', '/productos?cat=smartphones'], ['Ayuda', '/ayuda'],
];
const loadContact = () => request('legal-contact');

function Brand() {
  return <Link className="brand" to="/" aria-label="NexaTech, inicio">
    <span className="brand-mark"><Zap aria-hidden="true" fill="currentColor" /></span>
    <span>NEXA<span className="brand-accent">TECH</span></span>
  </Link>;
}

function SearchForm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get('q') ?? '';
  function search(event) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get('q')).trim();
    navigate(q ? '/productos?' + new URLSearchParams({ q }) : '/productos');
  }
  return <form className="header-search" role="search" aria-label="Buscar en la tienda" onSubmit={search}>
    <input key={query} aria-label="Buscar en la tienda" name="q" type="search" maxLength="100" defaultValue={query}
      placeholder="Producto, marca o SKU" />
    <button className="icon-button" aria-label="Buscar"><Search aria-hidden="true" /></button>
  </form>;
}

function ThemeToggle() {
  const { getSnapshot, subscribe, toggle } = window.nexaTheme;
  const dark = useSyncExternalStore(subscribe, getSnapshot) === 'dark';
  return <button type="button" className="icon-button theme-toggle" onClick={toggle}
    aria-label="Modo oscuro" aria-pressed={dark} title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
    {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
  </button>;
}

function Header() {
  const { user } = useAuthSession();
  const { cart, favorites, setDrawer } = useBasket();
  const { pathname, search } = useLocation();
  const [menu, setMenu] = useState(false);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  return <header className="site-header">
    <div className="wrap header-main">
      <Brand />
      <div className="header-search-row"><SearchForm />{window.nexaTheme && <ThemeToggle />}</div>
      <div className="header-actions">
        <Link className="icon-button" to="/wishlist" aria-label={'Favoritos (' + favorites.length + ')'}>
          <Heart aria-hidden="true" />{favorites.length > 0 && <span className="counter">{favorites.length}</span>}
        </Link>
        <NavLink className="icon-button" to={user ? '/perfil' : '/login'} aria-label={user ? 'Mi cuenta' : 'Iniciar sesión'}>
          <UserRound aria-hidden="true" />
        </NavLink>
        <button className="icon-button" aria-haspopup="dialog" onClick={() => setDrawer(true)}
          aria-label={'Abrir carrito (' + count + ')'}>
          <ShoppingBag aria-hidden="true" />{count > 0 && <span className="counter">{count}</span>}
        </button>
        <button className="icon-button menu-toggle" onClick={() => setMenu(open => !open)}
          aria-expanded={menu} aria-controls="main-nav" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'}>
          {menu ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
    </div>
    <div className={'nav-shell' + (menu ? ' expanded' : '')}>
      <nav className="wrap main-nav" id="main-nav" aria-label="Navegación principal">
        {navigation.map(([name, url]) => {
          const [route, filter] = url.split('?');
          const current = pathname === route && (new URLSearchParams(search).get('cat') ?? '') ===
            (new URLSearchParams(filter).get('cat') ?? '');
          return <Link key={url} to={url} onClick={() => setMenu(false)} aria-current={current ? 'page' : undefined}>{name}</Link>;
        })}
      </nav>
    </div>
  </header>;
}

function Footer({ contact }) {
  return <footer className="site-footer">
    <div className="wrap footer-content">
      <div><Brand />{contact && <><p>{contact.provider}</p><p className="footer-address">{contact.address}</p></>}</div>
      <div><h2>Catálogo</h2>{navigation.slice(1, 4).map(([name, url]) => <Link key={url} to={url}>{name}</Link>)}</div>
      <nav aria-label="Políticas de NexaTech"><h2>Políticas de la tienda</h2>
        {Object.entries(policyRoutes).map(([kind, [, label]]) => <Link key={kind} to={policyPath(kind)}>{label}</Link>)}
      </nav>
      <div><h2>Ayuda</h2><Link to="/ayuda">Centro de ayuda</Link><Link to="/cuenta/soporte">Soporte</Link>
        <SupportLinks contact={contact} />
      </div>
    </div>
    <div className="wrap footer-note">Precios en pesos mexicanos. No se realizan cargos reales.</div>
  </footer>;
}

function RoutePosition() {
  const { pathname, hash, key } = useLocation();
  useEffect(() => {
    if (hash) {
      const frame = requestAnimationFrame(() => {
        const section = document.getElementById(hash.slice(1));
        section?.scrollIntoView();
        section?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(frame);
    }
    if (key === 'default') return;
    window.scrollTo(0, 0);
    document.getElementById('contenido')?.focus({ preventScroll: true });
  }, [pathname, hash, key]);
  return null;
}

export function MainLayout() {
  const { favoriteError } = useBasket();
  const contact = useResource(loadContact);
  return <>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <Header />
    {favoriteError && <p className="wrap feedback error" role="alert">Favoritos. {commerceMessage(favoriteError)}</p>}
    <main id="contenido" tabIndex="-1"><Outlet context={{ contact }} /></main>
    <Footer contact={contact.data} />
    <CartDrawer />
    <RoutePosition />
  </>;
}
