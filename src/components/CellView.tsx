import { useState } from 'react';
import { Blocks, EyeOff, GripVertical, Minus } from 'lucide-react';
import { OPAQUE_CLASS_NAMES, TYPE_LABELS, typeForClassId } from '../domain/classIds';
import type { Cell, Section } from '../domain/types';
import { useEditor } from '../state/EditorContext';
import { activeDrag, endDrag, startDrag } from './dnd';

export function CellView({ cell, section }: { cell: Cell; section: Section }) {
  const { state, dispatch } = useEditor();
  const [over, setOver] = useState(false);
  const selected = state.selection?.kind === 'cell' && state.selection.id === cell.id;
  const label = cell.labels[String(state.lcid)] ?? Object.values(cell.labels)[0] ?? '';
  const span = Math.min(Math.max(cell.colspan, 1), section.columns);

  const accepts = () => {
    const d = activeDrag();
    return d?.kind === 'attr' || d?.kind === 'spacer' || d?.kind === 'cell';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const d = activeDrag();
    if (!d) return;
    if (d.kind === 'attr') dispatch({ type: 'addField', attr: d.attr, sectionId: section.id, beforeCellId: cell.id });
    else if (d.kind === 'spacer') dispatch({ type: 'addSpacer', sectionId: section.id, beforeCellId: cell.id });
    else if (d.kind === 'cell') dispatch({ type: 'moveCell', id: d.id, toSectionId: section.id, beforeId: cell.id });
    endDrag();
  };

  if (!cell.visible && !state.showHidden && !selected) return null;

  const typeKey = cell.field ? typeForClassId(cell.field.classId) : undefined;

  return (
    <div
      draggable
      onDragStart={(e) => startDrag(e, { kind: 'cell', id: cell.id })}
      onDragEnd={endDrag}
      onDragOver={(e) => {
        if (!accepts()) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: 'select', selection: { kind: 'cell', id: cell.id } });
      }}
      style={{ gridColumn: `span ${span}` }}
      className={[
        'group flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition',
        selected ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30' : 'border-slate-200 bg-white hover:border-slate-400',
        over ? 'border-l-4 border-l-brand-500' : '',
        cell.kind === 'empty' ? 'border-dashed bg-slate-50 text-slate-400' : '',
        cell.visible ? '' : 'opacity-50',
      ].join(' ')}
    >
      <GripVertical size={14} className="shrink-0 text-slate-300 group-hover:text-slate-500" />
      {!cell.visible && <EyeOff size={14} className="shrink-0 text-slate-500" aria-label="Oculto" />}
      {cell.kind === 'field' && cell.field && (
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{label || cell.field.dataField}</div>
          <div className="truncate text-xs text-slate-500">
            {cell.field.dataField} · {typeKey ? TYPE_LABELS[typeKey] : 'Control personalizado'}
            {cell.field.disabled && ' · solo lectura'}
          </div>
        </div>
      )}
      {cell.kind === 'empty' && (
        <div className="flex flex-1 items-center gap-1 text-xs"><Minus size={14} /> Celda vacía</div>
      )}
      {cell.kind === 'opaque' && (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Blocks size={16} className="shrink-0 text-amber-600" />
          <div className="min-w-0">
            <div className="truncate font-medium">{label || cell.opaqueInfo?.controlId}</div>
            <div className="truncate text-xs text-amber-700">
              {OPAQUE_CLASS_NAMES[(cell.opaqueInfo?.classId ?? '').toUpperCase()] ?? 'Control especial'} · se conserva sin editar
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
