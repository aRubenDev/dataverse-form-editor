import { OPAQUE_CLASS_NAMES } from '../classIds';
import { newGuid } from '../ids';
import type { Cell, FormModel, Labels, Section, Tab, TabColumn } from '../types';

const xmlSerializer = new XMLSerializer();

const toXml = (node: Node): string => xmlSerializer.serializeToString(node);

const children = (el: Element, name?: string): Element[] =>
  Array.from(el.children).filter((c) => !name || c.nodeName === name);

function attrsOf(el: Element, exclude: string[] = []): Record<string, string> {
  const skip = new Set(exclude.map((x) => x.toLowerCase()));
  const out: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) {
    if (!skip.has(a.name.toLowerCase())) out[a.name] = a.value;
  }
  return out;
}

const bool = (v: string | null, dflt: boolean): boolean => (v === null ? dflt : v.toLowerCase() === 'true');
const int = (v: string | null, dflt: number): number => {
  const n = v === null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

function parseLabels(el: Element): Labels {
  const out: Labels = {};
  const labels = children(el, 'labels')[0];
  if (!labels) return out;
  for (const l of children(labels, 'label')) {
    const lcid = l.getAttribute('languagecode');
    if (lcid) out[lcid] = l.getAttribute('description') ?? '';
  }
  return out;
}

function innerXml(el: Element): string {
  return Array.from(el.childNodes).map(toXml).join('');
}

function parseCell(cellEl: Element, warnings: string[]): Cell {
  const id = cellEl.getAttribute('id') || newGuid();
  const rowspan = int(cellEl.getAttribute('rowspan'), 1);
  const base = {
    id,
    colspan: int(cellEl.getAttribute('colspan'), 1),
    rowspan,
    showlabel: bool(cellEl.getAttribute('showlabel'), true),
    visible: bool(cellEl.getAttribute('visible'), true),
    labels: parseLabels(cellEl),
    cellAttrs: attrsOf(cellEl, ['id', 'showlabel', 'visible', 'colspan', 'rowspan']),
  };
  if (rowspan > 1) {
    warnings.push(
      `La celda ${id} usa rowspan=${rowspan}. El editor no lo modela; se exportará como rowspan=1 si la mueves o editas.`,
    );
  }

  const control = children(cellEl, 'control')[0];
  if (!control) {
    return { ...base, kind: 'empty', controlAttrs: {} };
  }

  const classId = control.getAttribute('classid') ?? '';
  const dataField = control.getAttribute('datafieldname');
  const isSpecial = OPAQUE_CLASS_NAMES[classId.toUpperCase()] !== undefined;

  if (dataField && !isSpecial) {
    return {
      ...base,
      kind: 'field',
      field: {
        controlId: control.getAttribute('id') ?? dataField,
        dataField,
        classId,
        disabled: bool(control.getAttribute('disabled'), false),
      },
      controlAttrs: attrsOf(control, ['id', 'classid', 'datafieldname', 'disabled']),
      controlInner: innerXml(control) || undefined,
    };
  }

  warnings.push(
    `Control especial conservado sin editar: ${OPAQUE_CLASS_NAMES[classId.toUpperCase()] ?? classId} (${control.getAttribute('id') ?? 's/id'}).`,
  );
  return {
    ...base,
    kind: 'opaque',
    controlAttrs: {},
    raw: toXml(cellEl),
    opaqueInfo: { classId, controlId: control.getAttribute('id') ?? '' },
  };
}

function parseSection(el: Element, warnings: string[]): Section {
  const cells: Cell[] = [];
  const rows = children(el, 'rows')[0];
  if (rows) {
    for (const row of children(rows, 'row')) {
      for (const c of children(row, 'cell')) cells.push(parseCell(c, warnings));
    }
  }
  return {
    id: el.getAttribute('id') || newGuid(),
    name: el.getAttribute('name') ?? '',
    showlabel: bool(el.getAttribute('showlabel'), true),
    showbar: bool(el.getAttribute('showbar'), false),
    visible: bool(el.getAttribute('visible'), true),
    columns: Math.min(4, int(el.getAttribute('columns'), 1)),
    labels: parseLabels(el),
    cells,
    attrs: attrsOf(el, ['id', 'name', 'showlabel', 'showbar', 'visible', 'columns']),
    extraXml: children(el)
      .filter((c) => c.nodeName !== 'labels' && c.nodeName !== 'rows')
      .map(toXml),
  };
}

function parseTab(el: Element, warnings: string[]): Tab {
  const columns: TabColumn[] = [];
  const cols = children(el, 'columns')[0];
  if (cols) {
    for (const c of children(cols, 'column')) {
      const sections = children(children(c, 'sections')[0] ?? c, 'section').map((s) => parseSection(s, warnings));
      columns.push({ id: newGuid(), width: c.getAttribute('width') ?? '100%', sections });
    }
  }
  if (columns.length === 0) columns.push({ id: newGuid(), width: '100%', sections: [] });

  return {
    id: el.getAttribute('id') || newGuid(),
    name: el.getAttribute('name') ?? '',
    expanded: bool(el.getAttribute('expanded'), true),
    showlabel: bool(el.getAttribute('showlabel'), true),
    visible: bool(el.getAttribute('visible'), true),
    labels: parseLabels(el),
    columns,
    attrs: attrsOf(el, ['id', 'name', 'expanded', 'showlabel', 'visible']),
    extraXml: children(el)
      .filter((c) => c.nodeName !== 'labels' && c.nodeName !== 'columns')
      .map(toXml),
  };
}

/** Convierte un FormXml (string) al modelo del editor. Lanza Error si no es XML válido. */
export function parseFormXml(xml: string): FormModel {
  const doc = new DOMParser().parseFromString(xml.trim(), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('El XML no es válido: ' + (doc.getElementsByTagName('parsererror')[0].textContent ?? '').slice(0, 200));
  }
  const root = doc.documentElement.nodeName === 'form' ? doc.documentElement : doc.getElementsByTagName('form')[0];
  if (!root) throw new Error('No se encontró el nodo raíz <form>.');

  const warnings: string[] = [];
  const beforeTabs: string[] = [];
  const afterTabs: string[] = [];
  let tabs: Tab[] = [];
  let seenTabs = false;

  for (const child of children(root)) {
    if (child.nodeName === 'tabs') {
      seenTabs = true;
      tabs = children(child, 'tab').map((t) => parseTab(t, warnings));
    } else {
      (seenTabs ? afterTabs : beforeTabs).push(toXml(child));
    }
  }

  return { formAttrs: attrsOf(root), beforeTabs, afterTabs, tabs, importWarnings: Array.from(new Set(warnings)) };
}
