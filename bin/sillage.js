#!/usr/bin/env node
import { parseArgs } from 'node:util';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants } from 'node:fs';
import { requestAuthorization } from '../src/authorization.js';
import { Hosts } from '../src/hosts.js';
import { services, defaults, selectServices } from '../src/catalog.js';
import { banner, showStatus, interactive, friendlyError } from '../src/ui.js';

const help = `
  sillage / reprenez le fil

  sillage                         Interface interactive
  sillage block                   Facebook, Instagram, YouTube
  sillage block facebook youtube  Sélection explicite
  sillage block --all              Tout le catalogue
  sillage unblock                 Retirer uniquement notre bloc
  sillage status                  Afficher l’état en lecture seule
  sillage list                    Voir les réseaux disponibles

  --demo          Utiliser un hosts temporaire (sans sudo)
  --hosts CHEMIN  Utiliser un fichier hosts explicite (tests, bac à sable)
  --help          Afficher cette aide
  --version       Afficher la version

  ↑ ↓ naviguer · espace sélectionner · entrée valider · Ctrl+C annuler
  Les commandes explicites block/unblock s’appliquent immédiatement.
  Linux / macOS · Node.js 22+ · autorisation administrateur demandée automatiquement
`;

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    all: { type: 'boolean' }, demo: { type: 'boolean' }, hosts: { type: 'string' },
    help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' }
  } });
  if (values.help) return console.log(help);
  if (values.version) return console.log('1.0.0');
  const [command, ...ids] = positionals;
  if (command && !['block', 'unblock', 'status', 'list'].includes(command)) throw new Error('Commande inconnue. Consultez « sillage --help ».');
  if (ids.length && command !== 'block') throw new Error('Seule la commande block accepte une liste de réseaux.');
  if (values.all && (command !== 'block' || ids.length)) throw new Error('Utilisez « sillage block --all » sans sélection supplémentaire.');
  if (values.demo && values.hosts) throw new Error('--demo et --hosts sont incompatibles.');
  if (command === 'list') return console.log(services.map(item => `  ${item.id.padEnd(12)} ${item.name}${defaults.includes(item.id) ? '  · par défaut' : ''}`).join('\n'));
  if (!['linux', 'darwin'].includes(process.platform)) throw new Error('Cette version prend en charge Linux et macOS.');
  if (!command && (!process.stdin.isTTY || !process.stdout.isTTY)) throw new Error('Terminal interactif requis. Utilisez une commande explicite ; voir --help.');
  if (command === 'block') selectServices(values.all ? services.map(item => item.id) : ids.length ? ids : defaults);
  if (!values.demo && !values.hosts && process.getuid() !== 0) {
    let needsAuthorization = command !== 'status';
    if (!needsAuthorization) {
      try { await fs.access('/etc/hosts', constants.R_OK); }
      catch (error) {
        if (error.code !== 'EACCES') throw error;
        needsAuthorization = true;
      }
    }
    if (needsAuthorization) return requestAuthorization(fileURLToPath(import.meta.url), process.argv.slice(2));
  }
  let file = values.hosts || '/etc/hosts';
  if (values.demo) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sillage-demo-'));
    file = path.join(dir, 'hosts');
    await fs.writeFile(file, '127.0.0.1 localhost\n::1 localhost\n', { mode: 0o600 });
    if (command) console.log(`  Fichier de démonstration : ${file}`);
  }
  const hosts = new Hosts(file);
  if (!command) return interactive(hosts, values.demo);
  banner(values.demo);
  if (command === 'status') return showStatus(await hosts.status());
  const result = command === 'block'
    ? await hosts.block(values.all ? services.map(item => item.id) : ids.length ? ids : defaults)
    : await hosts.unblock();
  console.log(command === 'block'
    ? `  ● ${result.ids.length} réseaux en pause · ${result.domains} domaines (IPv4 + IPv6).`
    : result.changed ? '  ○ Bloc Sillage retiré. Autres entrées conservées.' : '  ○ Aucun bloc à retirer. Journal vérifié.');
  if (result.backup) console.log(`  Sauvegarde : ${result.backup}`);
  console.log('  Les caches et connexions existantes peuvent retarder l’effet.');
}

main().catch(error => {
  console.error(`\n  Sillage · ${friendlyError(error)}\n`);
  process.exitCode = 1;
});
