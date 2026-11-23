import { typeForClassId } from './classIds';
import type { AttributeMeta, EntityMeta } from './types';

/**
 * Paquete que genera scripts/export-form-bundle.mjs. El script solo vuelca ficheros en bruto;
 * todo el parseo vive aquí para poder probarlo.
 */
export interface BundleFile {
  schema: number;
  generatedAt?: string;
  environment?: { name?: string; url?: string };
  solution?: { uniqueName?: string };
  /** Nombre de la carpeta de la entidad en la solución desempaquetada */
  entity: string;
  baseLanguage?: number;
  entityXml?: string | null;
  forms: { file?: string; xml: string }[];
}

export interface BundleForm {
  formId: string;
  name: string;
  /** main | quick | quickCreate | card ... tal como lo escribe SolutionPackager */
  type: string;
  /** El nodo <form> listo para el editor */
  formXml: string;
}

export interface Bundle {
  generatedAt?: string;
  environment: string;
  solution: string;
  entity: EntityMeta;
  baseLanguage: number;
  attributes: AttributeMeta[];
  forms: BundleForm[];
  warnings: string[];
}

// ---------- utilidades XML ----------

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml.trim(), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('XML mal formado');
  return doc;
}

const kids = (el: Element | null | undefined, name: string): Element[] =>
  el ? Array.from(el.children).filter((c) => c.nodeName === name) : [];
const kid = (el: Element | null | undefined, name: string): Element | null => kids(el, name)[0] ?? null;
const text = (el: Element | null | undefined, name: string): string => kid(el, name)?.textContent?.trim() ?? '';

/** Descripción localizada: idioma pedido, si no la primera disponible. */
function localized(container: Element | null | undefined, itemTag: string, lcid: number): string {
  const items = kids(container, itemTag);
  const wanted = items.find((i) => i.getAttribute('languagecode') === String(lcid));
  return (wanted ?? items[0])?.getAttribute('description')?.trim() ?? '';
}

// ---------- columnas ----------

const SKIPPED = new Set(['primarykey', 'uniqueidentifier', 'virtual', 'image', 'file', 'managedproperty', 'entityname', 'timestamp']);

function mapType(rawType: string, format: string): string | null {
  const t = rawType.toLowerCase();
  const f = format.toLowerCase();
  if (SKIPPED.has(t)) return null;
  switch (t) {
    case 'nvarchar':
      return ({ email: 'email', url: 'url', phone: 'phone', tickersymbol: 'ticker', textarea: 'memo' } as Record<string, string>)[f] ?? 'string';
    case 'ntext':
      return 'memo';
    case 'int':
      return f === 'duration' ? 'duration' : 'integer';
    case 'bigint':
      return 'bigint';
    case 'decimal':
      return 'decimal';
    case 'float':
      return 'double';
    case 'money':
      return 'money';
    case 'bit':
      return 'boolean';
    case 'datetime':
      return 'datetime';
    case 'picklist':
      return 'picklist';
    case 'multiselectpicklist':
      return 'multiselect';
    case 'lookup':
      return 'lookup';
    case 'customer':
      return 'customer';
    case 'owner':
      return 'owner';
    case 'state':
      return 'state';
    case 'status':
      return 'status';
    default:
      return 'string';
  }
}

function requiredLevel(raw: string): AttributeMeta['required'] {
  const r = raw.toLowerCase();
  if (r.includes('system')) return 'SystemRequired';
  if (r === 'required' || r === 'applicationrequired') return 'ApplicationRequired';
  if (r === 'recommended') return 'Recommended';
  return 'None';
}

export function parseEntityXml(
  xml: string | null | undefined,
  folderName: string,
  lcid: number,
): { entity: EntityMeta; attributes: AttributeMeta[]; warnings: string[] } {
  const logicalFallback = folderName.toLowerCase();
  if (!xml) {
    return {
      entity: { logicalName: logicalFallback, displayName: folderName },
      attributes: [],
      warnings: ['El paquete no incluye Entity.xml: no hay lista de columnas. Usa "Añadir campo manual".'],
    };
  }

  const root = parseXml(xml).documentElement;
  const info = kid(kid(root, 'EntityInfo'), 'entity');
  const nameEl = kid(root, 'Name');
  const logicalName = (info?.getAttribute('Name') ?? nameEl?.textContent ?? folderName).trim().toLowerCase();
  const displayName =
    nameEl?.getAttribute('LocalizedName')?.trim() || localized(kid(info, 'LocalizedNames'), 'LocalizedName', lcid) || logicalName;

  const warnings: string[] = [];
  const skipped = new Map<string, number>();
  const attributes: AttributeMeta[] = [];

  for (const a of kids(kid(info, 'attributes'), 'attribute')) {
    const logical = (text(a, 'LogicalName') || text(a, 'Name') || a.getAttribute('PhysicalName') || '').toLowerCase();
    if (!logical) continue;
    const mask = text(a, 'DisplayMask');
    if (mask && !mask.includes('ValidForForm')) continue;
    if (text(a, 'AttributeOf')) continue;

    const rawType = text(a, 'Type');
    const type = mapType(rawType, text(a, 'Format'));
    if (type === null) {
      if (!['primarykey', 'uniqueidentifier'].includes(rawType.toLowerCase())) skipped.set(rawType, (skipped.get(rawType) ?? 0) + 1);
      continue;
    }
    attributes.push({
      logicalName: logical,
      displayName: localized(kid(a, 'displaynames'), 'displayname', lcid) || logical,
      type,
      required: requiredLevel(text(a, 'RequiredLevel')),
    });
  }

  if (skipped.size > 0) {
    const list = Array.from(skipped, ([t, n]) => `${t} (${n})`).join(', ');
    warnings.push(`Columnas de tipos no clasificables omitidas: ${list}. Si las necesitas, añádelas a mano.`);
  }
  return { entity: { logicalName, displayName }, attributes, warnings };
}

// ---------- formularios ----------

export function parseFormFile(xml: string, lcid: number): BundleForm {
  const doc = parseXml(xml);
  const root = doc.documentElement;
  const systemform = root.nodeName === 'systemform' ? root : kid(root, 'systemform');
  if (!systemform) throw new Error('no contiene <systemform>');

  let formXml: string | null = null;
  const formEl = kid(systemform, 'form');
  if (formEl) formXml = new XMLSerializer().serializeToString(formEl);
  else {
    const raw = text(systemform, 'FormXml');
    if (raw) formXml = raw;
  }
  if (!formXml) throw new Error('no contiene el nodo <form>');

  const formId = text(systemform, 'formid');
  return {
    formId: formId || formXml.length.toString(),
    name: localized(kid(systemform, 'LocalizedNames'), 'LocalizedName', lcid) || formId || 'Formulario sin nombre',
    type: (root.nodeName === 'forms' ? root.getAttribute('type') : null) ?? 'main',
    formXml,
  };
}

/** Campos que usan los formularios y que quizá no estén en Entity.xml (columnas estándar no incluidas en la solución). */
function fieldsUsedByForms(forms: BundleForm[], lcid: number): AttributeMeta[] {
  const found = new Map<string, AttributeMeta>();
  for (const f of forms) {
    let doc: Document;
    try {
      doc = parseXml(f.formXml);
    } catch {
      continue;
    }
    for (const control of Array.from(doc.getElementsByTagName('control'))) {
      const logical = control.getAttribute('datafieldname')?.toLowerCase();
      if (!logical || found.has(logical)) continue;
      const cell = control.parentElement;
      found.set(logical, {
        logicalName: logical,
        displayName: localized(kid(cell, 'labels'), 'label', lcid) || logical,
        type: typeForClassId(control.getAttribute('classid') ?? '') ?? 'string',
        required: 'None',
      });
    }
  }
  return Array.from(found.values());
}

// ---------- API pública ----------

const TYPE_ORDER: Record<string, number> = { main: 0, quickCreate: 1, quick: 2, card: 3 };

export function parseBundle(raw: string): Bundle {
  let data: BundleFile;
  try {
    data = JSON.parse(raw) as BundleFile;
  } catch {
    throw new Error('El fichero no es un JSON válido.');
  }
  if (data?.schema !== 1) throw new Error(`Versión de paquete no soportada (${String(data?.schema)}). Regenera el paquete con el script actual.`);
  if (typeof data.entity !== 'string' || !Array.isArray(data.forms)) throw new Error('El paquete está incompleto (faltan entity o forms).');

  const lcid = Number.isInteger(data.baseLanguage) ? (data.baseLanguage as number) : 1033;
  const warnings: string[] = [];

  const forms: BundleForm[] = [];
  for (const f of data.forms) {
    try {
      forms.push(parseFormFile(f.xml, lcid));
    } catch (e) {
      warnings.push(`Formulario omitido (${f.file ?? 's/nombre'}): ${e instanceof Error ? e.message : String(e)}.`);
    }
  }
  if (forms.length === 0) throw new Error('El paquete no contiene ningún formulario legible.');
  forms.sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) || a.name.localeCompare(b.name));

  const ent = parseEntityXml(data.entityXml, data.entity, lcid);
  warnings.push(...ent.warnings);

  // Columnas de Entity.xml + las usadas por los formularios que falten (sin pisar las de Entity.xml)
  const byName = new Map(ent.attributes.map((a) => [a.logicalName, a]));
  for (const extra of fieldsUsedByForms(forms, lcid)) if (!byName.has(extra.logicalName)) byName.set(extra.logicalName, extra);
  const attributes = Array.from(byName.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    generatedAt: data.generatedAt,
    environment: data.environment?.name || data.environment?.url || '',
    solution: data.solution?.uniqueName ?? '',
    entity: ent.entity,
    baseLanguage: lcid,
    attributes,
    forms,
    warnings,
  };
}
