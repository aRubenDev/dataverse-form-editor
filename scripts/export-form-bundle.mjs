#!/usr/bin/env node
/**
 * Genera un paquete .bundle.json con los formularios y columnas de una tabla de una solucion, usando PAC CLI.
 * Flujo: entorno -> solucion -> (publicar) -> exportar y desempaquetar -> tabla -> paquete.
 * No interpreta XML: vuelca Entity.xml, los ficheros de FormXml y el idioma base tal cual.
 *
 * Uso:  node scripts/export-form-bundle.mjs [--env URL] [--solution NOMBRE] [--entity tabla]
 *                                           [--out carpeta] [--skip-publish] [--keep-work] [--yes]
 * Requisitos: Node 18+, PAC CLI y una sesion creada con `pac auth create`. Solo soluciones no gestionadas.
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => rl.question(q);
const step = (m) => console.log(`\n==> ${m}`);

function parseArgs(argv) {
  const o = { out: resolve('bundles') };
  const flags = { '--env': 'env', '--solution': 'solution', '--entity': 'entity', '--out': 'out' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (flags[a]) o[flags[a]] = argv[++i];
    else if (a === '--skip-publish') o.skipPublish = true;
    else if (a === '--keep-work') o.keepWork = true;
    else if (a === '--yes') o.yes = true;
    else { console.error(`Argumento desconocido: ${a}`); process.exit(2); }
  }
  return o;
}

function pac(...pacArgs) {
  const win = process.platform === 'win32'; // en Windows pac puede ser un .cmd: hace falta shell y comillas
  const a = win ? pacArgs.map((x) => (/[\s"]/.test(x) ? `"${x.replace(/"/g, '\\"')}"` : x)) : pacArgs;
  const r = spawnSync('pac', a, { encoding: 'utf8', shell: win, maxBuffer: 256 * 1024 * 1024 });
  if (r.error) {
    if (r.error.code === 'ENOENT') throw new Error('No encuentro "pac". Instalalo (dotnet tool install --global Microsoft.PowerApps.CLI.Tool) y ejecuta "pac auth create".');
    throw r.error;
  }
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (r.status !== 0) throw new Error(`pac ${pacArgs.join(' ')} fallo (codigo ${r.status}):\n${out}`);
  return out;
}

async function pick(title, items, label) {
  if (items.length === 0) throw new Error(`No hay elementos para elegir: ${title}`);
  if (items.length === 1) { console.log(`${title}: ${label(items[0])} (unico)`); return items[0]; }
  console.log(`\n${title}`);
  items.forEach((it, i) => console.log(`  [${i + 1}] ${label(it)}`));
  for (;;) {
    const a = (await ask('Numero (q para salir): ')).trim();
    if (a === 'q') throw new Error('Cancelado por el usuario.');
    const n = Number(a);
    if (Number.isInteger(n) && n >= 1 && n <= items.length) return items[n - 1];
    console.log('Opcion no valida.');
  }
}

// pac env list no tiene --json: se leen las lineas que contengan un GUID y una URL https.
function getEnvironments() {
  const guid = /[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i;
  const found = [];
  for (const line of pac('env', 'list').split(/\r?\n/)) {
    const id = guid.exec(line);
    const url = /https:\/\/[^\s/]+/.exec(line);
    if (!id || !url) continue;
    const name = url.index > id.index ? line.slice(0, id.index).trim().replace(/^\[\d+\]\s*/, '').replace(/^\*\s*/, '').trim() : '';
    found.push({ name: name || url[0].slice(8), id: id[0], url: url[0], active: line.trimStart().startsWith('*') });
  }
  return found;
}

const prop = (o, names) => {
  for (const n of names) {
    const k = Object.keys(o).find((x) => x.toLowerCase() === n.toLowerCase());
    if (k !== undefined && o[k] != null) return o[k];
  }
  return null;
};

// pac solution list --json: se acepta tanto un array como un objeto que lo contenga.
function getSolutions(envUrl) {
  const raw = pac('solution', 'list', '--environment', envUrl, '--json');
  const s = raw.search(/[[{]/);
  const e = Math.max(raw.lastIndexOf(']'), raw.lastIndexOf('}'));
  if (s < 0 || e <= s) return [];
  let data;
  try { data = JSON.parse(raw.slice(s, e + 1)); } catch { return []; }
  if (!Array.isArray(data)) data = Object.values(data ?? {}).find(Array.isArray) ?? [data];
  return data.flatMap((it) => {
    if (!it || typeof it !== 'object') return [];
    const unique = prop(it, ['SolutionUniqueName', 'UniqueName', 'uniquename', 'Name']);
    if (!unique) return [];
    if (String(prop(it, ['IsManaged', 'Managed', 'ismanaged'])).toLowerCase() === 'true') return [];
    return [{ unique: String(unique), friendly: prop(it, ['FriendlyName', 'DisplayName', 'friendlyname']) ?? '', version: prop(it, ['Version', 'SolutionVersion']) ?? '' }];
  });
}

const walkXml = (dir) =>
  !existsSync(dir) ? [] : readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walkXml(p) : n.toLowerCase().endsWith('.xml') ? [p] : [];
  });

async function main() {
  // 1. Entorno
  let envUrl = args.env;
  let envName = envUrl;
  if (!envUrl) {
    step('Entornos (pac env list)');
    let envs = [];
    try { envs = getEnvironments(); } catch (e) { console.warn(e.message); }
    if (envs.length === 0) {
      console.warn('No pude leer la lista de entornos (hace falta "pac auth create"?).');
      envUrl = (await ask('URL del entorno: ')).trim();
      envName = envUrl;
    } else {
      const c = await pick('Entorno', envs, (e) => `${e.active ? '* ' : ''}${e.name}  ${e.url}`);
      envUrl = c.url;
      envName = c.name;
    }
  }
  if (!envUrl) throw new Error('Falta el entorno.');

  // Salvaguarda: nunca se exporta sin confirmar el entorno (evita tocar produccion por error)
  if (!args.yes) {
    const a = (await ask(`\nEntorno: ${envName}  ${envUrl}\nContinuar con este entorno? (s/N): `)).trim().toLowerCase();
    if (a !== 's' && a !== 'si') throw new Error('Cancelado: entorno no confirmado.');
  }

  // 2. Solucion
  let solution = args.solution;
  if (!solution) {
    step('Soluciones no gestionadas (pac solution list)');
    const sols = getSolutions(envUrl);
    if (sols.length === 0) {
      console.warn('No pude leer la lista de soluciones.');
      solution = (await ask('Nombre unico de la solucion: ')).trim();
    } else {
      solution = (await pick('Solucion', sols, (s) => `${s.unique}  (${s.friendly} ${s.version})`.replace(/\s+\)/, ')'))).unique;
    }
  }
  if (!solution) throw new Error('Falta el nombre de la solucion.');

  // 3. Publicar (para que el export incluya los ultimos cambios)
  if (!args.skipPublish) {
    const a = (await ask('Publicar todas las personalizaciones antes de exportar? Asi el paquete refleja lo ultimo (S/n): ')).trim().toLowerCase();
    if (a !== 'n' && a !== 'no') {
      step('Publicando personalizaciones');
      pac('solution', 'publish', '--environment', envUrl);
    }
  }

  // 4-5. Exportar, desempaquetar, elegir tabla y escribir paquete
  const work = mkdtempSync(join(tmpdir(), 'formbundle_'));
  try {
    const zip = join(work, 'solution.zip');
    const unpacked = join(work, 'unpacked');

    step(`Exportando '${solution}' (no gestionada)`);
    pac('solution', 'export', '--environment', envUrl, '--name', solution, '--path', zip, '--overwrite');

    step('Desempaquetando');
    pac('solution', 'unpack', '--zipfile', zip, '--folder', unpacked);

    const root = join(unpacked, 'Entities');
    if (!existsSync(root)) throw new Error(`La solucion '${solution}' no contiene tablas (no existe la carpeta Entities).`);

    let candidates = readdirSync(root)
      .filter((n) => statSync(join(root, n)).isDirectory())
      .map((n) => ({ name: n, path: join(root, n), forms: walkXml(join(root, n, 'FormXml')) }))
      .filter((c) => c.forms.length > 0);
    if (args.entity) candidates = candidates.filter((c) => c.name.toLowerCase() === args.entity.toLowerCase());
    if (candidates.length === 0) throw new Error('Ninguna tabla de la solucion tiene formularios. Anade los formularios a la solucion (o usa "incluir todos los objetos").');
    const chosen = await pick('Tabla', candidates, (c) => `${c.name}  (${c.forms.length} formularios)`);

    const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
    const entityFile = join(chosen.path, 'Entity.xml');
    const custFile = join(unpacked, 'Other', 'Customizations.xml');
    const lang = existsSync(custFile) ? /<Language>\s*(\d+)\s*<\/Language>/.exec(read(custFile)) : null;

    const bundle = {
      schema: 1,
      generatedAt: new Date().toISOString(),
      environment: { name: envName, url: envUrl },
      solution: { uniqueName: solution },
      entity: chosen.name,
      baseLanguage: lang ? Number(lang[1]) : 1033,
      entityXml: existsSync(entityFile) ? read(entityFile) : null,
      forms: chosen.forms.map((f) => ({ file: relative(chosen.path, f), xml: read(f) })),
    };

    mkdirSync(args.out, { recursive: true });
    const file = join(args.out, `${chosen.name.toLowerCase()}.${solution}.bundle.json`);
    writeFileSync(file, JSON.stringify(bundle, null, 2), 'utf8');

    console.log(`\nPaquete creado: ${file}`);
    console.log(`  ${bundle.forms.length} formulario(s), idioma base ${bundle.baseLanguage}`);
    console.log('  Abrelo en la herramienta con "Cargar paquete".');
  } finally {
    if (args.keepWork) console.log(`Carpeta temporal conservada: ${work}`);
    else rmSync(work, { recursive: true, force: true });
  }
}

main()
  .catch((e) => { console.error(`\nError: ${e.message}`); process.exitCode = 1; })
  .finally(() => rl.close());
