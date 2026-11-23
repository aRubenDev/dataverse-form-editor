import { describe, expect, it } from 'vitest';
import { createEmptyForm, chunkRows, serializeFormXml } from './serialize';
import { parseFormXml } from './parse';
import { validateForm } from './validate';

const SAMPLE = `<form showImage="true">
  <tabs>
    <tab name="general" id="{11111111-1111-1111-1111-111111111111}" expanded="true" showlabel="true" verticallayout="true" IsUserDefined="1">
      <labels><label description="General" languagecode="1033" /><label description="Principal" languagecode="3082" /></labels>
      <columns>
        <column width="100%">
          <sections>
            <section name="s1" showlabel="true" showbar="false" columns="2" id="{22222222-2222-2222-2222-222222222222}" labelwidth="115">
              <labels><label description="Info" languagecode="1033" /></labels>
              <rows>
                <row>
                  <cell id="{33333333-3333-3333-3333-333333333333}" showlabel="true" locklevel="0">
                    <labels><label description="Name" languagecode="1033" /></labels>
                    <control id="name" classid="{4273EDBD-AC1D-40d3-9FB2-095C621B552D}" datafieldname="name" disabled="false" />
                  </cell>
                  <cell id="{44444444-4444-4444-4444-444444444444}" showlabel="true">
                    <labels><label description="Owner" languagecode="1033" /></labels>
                    <control id="ownerid" classid="{270BD3DB-D9AF-4782-9025-509E298DEC0A}" datafieldname="ownerid">
                      <parameters><DefaultViewId>{AAAA}</DefaultViewId></parameters>
                    </control>
                  </cell>
                </row>
                <row>
                  <cell id="{55555555-5555-5555-5555-555555555555}" showlabel="false" colspan="2">
                    <labels><label description="Contacts" languagecode="1033" /></labels>
                    <control id="contacts" classid="{E7A81278-8635-4D9E-8D4D-59480B391C5B}"><parameters><TargetEntityType>contact</TargetEntityType></parameters></control>
                  </cell>
                </row>
              </rows>
            </section>
          </sections>
        </column>
      </columns>
    </tab>
  </tabs>
  <events><event name="onload" application="false" active="true"><Handlers><Handler functionName="init" libraryName="x.js" handlerUniqueId="{6}" enabled="true" parameters="" passExecutionContext="false" /></Handlers></event></events>
  <formLibraries><Library name="x.js" libraryUniqueId="{7}" /></formLibraries>
</form>`;

describe('FormXml round-trip', () => {
  it('conserva todos los idiomas, controles especiales, parameters y nodos de formulario', () => {
    const model = parseFormXml(SAMPLE);
    expect(model.tabs).toHaveLength(1);
    expect(model.tabs[0].labels).toEqual({ '1033': 'General', '3082': 'Principal' });

    const cells = model.tabs[0].columns[0].sections[0].cells;
    expect(cells.map((c) => c.kind)).toEqual(['field', 'field', 'opaque']);
    expect(cells[1].controlInner).toContain('DefaultViewId');

    const out = serializeFormXml(model);
    expect(out).toContain('languagecode="3082"');
    expect(out).toContain('E7A81278-8635-4D9E-8D4D-59480B391C5B');
    expect(out).toContain('<TargetEntityType>contact</TargetEntityType>');
    expect(out).toContain('<events>');
    expect(out).toContain('<formLibraries>');
    expect(out).toContain('labelwidth="115"');
    expect(out).toContain('locklevel="0"');

    // Idempotencia: parsear la salida y volver a serializar da lo mismo
    expect(serializeFormXml(parseFormXml(out))).toBe(out);
  });

  it('el XML exportado es XML bien formado', () => {
    const out = serializeFormXml(parseFormXml(SAMPLE));
    const doc = new DOMParser().parseFromString(out, 'application/xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  });

  it('rechaza XML inválido y raíz inesperada', () => {
    expect(() => parseFormXml('<form><tabs></form>')).toThrow();
    expect(() => parseFormXml('<foo/>')).toThrow();
  });

  it('avisa de rowspan > 1', () => {
    const xml = SAMPLE.replace('locklevel="0"', 'locklevel="0" rowspan="2"');
    expect(parseFormXml(xml).importWarnings.join(' ')).toContain('rowspan');
  });
});

describe('chunkRows', () => {
  const mk = (colspan: number) => ({ id: String(Math.random()), kind: 'empty' as const, colspan, rowspan: 1, showlabel: true, labels: {}, cellAttrs: {}, controlAttrs: {} });
  it('respeta colspan y columnas', () => {
    const rows = chunkRows([mk(1), mk(1), mk(2), mk(1)], 2);
    expect(rows.map((r) => r.length)).toEqual([2, 1, 1]);
  });
});

describe('validateForm', () => {
  it('formulario vacío válido sin errores, con warning por etiquetas ausentes en otro idioma', () => {
    const f = createEmptyForm(3082);
    expect(validateForm(f, 3082).filter((i) => i.level === 'error')).toHaveLength(0);
    expect(validateForm(f, 1033).some((i) => i.level === 'warning')).toBe(true);
  });
  it('detecta nombres duplicados e inválidos', () => {
    const f = createEmptyForm(1033);
    f.tabs.push({ ...f.tabs[0], id: '{X}', name: 'general' });
    f.tabs[0].name = '1bad name';
    const errs = validateForm(f, 1033).filter((i) => i.level === 'error').map((i) => i.message);
    expect(errs.some((m) => m.includes('inválido'))).toBe(true);
  });
});
