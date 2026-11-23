/** GUID en el formato de FormXml: {XXXXXXXX-XXXX-...} en mayúsculas. */
export function newGuid(): string {
  return `{${crypto.randomUUID().toUpperCase()}}`;
}

/** Nombre lógico válido para tab/section: letras, dígitos y _, sin empezar por dígito. */
export const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Genera un nombre único dentro de un conjunto, partiendo de una base. */
export function uniqueName(base: string, taken: Set<string>): string {
  const clean = base.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'item';
  if (!taken.has(clean)) return clean;
  let i = 2;
  while (taken.has(`${clean}_${i}`)) i++;
  return `${clean}_${i}`;
}
