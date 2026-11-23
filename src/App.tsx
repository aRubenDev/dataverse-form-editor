import { useMemo, useState } from 'react';
import { FilePlus2, FileUp, X } from 'lucide-react';
import { useAuth } from './auth/AuthContext';
import { Canvas } from './components/Canvas';
import { FieldPalette } from './components/FieldPalette';
import { Header } from './components/Header';
import { IssuesPanel } from './components/IssuesPanel';
import { LoginPanel } from './components/LoginPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { XmlDialog } from './components/XmlDialog';
import { parseFormXml } from './domain/formxml/parse';
import { serializeFormXml } from './domain/formxml/serialize';
import { validateForm } from './domain/formxml/validate';
import { clearDraft, readDraft, useEditor } from './state/EditorContext';
import { useMetadata } from './state/useMetadata';

type Dialog = 'import' | 'export' | 'login' | null;

export function App() {
  const auth = useAuth();
  const { state, dispatch } = useEditor();
  const meta = useMetadata();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState(readDraft);

  const issues = useMemo(
    () => (state.present ? validateForm(state.present, state.lcid, meta.attributes) : []),
    [state.present, state.lcid, meta.attributes],
  );
  const errorCount = issues.filter((i) => i.level === 'error').length;

  const confirmDiscard = () => !state.dirty || window.confirm('Hay cambios sin exportar. ¿Descartarlos?');

  const onNew = () => {
    if (confirmDiscard()) dispatch({ type: 'newForm', entity: meta.entity });
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
      dispatch({ type: 'load', form, source: meta.entity ? { entity: meta.entity } : null });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };

  const fileName = `${state.source?.entity || 'form'}_${(state.source?.name || 'formxml').replace(/[^\w-]+/g, '_')}.xml`;

  return (
    <div className="flex h-full flex-col">
      <Header meta={meta} errorCount={errorCount} onNew={onNew} onImport={() => setDialog('import')} onExport={onExport} onLogin={() => setDialog('login')} />

      {auth.needsReauth && (
        <div className="flex items-center gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900">
          La sesión de Microsoft caducó. Tus cambios siguen aquí y hay un borrador local.
          <button className="btn" onClick={() => auth.signIn(auth.config)}>Volver a iniciar sesión</button>
        </div>
      )}
      {(meta.error || notice) && (
        <div className="flex items-center gap-3 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span className="flex-1">{meta.error ?? notice}</span>
          {notice && <button className="btn btn-ghost px-1" onClick={() => setNotice(null)} aria-label="Cerrar"><X size={14} /></button>}
        </div>
      )}

      {state.present ? (
        <>
          <div className="flex min-h-0 flex-1">
            <aside className="w-72 shrink-0 border-r border-slate-300 bg-slate-50">
              <FieldPalette attributes={meta.attributes} entity={meta.entity} loading={meta.busy} />
            </aside>
            <main className="min-w-0 flex-1"><Canvas /></main>
            <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-300 bg-slate-50"><PropertiesPanel /></aside>
          </div>
          <IssuesPanel issues={issues} />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center overflow-auto p-6">
          <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h1 className="text-lg font-semibold">Conectar con Dataverse</h1>
              <p className="mb-4 mt-1 text-sm text-slate-600">
                {auth.status === 'signed-in'
                  ? `Conectado como ${auth.account?.username}. Elige entidad y formulario en la barra superior.`
                  : 'Inicia sesión con tu cuenta de Microsoft para cargar entidades, campos y formularios.'}
              </p>
              {auth.status !== 'signed-in' && <LoginPanel />}
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
                Flujo: conecta → elige formulario → edita → <b>Exportar XML</b> → pégalo en el XML Editor de XRM Toolbox.
              </p>
            </section>
          </div>
        </div>
      )}

      {dialog === 'login' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Conectar con Dataverse</h2>
              <button className="btn btn-ghost px-1" onClick={() => setDialog(null)} aria-label="Cerrar"><X size={16} /></button>
            </div>
            <LoginPanel onDone={() => setDialog(null)} />
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
