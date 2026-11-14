import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { interactive } from '../src/ui.js';

test('l’interface bloque uniquement la sélection puis U débloque la session', async () => {
  let state = { active: false, ids: [], customDomains: [], file: '/tmp/hosts', backupDir: '/tmp/.hosts.sillage' };
  const calls = [];
  const hosts = {
    status: async () => state,
    block: async (ids, sites) => {
      calls.push(['block', ids, sites]);
      state = { ...state, active: true, ids, customDomains: sites };
    },
    unblock: async () => {
      calls.push(['unblock']);
      state = { ...state, active: false, ids: [], customDomains: [] };
      return { changed: true };
    }
  };
  const keyboard = new EventEmitter();
  keyboard.setRawMode = () => {};
  keyboard.resume = () => {};
  keyboard.pause = () => {};
  const output = new EventEmitter();
  output.columns = 80;
  output.rows = 16;
  let screen = '';
  output.write = text => { screen = text; };
  const run = interactive(hosts, true, keyboard, output);
  const press = (text, name = text) => keyboard.emit('keypress', text, { name });
  const until = async check => {
    for (let i = 0; i < 100 && !check(); i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(check(), `État attendu absent de l’écran : ${screen}`);
  };

  try {
    await until(() => screen.includes('0 sélectionné(s)'));
    assert.match(screen, /A catalogue · V vérifier · D détails · Q quitter/);
    output.rows = 10;
    output.emit('resize');
    assert.match(screen, /Agrandissez le terminal/);
    output.rows = 16;
    output.emit('resize');
    press('b');
    assert.match(screen, /Cochez un site/);
    press('u');
    assert.match(screen, /Aucune session active/);
    assert.deepEqual(calls, []);

    for (let i = 0; i < 5; i++) press('', 'down');
    press(' ');
    assert.match(screen, /1 sélectionné\(s\)/);
    press('b');
    assert.match(screen, /Bloquer 1 réseau/);
    press('o');
    await until(() => state.active && screen.includes('1 bloqué(s)'));
    assert.match(screen, /SESSION DÉMO/);
    assert.deepEqual(calls, [['block', ['reddit'], []]]);

    press('u');
    assert.match(screen, /Débloquer les sites/);
    press('o');
    await until(() => !state.active && screen.includes('Session arrêtée'));
    assert.deepEqual(calls, [['block', ['reddit'], []], ['unblock']]);
    assert.match(screen, /0 sélectionné\(s\)/);
  } finally {
    press('q');
    await run;
  }
});
