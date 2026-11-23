import { describe, expect, it } from 'vitest';
import { parseBundle } from './bundle';
import { parseFormXml } from './formxml/parse';
import { serializeFormXml } from './formxml/serialize';

const ENTITY_XML = `<Entity>
  <Name LocalizedName="Account" OriginalName="Account">Account</Name>
  <EntityInfo>
    <entity Name="Account">
      <LocalizedNames><LocalizedName description="Account" languagecode="1033" /></LocalizedNames>
      <attributes>
        <attribute PhysicalName="Name"><Type>nvarchar</Type><Name>name</Name><LogicalName>name</LogicalName><RequiredLevel>required</RequiredLevel>
          <DisplayMask>PrimaryName|ValidForAdvancedFind|ValidForForm|ValidForGrid</DisplayMask><Format>text</Format>
          <displaynames><displayname description="Account Name" languagecode="1033" /><displayname description="Nombre" languagecode="3082" /></displaynames></attribute>
        <attribute PhysicalName="EMailAddress1"><Type>nvarchar</Type><LogicalName>emailaddress1</LogicalName><RequiredLevel>none</RequiredLevel>
          <DisplayMask>ValidForForm</DisplayMask><Format>email</Format><displaynames><displayname description="Email" languagecode="1033" /></displaynames></attribute>
        <attribute PhysicalName="new_notes"><Type>ntext</Type><LogicalName>new_notes</LogicalName><RequiredLevel>none</RequiredLevel><DisplayMask>ValidForForm</DisplayMask></attribute>
        <attribute PhysicalName="new_amount"><Type>money</Type><LogicalName>new_amount</LogicalName><RequiredLevel>systemrequired</RequiredLevel><DisplayMask>ValidForForm</DisplayMask></attribute>
        <attribute PhysicalName="AccountId"><Type>primarykey</Type><LogicalName>accountid</LogicalName><DisplayMask>PrimaryKey</DisplayMask></attribute>
        <attribute PhysicalName="Hidden"><Type>int</Type><LogicalName>hiddenthing</LogicalName><DisplayMask>ValidForAdvancedFind</DisplayMask></attribute>
        <attribute PhysicalName="Weird"><Type>virtual</Type><LogicalName>new_weird</LogicalName><DisplayMask>ValidForForm</DisplayMask></attribute>
      </attributes>
    </entity>
  </EntityInfo>
</Entity>`;

const form = (id: string, name: string, type: string, fields: string[]) => `<forms type="${type}">
  <systemform>
    <formid>${id}</formid>
    <FormPresentation>1</FormPresentation>
    <form showImage="true">
      <tabs><tab name="general" id="{AAAAAAAA-0000-0000-0000-000000000001}" expanded="true" showlabel="true">
        <labels><label description="General" languagecode="1033" /></labels>
        <columns><column width="100%"><sections><section name="s1" showlabel="true" showbar="false" columns="1" id="{AAAAAAAA-0000-0000-0000-000000000002}">
          <labels><label description="Info" languagecode="1033" /></labels>
          <rows>${fields
            .map(
              (f) => `<row><cell id="{BBBBBBBB-0000-0000-0000-00000000000${fields.indexOf(f)}}"><labels><label description="${f.toUpperCase()}" languagecode="1033" /></labels>
            <control id="${f}" classid="{4273EDBD-AC1D-40d3-9FB2-095C621B552D}" datafieldname="${f}" /></cell></row>`,
            )
            .join('')}</rows>
        </section></sections></column></columns></tab></tabs>
      <events><event name="onload" application="false" active="true" /></events>
    </form>
    <LocalizedNames><LocalizedName description="${name}" languagecode="1033" /></LocalizedNames>
  </systemform>
</forms>`;

const bundle = {
  schema: 1,
  generatedAt: '2026-11-23T12:00:00Z',
  environment: { name: 'DEV', url: 'https://org.crm4.dynamics.com' },
  solution: { uniqueName: 'MiSolucion' },
  entity: 'Account',
  baseLanguage: 1033,
  entityXml: ENTITY_XML,
  forms: [
    { file: 'FormXml/quick/{2}.xml', xml: form('{2}', 'Quick', 'quick', ['name']) },
    { file: 'FormXml/main/{1}.xml', xml: form('{1}', 'Information', 'main', ['name', 'telephone1']) },
    { file: 'FormXml/main/{3}.xml', xml: '<forms><oops/></forms>' },
  ],
};

describe('parseBundle', () => {
  const b = parseBundle(JSON.stringify(bundle));

  it('lee entidad, entorno y solución', () => {
    expect(b.entity).toEqual({ logicalName: 'account', displayName: 'Account' });
    expect(b.environment).toBe('DEV');
    expect(b.solution).toBe('MiSolucion');
  });

  it('extrae columnas editables con tipo, nombre localizado y obligatoriedad', () => {
    const by = Object.fromEntries(b.attributes.map((a) => [a.logicalName, a]));
    expect(by.name).toMatchObject({ displayName: 'Account Name', type: 'string', required: 'ApplicationRequired' });
    expect(by.emailaddress1.type).toBe('email');
    expect(by.new_notes.type).toBe('memo');
    expect(by.new_amount).toMatchObject({ type: 'money', required: 'SystemRequired' });
    expect(by.accountid).toBeUndefined(); // clave primaria
    expect(by.hiddenthing).toBeUndefined(); // sin ValidForForm
    expect(by.new_weird).toBeUndefined(); // virtual: no clasificable
  });

  it('avisa de columnas no clasificables y de formularios ilegibles', () => {
    expect(b.warnings.join(' ')).toContain('virtual');
    expect(b.warnings.join(' ')).toContain('Formulario omitido');
  });

  it('añade a la paleta campos de los formularios que no están en Entity.xml', () => {
    const extra = b.attributes.find((a) => a.logicalName === 'telephone1');
    expect(extra).toBeDefined();
    expect(extra!.displayName).toBe('TELEPHONE1');
  });

  it('ordena formularios (main primero) y entrega <form> parseable con el editor, conservando events', () => {
    expect(b.forms.map((f) => f.type)).toEqual(['main', 'quick']);
    const model = parseFormXml(b.forms[0].formXml);
    expect(model.tabs[0].columns[0].sections[0].cells).toHaveLength(2);
    expect(serializeFormXml(model)).toContain('<events>');
  });

  it('rechaza paquetes inválidos', () => {
    expect(() => parseBundle('no json')).toThrow(/JSON/);
    expect(() => parseBundle(JSON.stringify({ schema: 2, entity: 'x', forms: [] }))).toThrow(/Versión/);
    expect(() => parseBundle(JSON.stringify({ schema: 1, entity: 'x', forms: [{ xml: '<forms/>' }] }))).toThrow(/ningún formulario/);
  });

  it('sin Entity.xml sigue funcionando con las columnas de los formularios', () => {
    const r = parseBundle(JSON.stringify({ ...bundle, entityXml: null }));
    expect(r.entity.logicalName).toBe('account');
    expect(r.attributes.map((a) => a.logicalName)).toContain('telephone1');
    expect(r.warnings.join(' ')).toContain('Entity.xml');
  });
});
