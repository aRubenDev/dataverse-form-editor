import { NAME_PATTERN } from '../ids';
import type { AttributeMeta, FormModel, Issue } from '../types';

/**
 * Reglas previas a exportar. 'error' bloquea la exportación; 'warning' solo informa.
 * `attributes` es opcional: sin login no hay metadatos y se omiten las reglas que dependen de ellos.
 */
export function validateForm(model: FormModel, lcid: number, attributes: AttributeMeta[] = []): Issue[] {
  const issues: Issue[] = [];
  const l = String(lcid);

  if (model.tabs.length === 0) {
    issues.push({ level: 'error', message: 'El formulario no tiene ninguna pestaña.' });
  }

  const tabNames = new Map<string, number>();
  const sectionNames = new Map<string, number>();
  const fieldUsage = new Map<string, number>();
  const controlIds = new Map<string, number>();

  for (const tab of model.tabs) {
    const sel = { kind: 'tab', id: tab.id } as const;
    if (!tab.name) issues.push({ level: 'error', message: 'Una pestaña no tiene nombre.', target: sel });
    else if (!NAME_PATTERN.test(tab.name))
      issues.push({ level: 'error', message: `Nombre de pestaña inválido: "${tab.name}" (solo letras, dígitos y _; no puede empezar por dígito).`, target: sel });
    tabNames.set(tab.name, (tabNames.get(tab.name) ?? 0) + 1);
    if (!tab.labels[l]?.trim()) issues.push({ level: 'warning', message: `Pestaña "${tab.name}" sin etiqueta en el idioma ${l}.`, target: sel });
    if (tab.columns.every((c) => c.sections.length === 0))
      issues.push({ level: 'warning', message: `La pestaña "${tab.name}" no tiene secciones.`, target: sel });

    for (const col of tab.columns) {
      for (const sec of col.sections) {
        const ssel = { kind: 'section', id: sec.id } as const;
        if (!sec.name) issues.push({ level: 'error', message: 'Una sección no tiene nombre.', target: ssel });
        else if (!NAME_PATTERN.test(sec.name))
          issues.push({ level: 'error', message: `Nombre de sección inválido: "${sec.name}".`, target: ssel });
        sectionNames.set(sec.name, (sectionNames.get(sec.name) ?? 0) + 1);
        if (!sec.labels[l]?.trim()) issues.push({ level: 'warning', message: `Sección "${sec.name}" sin etiqueta en el idioma ${l}.`, target: ssel });

        for (const cell of sec.cells) {
          const csel = { kind: 'cell', id: cell.id } as const;
          if (cell.colspan > sec.columns)
            issues.push({ level: 'warning', message: `Una celda en "${sec.name}" tiene colspan ${cell.colspan} > columnas de la sección (${sec.columns}).`, target: csel });
          if (cell.kind === 'field' && cell.field) {
            if (!cell.field.dataField)
              issues.push({ level: 'error', message: `Hay un campo sin nombre lógico en "${sec.name}".`, target: csel });
            const meta = attributes.find((a) => a.logicalName === cell.field!.dataField);
            if (!cell.visible && meta && (meta.required === 'SystemRequired' || meta.required === 'ApplicationRequired'))
              issues.push({ level: 'warning', message: `El campo obligatorio ${meta.displayName || meta.logicalName} está oculto: si no tiene valor por defecto, no se podrá guardar.`, target: csel });
            fieldUsage.set(cell.field.dataField, (fieldUsage.get(cell.field.dataField) ?? 0) + 1);
            controlIds.set(cell.field.controlId, (controlIds.get(cell.field.controlId) ?? 0) + 1);
          }
        }
      }
    }
  }

  for (const [name, n] of tabNames) if (name && n > 1) issues.push({ level: 'error', message: `Nombre de pestaña duplicado: "${name}".` });
  for (const [name, n] of sectionNames) if (name && n > 1) issues.push({ level: 'error', message: `Nombre de sección duplicado: "${name}".` });
  for (const [id, n] of controlIds) if (n > 1) issues.push({ level: 'error', message: `Id de control duplicado: "${id}" (cada control necesita un id único en el formulario).` });
  for (const [f, n] of fieldUsage) if (n > 1) issues.push({ level: 'warning', message: `El campo "${f}" aparece ${n} veces en el formulario.` });

  const used = new Set(fieldUsage.keys());
  for (const a of attributes) {
    if ((a.required === 'SystemRequired' || a.required === 'ApplicationRequired') && !used.has(a.logicalName)) {
      issues.push({ level: 'warning', message: `Campo obligatorio no incluido: ${a.displayName || a.logicalName} (${a.logicalName}). Dataverse rechazará guardar registros sin valor si no hay otra vía.` });
    }
  }

  return issues;
}

/** ¿Está el campo referenciado en nodos preservados (events, header, footer...)? Sirve para avisar al borrarlo. */
export function fieldReferencedElsewhere(model: FormModel, dataField: string): boolean {
  const needle = `"${dataField}"`;
  return [...model.beforeTabs, ...model.afterTabs].some((x) => x.includes(needle));
}
