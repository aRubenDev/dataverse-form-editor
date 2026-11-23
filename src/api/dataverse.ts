import type { AttributeMeta, EntityMeta, FormSummary } from '../domain/types';

const API = '/api/data/v9.2';

export class DataverseError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface Label {
  UserLocalizedLabel?: { Label?: string } | null;
  LocalizedLabels?: { Label?: string }[];
}
const labelOf = (l: Label | null | undefined): string => l?.UserLocalizedLabel?.Label ?? l?.LocalizedLabels?.[0]?.Label ?? '';

interface ODataList<T> {
  value: T[];
  '@odata.nextLink'?: string;
}

/** Cliente mínimo de la Web API. `getToken` se invoca en cada petición para aprovechar el refresco silencioso. */
export class DataverseClient {
  constructor(
    private readonly orgUrl: string,
    private readonly getToken: () => Promise<string>,
  ) {}

  private async request<T>(urlOrPath: string, attempt = 0): Promise<T> {
    const url = urlOrPath.startsWith('http') ? urlOrPath : `${this.orgUrl}${API}${urlOrPath}`;
    const token = await this.getToken();
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
    });

    // Límite de peticiones: respetamos Retry-After (máx. 2 reintentos)
    if (res.status === 429 && attempt < 2) {
      const wait = Number(res.headers.get('Retry-After') ?? '2');
      await new Promise((r) => setTimeout(r, Math.min(wait, 30) * 1000));
      return this.request<T>(urlOrPath, attempt + 1);
    }
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        if (body.error?.message) msg = body.error.message;
      } catch {
        /* cuerpo no JSON */
      }
      if (res.status === 403) msg += ' (¿falta el rol de seguridad con permiso de lectura sobre metadatos/formularios?)';
      throw new DataverseError(msg, res.status);
    }
    return (await res.json()) as T;
  }

  private async getAll<T>(path: string): Promise<T[]> {
    const out: T[] = [];
    let next: string | undefined = path;
    while (next) {
      const page: ODataList<T> = await this.request<ODataList<T>>(next);
      out.push(...page.value);
      next = page['@odata.nextLink'];
    }
    return out;
  }

  /** LCID del idioma base de la organización. */
  async getBaseLanguage(): Promise<number> {
    const r = await this.request<ODataList<{ languagecode: number }>>('/organizations?$select=languagecode&$top=1');
    return r.value[0]?.languagecode ?? 1033;
  }

  async listEntities(): Promise<EntityMeta[]> {
    const rows = await this.getAll<{ LogicalName: string; DisplayName: Label }>(
      '/EntityDefinitions?$select=LogicalName,DisplayName&$filter=IsPrivate eq false and IsIntersect eq false',
    );
    return rows
      .map((e) => ({ logicalName: e.LogicalName, displayName: labelOf(e.DisplayName) || e.LogicalName }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async listForms(entity: string): Promise<FormSummary[]> {
    const rows = await this.getAll<{ formid: string; name: string; type: number }>(
      `/systemforms?$select=formid,name,type&$filter=objecttypecode eq '${encodeURIComponent(entity)}' and (type eq 2 or type eq 6 or type eq 7)&$orderby=name`,
    );
    return rows.map((r) => ({ formId: r.formid, name: r.name, type: r.type }));
  }

  async getFormXml(formId: string): Promise<string> {
    const r = await this.request<{ formxml: string }>(`/systemforms(${formId})?$select=formxml`);
    return r.formxml;
  }

  async listAttributes(entity: string): Promise<AttributeMeta[]> {
    const base = `/EntityDefinitions(LogicalName='${encodeURIComponent(entity)}')/Attributes`;
    const select = 'LogicalName,DisplayName,AttributeType,AttributeTypeName,RequiredLevel,IsValidForForm,AttributeOf';
    const [all, strings, ints] = await Promise.all([
      this.getAll<RawAttr>(`${base}?$select=${select}`),
      this.getAll<{ LogicalName: string; Format: string | null }>(
        `${base}/Microsoft.Dynamics.CRM.StringAttributeMetadata?$select=LogicalName,Format`,
      ),
      this.getAll<{ LogicalName: string; Format: string | null }>(
        `${base}/Microsoft.Dynamics.CRM.IntegerAttributeMetadata?$select=LogicalName,Format`,
      ),
    ]);
    const stringFormat = new Map(strings.map((s) => [s.LogicalName, s.Format ?? 'Text']));
    const intFormat = new Map(ints.map((s) => [s.LogicalName, s.Format ?? 'None']));

    return all
      .filter((a) => a.IsValidForForm && !a.AttributeOf)
      .map((a) => ({
        logicalName: a.LogicalName,
        displayName: labelOf(a.DisplayName) || a.LogicalName,
        type: mapType(a, stringFormat.get(a.LogicalName), intFormat.get(a.LogicalName)),
        required: (a.RequiredLevel?.Value ?? 'None') as AttributeMeta['required'],
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
}

interface RawAttr {
  LogicalName: string;
  DisplayName: Label;
  AttributeType: string;
  AttributeTypeName?: { Value?: string };
  RequiredLevel?: { Value?: string };
  IsValidForForm: boolean;
  AttributeOf: string | null;
}

function mapType(a: RawAttr, strFmt?: string, intFmt?: string): string {
  const typeName = a.AttributeTypeName?.Value ?? '';
  if (typeName === 'MultiSelectPicklistType') return 'multiselect';
  switch (a.AttributeType) {
    case 'String':
      return ({ Email: 'email', Url: 'url', Phone: 'phone', TickerSymbol: 'ticker' } as Record<string, string>)[strFmt ?? ''] ?? 'string';
    case 'Memo':
      return 'memo';
    case 'Integer':
      return intFmt === 'Duration' ? 'duration' : 'integer';
    case 'BigInt':
      return 'bigint';
    case 'Decimal':
      return 'decimal';
    case 'Double':
      return 'double';
    case 'Money':
      return 'money';
    case 'Boolean':
      return 'boolean';
    case 'DateTime':
      return 'datetime';
    case 'Picklist':
      return 'picklist';
    case 'State':
      return 'state';
    case 'Status':
      return 'status';
    case 'Lookup':
      return 'lookup';
    case 'Customer':
      return 'customer';
    case 'Owner':
      return 'owner';
    default:
      return 'string';
  }
}
