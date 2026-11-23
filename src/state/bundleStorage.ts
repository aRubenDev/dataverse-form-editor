const KEY = 'dfd.bundleRaw';

/** Guarda el texto crudo del paquete para que la paleta de campos sobreviva a una recarga. */
export function saveBundleRaw(raw: string): void {
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* cuota excedida o almacenamiento no disponible: la herramienta sigue funcionando sin persistencia */
  }
}

export function readBundleRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
