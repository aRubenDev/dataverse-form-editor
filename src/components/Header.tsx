import { FileDown, FilePlus2, FileUp, LayoutTemplate, LogIn, LogOut, Redo2, Undo2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useEditor } from '../state/EditorContext';
import type { Metadata } from '../state/useMetadata';

const BASE_LANGS: [number, string][] = [
  [1033, 'English (1033)'],
  [3082, 'Español (3082)'],
  [1027, 'Català (1027)'],
  [1036, 'Français (1036)'],
  [1031, 'Deutsch (1031)'],
  [1040, 'Italiano (1040)'],
  [2070, 'Português (2070)'],
];

interface Props {
  meta: Metadata;
  errorCount: number;
  onNew: () => void;
  onImport: () => void;
  onExport: () => void;
  onLogin: () => void;
}

export function Header({ meta, errorCount, onNew, onImport, onExport, onLogin }: Props) {
  const auth = useAuth();
  const { state, dispatch } = useEditor();
  const langs = BASE_LANGS.some(([n]) => n === state.lcid) ? BASE_LANGS : [...BASE_LANGS, [state.lcid, `Idioma ${state.lcid}`] as [number, string]];
  const signedIn = auth.status === 'signed-in';

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-300 bg-white px-3">
      <div className="mr-2 flex items-center gap-2 font-semibold"><LayoutTemplate size={18} className="text-brand-600" /> Form Designer</div>

      {signedIn && (
        <>
          <select className="input w-48" value={meta.entity} onChange={(e) => meta.setEntity(e.target.value)} aria-label="Entidad">
            <option value="">Entidad…</option>
            {meta.entities.map((e) => <option key={e.logicalName} value={e.logicalName}>{e.displayName} ({e.logicalName})</option>)}
          </select>
          <select
            className="input w-56"
            value={state.source?.formId ?? ''}
            disabled={meta.forms.length === 0}
            onChange={(e) => meta.loadForm(e.target.value)}
            aria-label="Formulario"
          >
            <option value="">Formulario…</option>
            {meta.forms.map((f) => <option key={f.formId} value={f.formId}>{f.name} ({{ 2: 'Main', 6: 'Quick view', 7: 'Quick create' }[f.type] ?? f.type})</option>)}
          </select>
        </>
      )}

      <div className="ml-2 flex items-center gap-1">
        <button className="btn btn-ghost px-2" onClick={onNew} title="Formulario nuevo"><FilePlus2 size={16} /></button>
        <button className="btn btn-ghost px-2" onClick={onImport} title="Importar XML"><FileUp size={16} /></button>
        {state.present && (
          <>
            <button className="btn btn-ghost px-2" disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })} title="Deshacer (Ctrl+Z)"><Undo2 size={16} /></button>
            <button className="btn btn-ghost px-2" disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })} title="Rehacer (Ctrl+Shift+Z)"><Redo2 size={16} /></button>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {meta.busy && <span className="text-xs text-slate-500">Cargando…</span>}
        {state.dirty && <span className="text-xs text-amber-600">● sin exportar</span>}
        <select className="input w-40" value={state.lcid} onChange={(e) => dispatch({ type: 'setLcid', lcid: Number(e.target.value) })} aria-label="Idioma de etiquetas">
          {langs.map(([n, l]) => <option key={n} value={n}>{l}</option>)}
        </select>
        <button className="btn btn-primary" disabled={!state.present} onClick={onExport} title={errorCount ? 'Hay errores que corregir antes de exportar' : 'Exportar FormXml'}>
          <FileDown size={16} /> Exportar XML
        </button>
        {signedIn ? (
          <button className="btn" onClick={auth.signOut} title={auth.account?.username}><LogOut size={16} /> Salir</button>
        ) : (
          <button className="btn" onClick={onLogin}><LogIn size={16} /> Conectar</button>
        )}
      </div>
    </header>
  );
}
