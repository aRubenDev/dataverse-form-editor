import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type Configuration,
} from '@azure/msal-browser';

import { normalizeOrgUrl } from './orgUrl';

export interface AuthConfig {
  clientId: string;
  /** 'organizations', 'common' o GUID de tenant */
  tenant: string;
  /** https://org12345.crm4.dynamics.com (sin barra final) */
  orgUrl: string;
  /** Solo en memoria (no se persiste): cuenta a preseleccionar, viene de Username= */
  loginHint?: string;
  /** Solo en memoria: LoginPrompt=Always */
  prompt?: 'select_account';
}

export interface RecentOrg {
  orgUrl: string;
  account?: string;
}

const RECENTS_KEY = 'dfd.recentOrgs';

export function loadRecents(): RecentOrg[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') as RecentOrg[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Entornos usados recientemente (más reciente primero, máx. 8), como la lista de conexiones de XRM Toolbox. */
export function rememberOrg(orgUrl: string, account?: string): void {
  try {
    const next = [{ orgUrl, account }, ...loadRecents().filter((r) => r.orgUrl !== orgUrl)].slice(0, 8);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* no crítico */
  }
}

const STORAGE_KEY = 'dfd.authConfig';

export function loadConfig(): AuthConfig {
  const env = import.meta.env;
  const fallback: AuthConfig = {
    clientId: env.VITE_AZURE_CLIENT_ID ?? '',
    tenant: env.VITE_AZURE_TENANT || 'organizations',
    orgUrl: env.VITE_DEFAULT_ORG_URL ?? '',
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<AuthConfig>) } : fallback;
  } catch {
    return fallback;
  }
}

/** Solo se guardan datos no secretos (ids y URL). Los tokens los gestiona MSAL en sessionStorage. */
export function saveConfig(cfg: AuthConfig): void {
  try {
    const { clientId, tenant, orgUrl } = cfg;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ clientId, tenant, orgUrl }));
  } catch {
    /* almacenamiento no disponible: no es crítico */
  }
}

export function validateConfig(cfg: AuthConfig): string | null {
  if (!/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(cfg.clientId.trim()))
    return 'El Client ID debe ser un GUID (Application ID de tu App Registration).';
  try {
    normalizeOrgUrl(cfg.orgUrl);
  } catch (e) {
    return e instanceof Error ? e.message : 'URL de entorno inválida.';
  }
  return null;
}

export const scopesFor = (orgUrl: string): string[] => [`${orgUrl}/user_impersonation`];

export async function createMsal(cfg: AuthConfig): Promise<PublicClientApplication> {
  const config: Configuration = {
    auth: {
      clientId: cfg.clientId.trim(),
      authority: `https://login.microsoftonline.com/${cfg.tenant.trim() || 'organizations'}`,
      // Página puente (ver redirect.html). Debe estar registrada como SPA redirect URI.
      redirectUri: `${window.location.origin}/redirect.html`,
    },
    cache: { cacheLocation: 'sessionStorage' },
  };
  const pca = new PublicClientApplication(config);
  await pca.initialize();
  return pca;
}

export { InteractionRequiredAuthError, normalizeOrgUrl };
export type { AccountInfo, PublicClientApplication };
