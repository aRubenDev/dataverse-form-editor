import { useState } from 'react';
import { ChevronDown, ChevronRight, Info, LogIn } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { parseConnectionString } from '../auth/connectionString';
import { loadRecents, type AuthConfig } from '../auth/msal';

const GUID = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/**
 * Igual que XRM Toolbox: basta la URL del entorno (o una connection string) y se abre el login de Microsoft.
 * El Client ID es una configuración de una sola vez que queda guardada; por eso las opciones avanzadas
 * solo se abren solas si todavía no hay uno válido.
 */
export function LoginPanel({ onDone }: { onDone?: () => void }) {
  const auth = useAuth();
  const [cfg, setCfg] = useState<AuthConfig>(auth.config);
  const [mode, setMode] = useState<'url' | 'cs'>('url');
  const [csText, setCsText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(() => !GUID.test(auth.config.clientId.trim()));
  const recents = loadRecents();
  const busy = auth.status === 'signing-in';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    let toUse: AuthConfig = cfg;
    if (mode === 'cs') {
      try {
        const p = parseConnectionString(csText);
        toUse = {
          orgUrl: p.orgUrl,
          clientId: p.clientId ?? cfg.clientId,
          tenant: p.tenant ?? cfg.tenant,
          loginHint: p.loginHint,
          prompt: p.prompt,
        };
        setCfg(toUse);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : String(err));
        return;
      }
    }
    if (!GUID.test(toUse.clientId.trim())) setAdvanced(true);
    await auth.signIn(toUse);
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="inline-flex rounded-md border border-slate-300 p-0.5 text-sm" role="tablist">
        {(['url', 'cs'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={['rounded px-3 py-1 font-medium', mode === m ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'].join(' ')}
          >
            {m === 'url' ? 'URL del entorno' : 'Connection string'}
          </button>
        ))}
      </div>

      {mode === 'url' ? (
        <div>
          <label className="label" htmlFor="org">URL del entorno</label>
          <input
            id="org"
            className="input"
            list="recent-orgs"
            autoFocus
            placeholder="https://org12345.crm4.dynamics.com"
            value={cfg.orgUrl}
            onChange={(e) => setCfg({ ...cfg, orgUrl: e.target.value, loginHint: undefined, prompt: undefined })}
          />
          <datalist id="recent-orgs">
            {recents.map((r) => <option key={r.orgUrl} value={r.orgUrl}>{r.account}</option>)}
          </datalist>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="cs">Connection string</label>
          <textarea
            id="cs"
            className="input min-h-[88px] font-mono text-xs"
            spellCheck={false}
            autoFocus
            placeholder="AuthType=OAuth;Url=https://org12345.crm4.dynamics.com;AppId=…;Username=usuario@dominio.com;LoginPrompt=Auto"
            value={csText}
            onChange={(e) => setCsText(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Se leen Url, AppId/ClientId, TenantId, Username y LoginPrompt. RedirectUri se ignora. No se aceptan cadenas con secretos.
          </p>
        </div>
      )}

      {(localError || auth.error) && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{localError ?? auth.error}</p>}

      <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy || (mode === 'cs' ? !csText.trim() : !cfg.orgUrl.trim())}>
        <LogIn size={16} /> {busy ? 'Esperando al popup de Microsoft…' : 'Conectar'}
      </button>

      <div className="rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-600">
        <button type="button" className="flex w-full items-center gap-1.5 p-3 text-left font-semibold text-slate-700" onClick={() => setAdvanced((v) => !v)}>
          {advanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Aplicación de Azure (configuración única)
          {!advanced && GUID.test(cfg.clientId.trim()) && <span className="ml-auto font-normal text-emerald-600">configurada</span>}
        </button>
        {advanced && (
          <div className="space-y-3 px-3 pb-3">
            <div>
              <label className="label" htmlFor="cid">Client ID</label>
              <input id="cid" className="input font-mono" placeholder="00000000-0000-0000-0000-000000000000" value={cfg.clientId} onChange={(e) => setCfg({ ...cfg, clientId: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="tenant">Tenant</label>
              <input id="tenant" className="input" placeholder="organizations | common | GUID" value={cfg.tenant} onChange={(e) => setCfg({ ...cfg, tenant: e.target.value })} />
            </div>
            <div className="flex gap-1.5">
              <Info size={14} className="mt-0.5 shrink-0" />
              <p>
                XRM Toolbox usa un AppId propio con redirect nativo (<code>app://…</code>) que un navegador no puede usar. Registra una app tipo <b>Single-page application</b> con redirect{' '}
                <code className="rounded bg-white px-1">{window.location.origin}/redirect.html</code> y permiso Dataverse <code>user_impersonation</code>. Se hace una vez; el Client ID queda guardado
                (o se fija para todos con <code>VITE_AZURE_CLIENT_ID</code>).
              </p>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
