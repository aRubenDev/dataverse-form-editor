import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { TYPE_LABELS, typeForClassId } from '../domain/classIds';
import { fieldReferencedElsewhere } from '../domain/formxml/validate';
import type { Cell, FormModel, Section, Selection, Tab } from '../domain/types';
import { useEditor } from '../state/EditorContext';

const TAB_LAYOUTS: { label: string; widths: string[] }[] = [
  { label: '1 columna', widths: ['100%'] },
  { label: '2 columnas 50/50', widths: ['50%', '50%'] },
  { label: '2 columnas 33/67', widths: ['33%', '67%'] },
  { label: '2 columnas 67/33', widths: ['67%', '33%'] },
  { label: '3 columnas', widths: ['33%', '34%', '33%'] },
];

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

function LabelInput({ labels, target }: { labels: Record<string, string>; target: Exclude<Selection, null> }) {
  const { state, dispatch } = useEditor();
  const lcid = String(state.lcid);
  const others = Object.keys(labels).filter((k) => k !== lcid);
  return (
    <div>
      <label className="label">Etiqueta ({lcid})</label>
      <input className="input" value={labels[lcid] ?? ''} onChange={(e) => dispatch({ type: 'setLabel', target, text: e.target.value })} />
      {others.length > 0 && <p className="mt-1 text-xs text-slate-400">Otros idiomas conservados: {others.join(', ')}</p>}
    </div>
  );
}

function findCellCtx(form: FormModel, id: string): { cell: Cell; section: Section } | null {
  for (const t of form.tabs) for (const c of t.columns) for (const s of c.sections) {
    const cell = s.cells.find((x) => x.id === id);
    if (cell) return { cell, section: s };
  }
  return null;
}
function findSectionById(form: FormModel, id: string): Section | null {
  for (const t of form.tabs) for (const c of t.columns) for (const s of c.sections) if (s.id === id) return s;
  return null;
}

export function PropertiesPanel() {
  const { state, dispatch } = useEditor();
  const form = state.present!;
  const sel = state.selection;
  if (!sel) {
    return (
      <div className="space-y-3 p-4 text-sm text-slate-600">
        <h3 className="text-sm font-semibold text-slate-800">Formulario</h3>
        <p>{form.tabs.length} pestañas. Selecciona una pestaña, sección o campo para editar sus propiedades.</p>
        {form.importWarnings.length > 0 && (
          <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            <b>Avisos de importación</b>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">{form.importWarnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        )}
        {(form.beforeTabs.length + form.afterTabs.length > 0) && (
          <p className="text-xs text-slate-500">
            Se conservan {form.beforeTabs.length + form.afterTabs.length} nodos del formulario que el editor no modifica (events, header, footer, libraries…).
          </p>
        )}
        <p className="text-xs text-slate-400">Atajos: Ctrl+Z deshacer · Ctrl+Shift+Z rehacer · doble clic en un campo de la paleta para añadirlo.</p>
      </div>
    );
  }

  if (sel.kind === 'tab') {
    const tab = form.tabs.find((t) => t.id === sel.id) as Tab | undefined;
    if (!tab) return null;
    const layoutKey = tab.columns.map((c) => c.width).join('|');
    return (
      <div className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Pestaña</h3>
        <LabelInput labels={tab.labels} target={sel} />
        <div>
          <label className="label">Nombre (único)</label>
          <input className="input font-mono" value={tab.name} onChange={(e) => dispatch({ type: 'patchTab', id: tab.id, patch: { name: e.target.value } })} />
        </div>
        <div>
          <label className="label">Diseño de columnas</label>
          <select
            className="input"
            value={TAB_LAYOUTS.find((l) => l.widths.join('|') === layoutKey)?.label ?? ''}
            onChange={(e) => {
              const l = TAB_LAYOUTS.find((x) => x.label === e.target.value);
              if (l) dispatch({ type: 'setTabColumns', id: tab.id, widths: l.widths });
            }}
          >
            {!TAB_LAYOUTS.some((l) => l.widths.join('|') === layoutKey) && <option value="">Personalizado ({layoutKey})</option>}
            {TAB_LAYOUTS.map((l) => <option key={l.label}>{l.label}</option>)}
          </select>
        </div>
        <Check label="Mostrar etiqueta" checked={tab.showlabel} onChange={(v) => dispatch({ type: 'patchTab', id: tab.id, patch: { showlabel: v } })} />
        <Check label="Expandida por defecto" checked={tab.expanded} onChange={(v) => dispatch({ type: 'patchTab', id: tab.id, patch: { expanded: v } })} />
        <Check label="Visible" checked={tab.visible} onChange={(v) => dispatch({ type: 'patchTab', id: tab.id, patch: { visible: v } })} />
        <div className="flex gap-2 pt-1">
          <button className="btn" onClick={() => dispatch({ type: 'moveTab', id: tab.id, dir: -1 })}><ArrowUp size={14} className="-rotate-90" /> Izq.</button>
          <button className="btn" onClick={() => dispatch({ type: 'moveTab', id: tab.id, dir: 1 })}><ArrowDown size={14} className="-rotate-90" /> Der.</button>
          <button
            className="btn ml-auto text-red-600"
            onClick={() => {
              const n = tab.columns.reduce((a, c) => a + c.sections.length, 0);
              if (n === 0 || window.confirm(`¿Eliminar la pestaña con ${n} secciones?`)) dispatch({ type: 'removeTab', id: tab.id });
            }}
          ><Trash2 size={14} /> Eliminar</button>
        </div>
      </div>
    );
  }

  if (sel.kind === 'section') {
    const sec = findSectionById(form, sel.id);
    if (!sec) return null;
    return (
      <div className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Sección</h3>
        <LabelInput labels={sec.labels} target={sel} />
        <div>
          <label className="label">Nombre (único)</label>
          <input className="input font-mono" value={sec.name} onChange={(e) => dispatch({ type: 'patchSection', id: sec.id, patch: { name: e.target.value } })} />
        </div>
        <div>
          <label className="label">Columnas</label>
          <select className="input" value={sec.columns} onChange={(e) => dispatch({ type: 'patchSection', id: sec.id, patch: { columns: Number(e.target.value) } })}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <Check label="Mostrar etiqueta" checked={sec.showlabel} onChange={(v) => dispatch({ type: 'patchSection', id: sec.id, patch: { showlabel: v } })} />
        <Check label="Mostrar barra separadora" checked={sec.showbar} onChange={(v) => dispatch({ type: 'patchSection', id: sec.id, patch: { showbar: v } })} />
        {sec.extraXml.length > 0 && <p className="text-xs text-slate-500">Contiene {sec.extraXml.length} nodo(s) adicional(es) conservado(s).</p>}
      </div>
    );
  }

  const ctx = findCellCtx(form, sel.id);
  if (!ctx) return null;
  const { cell, section } = ctx;
  const typeKey = cell.field ? typeForClassId(cell.field.classId) : undefined;

  const remove = () => {
    if (cell.field && fieldReferencedElsewhere(form, cell.field.dataField)) {
      if (!window.confirm(`"${cell.field.dataField}" está referenciado en eventos/header/footer del formulario. Al quitarlo esas referencias quedarán rotas. ¿Eliminar igualmente?`)) return;
    }
    dispatch({ type: 'removeCell', id: cell.id });
  };

  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">{cell.kind === 'field' ? 'Campo' : cell.kind === 'opaque' ? 'Control especial' : 'Celda vacía'}</h3>
      {cell.kind === 'field' && cell.field && (
        <>
          <LabelInput labels={cell.labels} target={sel} />
          <div>
            <label className="label">Campo</label>
            <input className="input bg-slate-50 font-mono" readOnly value={cell.field.dataField} />
            <p className="mt-1 text-xs text-slate-500">{typeKey ? TYPE_LABELS[typeKey] : 'Control personalizado'} · {cell.field.classId}</p>
          </div>
          <div>
            <label className="label">Id del control</label>
            <input className="input font-mono" value={cell.field.controlId} onChange={(e) => dispatch({ type: 'patchField', id: cell.id, patch: { controlId: e.target.value } })} />
          </div>
          <Check label="Mostrar etiqueta" checked={cell.showlabel} onChange={(v) => dispatch({ type: 'patchCell', id: cell.id, patch: { showlabel: v } })} />
          <Check label="Deshabilitado (solo lectura)" checked={cell.field.disabled} onChange={(v) => dispatch({ type: 'patchField', id: cell.id, patch: { disabled: v } })} />
        </>
      )}
      {cell.kind === 'opaque' && (
        <p className="text-sm text-slate-600">
          Este control ({cell.opaqueInfo?.controlId}) se exporta exactamente como estaba. Puedes moverlo o eliminarlo, pero para configurarlo usa el XML Editor.
        </p>
      )}
      {cell.kind !== 'opaque' && (
        <div>
          <label className="label">Columnas que ocupa</label>
          <select className="input" value={Math.min(cell.colspan, section.columns)} onChange={(e) => dispatch({ type: 'patchCell', id: cell.id, patch: { colspan: Number(e.target.value) } })}>
            {Array.from({ length: section.columns }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}
      <button className="btn text-red-600" onClick={remove}><Trash2 size={14} /> Eliminar</button>
    </div>
  );
}
