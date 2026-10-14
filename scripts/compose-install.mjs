import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {verifyRelease} from './verify-release.mjs';

const args = process.argv.slice(2), option = key => { const i = args.indexOf(key); return i < 0 ? null : args[i + 1]; };
const project = option('--project'), envFile = option('--env-file');
if (!project || !/^[a-z][a-z0-9_-]{2,60}$/.test(project) || !envFile) throw Error('Use --project (new installation) --env-file (private configuration outside release)');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))), file = path.resolve(envFile);
const relative = path.relative(root, file);
if (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) throw Error('Keep the private env file outside the release directory');
if (!(await fs.lstat(file)).isFile()) throw Error('Configuration must be a regular file');
const {manifest} = await verifyRelease(root);
const run = argv => new Promise((resolve, reject) => {
  const child = spawn('docker', argv, {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  let output = '';
  child.stdout.on('data', bytes => output += bytes);
  // Compose diagnostics can contain interpolated secrets. Never include them in errors.
  child.stderr.resume();
  child.on('error', () => reject(Error('Docker could not be started')));
  child.on('close', code => code ? reject(Error('Docker operation failed (exit ' + code + '). Inspect the installation locally.')) : resolve(output));
});
const base = ['compose', '--project-name', project, '--env-file', file, '-f', path.join(root, 'docker-compose.yml')];
// Resolve Compose configuration privately before any image load or installation mutation.
const config = JSON.parse(await run([...base, 'config', '--format', 'json']));
const env = config.services.api.environment;
if (!/^[a-fA-F0-9]{64,}$/.test(env.JWT_SECRET || '') || !/^[a-fA-F0-9]{64,}$/.test(config.services.postgres.environment.POSTGRES_PASSWORD || '') ||
    env.JWT_SECRET === config.services.postgres.environment.POSTGRES_PASSWORD) throw Error('Use independent hexadecimal JWT and database secrets, each at least 32 bytes');
if (!['hosted', 'self_hosted'].includes(env.DEPLOYMENT_MODE)) throw Error('Invalid deployment mode');
if (env.FILE_STORAGE_DRIVER !== 'local') throw Error('This offline installer supports local storage; use the documented S3 deployment procedure');
if (config.services.api.image !== manifest.images[0].id || config.services.migrate.image !== manifest.images[0].id ||
    config.services.postgres.image !== manifest.images[1].id || config.services.gateway.image !== manifest.images[2].id) throw Error('Configuration must use this release\u2019s immutable images');
const daemon = JSON.parse(await run(['info', '--format', '{{json .}}']));
const normalizeArch = value => ({x86_64: 'amd64', aarch64: 'arm64'})[value] || value;
if (daemon.OSType !== manifest.os || normalizeArch(daemon.Architecture) !== manifest.architecture) throw Error('Docker platform does not match this release');
for (const kind of ['container', 'volume']) {
  if ((await run([kind, 'ls', ...(kind === 'container' ? ['-a'] : []), '-q', '--filter', 'label=com.docker.compose.project=' + project])).trim()) throw Error('Installation requires a new project without existing containers or volumes');
}
console.log('Loading the verified offline images...');
await run(['load', '--input', path.join(root, 'images.tar')]);
for (const image of manifest.images) await run(['image', 'inspect', image.id]);
console.log('Starting PostgreSQL, migrations, application and gateway...');
await run([...base, 'up', '-d', '--wait', '--pull', 'never']);
console.log(JSON.stringify({installed: true, project, version: manifest.version, onboarding: env.PUBLIC_SITE_URL.replace(/\/$/, '') + (env.DEPLOYMENT_MODE === 'self_hosted' ? '/setup' : env.PUBLIC_SIGNUP_ENABLED === 'false' ? '/login' : '/signup')}));
