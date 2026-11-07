import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import childProcess from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { Hosts } from '../src/hosts.js';
import { refreshDns } from '../src/dns.js';

test('le déblocage actualise le DNS après réparation, même sans journal, et signale les échecs', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sillage-dns-'));
  t.after(() => fs.rm(dir, { recursive: true }));
  const file = path.join(dir, 'hosts');
  const original = '127.0.0.1 localhost\n';
  await fs.writeFile(file, original, { mode: 0o600 });
  const hosts = new Hosts(file);
  const realpath = fs.realpath;
  // Faire passer ce fichier temporaire pour hosts système, sans toucher au vrai DNS.
  t.mock.method(fs, 'realpath', target => target === '/etc/hosts' ? Promise.resolve(file) : realpath(target));
  let failure = null;
  const calls = [];
  t.mock.method(childProcess, 'execFile', (command, args, options, callback) => {
    calls.push([command, args]);
    fs.readFile(file, 'utf8').then(async content => {
      assert.equal(content, original);
      assert.equal((await fs.stat(file)).mode & 0o444, 0o444);
      callback(command === '/usr/sbin/nscd' ? Object.assign(new Error('absent'), { code: 'ENOENT' }) : failure);
    }).catch(callback);
  });
  for (const state of ['active', 'repeated', 'interrupted']) {
    if (state !== 'repeated') await hosts.block(['youtube']);
    if (state === 'interrupted') await fs.writeFile(file, original);
    await fs.chmod(file, 0o600);
    calls.length = 0;
    const result = await hosts.unblock();
    assert.match(result.dnsMessage, /Cache DNS système actualisé/);
    assert.ok(calls.length > 0);
    if (process.platform === 'linux') assert.deepEqual(calls[0], ['/usr/bin/resolvectl', ['flush-caches']]);
  }
  for (const code of ['EACCES', 'ETIMEDOUT']) {
    failure = Object.assign(new Error('échec'), { code });
    await hosts.block(['youtube']);
    assert.match((await hosts.unblock()).dnsMessage, /Attention.*non actualisé/);
    assert.equal(await fs.readFile(file, 'utf8'), original);
    assert.equal((await hosts.status()).active, false);
  }
  failure = null;
  assert.match((await hosts.unblock()).dnsMessage, /Cache DNS système actualisé/);
  failure = Object.assign(new Error('absent'), { code: 'ENOENT' });
  assert.match((await hosts.unblock()).dnsMessage, /Attention/);
});

test('macOS actualise les deux caches et signale une purge partielle', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  t.after(() => Object.defineProperty(process, 'platform', descriptor));
  const file = await fs.realpath('/etc/hosts');
  const calls = [];
  let failure = null;
  t.mock.method(childProcess, 'execFile', (command, args, options, callback) => {
    calls.push([command, args]);
    callback(command === '/usr/bin/killall' ? failure : null);
  });
  assert.match(await refreshDns(file), /Cache DNS système actualisé/);
  assert.deepEqual(calls, [
    ['/usr/bin/dscacheutil', ['-flushcache']],
    ['/usr/bin/killall', ['-HUP', 'mDNSResponder']]
  ]);
  failure = Object.assign(new Error('absent'), { code: 'ENOENT' });
  assert.match(await refreshDns(file), /Attention.*non actualisé/);
});

test('un hosts de démonstration ne déclenche aucune purge système', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sillage-dns-demo-'));
  t.after(() => fs.rm(dir, { recursive: true }));
  const file = path.join(dir, 'hosts');
  await fs.writeFile(file, '127.0.0.1 localhost\n');
  t.mock.method(childProcess, 'execFile', () => assert.fail('purge DNS système depuis un bac à sable'));
  assert.equal((await new Hosts(file).unblock()).dnsMessage, null);
});
