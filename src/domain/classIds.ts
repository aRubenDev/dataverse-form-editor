/**
 * Mapa tipo de atributo -> classid del control de FormXml.
 * Fuente: valores estándar de controles clásicos de Dataverse.
 * Los tipos sin entrada propia caen en 'string' (se avisa en validación).
 */
export const CLASS_IDS: Record<string, string> = {
  string: '{4273EDBD-AC1D-40d3-9FB2-095C621B552D}',
  memo: '{E0DECE4B-6FC8-4a8f-A065-082708572369}',
  email: '{ADA2203E-B4CD-49be-9DDF-234642B43B52}',
  url: '{71716B6C-711E-476C-8AB8-5D11542BFB47}',
  ticker: '{1E1FC551-F7A8-43af-AC34-A8DC35C7B6D4}',
  phone: '{F3015350-44A2-4AA0-97B5-00166532B5E9}',
  integer: '{C6D124CA-7EDA-4a60-AEA9-7FB8D318B68F}',
  bigint: '{C6D124CA-7EDA-4a60-AEA9-7FB8D318B68F}',
  duration: '{AA987274-CE4E-4271-A803-66164311A958}',
  decimal: '{C3EFE0C3-0EC6-42be-8349-CBD9079AFEDE}',
  double: '{0D2C745A-E5A8-4C8F-BA63-C6D3BB604660}',
  money: '{533B9E00-756B-4312-95A0-DC888637AC78}',
  boolean: '{67FAC785-CD58-4f9f-ABB3-4B7DDC6ED5ED}',
  datetime: '{5B773807-9FB2-42db-97C3-7A91EFF8ADFF}',
  picklist: '{3EF39988-22BB-4F0B-BBBE-64B5A3748AEE}',
  multiselect: '{06375649-C143-495E-A496-C962E5B4488E}',
  state: '{5D68B988-0661-4db2-BC3E-17598AD3BE6C}',
  status: '{5D68B988-0661-4db2-BC3E-17598AD3BE6C}',
  lookup: '{270BD3DB-D9AF-4782-9025-509E298DEC0A}',
  customer: '{270BD3DB-D9AF-4782-9025-509E298DEC0A}',
  owner: '{270BD3DB-D9AF-4782-9025-509E298DEC0A}',
};

export const TYPE_LABELS: Record<string, string> = {
  string: 'Texto',
  memo: 'Texto multilínea',
  email: 'Email',
  url: 'URL',
  ticker: 'Ticker',
  phone: 'Teléfono',
  integer: 'Número entero',
  bigint: 'Entero grande',
  duration: 'Duración',
  decimal: 'Decimal',
  double: 'Coma flotante',
  money: 'Moneda',
  boolean: 'Dos opciones',
  datetime: 'Fecha y hora',
  picklist: 'Conjunto de opciones',
  multiselect: 'Selección múltiple',
  state: 'Estado',
  status: 'Motivo de estado',
  lookup: 'Búsqueda',
  customer: 'Cliente',
  owner: 'Propietario',
};

/** classid de controles "especiales" que el editor muestra como bloque opaco */
export const OPAQUE_CLASS_NAMES: Record<string, string> = {
  '{E7A81278-8635-4D9E-8D4D-59480B391C5B}': 'Subgrid',
  '{9FDF5F91-88B1-47F4-AD53-C11EFC01A01D}': 'Web resource',
  '{FD2A7985-3187-444E-908D-6624B21F69C0}': 'IFrame',
  '{5C5600E0-1D6E-4205-A272-BE80DA87FD42}': 'Quick view',
  '{62B0DF79-0464-470F-8AF7-4483CFEA0C7D}': 'Timeline',
};

export function classIdForType(type: string): string {
  return CLASS_IDS[type] ?? CLASS_IDS.string;
}

/** Inversa aproximada para campos añadidos a mano o importados. */
export function typeForClassId(classId: string): string | undefined {
  const up = classId.toUpperCase();
  return Object.entries(CLASS_IDS).find(([, v]) => v.toUpperCase() === up)?.[0];
}
