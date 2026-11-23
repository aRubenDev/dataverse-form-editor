import { describe, expect, it } from 'vitest';
import { parseConnectionString } from './connectionString';
import { normalizeOrgUrl } from './orgUrl';

describe('parseConnectionString', () => {
  it('lee una cadena OAuth típica de XRM Toolbox', () => {
    const p = parseConnectionString(
      'AuthType=OAuth;Url=https://org123.crm4.dynamics.com/;AppId=51f81489-12ee-4a9e-aaae-a2591f45987d;RedirectUri=app://58145B91-0C36-4500-8554-080854F2AC97;LoginPrompt=Auto;Username=ruben@contoso.com',
    );
    expect(p.orgUrl).toBe('https://org123.crm4.dynamics.com');
    expect(p.clientId).toBe('51f81489-12ee-4a9e-aaae-a2591f45987d');
    expect(p.loginHint).toBe('ruben@contoso.com');
    expect(p.prompt).toBeUndefined();
  });

  it('claves en cualquier capitalización, espacios y comillas', () => {
    const p = parseConnectionString(' url = "https://org.crm.dynamics.com" ; appid=abc ; LOGINPROMPT=Always ;');
    expect(p.orgUrl).toBe('https://org.crm.dynamics.com');
    expect(p.prompt).toBe('select_account');
  });

  it('rechaza secretos y AuthType no OAuth', () => {
    expect(() => parseConnectionString('AuthType=ClientSecret;Url=https://o.crm.dynamics.com;ClientId=x;ClientSecret=y')).toThrow(/credenciales/);
    expect(() => parseConnectionString('AuthType=Office365;Url=https://o.crm.dynamics.com')).toThrow(/AuthType/);
  });

  it('exige Url', () => {
    expect(() => parseConnectionString('AuthType=OAuth;AppId=x')).toThrow(/Url/);
    expect(() => parseConnectionString('')).toThrow();
  });
});

describe('normalizeOrgUrl', () => {
  it('acepta host sin esquema y recorta ruta', () => {
    expect(normalizeOrgUrl('org.crm4.dynamics.com/main.aspx')).toBe('https://org.crm4.dynamics.com');
  });
  it('rechaza http', () => {
    expect(() => normalizeOrgUrl('http://org.crm4.dynamics.com')).toThrow();
  });
});
