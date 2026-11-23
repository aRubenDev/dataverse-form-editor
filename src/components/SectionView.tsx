import { useState } from 'react';
import { ArrowDown, ArrowUp, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import type { Section } from '../domain/types';
import { useEditor } from '../state/EditorContext';
import { CellView } from './CellView';
import { activeDrag, endDrag, startDrag } from './dnd';

export function SectionView({ section, columnId }: { section: Section; columnId: string }) {
  const { state, dispatch } = useEditor();
  const [over, setOver] = useState<'section' | 'cells' | null>(null);
  const selected = state.selection?.kind === 'section' && state.selection.id === section.id;
  const label = section.labels[String(state.lcid)] ?? Object.values(section.labels)[0] ?? '';

  const onDropCells = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(null);
    const d = activeDrag();
    if (!d) return;
    if (d.kind === 'attr') dispatch({ type: 'addField', attr: d.attr, sectionId: section.id, beforeCellId: null });
    else if (d.kind === 'spacer') dispatch({ type: 'addSpacer', sectionId: section.id, beforeCellId: null });
    else if (d.kind === 'cell') dispatch({ type: 'moveCell', id: d.id, toSectionId: section.id, beforeId: null });
    endDrag();
  };

  const onDropSection = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(null);
    const d = activeDrag();
    if (d?.kind === 'section') dispatch({ type: 'moveSection', id: d.id, toColumnId: columnId, beforeId: section.id });
    endDrag();
  };

  if (!section.visible && !state.showHidden && !selected) return null;

  return (
    <section
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: 'select', selection: { kind: 'section', id: section.id } });
      }}
      className={[
        'rounded-lg border bg-white shadow-sm',
        selected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-200',
        over === 'section' ? 'border-t-4 border-t-brand-500' : '',
        section.visible ? '' : 'opacity-60',
      ].join(' ')}
    >
      <header
        draggable
        onDragStart={(e) => startDrag(e, { kind: 'section', id: section.id })}
        onDragEnd={endDrag}
        onDragOver={(e) => {
          if (activeDrag()?.kind !== 'section') return;
          e.preventDefault();
          e.stopPropagation();
          setOver('section');
        }}
        onDragLeave={() => setOver(null)}
        onDrop={onDropSection}
        className="flex cursor-grab items-center gap-2 border-b border-slate-100 px-3 py-2"
      >
        <GripVertical size={14} className="text-slate-300" />
        {!section.visible && <EyeOff size={14} className="text-slate-500" aria-label="Oculta" />}
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-semibold">{label || section.name}</span>
          <span className="ml-2 text-xs text-slate-400">{section.name} · {section.columns} col</span>
        </div>
        <button className="btn btn-ghost px-1" title="Subir" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'shiftSection', id: section.id, dir: -1 }); }}><ArrowUp size={14} /></button>
        <button className="btn btn-ghost px-1" title="Bajar" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'shiftSection', id: section.id, dir: 1 }); }}><ArrowDown size={14} /></button>
        <button
          className="btn btn-ghost px-1 text-red-600"
          title="Eliminar sección"
          onClick={(e) => {
            e.stopPropagation();
            if (section.cells.length === 0 || window.confirm(`¿Eliminar la sección "${label || section.name}" y sus ${section.cells.length} celdas?`))
              dispatch({ type: 'removeSection', id: section.id });
          }}
        ><Trash2 size={14} /></button>
      </header>
      <div
        className={['grid gap-2 p-3', over === 'cells' ? 'bg-brand-50/60' : ''].join(' ')}
        style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}
        onDragOver={(e) => {
          const d = activeDrag();
          if (d && d.kind !== 'section') {
            e.preventDefault();
            setOver('cells');
          }
        }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(null); }}
        onDrop={onDropCells}
      >
        {section.cells.map((c) => <CellView key={c.id} cell={c} section={section} />)}
        {section.cells.length === 0 && (
          <div className="col-span-full rounded-md border border-dashed border-slate-300 py-5 text-center text-xs text-slate-400">
            Arrastra campos aquí o pulsa uno en la paleta
          </div>
        )}
      </div>
    </section>
  );
}
