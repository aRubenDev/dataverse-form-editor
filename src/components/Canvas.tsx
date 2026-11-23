import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, EyeOff, Plus } from 'lucide-react';
import type { FormModel, Selection } from '../domain/types';
import { useEditor } from '../state/EditorContext';
import { SectionView } from './SectionView';
import { activeDrag, endDrag } from './dnd';

function tabIdOf(form: FormModel, sel: Selection): string | null {
  if (!sel) return null;
  if (sel.kind === 'tab') return sel.id;
  for (const t of form.tabs)
    for (const c of t.columns)
      for (const s of c.sections) {
        if (sel.kind === 'section' && s.id === sel.id) return t.id;
        if (sel.kind === 'cell' && s.cells.some((x) => x.id === sel.id)) return t.id;
      }
  return null;
}

export function Canvas() {
  const { state, dispatch } = useEditor();
  const form = state.present!;
  const [activeId, setActiveId] = useState<string | null>(null);

  // Al seleccionar algo desde otro sitio (p. ej. el panel de incidencias) mostramos su pestaña
  useEffect(() => {
    const t = tabIdOf(form, state.selection);
    if (t) setActiveId(t);
  }, [state.selection, form]);

  const tab = form.tabs.find((t) => t.id === activeId) ?? form.tabs[0];
  const lcid = String(state.lcid);

  return (
    <div className="flex h-full flex-col" onClick={() => dispatch({ type: 'select', selection: null })}>
      <div className="flex items-end gap-1 overflow-x-auto border-b border-slate-300 bg-slate-200/60 px-3 pt-2">
        {form.tabs.map((t) => {
          const active = t.id === tab?.id;
          const sel = state.selection?.kind === 'tab' && state.selection.id === t.id;
          return (
            <button
              key={t.id}
              onClick={(e) => { e.stopPropagation(); setActiveId(t.id); dispatch({ type: 'select', selection: { kind: 'tab', id: t.id } }); }}
              className={[
                'flex items-center gap-1.5 whitespace-nowrap rounded-t-md border border-b-0 px-3 py-1.5 text-sm font-medium',
                active ? 'border-slate-300 bg-white text-slate-900' : 'border-transparent text-slate-600 hover:bg-slate-100',
                sel ? 'ring-2 ring-brand-500/40' : '',
              ].join(' ')}
            >
              {!t.visible && <EyeOff size={13} className="text-slate-400" />}
              {t.labels[lcid] || Object.values(t.labels)[0] || t.name}
            </button>
          );
        })}
        <button className="btn btn-ghost mb-0.5 px-2 py-1" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'addTab' }); }} title="Añadir pestaña">
          <Plus size={16} />
        </button>
        {tab && (
          <div className="ml-auto flex items-center gap-1 pb-1">
            <button className="btn btn-ghost px-1.5 py-0.5" title="Mover pestaña a la izquierda" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'moveTab', id: tab.id, dir: -1 }); }}><ArrowLeft size={14} /></button>
            <button className="btn btn-ghost px-1.5 py-0.5" title="Mover pestaña a la derecha" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'moveTab', id: tab.id, dir: 1 }); }}><ArrowRight size={14} /></button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-white p-4">
        {tab ? (
          <div className="flex gap-4">
            {tab.columns.map((col, i) => (
              <div
                key={col.id}
                style={{ flex: `${parseFloat(col.width) || 100} 1 0%` }}
                className="min-w-0 space-y-3"
                onDragOver={(e) => { if (activeDrag()?.kind === 'section') e.preventDefault(); }}
                onDrop={(e) => {
                  const d = activeDrag();
                  if (d?.kind === 'section') {
                    e.preventDefault();
                    dispatch({ type: 'moveSection', id: d.id, toColumnId: col.id, beforeId: null });
                    endDrag();
                  }
                }}
              >
                {col.sections.map((s) => <SectionView key={s.id} section={s} columnId={col.id} />)}
                <button
                  className="btn btn-ghost w-full justify-center border border-dashed border-slate-300 text-slate-500"
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'addSection', tabId: tab.id, colIndex: i }); }}
                >
                  <Plus size={14} /> Añadir sección
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-sm text-slate-500">
            El formulario no tiene pestañas.{' '}
            <button className="text-brand-600 underline" onClick={() => dispatch({ type: 'addTab' })}>Añadir una</button>
          </div>
        )}
      </div>
    </div>
  );
}
