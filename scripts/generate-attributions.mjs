// Generates src/assets/attributions.json (F58) from package.json's runtime
// `dependencies` — the packages actually bundled into the shipped extension,
// never devDependencies (build/test tooling that ships nothing). Run
// manually with `node scripts/generate-attributions.mjs` whenever
// dependencies change; the output is committed, not built on the fly
// (same pattern as scripts/generate-perf-fixtures.mjs), so the settings
// page can read it as a plain static import with no Node access at runtime.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const names = Object.keys(pkg.dependencies ?? {}).sort((a, b) => a.localeCompare(b));

function readDependencyPackageJson(name) {
  const pkgJsonPath = path.join(rootDir, 'node_modules', name, 'package.json');
  return JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
}

function licenseText(depPkg) {
  if (typeof depPkg.license === 'string') return depPkg.license;
  if (Array.isArray(depPkg.licenses)) {
    return depPkg.licenses.map((l) => l.type ?? String(l)).join(' OR ');
  }
  return 'UNKNOWN';
}

// npm allows a bare "owner/repo" shorthand for `repository`/`homepage`
// (no protocol) — normalize it to a real, clickable GitHub URL rather than
// showing an inert, non-navigable string in the attribution list.
function normalizeHomepage(raw) {
  if (!raw) return '';
  if (/^https?:\/\//.test(raw)) return raw;
  const cleaned = raw.replace(/^git\+/, '').replace(/\.git$/, '');
  if (/^[\w.-]+\/[\w.-]+$/.test(cleaned)) return `https://github.com/${cleaned}`;
  if (/^github:/.test(cleaned)) return `https://github.com/${cleaned.slice('github:'.length)}`;
  return cleaned;
}

const attributions = names.map((name) => {
  const depPkg = readDependencyPackageJson(name);
  const rawHomepage =
    depPkg.homepage ??
    (typeof depPkg.repository === 'string' ? depPkg.repository : (depPkg.repository?.url ?? ''));
  return {
    name,
    version: depPkg.version ?? pkg.dependencies[name],
    license: licenseText(depPkg),
    homepage: normalizeHomepage(rawHomepage),
  };
});

const outPath = path.join(rootDir, 'src', 'backend', 'assets', 'attributions.json');
writeFileSync(outPath, JSON.stringify(attributions, null, 2) + '\n');
console.log(`Wrote ${attributions.length} attributions to ${path.relative(rootDir, outPath)}`);
