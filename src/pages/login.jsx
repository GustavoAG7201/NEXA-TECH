import { useState } from 'react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeading } from '../components/ui.jsx';
import { useAuthSession } from '../context/auth-session.js';
import { ensureCustomerProfile, identityError, loadMyProfile, saveProfile } from '../lib/account.js';
import { auth, useFirebaseEmulators } from '../lib/firebase.js';

export function AuthForm({ register = false }) {
  const { user, pending, error: sessionError } = useAuthSession();
  const [params] = useSearchParams();
  const { state } = useLocation();
  const checkout = params.get('continuar') === 'checkout';
  const accountRoute = /^\/(?:pedidos(?:\/[a-f0-9-]+(?:\/confirmacion)?)?|cuenta\/(?:solicitudes|soporte)(?:\/(?:nuevo|[a-f0-9-]+))?(?:\?pedido=[a-f0-9-]+)?)$/i;
  const returnTo = accountRoute.test(state?.returnTo ?? '') ? state.returnTo : null;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function resetPassword(event) {
    const email = event.currentTarget.form.elements.email;
    if (busy || !email.reportValidity()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await sendPasswordResetEmail(auth, email.value.trim()).catch(failure => {
        if (failure.code !== 'auth/user-not-found') throw failure;
      });
      setNotice(useFirebaseEmulators ? 'Si la cuenta existe, el emulador genera un enlace de recuperación.'
        : 'Si la cuenta existe, recibirás un enlace para restablecer la contraseña.');
    } catch (failure) {
      setError(identityError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const email = fields.get('email').trim();
    const password = fields.get('password');
    const name = fields.get('name')?.trim();
    if (register && !name) {
      setError('Escribe tu nombre.');
      return;
    }
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (register) {
        const { user: identity } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(identity, { displayName: name });
        await ensureCustomerProfile(identity.uid, name);
        const saved = await loadMyProfile(identity.uid);
        if (saved?.displayName !== name) await saveProfile(identity.uid, name, saved?.phone ?? '');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate(returnTo ?? (checkout ? '/checkout' : '/perfil'), { replace: true });
    } catch (failure) {
      setError(identityError(failure));
    } finally {
      setBusy(false);
    }
  }

  const alternate = register ? '/login' : '/registro';
  return <div className="wrap page">
    <div className="auth-layout">
      <div className="auth-visual">
        <p className="eyebrow">Cuenta NexaTech</p>
        <h2>{register ? 'Tu cuenta para la tienda académica.' : 'Vuelve a tu cuenta.'}</h2>
        <img src="/catalogo/telefono-perfil.jpg" alt="" />
      </div>
      <section className="surface auth-panel">
        <PageHeading title={register ? 'Crea tu cuenta' : 'Inicia sesión'}>Usa datos de prueba para la tienda académica.</PageHeading>
        {pending && <p role="status">Comprobando sesión…</p>}
        {(error || sessionError) && <p role="alert" className="feedback error">{error || identityError(sessionError)}</p>}
        {notice && <p role="status" className="feedback">{notice}</p>}
        {user && !busy ? <div className="form-stack">
          <p>Sesión iniciada como {user.email}.</p>
          <Link className="button primary" to="/perfil">Ir a mi perfil</Link>
          {checkout && <Link className="text-link" to="/checkout">Volver al resumen</Link>}
          {returnTo && <Link className="text-link" to={returnTo}>Volver a la cuenta</Link>}
        </div> : !pending && <form className="form-stack" onSubmit={submit}>
          <fieldset disabled={busy}>
            {register && <label>Nombre completo<input name="name" autoComplete="name" maxLength="120" required /></label>}
            <label>Correo electrónico<input name="email" type="email" autoComplete="email" maxLength="254" required /></label>
            <label>Contraseña<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'}
              minLength={register ? 8 : undefined} required /></label>
            {register && <p className="muted">Usa al menos ocho caracteres.</p>}
            <button className="button primary">{busy ? 'Procesando…' : register ? 'Crear cuenta' : 'Iniciar sesión'}</button>
            {!register && <button type="button" className="button secondary" onClick={resetPassword}>Restablecer contraseña</button>}
          </fieldset>
        </form>}
        {!user && <p className="auth-switch">{register ? '¿Ya tienes cuenta? ' : '¿Aún no tienes cuenta? '}
          <Link className="text-link" state={state} to={alternate + (checkout ? '?continuar=checkout' : '')}>{register ? 'Inicia sesión' : 'Crea una cuenta'}</Link>
        </p>}
        {register && <Link className="text-link" to="/politicas/privacidad">Privacidad de la demostración</Link>}
      </section>
    </div>
  </div>;
}
