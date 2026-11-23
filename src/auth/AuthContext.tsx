import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  InteractionRequiredAuthError,
  createMsal,
  loadConfig,
  normalizeOrgUrl,
  rememberOrg,
  saveConfig,
  scopesFor,
  validateConfig,
  type AccountInfo,
  type AuthConfig,
  type PublicClientApplication,
} from './msal';

type Status = 'signed-out' | 'signing-in' | 'signed-in';

interface AuthState {
  status: Status;
  account: AccountInfo | null;
  config: AuthConfig;
  orgUrl: string | null;
  error: string | null;
  /** El token silencioso caducó y hace falta interacción; el editor sigue vivo. */
  needsReauth: boolean;
  signIn: (cfg: AuthConfig) => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AuthConfig>(loadConfig);
  const [status, setStatus] = useState<Status>('signed-out');
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const pcaRef = useRef<PublicClientApplication | null>(null);
  const [orgUrl, setOrgUrl] = useState<string | null>(null);
  const orgRef = useRef<string | null>(null);

  // Restaura sesión si MSAL ya tiene una cuenta cacheada para esta configuración
  useEffect(() => {
    const cfg = loadConfig();
    if (validateConfig(cfg)) return;
    let cancelled = false;
    (async () => {
      try {
        const pca = await createMsal(cfg);
        const acc = pca.getAllAccounts()[0];
        if (!acc || cancelled) return;
        pcaRef.current = pca;
        orgRef.current = normalizeOrgUrl(cfg.orgUrl);
        setOrgUrl(orgRef.current);
        pca.setActiveAccount(acc);
        setAccount(acc);
        setStatus('signed-in');
      } catch {
        /* sin sesión previa: se queda en signed-out */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (cfg: AuthConfig) => {
    setError(null);
    const problem = validateConfig(cfg);
    if (problem) {
      setError(problem);
      return;
    }
    setStatus('signing-in');
    try {
      const orgUrl = normalizeOrgUrl(cfg.orgUrl);
      const clean = { ...cfg, orgUrl };
      saveConfig(clean);
      setConfig(clean);
      const pca = await createMsal(clean);
      const res = await pca.loginPopup({ scopes: scopesFor(orgUrl), loginHint: cfg.loginHint, prompt: cfg.prompt });
      rememberOrg(orgUrl, res.account.username);
      pca.setActiveAccount(res.account);
      pcaRef.current = pca;
      orgRef.current = orgUrl;
      setOrgUrl(orgUrl);
      setAccount(res.account);
      setNeedsReauth(false);
      setStatus('signed-in');
    } catch (e) {
      setStatus('signed-out');
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    const pca = pcaRef.current;
    const acc = account;
    pcaRef.current = null;
    orgRef.current = null;
    setOrgUrl(null);
    setAccount(null);
    setStatus('signed-out');
    try {
      if (pca && acc) await pca.logoutPopup({ account: acc });
    } catch {
      /* cierre de popup por el usuario: la sesión local ya está limpia */
    }
  }, [account]);

  const getToken = useCallback(async (): Promise<string> => {
    const pca = pcaRef.current;
    const org = orgRef.current;
    const acc = pca?.getActiveAccount();
    if (!pca || !org || !acc) throw new Error('No hay sesión iniciada.');
    const request = { scopes: scopesFor(org), account: acc };
    try {
      const r = await pca.acquireTokenSilent(request);
      return r.accessToken;
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        // Un popup lanzado fuera de un gesto del usuario suele bloquearse: lo intentamos y, si falla, avisamos.
        try {
          const r = await pca.acquireTokenPopup(request);
          setNeedsReauth(false);
          return r.accessToken;
        } catch {
          setNeedsReauth(true);
          throw new Error('La sesión caducó. Pulsa "Volver a iniciar sesión" (tus cambios no se pierden).');
        }
      }
      throw e;
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, account, config, orgUrl, error, needsReauth, signIn, signOut, getToken }),
    [status, account, config, orgUrl, error, needsReauth, signIn, signOut, getToken],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return v;
}
