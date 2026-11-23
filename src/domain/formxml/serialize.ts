import { newGuid } from '../ids';
import type { Cell, FormModel, Labels, Section, Tab } from '../types';

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, '&#10;');

const pad = (n: number): string => '  '.repeat(n);

function attrString(attrs: Record<string, string | undefined>): string {
  return Object.entries(attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${esc(v as string)}"`)
    .join('');
}

function labelsXml(labels: Labels, depth: number): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return `${pad(depth)}<labels />`;
  const inner = entries
    .map(([lcid, text]) => `${pad(depth + 1)}<label description="${esc(text)}" languagecode="${esc(lcid)}" />`)
    .join('\n');
  return `${pad(depth)}<labels>\n${inner}\n${pad(depth)}</labels>`;
}

function cellXml(cell: Cell, sectionColumns: number, depth: number): string {
  if (cell.kind === 'opaque' && cell.raw) {
    // Preservado byte a byte, salvo el colspan, que sí puede haber cambiado
    return `${pad(depth)}${cell.raw}`;
  }
  const colspan = Math.min(Math.max(cell.colspan, 1), sectionColumns);
  const head = attrString({
    id: cell.id,
    showlabel: String(cell.showlabel),
    ...cell.cellAttrs,
    colspan: String(colspan),
    rowspan: '1',
  });

  if (cell.kind === 'empty' || !cell.field) {
    return `${pad(depth)}<cell${head} />`;
  }

  const f = cell.field;
  const ctrlAttrs = attrString({
    id: f.controlId,
    classid: f.classId,
    datafieldname: f.dataField,
    disabled: String(f.disabled),
    ...cell.controlAttrs,
  });
  const control = cell.controlInner
    ? `${pad(depth + 2)}<control${ctrlAttrs}>${cell.controlInner}</control>`
    : `${pad(depth + 2)}<control${ctrlAttrs} />`;

  return [`${pad(depth)}<cell${head}>`, labelsXml(cell.labels, depth + 1), control, `${pad(depth)}</cell>`].join('\n');
}

/** Reparte las celdas en filas según las columnas de la sección y el colspan de cada celda. */
export function chunkRows(cells: Cell[], columns: number): Cell[][] {
  const rows: Cell[][] = [];
  let cur: Cell[] = [];
  let used = 0;
  for (const cell of cells) {
    const span = Math.min(Math.max(cell.colspan, 1), columns);
    if (used + span > columns && cur.length > 0) {
      rows.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(cell);
    used += span;
    if (used >= columns) {
      rows.push(cur);
      cur = [];
      used = 0;
    }
  }
  if (cur.length > 0) rows.push(cur);
  return rows;
}

function sectionXml(s: Section, depth: number): string {
  const head = attrString({
    name: s.name,
    showlabel: String(s.showlabel),
    showbar: String(s.showbar),
    columns: String(s.columns),
    id: s.id,
    ...s.attrs,
  });
  const rows = chunkRows(s.cells, s.columns)
    .map((r) => `${pad(depth + 2)}<row>\n${r.map((c) => cellXml(c, s.columns, depth + 3)).join('\n')}\n${pad(depth + 2)}</row>`)
    .join('\n');
  const parts = [
    `${pad(depth)}<section${head}>`,
    labelsXml(s.labels, depth + 1),
    rows ? `${pad(depth + 1)}<rows>\n${rows}\n${pad(depth + 1)}</rows>` : `${pad(depth + 1)}<rows />`,
    ...s.extraXml.map((x) => `${pad(depth + 1)}${x}`),
    `${pad(depth)}</section>`,
  ];
  return parts.join('\n');
}

function tabXml(t: Tab, depth: number): string {
  const head = attrString({
    name: t.name,
    id: t.id,
    expanded: String(t.expanded),
    showlabel: String(t.showlabel),
    visible: t.visible ? undefined : 'false',
    ...t.attrs,
  });
  const cols = t.columns
    .map((c) => {
      const secs = c.sections.map((s) => sectionXml(s, depth + 4)).join('\n');
      return [
        `${pad(depth + 2)}<column width="${esc(c.width)}">`,
        secs ? `${pad(depth + 3)}<sections>\n${secs}\n${pad(depth + 3)}</sections>` : `${pad(depth + 3)}<sections />`,
        `${pad(depth + 2)}</column>`,
      ].join('\n');
    })
    .join('\n');
  return [
    `${pad(depth)}<tab${head}>`,
    labelsXml(t.labels, depth + 1),
    `${pad(depth + 1)}<columns>\n${cols}\n${pad(depth + 1)}</columns>`,
    ...t.extraXml.map((x) => `${pad(depth + 1)}${x}`),
    `${pad(depth)}</tab>`,
  ].join('\n');
}

/** Serializa el modelo a FormXml listo para pegar en el XML Editor de XRM Toolbox. */
export function serializeFormXml(model: FormModel): string {
  const tabs = model.tabs.map((t) => tabXml(t, 2)).join('\n');
  const lines = [
    `<form${attrString(model.formAttrs)}>`,
    ...model.beforeTabs.map((x) => `${pad(1)}${x}`),
    `${pad(1)}<tabs>`,
    tabs,
    `${pad(1)}</tabs>`,
    ...model.afterTabs.map((x) => `${pad(1)}${x}`),
    `</form>`,
  ].filter((l) => l !== '');
  return lines.join('\n') + '\n';
}

/** Formulario nuevo: una pestaña "General" con una sección de 2 columnas. */
export function createEmptyForm(lcid: number): FormModel {
  const l = String(lcid);
  return {
    formAttrs: { showImage: 'true' },
    beforeTabs: [],
    afterTabs: [],
    importWarnings: [],
    tabs: [
      {
        id: newGuid(),
        name: 'general',
        expanded: true,
        showlabel: true,
        visible: true,
        labels: { [l]: 'General' },
        attrs: { verticallayout: 'true', IsUserDefined: '1' },
        extraXml: [],
        columns: [
          {
            id: newGuid(),
            width: '100%',
            sections: [
              {
                id: newGuid(),
                name: 'general_section',
                showlabel: true,
                showbar: false,
                columns: 2,
                labels: { [l]: 'General' },
                cells: [],
                attrs: { IsUserDefined: '1' },
                extraXml: [],
              },
            ],
          },
        ],
      },
    ],
  };
}
