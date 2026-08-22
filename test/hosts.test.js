import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Hosts } from '../src/hosts.js';

async function fixture(t, original = Buffer.from('127.0.0.1 localhost\n')) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sillage-test-'));
  // Garder tous les artefacts dans un dossier temporaire privé, jamais /etc/hosts.
  t.after(() => fs.rm(dir, { recursive: true }));
  const file = path.join(dir, 'hosts');
  await fs.writeFile(file, original, { mode: 0o640 });
  return { hosts: new Hosts(file), file, dir, original };
}

test('restaure les octets et permissions initiaux pour chaque format', async t => {
  for (const original of [Buffer.alloc(0), Buffer.from('127.0.0.1 localhost'), Buffer.from('# personnel\r\n127.0.0.1 localhost\r\n'), Buffer.from([0xef, 0xbb, 0xbf, 0x23, 0xff, 10])]) {
    const { hosts, file } = await fixture(t, original);
    const result = await hosts.block(['facebook', 'youtube']);
    const active = await fs.readFile(file, 'utf8');
    assert.match(active, /^0\.0\.0\.0 www\.facebook\.com$/m);
    assert.match(active, /^:: www\.youtube\.com$/m);
    assert.deepEqual((await hosts.status()).ids, ['facebook', 'youtube']);
    assert.deepEqual(await fs.readFile(result.backup), original);
    await hosts.unblock();
    assert.deepEqual(await fs.readFile(file), original);
    assert.equal((await fs.stat(file)).mode & 0o777, 0o640);
    assert.deepEqual(await fs.readFile(result.backup), original);
    assert.equal((await hosts.status()).active, false);
  }
});

test('conserve les modifications externes avant et après le bloc', async t => {
  const { hosts, file, original } = await fixture(t);
  await hosts.block(['instagram']);
  const active = await fs.readFile(file);
  await fs.writeFile(file, Buffer.concat([Buffer.from('# ajouté avant\n'), active, Buffer.from('10.2.3.4 service.interne\n')]));
  await hosts.unblock();
  assert.deepEqual(await fs.readFile(file), Buffer.concat([Buffer.from('# ajouté avant\n'), original, Buffer.from('10.2.3.4 service.interne\n')]));
});

test('refuse un bloc modifié, dupliqué, une sauvegarde ou un journal altérés sans toucher hosts', async t => {
  for (const mutation of ['modified', 'duplicate', 'backup', 'journal', 'null-journal']) {
    const { hosts, file } = await fixture(t);
    const result = await hosts.block(['facebook']);
    let active = await fs.readFile(file);
    if (mutation === 'modified') active = Buffer.from(active.toString().replace('0.0.0.0 facebook.com', '1.2.3.4 facebook.com'));
    if (mutation === 'duplicate') active = Buffer.concat([active, active]);
    if (mutation === 'backup') await fs.writeFile(result.backup, 'corrompu');
    if (mutation === 'journal') {
      const state = JSON.parse(await fs.readFile(hosts.journal));
      state.block = Buffer.from('localhost').toString('base64');
      await fs.writeFile(hosts.journal, JSON.stringify(state));
    }
    if (mutation === 'null-journal') await fs.writeFile(hosts.journal, 'null');
    await fs.writeFile(file, active);
    await assert.rejects(hosts.unblock(), /modifié|ambigu|altéré/);
    assert.deepEqual(await fs.readFile(file), active);
  }
});

test('ne remplace ni une session active ni des domaines déjà configurés', async t => {
  const { hosts, file } = await fixture(t, Buffer.from('10.0.0.1 custom.test WWW.FACEBOOK.COM. # existant\n'));
  const original = await fs.readFile(file);
  await assert.rejects(hosts.block(['facebook']), /déjà présentes/);
  assert.deepEqual(await fs.readFile(file), original);
  await hosts.block(['youtube']);
  const active = await fs.readFile(file);
  await assert.rejects(hosts.block(['instagram']), /existe déjà/);
  assert.deepEqual(await fs.readFile(file), active);
});

test('déblocage répété et récupération des interruptions sans écraser les ajouts', async t => {
    const { hosts, file, original } = await fixture(t);
    await hosts.block(['youtube']);
    // Ces deux interruptions laissent le journal avec hosts sans bloc.
    const external = Buffer.concat([original, Buffer.from('10.0.0.2 ajout.local\n')]);
    await fs.writeFile(file, external);
    assert.equal((await hosts.unblock()).recovered, true);
    assert.deepEqual(await fs.readFile(file), external);
    assert.equal((await hosts.unblock()).changed, false);
});

test('un échec avant le remplacement laisse hosts intact et un journal récupérable', async t => {
  const { hosts, file, dir, original } = await fixture(t);
  await fs.link(file, path.join(dir, 'autre-lien'));
  await assert.rejects(hosts.block(['youtube']), /sans lien physique/);
  assert.deepEqual(await fs.readFile(file), original);
  assert.equal((await hosts.unblock()).recovered, true);
  assert.deepEqual(await fs.readFile(file), original);
});

test('un bloc orphelin est conservé et signalé', async t => {
  const { hosts, file } = await fixture(t, Buffer.from('# sillage:begin inconnu\n'));
  const original = await fs.readFile(file);
  await assert.rejects(hosts.unblock(), /modifié|ambigu/);
  await assert.rejects(hosts.status(), /modifié|ambigu/);
  assert.deepEqual(await fs.readFile(file), original);
});

test('un verrou existant bloque toute écriture', async t => {
  const { hosts, file, original } = await fixture(t);
  await fs.mkdir(path.join(path.dirname(file), '.hosts.sillage'), { mode: 0o700 });
  await fs.mkdir(path.join(path.dirname(file), '.hosts.sillage', 'lock'));
  await assert.rejects(hosts.block(['youtube']), /Opération en cours/);
  assert.deepEqual(await fs.readFile(file), original);
});

test('conserve le lien symbolique hosts légitime', async t => {
  const { file, dir, original } = await fixture(t);
  const link = path.join(dir, 'hosts-link');
  await fs.symlink(file, link);
  const hosts = new Hosts(link);
  await hosts.block(['youtube']);
  await hosts.unblock();
  assert.equal((await fs.lstat(link)).isSymbolicLink(), true);
  assert.deepEqual(await fs.readFile(file), original);
});

test('refuse un dossier de sauvegarde redirigé par un lien', async t => {
  const { hosts, file, dir, original } = await fixture(t);
  await fs.mkdir(path.join(dir, 'ailleurs'));
  await fs.symlink(path.join(dir, 'ailleurs'), path.join(dir, '.hosts.sillage'));
  await assert.rejects(hosts.block(['youtube']), /non sûr/);
  assert.deepEqual(await fs.readFile(file), original);
});

test('deux activations concurrentes produisent une seule session récupérable', async t => {
  const { file, original } = await fixture(t);
  const results = await Promise.allSettled([new Hosts(file).block(['youtube']), new Hosts(file).block(['facebook'])]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  await new Hosts(file).unblock();
  assert.deepEqual(await fs.readFile(file), original);
});

test('le CLI valide les arguments et effectue le cycle complet sur --hosts', async t => {
  const { file, original } = await fixture(t);
  const run = (...args) => spawnSync(process.execPath, ['bin/sillage.js', ...args, '--hosts', file], { encoding: 'utf8' });
  for (const args of [['block', 'inconnu'], ['block', '--all', 'youtube'], ['status', 'youtube'], ['block', '--option-inconnue']]) {
    assert.equal(run(...args).status, 1);
    assert.deepEqual(await fs.readFile(file), original);
  }
  assert.equal(run('block').status, 0);
  assert.match(run('status').stdout, /CONCENTRATION/);
  assert.equal(run('unblock').status, 0);
  assert.deepEqual(await fs.readFile(file), original);
  assert.equal(run().status, 1);
});

test('réparation de lecture réversible, sans écraser un changement externe de permissions', async t => {
  for (const externalMode of [null, 0o640]) {
    const { hosts, file, original } = await fixture(t);
    await fs.chmod(file, 0o600);
    await hosts.block(['facebook']);
    await hosts.repairPermissions();
    assert.equal((await fs.stat(file)).mode & 0o777, 0o644);
    if (externalMode) await fs.chmod(file, externalMode);
    await hosts.unblock();
    assert.equal((await fs.stat(file)).mode & 0o777, externalMode || 0o600);
    assert.deepEqual(await fs.readFile(file), original);
  }
});

test('bloquer, débloquer et rebloquer rétablit la lecture à chaque activation', async t => {
  const { hosts, file, original } = await fixture(t);
  await fs.chmod(file, 0o600);
  for (let cycle = 0; cycle < 3; cycle++) {
    await hosts.block(['facebook']);
    assert.equal((await fs.stat(file)).mode & 0o777, 0o644);
    assert.equal((await hosts.status()).active, true);
    await hosts.unblock();
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
    assert.deepEqual(await fs.readFile(file), original);
  }
});
