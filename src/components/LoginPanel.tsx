import { useState } from 'react';
import { LogIn, Info } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { AuthConfig } from '../auth/msal';

export function LoginPanel({ onDone }: { onDone?: () => void }) {
  const auth = useAuth();
  const [cfg, setCfg] = useState<AuthConfig>(auth.config);
  const set = (k: keyof AuthConfig) => (e: React.ChangeEvent<HTMLInputElement>) => setCfg({ ...cfg, [k]: e.target.value });
  const busy = auth.status === 'signing-in';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await auth.signIn(cfg);
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label" htmlFor="org">URL del entorno</label>
        <input id="org" className="input" placeholder="https://org12345.crm4.dynamics.com" value={cfg.orgUrl} onChange={set('orgUrl')} />
      </div>
      <div>
        <label className="label" htmlFor="cid">Client ID (App Registration)</label>
        <input id="cid" className="input font-mono" placeholder="00000000-0000-0000-0000-000000000000" value={cfg.clientId} onChange={set('clientId')} />
      </div>
      <div>
        <label className="label" htmlFor="tenant">Tenant</label>
        <input id="tenant" className="input" placeholder="organizations | common | GUID" value={cfg.tenant} onChange={set('tenant')} />
      </div>

      {auth.error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{auth.error}</p>}

      <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy}>
        <LogIn size={16} /> {busy ? 'Esperando al popup de Microsoft…' : 'Iniciar sesión con Microsoft'}
      </button>

      <details className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <summary className="flex cursor-pointer items-center gap-1.5 font-semibold text-slate-700">
          <Info size={14} /> Configuración única de la App Registration
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Entra ID → App registrations → New registration (cuentas de cualquier directorio organizativo).</li>
          <li>Authentication → Add a platform → <b>Single-page application</b>. Redirect URI: <code className="rounded bg-white px-1">{window.location.origin}/redirect.html</code></li>
          <li>API permissions → Add → APIs my organization uses → <b>Dataverse</b> → Delegated → <code>user_impersonation</code>.</li>
          <li>Copia el Application (client) ID aquí. No hay secretos: usa Authorization Code + PKCE.</li>
        </ol>
        <p className="mt-2">XRM Toolbox usa un Client ID propio con redirect nativo; en navegador hace falta uno tipo SPA, por eso no se puede reutilizar.</p>
      </details>
    </form>
  );
}
