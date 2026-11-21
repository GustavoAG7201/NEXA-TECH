import { useCallback, useState } from 'react';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { LayoutDashboard, LogOut, MailCheck, UserRound } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { PageHeading, Resource } from '../components/ui.jsx';
import { useAuthSession } from '../context/auth-session.js';
import { useResource } from '../hooks/useResource.js';
import { ensureCustomerProfile, identityError, loadMyProfile, saveProfile } from '../lib/account.js';
import { auth, useFirebaseEmulators } from '../lib/firebase.js';

const roleNames = { CUSTOMER: 'Cliente', ADMIN: 'Administración', SUPPORT: 'Soporte' };

function ProfileForm({ user, profile, reload }) {
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get('name').trim();
    if (!name) {
      setFeedback({ error: true, text: 'Escribe tu nombre.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      if (profile) await saveProfile(user.uid, name, form.get('phone').trim());
      else await ensureCustomerProfile(user.uid, name);
      reload();
    } catch (failure) {
      setFeedback({ error: true, text: identityError(failure) });
    } finally {
      setBusy(false);
    }
  }
  return <form className="surface form-stack" onSubmit={submit}>
    <h2>{profile ? 'Datos de perfil' : 'Completa tu perfil'}</h2>
    {profile && <p role="status" className="muted">Perfil asociado a tu cuenta en PostgreSQL.</p>}
    <fieldset disabled={busy}>
      <label>Nombre completo<input name="name" autoComplete="name" defaultValue={profile?.displayName ?? user.displayName ?? ''}
        maxLength="120" required /></label>
      {profile && <label>Teléfono de prueba (opcional)<input name="phone" type="tel" autoComplete="tel" defaultValue={profile.phone ?? ''}
        maxLength="25" /></label>}
      <button className="button primary">{busy ? 'Guardando…' : profile ? 'Guardar perfil' : 'Crear perfil'}</button>
    </fieldset>
    {feedback && <p role="alert" className="feedback error">{feedback.text}</p>}
  </form>;
}

function SessionPanel({ user, roles }) {
  const [verified, setVerified] = useState(user.emailVerified);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  async function act(task) {
    setBusy(true);
    setFeedback(null);
    try {
      const text = await task();
      if (text) setFeedback({ text });
    } catch (error) {
      setFeedback({ text: identityError(error), error: true });
    } finally {
      setBusy(false);
    }
  }
  const canUseStaff = roles.some(role => role === 'ADMIN' || role === 'SUPPORT');
  return <aside className="surface session-panel">
    <UserRound aria-hidden="true" />
    <h2>Tu sesión</h2>
    <p className="session-email">{user.email}</p>
    <Link className="button secondary" to="/pedidos">Ver mis pedidos</Link>
    <Link className="button secondary" to="/cuenta/solicitudes">Mis solicitudes</Link>
    <Link className="button secondary" to="/cuenta/soporte">Mis tickets de soporte</Link>
    {roles.length > 0 && <p className="muted">{roles.map(role => roleNames[role] ?? role).join(' · ')}</p>}
    {canUseStaff && (verified ? <Link className="button secondary" to="/administracion">
      <LayoutDashboard aria-hidden="true" /> Abrir panel de personal
    </Link> : <>
      <p>Verifica el correo para abrir el panel de personal.</p>
      <button className="button secondary" disabled={busy} onClick={() => act(async () => {
        await sendEmailVerification(user);
        return useFirebaseEmulators ? 'El enlace de verificación está disponible en el emulador de Auth.'
          : 'Se envió un enlace de verificación a tu correo.';
      })}><MailCheck aria-hidden="true" /> Enviar enlace de verificación</button>
      <button className="button secondary" disabled={busy} onClick={() => act(async () => {
        await user.reload();
        await user.getIdToken(true);
        setVerified(user.emailVerified);
        return user.emailVerified ? 'Correo verificado.' : 'La verificación sigue pendiente.';
      })}>Comprobar verificación</button>
    </>)}
    <button className="button secondary" disabled={busy} onClick={() => act(() => signOut(auth))}>
      <LogOut aria-hidden="true" /> Cerrar sesión
    </button>
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className="feedback">{feedback.text}</p>}
  </aside>;
}

export function Profile() {
  const { user, pending, error } = useAuthSession();
  const [savedBy, setSavedBy] = useState(null);
  const uid = user?.uid;
  const load = useCallback(() => loadMyProfile(uid), [uid]);
  const profile = useResource(load, Boolean(uid));
  if (pending) return <div className="wrap page"><p role="status">Comprobando sesión…</p></div>;
  if (error) return <div className="wrap page"><p role="alert">{identityError(error)}</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <div className="wrap page">
    <PageHeading title="Mi perfil">Consulta y actualiza los datos de tu cuenta.</PageHeading>
    {profile.data && savedBy === uid && <p className="feedback" role="status">Perfil guardado.</p>}
    <Resource value={profile} label="Consultando perfil…">{value => <div className="account-grid" key={uid}>
      <ProfileForm user={user} profile={value} reload={() => { setSavedBy(uid); profile.retry(); }} />
      <SessionPanel user={user} roles={value?.userRoles_on_user.map(item => item.roleCode) ?? []} />
    </div>}</Resource>
    {profile.error && <button className="button secondary" onClick={() => signOut(auth).catch(profile.retry)}>Cerrar sesión</button>}
  </div>;
}
