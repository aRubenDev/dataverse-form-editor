import { normalizeOrgUrl } from './orgUrl';

export interface ParsedConnection {
  orgUrl: string;
  clientId?: string;
  tenant?: string;
  /** Username= de la cadena: se usa como login_hint para preseleccionar la cuenta */
  loginHint?: string;
  /** LoginPrompt=Always -> fuerza el selector de cuenta */
  prompt?: 'select_account';
}

/** Tokeniza "Clave=Valor;Clave2="valor;con;punto y coma"" (claves insensibles a mayúsculas). */
function tokenize(s: string): Map<string, string> {
  const out = new Map<string, string>();
  let key = '';
  let val = '';
  let inVal = false;
  let quote: string | null = null;
  const flush = () => {
    if (key.trim()) out.set(key.trim().toLowerCase(), val.trim());
    key = '';
    val = '';
    inVal = false;
    quote = null;
  };
  for (const ch of s) {
    if (quote) {
      if (ch === quote) quote = null;
      else val += ch;
      continue;
    }
    if (inVal) {
      if ((ch === '"' || ch === "'") && val.trim() === '') quote = ch;
      else if (ch === ';') flush();
      else val += ch;
      continue;
    }
    if (ch === '=') inVal = true;
    else if (ch === ';') key = '';
    else key += ch;
  }
  flush();
  return out;
}

const SECRET_KEYS = ['clientsecret', 'password', 'certificatethumbprint', 'certificatestorename'];

/**
 * Interpreta una connection string estilo XRM Toolbox / Dataverse
 * (p. ej. `AuthType=OAuth;Url=https://org.crm4.dynamics.com;AppId=...;Username=a@b.com;LoginPrompt=Auto`).
 * RedirectUri y TokenCacheStorePath se ignoran: en navegador la redirección es siempre la de esta app.
 * Las cadenas con secretos se rechazan: un secreto en un SPA quedaría expuesto a cualquiera.
 */
export function parseConnectionString(input: string): ParsedConnection {
  const kv = tokenize(input);
  if (kv.size === 0) throw new Error('La connection string está vacía.');

  for (const k of SECRET_KEYS) {
    if (kv.has(k)) {
      throw new Error(
        'Esta connection string contiene credenciales (secreto, contraseña o certificado). No se admiten en el navegador porque quedarían expuestas; usa una con AuthType=OAuth.',
      );
    }
  }
  const authType = kv.get('authtype');
  if (authType && authType.toLowerCase() !== 'oauth') {
    throw new Error(`AuthType=${authType} no está soportado. Usa AuthType=OAuth (inicio de sesión interactivo).`);
  }

  const url = kv.get('url') ?? kv.get('serviceuri') ?? kv.get('service uri');
  if (!url) throw new Error('Falta el parámetro Url= en la connection string.');

  return {
    orgUrl: normalizeOrgUrl(url),
    clientId: kv.get('appid') ?? kv.get('clientid') ?? undefined,
    tenant: kv.get('tenantid') ?? undefined,
    loginHint: kv.get('username') ?? kv.get('loginhint') ?? undefined,
    prompt: kv.get('loginprompt')?.toLowerCase() === 'always' ? 'select_account' : undefined,
  };
}
