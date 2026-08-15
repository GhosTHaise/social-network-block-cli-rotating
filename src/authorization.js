import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export function authorizationCommand(graphical, node, script, args) {
  // Passer les arguments séparément évite toute interprétation par un shell privilégié.
  return graphical
    ? ['/usr/bin/pkexec', ['--disable-internal-agent', node, script, ...args]]
    : ['/usr/bin/sudo', ['--', node, script, ...args]];
}

export function requestAuthorization(script, args) {
  const graphical = process.platform === 'linux'
    && Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY)
    && existsSync('/usr/bin/pkexec');
  if (!graphical && !process.stdin.isTTY) {
    throw new Error('Autorisation administrateur nécessaire. Lancez cette commande dans un terminal interactif.');
  }
  console.log(graphical
    ? '\n  Autorisation système : validez la fenêtre pour gérer le blocage.\n'
    : '\n  Autorisation système : saisissez votre mot de passe dans ce terminal.\n');
  const [command, parameters] = authorizationCommand(graphical, process.execPath, script, args);
  const result = spawnSync(command, parameters, { stdio: 'inherit' });
  if (result.error) throw new Error(`Impossible de demander l’autorisation : ${result.error.message}`);
  if (graphical && [126, 127].includes(result.status)) {
    console.error('  Autorisation annulée ou indisponible. Aucun lancement administrateur effectué.');
  }
  process.exitCode = result.status ?? 1;
}
