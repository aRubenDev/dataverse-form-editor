import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { EditorProvider } from './state/EditorContext';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FORM = `<forms type="main"><systemform><formid>{1}</formid><form showImage="true"><tabs>
<tab name="general" id="{A1}" expanded="true" showlabel="true"><labels><label description="General" languagecode="1033" /></labels>
<columns><column width="100%"><sections><section name="s1" showlabel="true" showbar="false" columns="1" id="{A2}"><labels><label description="Info" languagecode="1033" /></labels>
<rows><row><cell id="{A3}"><labels><label description="Name" languagecode="1033" /></labels><control id="name" classid="{4273EDBD-AC1D-40d3-9FB2-095C621B552D}" datafieldname="name" /></cell></row></rows>
</section></sections></column></columns></tab></tabs></form>
<LocalizedNames><LocalizedName description="Information" languagecode="1033" /></LocalizedNames></systemform></forms>`;

const BUNDLE = JSON.stringify({ schema: 1, entity: 'Account', baseLanguage: 1033, solution: { uniqueName: 'Sol' }, environment: { name: 'DEV' }, entityXml: null, forms: [{ file: 'a.xml', xml: FORM }] });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = () => act(() => root.render(<EditorProvider><App /></EditorProvider>));

describe('App (smoke)', () => {
  it('muestra la pantalla de inicio sin formulario', () => {
    render();
    expect(host.textContent).toContain('Cargar paquete de Dataverse');
    expect(host.textContent).toContain('export-form-bundle.mjs');
  });

  it('crea un formulario nuevo y muestra el canvas', () => {
    render();
    const btn = host.querySelector<HTMLButtonElement>('button[title="Formulario nuevo"]')!;
    act(() => btn.click());
    expect(host.textContent).toContain('General');
    expect(host.textContent).toContain('Añadir sección');
  });

  it('carga un paquete con un solo formulario y lo abre', async () => {
    render();
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [{ name: 'a.bundle.json', text: async () => BUNDLE }] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.textContent).toContain('Account');
    expect(host.textContent).toContain('Name'); // celda del formulario
    expect(localStorage.getItem('dfd.bundleRaw')).toBe(BUNDLE);
  });

  it('un paquete inválido muestra el error y no rompe la app', async () => {
    render();
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [{ name: 'mal.json', text: async () => 'no es json' }] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.textContent).toContain('No se pudo cargar mal.json');
  });
});
