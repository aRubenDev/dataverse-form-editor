import { useMemo, useState } from 'react';
import { FilePlus2, FileUp, Terminal, X } from 'lucide-react';
import { Canvas } from './components/Canvas';
import { FieldPalette } from './components/FieldPalette';
import { Header } from './components/Header';
import { IssuesPanel } from './components/IssuesPanel';
import { BundleButton } from './components/BundleButton';
import { PropertiesPanel } from './components/PropertiesPanel';
import { XmlDialog } from './components/XmlDialog';
import { parseFormXml } from './domain/formxml/parse';
import { serializeFormXml } from './domain/formxml/serialize';
import { validateForm } from './domain/formxml/validate';
import { clearDraft, readDraft, useEditor } from './state/EditorContext';
import { readBundleRaw, saveBundleRaw } from './state/bundleStorage';
import { parseBundle, type Bundle } from './domain/bundle';

type Dialog = 'import' | 'export' | null;

function restoreBundle(): Bundle | null {
  const raw = readBundleRaw();
  if (!raw) return null;
  try {
    return parseBundle(raw);
  } catch {
    return null;
  }
}

export function App() {
  const { state, dispatch } = useEditor();
  const [bundle, setBundle] = useState<Bundle | null>(restoreBundle);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState(readDraft);

  const issues = useMemo(
    () => (state.present ? validateForm(state.present, state.lcid, bundle?.attributes ?? []) : []),
    [state.present, state.lcid, bundle],
  );
  const errorCount = issues.filter((i) => i.level === 'error').length;

  const confirmDiscard = () => !state.dirty || window.confirm('Hay cambios sin exportar. ¿Descartarlos?');

  const onNew = () => {
    if (confirmDiscard()) dispatch({ type: 'newForm', entity: bundle?.entity.logicalName ?? '' });
  };

  const onExport = () => {
    if (errorCount > 0) {
      setNotice(`Corrige ${errorCount} error(es) antes de exportar (panel inferior).`);
      return;
    }
    setNotice(null);
    setDialog('export');
  };

  const importXml = (xml: string): string | null => {
    if (!confirmDiscard()) return null;
    try {
      const form = parseFormXml(xml);
      dispatch({ type: 'load', form, source: bundle ? { entity: bundle.entity.logicalName } : null });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };

  const loadForm = (b: Bundle, formId: string) => {
    const f = b.forms.find((x) => x.formId === formId);
    if (!f) return;
    try {
      dispatch({ type: 'load', form: parseFormXml(f.formXml), source: { entity: b.entity.logicalName, formId: f.formId, name: f.name }, lcid: b.baseLanguage });
    } catch (e) {
      setNotice(`No se pudo abrir el formulario "${f.name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const onPickForm = (formId: string) => {
    if (bundle && confirmDiscard()) loadForm(bundle, formId);
  };

  /** Cargar un paquete nunca descarta el formulario abierto: solo cambia la paleta y la lista de formularios. */
  const onBundleText = (raw: string, fileName: string) => {
    try {
      const b = parseBundle(raw);
      setBundle(b);
      saveBundleRaw(raw);
      setNotice(null);
      if (!state.present) {
        if (b.forms.length === 1) loadForm(b, b.forms[0].formId);
        else dispatch({ type: 'setLcid', lcid: b.baseLanguage });
      }
    } catch (e) {
      setNotice(`No se pudo cargar ${fileName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const fileName = `${state.source?.entity || 'form'}_${(state.source?.name || 'formxml').replace(/[^\w-]+/g, '_')}.xml`;

  return (
    <div className="flex h-full flex-col">
      <Header bundle={bundle} errorCount={errorCount} onBundleText={onBundleText} onPickForm={onPickForm} onNew={onNew} onImport={() => setDialog('import')} onExport={onExport} />

      {notice && (
        <div className="flex items-center gap-3 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span className="flex-1">{notice}</span>
          <button className="btn btn-ghost px-1" onClick={() => setNotice(null)} aria-label="Cerrar"><X size={14} /></button>
        </div>
      )}
      {bundle && bundle.warnings.length > 0 && (
        <details className="bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
          <summary className="cursor-pointer">Avisos del paquete ({bundle.warnings.length})</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{bundle.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </details>
      )}

      {state.present ? (
        <>
          <div className="flex min-h-0 flex-1">
            <aside className="w-72 shrink-0 border-r border-slate-300 bg-slate-50">
              <FieldPalette attributes={bundle?.attributes ?? []} entity={bundle?.entity.logicalName ?? ''} loading={false} />
            </aside>
            <main className="min-w-0 flex-1"><Canvas /></main>
            <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-300 bg-slate-50"><PropertiesPanel /></aside>
          </div>
          <IssuesPanel issues={issues} />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center overflow-auto p-6">
          <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h1 className="text-lg font-semibold">Cargar paquete de Dataverse</h1>
              <p className="text-sm text-slate-600">Genera el paquete con PAC CLI y cárgalo aquí. Tendrás las columnas y los formularios de la tabla.</p>
              <pre className="flex items-start gap-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100"><Terminal size={14} className="mt-0.5 shrink-0" /><code>node scripts/export-form-bundle.mjs</code></pre>
              <BundleButton primary onText={onBundleText} label="Cargar paquete (.bundle.json)" />
            </section>
            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Empezar</h2>
              <button className="btn w-full justify-start" onClick={onNew}><FilePlus2 size={16} /> Formulario nuevo</button>
              <button className="btn w-full justify-start" onClick={() => setDialog('import')}><FileUp size={16} /> Importar FormXml (pegar o fichero)</button>
              {draft && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                  <p className="font-medium text-amber-900">Borrador sin exportar · {new Date(draft.savedAt).toLocaleString()}</p>
                  <div className="mt-2 flex gap-2">
                    <button className="btn" onClick={() => { dispatch({ type: 'load', form: draft.form, source: draft.source, lcid: draft.lcid }); }}>Restaurar</button>
                    <button className="btn btn-ghost" onClick={() => { clearDraft(); setDraft(null); }}>Descartar</button>
                  </div>
                </div>
              )}
              <p className="pt-2 text-xs text-slate-500">
                Flujo: script con pac → cargar paquete → elegir formulario → editar → <b>Exportar XML</b> → pegarlo en el XML Editor de XRM Toolbox.
              </p>
            </section>
          </div>
        </div>
      )}

      {dialog === 'import' && <XmlDialog mode="import" onImport={importXml} onClose={() => setDialog(null)} />}
      {dialog === 'export' && state.present && (
        <XmlDialog
          mode="export"
          initialXml={serializeFormXml(state.present)}
          fileName={fileName}
          onClose={() => setDialog(null)}
          onExported={() => { dispatch({ type: 'markExported' }); clearDraft(); setDraft(null); }}
        />
      )}
    </div>
  );
}
