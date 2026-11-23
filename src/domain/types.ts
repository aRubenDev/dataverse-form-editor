/** Etiquetas por LCID (1033, 3082...). Se conservan todos los idiomas al importar. */
export type Labels = Record<string, string>;

export type CellKind = 'field' | 'empty' | 'opaque';

export interface FieldControl {
  controlId: string;
  dataField: string;
  classId: string;
  disabled: boolean;
}

export interface Cell {
  id: string;
  kind: CellKind;
  colspan: number;
  rowspan: number;
  showlabel: boolean;
  /** false = <cell visible="false">: oculta en tiempo de ejecucion, sigue en el formulario */
  visible: boolean;
  labels: Labels;
  /** Solo kind === 'field' */
  field?: FieldControl;
  /** Atributos del <cell> no gestionados por el editor (locklevel, auto, ...) */
  cellAttrs: Record<string, string>;
  /** Atributos extra del <control> */
  controlAttrs: Record<string, string>;
  /** XML interno del <control> (parameters, ...) preservado tal cual */
  controlInner?: string;
  /** Solo kind === 'opaque': <cell> completo (subgrid, web resource, quick view...) */
  raw?: string;
  opaqueInfo?: { classId: string; controlId: string };
}

export interface Section {
  id: string;
  name: string;
  showlabel: boolean;
  showbar: boolean;
  visible: boolean;
  /** Columnas internas de la sección (1-4) */
  columns: number;
  labels: Labels;
  cells: Cell[];
  attrs: Record<string, string>;
  /** Hijos de <section> distintos de labels/rows */
  extraXml: string[];
}

export interface TabColumn {
  id: string;
  /** p. ej. "100%" o "50%" */
  width: string;
  sections: Section[];
}

export interface Tab {
  id: string;
  name: string;
  expanded: boolean;
  showlabel: boolean;
  visible: boolean;
  labels: Labels;
  columns: TabColumn[];
  attrs: Record<string, string>;
  /** Hijos de <tab> distintos de labels/columns (events, ...) */
  extraXml: string[];
}

export interface FormModel {
  /** Atributos de <form> */
  formAttrs: Record<string, string>;
  /** Nodos hijos de <form> antes de <tabs> (p. ej. <header>) */
  beforeTabs: string[];
  /** Nodos hijos de <form> después de <tabs> (events, footer, formLibraries...) */
  afterTabs: string[];
  tabs: Tab[];
  /** Avisos generados al importar (rowspan, controles opacos...) */
  importWarnings: string[];
}

export interface AttributeMeta {
  logicalName: string;
  displayName: string;
  /** Clave interna de tipo (ver classIds.ts) */
  type: string;
  required: 'None' | 'Recommended' | 'ApplicationRequired' | 'SystemRequired';
}

export interface EntityMeta {
  logicalName: string;
  displayName: string;
}

export type Selection =
  | { kind: 'tab'; id: string }
  | { kind: 'section'; id: string }
  | { kind: 'cell'; id: string }
  | null;

export type IssueLevel = 'error' | 'warning';
export interface Issue {
  level: IssueLevel;
  message: string;
  /** Elemento al que apunta, para seleccionarlo desde el panel */
  target?: Selection;
}
