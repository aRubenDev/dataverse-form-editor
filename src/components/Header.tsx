import { FileDown, FilePlus2, FileUp, LayoutTemplate, Redo2, Undo2 } from 'lucide-react';
import type { Bundle } from '../domain/bundle';
import { useEditor } from '../state/EditorContext';
import { BundleButton } from './BundleButton';

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
  bundle: Bundle | null;
  errorCount: number;
  onBundleText: (text: string, fileName: string) => void;
  onPickForm: (formId: string) => void;
  onNew: () => void;
  onImport: () => void;
  onExport: () => void;
}

export function Header({ bundle, errorCount, onBundleText, onPickForm, onNew, onImport, onExport }: Props) {
  const { state, dispatch } = useEditor();
  const langs = BASE_LANGS.some(([n]) => n === state.lcid) ? BASE_LANGS : [...BASE_LANGS, [state.lcid, `Idioma ${state.lcid}`] as [number, string]];

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-300 bg-white px-3">
      <div className="mr-2 flex items-center gap-2 font-semibold"><LayoutTemplate size={18} className="text-brand-600" /> Form Designer</div>

      <BundleButton onText={onBundleText} />
      {bundle && (
        <>
          <span className="max-w-[16rem] truncate text-xs text-slate-500" title={`${bundle.environment} · ${bundle.solution}`}>
            <b className="text-slate-700">{bundle.entity.displayName}</b> · {bundle.solution}
          </span>
          <select
            className="input w-56"
            value={state.source?.formId ?? ''}
            onChange={(e) => e.target.value && onPickForm(e.target.value)}
            aria-label="Formulario del paquete"
          >
            <option value="">Formulario…</option>
            {bundle.forms.map((f) => <option key={f.formId} value={f.formId}>{f.name} ({f.type})</option>)}
          </select>
        </>
      )}

      <div className="ml-2 flex items-center gap-1">
        <button className="btn btn-ghost px-2" onClick={onNew} title="Formulario nuevo"><FilePlus2 size={16} /></button>
        <button className="btn btn-ghost px-2" onClick={onImport} title="Importar FormXml"><FileUp size={16} /></button>
        {state.present && (
          <>
            <button className="btn btn-ghost px-2" disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })} title="Deshacer (Ctrl+Z)"><Undo2 size={16} /></button>
            <button className="btn btn-ghost px-2" disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })} title="Rehacer (Ctrl+Shift+Z)"><Redo2 size={16} /></button>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {state.dirty && <span className="text-xs text-amber-600">● sin exportar</span>}
        <select className="input w-40" value={state.lcid} onChange={(e) => dispatch({ type: 'setLcid', lcid: Number(e.target.value) })} aria-label="Idioma de etiquetas">
          {langs.map(([n, l]) => <option key={n} value={n}>{l}</option>)}
        </select>
        <button className="btn btn-primary" disabled={!state.present} onClick={onExport} title={errorCount ? 'Hay errores que corregir antes de exportar' : 'Exportar FormXml'}>
          <FileDown size={16} /> Exportar XML
        </button>
      </div>
    </header>
  );
}
