import { classIdForType } from '../domain/classIds';
import { newGuid, uniqueName } from '../domain/ids';
import { createEmptyForm } from '../domain/formxml/serialize';
import type { AttributeMeta, Cell, FormModel, Section, Selection, Tab } from '../domain/types';

const HISTORY_LIMIT = 80;
const COALESCE_MS = 900;

export interface FormSource {
  entity: string;
  formId?: string;
  name?: string;
}

export interface EditorState {
  past: FormModel[];
  present: FormModel | null;
  future: FormModel[];
  selection: Selection;
  lcid: number;
  dirty: boolean;
  /** Solo vista del editor: false quita del lienzo lo oculto. No afecta al XML exportado. */
  showHidden: boolean;
  source: FormSource | null;
  lastKey: string | null;
  lastAt: number;
}

export const initialState: EditorState = {
  past: [],
  present: null,
  future: [],
  selection: null,
  lcid: 1033,
  dirty: false,
  showHidden: true,
  source: null,
  lastKey: null,
  lastAt: 0,
};

export type Action =
  | { type: 'load'; form: FormModel; source: FormSource | null; lcid?: number }
  | { type: 'newForm'; entity: string }
  | { type: 'setLcid'; lcid: number }
  | { type: 'setShowHidden'; value: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'select'; selection: Selection }
  | { type: 'markExported' }
  | { type: 'addTab' }
  | { type: 'removeTab'; id: string }
  | { type: 'moveTab'; id: string; dir: -1 | 1 }
  | { type: 'patchTab'; id: string; patch: Partial<Pick<Tab, 'name' | 'expanded' | 'showlabel' | 'visible'>> }
  | { type: 'setTabColumns'; id: string; widths: string[] }
  | { type: 'addSection'; tabId: string; colIndex: number }
  | { type: 'removeSection'; id: string }
  | { type: 'patchSection'; id: string; patch: Partial<Pick<Section, 'name' | 'showlabel' | 'showbar' | 'visible' | 'columns'>> }
  | { type: 'moveSection'; id: string; toColumnId: string; beforeId: string | null }
  | { type: 'shiftSection'; id: string; dir: -1 | 1 }
  | { type: 'addField'; attr: AttributeMeta; sectionId: string; beforeCellId: string | null }
  | { type: 'addCustomField'; logicalName: string; typeKey: string; sectionId: string }
  | { type: 'addSpacer'; sectionId: string; beforeCellId: string | null }
  | { type: 'patchCell'; id: string; patch: Partial<Pick<Cell, 'colspan' | 'showlabel' | 'visible'>> }
  | { type: 'patchField'; id: string; patch: { disabled?: boolean; controlId?: string } }
  | { type: 'moveCell'; id: string; toSectionId: string; beforeId: string | null }
  | { type: 'removeCell'; id: string }
  | { type: 'setLabel'; target: Exclude<Selection, null>; text: string };

// ---------- helpers de búsqueda sobre el modelo ----------

function* eachSection(form: FormModel) {
  for (const tab of form.tabs) for (const col of tab.columns) for (const sec of col.sections) yield { tab, col, sec };
}

function findSection(form: FormModel, id: string) {
  for (const x of eachSection(form)) if (x.sec.id === id) return x;
  return null;
}

function findCell(form: FormModel, id: string) {
  for (const x of eachSection(form)) {
    const idx = x.sec.cells.findIndex((c) => c.id === id);
    if (idx >= 0) return { ...x, idx, cell: x.sec.cells[idx] };
  }
  return null;
}

function allControlIds(form: FormModel): Set<string> {
  const s = new Set<string>();
  for (const { sec } of eachSection(form)) for (const c of sec.cells) if (c.field) s.add(c.field.controlId);
  return s;
}

function insertAt<T extends { id: string }>(arr: T[], item: T, beforeId: string | null) {
  const i = beforeId ? arr.findIndex((x) => x.id === beforeId) : -1;
  if (i < 0) arr.push(item);
  else arr.splice(i, 0, item);
}

function makeFieldCell(form: FormModel, lcid: number, a: { logicalName: string; displayName: string; type: string }, section: Section): Cell {
  const ids = allControlIds(form);
  return {
    id: newGuid(),
    kind: 'field',
    colspan: a.type === 'memo' ? section.columns : 1,
    rowspan: 1,
    showlabel: true,
    visible: true,
    labels: { [String(lcid)]: a.displayName },
    field: {
      controlId: uniqueName(a.logicalName, ids),
      dataField: a.logicalName,
      classId: classIdForType(a.type),
      disabled: false,
    },
    cellAttrs: {},
    controlAttrs: {},
  };
}

// ---------- reducer ----------

function mutate(state: EditorState, key: string | null, fn: (draft: FormModel) => Selection | void): EditorState {
  if (!state.present) return state;
  const draft = structuredClone(state.present);
  const nextSel = fn(draft);
  const now = Date.now();
  const coalesce = key !== null && key === state.lastKey && now - state.lastAt < COALESCE_MS;
  const past = coalesce ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT);

  // si el elemento seleccionado ya no existe, limpiamos la selección
  let selection = nextSel === undefined ? state.selection : nextSel;
  if (selection && !exists(draft, selection)) selection = null;

  return { ...state, past, present: draft, future: [], selection, dirty: true, lastKey: key, lastAt: now };
}

function exists(form: FormModel, sel: Exclude<Selection, null>): boolean {
  if (sel.kind === 'tab') return form.tabs.some((t) => t.id === sel.id);
  if (sel.kind === 'section') return findSection(form, sel.id) !== null;
  return findCell(form, sel.id) !== null;
}

export function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'load':
      return { ...initialState, showHidden: state.showHidden, present: action.form, source: action.source, lcid: action.lcid ?? state.lcid };
    case 'newForm':
      return { ...initialState, showHidden: state.showHidden, present: createEmptyForm(state.lcid), source: { entity: action.entity }, lcid: state.lcid, dirty: true };
    case 'setLcid':
      return { ...state, lcid: action.lcid };
    case 'setShowHidden':
      return { ...state, showHidden: action.value };
    case 'select':
      return { ...state, selection: action.selection };
    case 'markExported':
      return { ...state, dirty: false };
    case 'undo': {
      if (!state.past.length || !state.present) return state;
      const prev = state.past[state.past.length - 1];
      const sel = state.selection && !exists(prev, state.selection) ? null : state.selection;
      return { ...state, past: state.past.slice(0, -1), present: prev, future: [state.present, ...state.future], selection: sel, lastKey: null };
    }
    case 'redo': {
      if (!state.future.length || !state.present) return state;
      const [next, ...rest] = state.future;
      return { ...state, past: [...state.past, state.present], present: next, future: rest, lastKey: null };
    }

    case 'addTab':
      return mutate(state, null, (f) => {
        const name = uniqueName('tab', new Set(f.tabs.map((t) => t.name)));
        const sectionName = uniqueName(`${name}_section`, new Set([...eachSection(f)].map((x) => x.sec.name)));
        const l = String(state.lcid);
        const tab: Tab = {
          id: newGuid(), name, expanded: true, showlabel: true, visible: true,
          labels: { [l]: 'Nueva pestaña' }, attrs: { verticallayout: 'true', IsUserDefined: '1' }, extraXml: [],
          columns: [{
            id: newGuid(), width: '100%',
            sections: [{ id: newGuid(), name: sectionName, showlabel: true, showbar: false, visible: true, columns: 2, labels: { [l]: 'Nueva sección' }, cells: [], attrs: { IsUserDefined: '1' }, extraXml: [] }],
          }],
        };
        f.tabs.push(tab);
        return { kind: 'tab', id: tab.id };
      });
    case 'removeTab':
      return mutate(state, null, (f) => {
        f.tabs = f.tabs.filter((t) => t.id !== action.id);
      });
    case 'moveTab':
      return mutate(state, null, (f) => {
        const i = f.tabs.findIndex((t) => t.id === action.id);
        const j = i + action.dir;
        if (i < 0 || j < 0 || j >= f.tabs.length) return;
        [f.tabs[i], f.tabs[j]] = [f.tabs[j], f.tabs[i]];
      });
    case 'patchTab':
      return mutate(state, `tab:${action.id}:${Object.keys(action.patch).join()}`, (f) => {
        const t = f.tabs.find((x) => x.id === action.id);
        if (t) Object.assign(t, action.patch);
      });
    case 'setTabColumns':
      return mutate(state, null, (f) => {
        const t = f.tabs.find((x) => x.id === action.id);
        if (!t) return;
        // Al reducir columnas, las secciones sobrantes se fusionan en la última que se conserva
        while (t.columns.length > action.widths.length) {
          const removed = t.columns.pop()!;
          t.columns[t.columns.length - 1].sections.push(...removed.sections);
        }
        while (t.columns.length < action.widths.length) t.columns.push({ id: newGuid(), width: '100%', sections: [] });
        t.columns.forEach((c, i) => (c.width = action.widths[i]));
      });

    case 'addSection':
      return mutate(state, null, (f) => {
        const tab = f.tabs.find((t) => t.id === action.tabId);
        const col = tab?.columns[Math.min(action.colIndex, (tab?.columns.length ?? 1) - 1)];
        if (!col) return;
        const name = uniqueName('section', new Set([...eachSection(f)].map((x) => x.sec.name)));
        const sec: Section = { id: newGuid(), name, showlabel: true, showbar: false, visible: true, columns: 1, labels: { [String(state.lcid)]: 'Nueva sección' }, cells: [], attrs: { IsUserDefined: '1' }, extraXml: [] };
        col.sections.push(sec);
        return { kind: 'section', id: sec.id };
      });
    case 'removeSection':
      return mutate(state, null, (f) => {
        for (const { col } of eachSection(f)) col.sections = col.sections.filter((s) => s.id !== action.id);
      });
    case 'patchSection':
      return mutate(state, `sec:${action.id}:${Object.keys(action.patch).join()}`, (f) => {
        const s = findSection(f, action.id)?.sec;
        if (s) Object.assign(s, action.patch);
      });
    case 'moveSection':
      return mutate(state, null, (f) => {
        if (action.id === action.beforeId) return;
        const src = findSection(f, action.id);
        if (!src) return;
        const target = f.tabs.flatMap((t) => t.columns).find((c) => c.id === action.toColumnId);
        if (!target) return;
        src.col.sections = src.col.sections.filter((s) => s.id !== action.id);
        insertAt(target.sections, src.sec, action.beforeId);
      });
    case 'shiftSection':
      return mutate(state, null, (f) => {
        const x = findSection(f, action.id);
        if (!x) return;
        const arr = x.col.sections;
        const i = arr.findIndex((s) => s.id === action.id);
        const j = i + action.dir;
        if (j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
      });

    case 'addField':
      return mutate(state, null, (f) => {
        const sec = findSection(f, action.sectionId)?.sec;
        if (!sec) return;
        const cell = makeFieldCell(f, state.lcid, action.attr, sec);
        insertAt(sec.cells, cell, action.beforeCellId);
        return { kind: 'cell', id: cell.id };
      });
    case 'addCustomField':
      return mutate(state, null, (f) => {
        const sec = findSection(f, action.sectionId)?.sec;
        if (!sec) return;
        const cell = makeFieldCell(f, state.lcid, { logicalName: action.logicalName, displayName: action.logicalName, type: action.typeKey }, sec);
        sec.cells.push(cell);
        return { kind: 'cell', id: cell.id };
      });
    case 'addSpacer':
      return mutate(state, null, (f) => {
        const sec = findSection(f, action.sectionId)?.sec;
        if (!sec) return;
        const cell: Cell = { id: newGuid(), kind: 'empty', colspan: 1, rowspan: 1, showlabel: false, visible: true, labels: {}, cellAttrs: {}, controlAttrs: {} };
        insertAt(sec.cells, cell, action.beforeCellId);
        return { kind: 'cell', id: cell.id };
      });
    case 'patchCell':
      return mutate(state, `cell:${action.id}:${Object.keys(action.patch).join()}`, (f) => {
        const c = findCell(f, action.id)?.cell;
        if (c) Object.assign(c, action.patch);
      });
    case 'patchField':
      return mutate(state, `field:${action.id}:${Object.keys(action.patch).join()}`, (f) => {
        const c = findCell(f, action.id)?.cell;
        if (c?.field) Object.assign(c.field, action.patch);
      });
    case 'moveCell':
      return mutate(state, null, (f) => {
        if (action.id === action.beforeId) return;
        const src = findCell(f, action.id);
        const dst = findSection(f, action.toSectionId);
        if (!src || !dst) return;
        src.sec.cells.splice(src.idx, 1);
        insertAt(dst.sec.cells, src.cell, action.beforeId);
        return { kind: 'cell', id: src.cell.id };
      });
    case 'removeCell':
      return mutate(state, null, (f) => {
        const src = findCell(f, action.id);
        if (src) src.sec.cells.splice(src.idx, 1);
      });
    case 'setLabel':
      return mutate(state, `label:${action.target.id}`, (f) => {
        const l = String(state.lcid);
        const t =
          action.target.kind === 'tab'
            ? f.tabs.find((x) => x.id === action.target.id)
            : action.target.kind === 'section'
              ? findSection(f, action.target.id)?.sec
              : findCell(f, action.target.id)?.cell;
        if (t) t.labels[l] = action.text;
      });
  }
}
