import { useRef, useState } from 'react';
import { Copy, Download, Upload, X } from 'lucide-react';

interface Props {
  mode: 'import' | 'export';
  initialXml?: string;
  fileName?: string;
  onImport?: (xml: string) => string | null;
  onClose: () => void;
  onExported?: () => void;
}

export function XmlDialog({ mode, initialXml = '', fileName = 'formxml.xml', onImport, onClose, onExported }: Props) {
  const [xml, setXml] = useState(initialXml);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    onExported?.();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(xml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      onExported?.();
    } catch {
      setError('No se pudo copiar automáticamente; selecciona el texto y usa Ctrl+C.');
    }
  };

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setXml(await f.text());
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-full w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold">{mode === 'export' ? 'Exportar FormXml' : 'Importar FormXml'}</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
          {mode === 'export' ? (
            <p className="text-sm text-slate-600">Pega este XML en el XML Editor de XRM Toolbox (campo <code>formxml</code> del formulario) o guárdalo como fichero.</p>
          ) : (
            <p className="text-sm text-slate-600">Pega el contenido de <code>formxml</code> o carga un fichero .xml. Los eventos, libraries, header/footer, subgrids y web resources se conservan intactos.</p>
          )}
          <textarea
            className="input min-h-[320px] flex-1 resize-none font-mono text-xs"
            spellCheck={false}
            readOnly={mode === 'export'}
            value={xml}
            onChange={(e) => setXml(e.target.value)}
            placeholder={mode === 'import' ? '<form>…</form>' : ''}
          />
          {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          {mode === 'export' ? (
            <>
              <button className="btn" onClick={copy}><Copy size={16} /> {copied ? '¡Copiado!' : 'Copiar'}</button>
              <button className="btn btn-primary" onClick={download}><Download size={16} /> Descargar .xml</button>
            </>
          ) : (
            <>
              <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
              <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> Cargar fichero</button>
              <button
                className="btn btn-primary"
                disabled={!xml.trim()}
                onClick={() => {
                  const err = onImport?.(xml) ?? null;
                  if (err) setError(err);
                  else onClose();
                }}
              >
                Importar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
