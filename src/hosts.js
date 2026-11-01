import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeSite, selectServices } from './catalog.js';

const exec = promisify(execFile);
const marker = '# sillage:';
const digest = data => createHash('sha256').update(data).digest('hex');
const conflict = () => new Error('Bloc Sillage modifié ou ambigu. Arrêt sans modifier hosts ; conservez la sauvegarde pour une récupération manuelle.');

async function optional(file) {
  try { return await fs.readFile(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function syncDir(dir) {
  const handle = await fs.open(dir, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function saveNew(file, data) {
  const handle = await fs.open(file, 'wx', 0o600);
  try { await handle.writeFile(data); await handle.sync(); }
  finally { await handle.close(); }
  await syncDir(path.dirname(file));
}

// Le renommage atomique évite de laisser hosts tronqué en cas d'interruption.
async function replace(file, before, after, mode) {
  const meta = await fs.lstat(file);
  if (!meta.isFile() || meta.nlink !== 1) throw new Error('hosts doit être un fichier ordinaire sans lien physique.');
  const temp = path.join(path.dirname(file), `.sillage-${randomUUID()}.tmp`);
  try {
    await saveNew(temp, '');
    await exec('/bin/cp', process.platform === 'darwin'
      ? ['-p', file, temp] : ['--preserve=all', '--', file, temp]);
    const handle = await fs.open(temp, constants.O_WRONLY | constants.O_NOFOLLOW);
    try {
      await handle.truncate(0);
      await handle.writeFile(after);
      await handle.sync();
    } finally { await handle.close(); }
    if (mode !== undefined) await fs.chmod(temp, mode);
    const current = await fs.lstat(file);
    if (current.ino !== meta.ino || current.dev !== meta.dev || current.mtimeMs !== meta.mtimeMs || !(await fs.readFile(file)).equals(before)) {
      throw new Error('hosts a changé pendant l’opération. Réessayez ; aucune écriture effectuée.');
    }
    await fs.rename(temp, file);
    await syncDir(path.dirname(file));
  } finally {
    await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

export class Hosts {
  constructor(file) { this.file = path.resolve(file); }

  async resolve() {
    // /etc/hosts peut être un lien légitime sous macOS : conserver ce lien.
    this.file = await fs.realpath(this.file);
    this.dir = path.join(path.dirname(this.file), `.${path.basename(this.file)}.sillage`);
    this.journal = path.join(this.dir, 'active.json');
  }

  async status() {
    await this.resolve();
    const content = await fs.readFile(this.file);
    const text = content.toString('utf8');
    if (!text.includes(marker)) return { active: false, ids: [], file: this.file, backupDir: this.dir };
    const headers = [...text.matchAll(/^# sillage:begin ([a-f0-9-]{36}) ([a-z,-]+)(?: ([A-Za-z0-9_.,-]+))?\r?$/gm)];
    if (headers.length !== 1 || text.split(marker).length !== 3 || !text.includes(`# sillage:end ${headers[0][1]}`)) throw conflict();
    const ids = headers[0][2] === '-' ? [] : headers[0][2].split(',');
    if (ids.length) selectServices(ids);
    const customDomains = headers[0][3] ? headers[0][3].split(',').map(domain => normalizeSite(domain)) : [];
    if (!ids.length && !customDomains.length) throw conflict();
    return { active: true, ids, customDomains, file: this.file, backupDir: this.dir };
  }

  async locked(action) {
    await this.resolve();
    await fs.mkdir(this.dir, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    const info = await fs.lstat(this.dir);
    if (!info.isDirectory() || (info.mode & 0o077) || info.uid !== process.getuid()) {
      throw new Error(`Dossier de sauvegarde non sûr : ${this.dir} (propriétaire courant et mode 700 requis).`);
    }
    const lock = path.join(this.dir, 'lock');
    try { await fs.mkdir(lock, { mode: 0o700 }); }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error(`Opération en cours ou interrompue. Si aucun Sillage ne tourne, retirez le dossier vide avec : rmdir '${lock}'`);
      throw error;
    }
    try { return await action(); }
    finally { await fs.rmdir(lock); }
  }

  async block(ids, sites = []) {
    const selection = ids.length ? selectServices(ids) : [];
    const customDomains = [...new Set(sites.map(normalizeSite))];
    if (!selection.length && !customDomains.length) throw new Error('Sélectionnez au moins un réseau ou domaine.');
    return this.locked(async () => {
      const before = await fs.readFile(this.file);
      const state = await optional(this.journal);
      if (before.includes(Buffer.from(marker)) || state) {
        throw new Error('Une session ou une récupération Sillage existe déjà. Lancez « sillage unblock » avant de changer la sélection.');
      }
      const id = randomUUID();
      const eol = before.includes(Buffer.from('\r\n')) ? '\r\n' : '\n';
      const domains = [...new Set([...selection.flatMap(item => item.domains), ...customDomains])];
      const existing = before.toString('utf8').split(/\r?\n/).flatMap(line => line.split('#')[0].trim().split(/\s+/).slice(1));
      const overlaps = domains.filter(domain => existing.some(host => host.toLowerCase().replace(/\.$/, '') === domain));
      if (overlaps.length) throw new Error(`Entrées hosts déjà présentes pour : ${overlaps.join(', ')}. Résolvez ce conflit manuellement ; vos entrées ne seront pas remplacées.`);
      const lines = domains.flatMap(domain => [`0.0.0.0 ${domain}`, `:: ${domain}`]);
      const prefix = before.length && before.at(-1) !== 10 ? eol : '';
      const markerIds = selection.map(item => item.id).join(',') || '-';
      const markerSites = customDomains.length ? ` ${customDomains.join(',')}` : '';
      const block = Buffer.from(`${prefix}# sillage:begin ${id} ${markerIds}${markerSites}${eol}${lines.join(eol)}${eol}# sillage:end ${id}${eol}`);
      const backup = path.join(this.dir, `${id}.hosts.bak`);
      const originalMode = (await fs.stat(this.file)).mode & 0o777;
      const readableMode = originalMode | 0o444;
      await saveNew(backup, before);
      await saveNew(this.journal, JSON.stringify({ version: 1, file: this.file, originalMode, readableMode, backup, hash: digest(before), blockHash: digest(block), block: block.toString('base64') }));
      await replace(this.file, before, Buffer.concat([before, block]), readableMode);
      return { ids: selection.map(item => item.id), customDomains, domains: domains.length, backup };
    });
  }

  async repairPermissions() {
    return this.locked(async () => {
      const raw = await optional(this.journal);
      if (!raw) throw new Error('Activez une session avant la réparation.');
      const state = JSON.parse(raw);
      if (!state || state.file !== this.file) throw conflict();
      const content = await fs.readFile(this.file);
      const block = Buffer.from(state.block || '', 'base64');
      if (!block.length || digest(block) !== state.blockHash || !content.includes(block)) throw conflict();
      const mode = (await fs.stat(this.file)).mode & 0o777;
      if (state.originalMode === undefined) {
        state.originalMode = mode;
        state.readableMode = mode | 0o444;
        await replace(this.journal, raw, Buffer.from(JSON.stringify(state)));
      }
      await fs.chmod(this.file, state.readableMode);
    });
  }

  async unblock() {
    return this.locked(async () => {
      const before = await fs.readFile(this.file);
      const raw = await optional(this.journal);
      if (!raw) {
        if (before.includes(Buffer.from(marker))) throw conflict();
        return { changed: false };
      }
      let state;
      try { state = JSON.parse(raw); } catch { throw conflict(); }
      if (!state || state.version !== 1 || state.file !== this.file || typeof state.block !== 'string' || typeof state.backup !== 'string' || path.dirname(state.backup) !== this.dir) throw conflict();
      const original = await fs.readFile(state.backup);
      if (digest(original) !== state.hash) throw new Error('Sauvegarde altérée. Aucune modification effectuée.');
      const block = Buffer.from(state.block, 'base64');
      if (digest(block) !== state.blockHash) throw new Error('Journal altéré. Aucune modification effectuée.');
      const start = before.indexOf(block);
      if (!block.length) throw conflict();
      if (start === -1) {
        // Journal écrit avant hosts, ou déblocage terminé avant son nettoyage.
        if (before.includes(Buffer.from(marker))) throw conflict();
        await fs.unlink(this.journal);
        await syncDir(this.dir);
        return { changed: false, recovered: true, backup: state.backup };
      }
      const after = Buffer.concat([before.subarray(0, start), before.subarray(start + block.length)]);
      if (after.includes(Buffer.from(marker))) throw conflict();
      const currentMode = (await fs.stat(this.file)).mode & 0o777;
      const restoreMode = Number.isInteger(state.originalMode) && currentMode === state.readableMode
        ? state.originalMode : undefined;
      await replace(this.file, before, after, restoreMode);
      await fs.unlink(this.journal);
      await syncDir(this.dir);
      return { changed: true, backup: state.backup };
    });
  }
}
