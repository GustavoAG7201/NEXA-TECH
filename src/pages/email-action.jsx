import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading } from '../components/ui.jsx';
import { identityError } from '../lib/account.js';
import { confirmEmailAction } from '../lib/session.js';

export function EmailAction({ reset = false }) {
  const [token] = useState(() => window.location.hash.slice(1));
  const [status, setStatus] = useState({});
  const heading = reset ? 'Restablecer contraseña' : 'Verificar correo';
  async function submit(event) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get('password') ?? undefined;
    setStatus({ busy: true });
    try {
      await confirmEmailAction(reset ? 'reset' : 'verify', token, password);
      window.history.replaceState(window.history.state, '', window.location.pathname);
      setStatus({ success: true });
    } catch (error) {
      setStatus({ error: identityError(error) });
    }
  }
  return <div className="wrap page">
    <section className="surface auth-panel">
      <PageHeading title={heading} />
      {status.success ? <p role="status">{reset ? 'Contraseña actualizada.' : 'Correo verificado.'}
        {' '}<Link className="text-link" to={reset ? '/login' : '/perfil'}>Continuar</Link>
      </p> : /^[a-f0-9]{64}$/.test(token) ? <form className="form-stack" onSubmit={submit}>
        <fieldset disabled={status.busy}>
          {reset && <label>Nueva contraseña<input name="password" type="password" autoComplete="new-password"
            minLength={12} maxLength={256} required /></label>}
          <button className="button primary">{status.busy ? 'Procesando…' : heading}</button>
        </fieldset>
        {status.error && <p role="alert" className="feedback error">{status.error}</p>}
      </form> : <p role="alert">El enlace no es válido. <Link className="text-link" to="/login">Ir al acceso</Link></p>}
    </section>
  </div>;
}
