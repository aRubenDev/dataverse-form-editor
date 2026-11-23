/** Acepta "https://org.crm4.dynamics.com/", "org.crm4.dynamics.com" o con ruta; devuelve solo el origin https. */
export function normalizeOrgUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error('Indica la URL del entorno.');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error('La URL del entorno no es válida.');
  }
  if (url.protocol !== 'https:') throw new Error('La URL del entorno debe empezar por https://');
  return url.origin;
}
