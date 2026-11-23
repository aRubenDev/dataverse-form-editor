import { describe, expect, it } from 'vitest';
import { serializeFormXml } from '../domain/formxml/serialize';
import type { AttributeMeta } from '../domain/types';
import { initialState, reducer, type Action, type EditorState } from './reducer';

const attr = (n: string, type = 'string'): AttributeMeta => ({ logicalName: n, displayName: n.toUpperCase(), type, required: 'None' });
const run = (s: EditorState, ...a: Action[]) => a.reduce(reducer, s);
const sections = (s: EditorState) => s.present!.tabs.flatMap((t) => t.columns.flatMap((c) => c.sections));

function start(): EditorState {
  return run({ ...initialState, lcid: 3082 }, { type: 'newForm', entity: 'account' });
}

describe('reducer', () => {
  it('añade campos con classid, etiqueta en el idioma activo e ids de control únicos', () => {
    const s0 = start();
    const sec = sections(s0)[0].id;
    const s = run(s0, { type: 'addField', attr: attr('name'), sectionId: sec, beforeCellId: null }, { type: 'addField', attr: attr('name'), sectionId: sec, beforeCellId: null });
    const cells = sections(s)[0].cells;
    expect(cells).toHaveLength(2);
    expect(cells[0].labels['3082']).toBe('NAME');
    expect(cells[0].field!.controlId).not.toBe(cells[1].field!.controlId);
  });

  it('un campo memo ocupa todas las columnas de la sección', () => {
    const s0 = start();
    const sec = sections(s0)[0];
    const s = run(s0, { type: 'addField', attr: attr('description', 'memo'), sectionId: sec.id, beforeCellId: null });
    expect(sections(s)[0].cells[0].colspan).toBe(sec.columns);
  });

  it('mueve celdas entre secciones y antes de otra celda', () => {
    let s = start();
    s = run(s, { type: 'addSection', tabId: s.present!.tabs[0].id, colIndex: 0 });
    const [a, b] = sections(s);
    s = run(s,
      { type: 'addField', attr: attr('f1'), sectionId: a.id, beforeCellId: null },
      { type: 'addField', attr: attr('f2'), sectionId: a.id, beforeCellId: null },
    );
    const [c1, c2] = sections(s)[0].cells;
    s = run(s, { type: 'moveCell', id: c1.id, toSectionId: b.id, beforeId: null });
    expect(sections(s)[0].cells.map((c) => c.field!.dataField)).toEqual(['f2']);
    expect(sections(s)[1].cells.map((c) => c.field!.dataField)).toEqual(['f1']);
    s = run(s, { type: 'moveCell', id: c2.id, toSectionId: b.id, beforeId: c1.id });
    expect(sections(s)[1].cells.map((c) => c.field!.dataField)).toEqual(['f2', 'f1']);
  });

  it('al reducir columnas de pestaña, las secciones no se pierden', () => {
    let s = start();
    const tabId = s.present!.tabs[0].id;
    s = run(s, { type: 'setTabColumns', id: tabId, widths: ['50%', '50%'] }, { type: 'addSection', tabId, colIndex: 1 });
    expect(sections(s)).toHaveLength(2);
    s = run(s, { type: 'setTabColumns', id: tabId, widths: ['100%'] });
    expect(s.present!.tabs[0].columns).toHaveLength(1);
    expect(sections(s)).toHaveLength(2);
  });

  it('undo/redo restauran el estado y la selección huérfana se limpia', () => {
    let s = start();
    const sec = sections(s)[0].id;
    s = run(s, { type: 'addField', attr: attr('f1'), sectionId: sec, beforeCellId: null });
    expect(s.selection?.kind).toBe('cell');
    s = run(s, { type: 'undo' });
    expect(sections(s)[0].cells).toHaveLength(0);
    expect(s.selection).toBeNull();
    s = run(s, { type: 'redo' });
    expect(sections(s)[0].cells).toHaveLength(1);
  });

  it('teclear en una etiqueta se fusiona en una sola entrada de historial', () => {
    let s = start();
    const tab = { kind: 'tab', id: s.present!.tabs[0].id } as const;
    const before = s.past.length;
    for (const t of ['A', 'Ac', 'Acc']) s = run(s, { type: 'setLabel', target: tab, text: t });
    expect(s.past.length - before).toBe(1);
    expect(s.present!.tabs[0].labels['3082']).toBe('Acc');
  });

  it('el XML exportado de un formulario editado es bien formado', () => {
    let s = start();
    const sec = sections(s)[0].id;
    s = run(s, { type: 'addField', attr: attr('name'), sectionId: sec, beforeCellId: null }, { type: 'addSpacer', sectionId: sec, beforeCellId: null });
    const doc = new DOMParser().parseFromString(serializeFormXml(s.present!), 'application/xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.getElementsByTagName('control')).toHaveLength(1);
    expect(doc.getElementsByTagName('cell')).toHaveLength(2);
  });
});

describe('showHidden', () => {
  it('se conserva al cargar o crear un formulario y no ensucia el formulario', () => {
    let s = reducer(initialState, { type: 'newForm', entity: 'account' });
    s = reducer({ ...s, dirty: false }, { type: 'setShowHidden', value: false });
    expect(s.showHidden).toBe(false);
    expect(s.dirty).toBe(false);
    expect(s.past).toHaveLength(0);
    s = reducer(s, { type: 'newForm', entity: 'account' });
    expect(s.showHidden).toBe(false);
  });
});
