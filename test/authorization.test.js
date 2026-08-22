import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizationCommand } from '../src/authorization.js';

test('l’autorisation conserve les chemins et arguments littéraux sans shell', () => {
  const args = ['block', 'facebook', '--hosts', '/tmp/a b;$(touch nope)'];
  for (const graphical of [true, false]) {
    const [command, parameters] = authorizationCommand(graphical, '/opt/node bin/node', '/projet avec espaces/sillage.js', args);
    assert.equal(command, graphical ? '/usr/bin/pkexec' : '/usr/bin/sudo');
    assert.deepEqual(parameters, [graphical ? '--disable-internal-agent' : '--', '/opt/node bin/node', '/projet avec espaces/sillage.js', ...args]);
  }
});
