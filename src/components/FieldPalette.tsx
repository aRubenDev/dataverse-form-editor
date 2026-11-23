import { useMemo, useState } from 'react';
import { CheckCircle2, Minus, Plus, Search } from 'lucide-react';
import { TYPE_LABELS } from '../domain/classIds';
import type { AttributeMeta, FormModel, Selection } from '../domain/types';
import { useEditor } from '../state/EditorContext';
import { endDrag, startDrag } from './dnd';

/** Sección donde se inserta un campo al pulsarlo: la seleccionada, la de la celda seleccionada, o la primera. */
function targetSectionId(form: FormModel, sel: Selection): string | null {
  let first: string | null = null;
  for (const t of form.tabs)
    for (const c of t.columns)
      for (const s of c.sections) {
        first ??= s.id;
        if (sel?.kind === 'section' && sel.id === s.id) return s.id;
        if (sel?.kind === 'cell' && s.cells.some((x) => x.id === sel.id)) return s.id;
        if (sel?.kind === 'tab' && sel.id === t.id) return s.id;
      }
  return first;
}

export function FieldPalette({ attributes, entity, loading }: { attributes: AttributeMeta[]; entity: string; loading: boolean }) {
  const { state, dispatch } = useEditor();
  const form = state.present!;
  const [q, setQ] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualType, setManualType] = useState('string');

  const used = useMemo(() => {
    const s = new Set<string>();
    for (const t of form.tabs) for (const c of t.columns) for (const sec of c.sections) for (const cell of sec.cells) if (cell.field) s.add(cell.field.dataField);
    return s;
  }, [form]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? attributes.filter((a) => a.logicalName.includes(n) || a.displayName.toLowerCase().includes(n)) : attributes;
  }, [attributes, q]);

  const target = targetSectionId(form, state.selection);
  const add = (attr: AttributeMeta) => target && dispatch({ type: 'addField', attr, sectionId: target, beforeCellId: null });

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-slate-200 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Campos {entity && <span className="normal-case text-slate-400">· {entity}</span>}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
          <input className="input pl-7" placeholder="Buscar campo…" value={q} onChange={(e) => setQ(e.target.value)} disabled={attributes.length === 0} />
        </div>
        <div
          draggable
          onDragStart={(e) => startDrag(e, { kind: 'spacer' })}
          onDragEnd={endDrag}
          className="flex cursor-grab items-center gap-2 rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-xs text-slate-500 hover:border-slate-400"
        >
          <Minus size={14} /> Celda vacía (espaciador)
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading && <p className="p-3 text-sm text-slate-500">Cargando metadatos…</p>}
        {!loading && attributes.length === 0 && (
          <p className="p-3 text-sm text-slate-500">
            Sin metadatos. Conéctate y elige una entidad para ver sus campos, o añade campos a mano abajo.
          </p>
        )}
        <ul className="space-y-1">
          {filtered.map((a) => {
            const isUsed = used.has(a.logicalName);
            return (
              <li
                key={a.logicalName}
                draggable
                onDragStart={(e) => startDrag(e, { kind: 'attr', attr: a })}
                onDragEnd={endDrag}
                onDoubleClick={() => add(a)}
                className="group flex cursor-grab items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm hover:border-brand-500"
                title="Arrastra al canvas o doble clic para añadir a la sección seleccionada"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {a.displayName}
                    {(a.required === 'SystemRequired' || a.required === 'ApplicationRequired') && <span className="ml-1 text-red-500">*</span>}
                  </div>
                  <div className="truncate text-xs text-slate-500">{a.logicalName} · {TYPE_LABELS[a.type] ?? a.type}</div>
                </div>
                {isUsed && <CheckCircle2 size={14} className="shrink-0 text-emerald-500" aria-label="Ya está en el formulario" />}
                <button className="btn btn-ghost px-1 opacity-0 group-hover:opacity-100" onClick={() => add(a)} aria-label={`Añadir ${a.displayName}`}><Plus size={14} /></button>
              </li>
            );
          })}
        </ul>
      </div>

      <details className="border-t border-slate-200 p-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Añadir campo manual</summary>
        <div className="mt-2 space-y-2">
          <input className="input font-mono" placeholder="nombre_logico" value={manualName} onChange={(e) => setManualName(e.target.value)} />
          <select className="input" value={manualType} onChange={(e) => setManualType(e.target.value)}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button
            className="btn w-full justify-center"
            disabled={!manualName.trim() || !target}
            onClick={() => {
              if (target) dispatch({ type: 'addCustomField', logicalName: manualName.trim().toLowerCase(), typeKey: manualType, sectionId: target });
              setManualName('');
            }}
          >
            <Plus size={14} /> Añadir
          </button>
        </div>
      </details>
    </div>
  );
}
