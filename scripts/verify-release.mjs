import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';

export async function verifyRelease(directory) {
  const root = path.resolve(directory);
  if (!(await fs.lstat(root)).isDirectory()) throw Error('Release directory must be a real directory');
  const manifestPath = path.join(root, 'release-manifest.json');
  const manifestStat = await fs.lstat(manifestPath);
  if (!manifestStat.isFile() || manifestStat.size > 2 * 1024 * 1024) throw Error('Invalid release manifest');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(manifest.version || '') ||
      manifest.os !== 'linux' || !Array.isArray(manifest.files) || !manifest.files.length ||
      !Array.isArray(manifest.images) || manifest.images.length !== 3 ||
      manifest.images.some(row => !/^sha256:[a-f0-9]{64}$/.test(row.id || ''))) throw Error('Invalid release metadata');
  const expected = new Map();
  for (const row of manifest.files) {
    if (typeof row.file !== 'string' || !row.file || row.file.includes('\\') ||
        row.file.split('/').some(part => !part || part === '.' || part === '..' || part.includes(':')) ||
        row.file === 'release-manifest.json' || expected.has(row.file) ||
        !Number.isSafeInteger(row.bytes) || row.bytes < 0 || !/^[a-f0-9]{64}$/.test(row.sha256 || '')) throw Error('Invalid file inventory');
    expected.set(row.file, row);
  }
  for (const required of ['images.tar', 'docker-compose.yml', 'deploy/release.env.example', 'scripts/compose-install.mjs', 'scripts/verify-release.mjs']) {
    if (!expected.has(required)) throw Error('Missing release file: ' + required);
  }
  const found = new Set();
  async function walk(directory, prefix = '') {
    for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
      const relative = prefix + entry.name, target = path.join(directory, entry.name), stat = await fs.lstat(target);
      if (stat.isSymbolicLink()) throw Error('Release must not contain symbolic links');
      if (stat.isDirectory()) await walk(target, relative + '/');
      else if (stat.isFile()) {
        if (relative === 'release-manifest.json') continue;
        const row = expected.get(relative);
        if (!row || row.bytes !== stat.size) throw Error('Release inventory mismatch: ' + relative);
        const hash = crypto.createHash('sha256');
        for await (const bytes of createReadStream(target)) hash.update(bytes);
        if (hash.digest('hex') !== row.sha256) throw Error('Release checksum mismatch: ' + relative);
        found.add(relative);
      } else throw Error('Unsupported release file');
    }
  }
  await walk(root);
  if (found.size !== expected.size) throw Error('Release is incomplete');
  return {root, manifest};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), index = args.indexOf('--directory');
  if (index < 0 || !args[index + 1]) throw Error('Use --directory /path/to/release');
  const {manifest} = await verifyRelease(args[index + 1]);
  console.log(JSON.stringify({complete: true, version: manifest.version, files: manifest.files.length, architecture: manifest.architecture}));
}
