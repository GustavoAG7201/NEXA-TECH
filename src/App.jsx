import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CatalogLink, State } from './components/ui.jsx';
import { AuthProvider } from './context/authcontext.jsx';
import { BasketProvider } from './context/cartcontext.jsx';
import { MainLayout } from './layouts/mainlayout.jsx';
import { Cart } from './pages/cart.jsx';
import { Checkout } from './pages/checkout.jsx';
import { Help, Policies } from './pages/help.jsx';
import { Home } from './pages/home.jsx';
import { AuthForm } from './pages/login.jsx';
import { MyReturns } from './components/customer-returns.jsx';
import { MySupport } from './components/customer-support.jsx';
import { OrderConfirmation, Orders } from './pages/orderconfirmation.jsx';
import { Detail } from './pages/productdetail.jsx';
import { Catalog } from './pages/products.jsx';
import { Profile } from './pages/profile.jsx';
import { Wishlist } from './pages/wishlist.jsx';
import './App.css';

const Admin = lazy(() => import('./pages/admin.jsx').then(module => ({ default: module.Admin })));

export default function App() {
  return <BrowserRouter>
    <AuthProvider><BasketProvider>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="productos" element={<Catalog />} />
          <Route path="producto/:id" element={<Detail />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="carrito" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="pedidos" element={<Orders />} />
          <Route path="pedidos/:id" element={<OrderConfirmation />} />
          <Route path="pedidos/:id/confirmacion" element={<OrderConfirmation confirmation />} />
          <Route path="cuenta/solicitudes/:id?" element={<MyReturns />} />
          <Route path="cuenta/soporte/:id?" element={<MySupport />} />
          <Route path="login" element={<AuthForm key="login" />} />
          <Route path="registro" element={<AuthForm key="register" register />} />
          <Route path="perfil" element={<Profile />} />
          <Route path="ayuda" element={<Help />} />
          <Route path="politicas/:kind?" element={<Policies />} />
          <Route path="administracion/:section?/:id?" element={<Suspense fallback={<div className="wrap page" role="status">Cargando panel…</div>}><Admin /></Suspense>} />
          <Route path="*" element={<div className="wrap page"><State title="Página no encontrada" action={<CatalogLink />} /></div>} />
        </Route>
      </Routes>
    </BasketProvider></AuthProvider>
  </BrowserRouter>;
}
