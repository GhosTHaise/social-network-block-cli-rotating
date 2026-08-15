import * as p from '@clack/prompts';
import pc from 'picocolors';
import { services, defaults, selectServices } from './catalog.js';

const names = ids => selectServices(ids).map(item => item.name).join(', ');
const checked = value => {
  if (p.isCancel(value)) { p.cancel('Annulé. Aucune nouvelle modification.'); return null; }
  return value;
};

export function banner(demo = false) {
  const width = Math.max(24, Math.min(62, (process.stdout.columns || 80) - 4));
  console.log();
  console.log(`  ${pc.cyan('━'.repeat(width))}`);
  console.log(`  ${pc.bold('S I L L A G E')}  ${pc.cyan(' / CONCENTRATION')}`);
  console.log('  Bloquez les distractions. Concentrez-vous.');
  console.log(`  ${pc.cyan('━'.repeat(width))}`);
  console.log();
  if (demo) console.log(`  ${pc.bold('MODE DÉMO')} · aucun blocage réel\n`);

}

export function showStatus(state) {
  p.log.info(state.active
    ? `${pc.green('CONCENTRATION')}\n${names(state.ids)}\n${pc.dim('Entrées présentes dans hosts · sillage unblock pour les retirer')}`
    : `${pc.bold('BLOCAGE DÉSACTIVÉ')}\nLes réseaux sociaux restent accessibles.`);
}

export async function interactive(hosts, demo) {
  const { emitKeypressEvents } = await import('node:readline');
  const { lookup } = await import('node:dns/promises');
  const fs = await import('node:fs/promises');
  let state = await hosts.status();
  let selected = new Set(state.active ? state.ids : defaults);
  let cursor = 0, pending = null, busy = false, details = false;
  let message = 'Choisissez vos réseaux, puis appuyez sur B pour bloquer.';
  let diagnostic = 'Non vérifié · V pour tester la résolution système';
  const output = process.stdout;
  const clean = value => String(value).replace(/[\x00-\x1f\x7f]/g, ' ');
  function render() {
    const width = Math.max(20, Math.min(96, (output.columns || 80) - 4));
    const rows = output.rows || 30;
    const line = text => '  ' + clean(text).slice(0, width);
    const visible = Math.max(1, Math.min(services.length, rows - 15));
    const offset = Math.max(0, Math.min(cursor - visible + 1, services.length - visible));
    const lines = [
      '', pc.bold(pc.cyan(line('S I L L A G E   /   FOCUS'))),
      line(demo ? 'DÉMONSTRATION · aucun blocage réel' : 'Votre espace de concentration'),
      pc.cyan(line('─'.repeat(width))), '',
      pc.bold(line(state.active ? (busy ? 'VÉRIFICATION EN COURS' : diagnostic.startsWith('RÉSOLUTION SYSTÈME BLOQUÉE') ? 'RÉSOLUTION BLOQUÉE' : 'SESSION ACTIVE · vérification requise') : 'BLOCAGE DÉSACTIVÉ')),
      line(diagnostic), '',
      line(state.active ? 'RÉSEAUX DE LA SESSION' : 'RÉSEAUX À BLOQUER · espace pour sélectionner'),
      ...services.slice(offset, offset + visible).map((item, i) => {
        const text = line((i + offset === cursor ? '› ' : '  ') + (selected.has(item.id) ? '[x] ' : '[ ] ') + item.name);
        return i + offset === cursor ? pc.bold(pc.cyan(text)) : text;
      }),
      '', pc.cyan(line('─'.repeat(width))),
      line(pending ? pending : busy ? 'Opération en cours…' : message),
      line(pending ? 'O / Entrée : confirmer · N / Échap : annuler' : details ? 'Fichier : ' + state.file : state.active ? 'Sélection verrouillée pendant le blocage · U pour débloquer' : '↑↓ choisir · espace cocher · A tout · Entrée bloquer'),
      line(details ? 'Sauvegardes : ' + state.backupDir : 'V vérifier · R réparer la lecture · D détails · Q quitter')
    ];
    output.write('\x1b[H\x1b[2J' + lines.slice(0, rows - 1).join('\n'));
  }
  async function verify() {
    if (!state.active) { diagnostic = 'Aucun blocage Sillage actif. Les cases sont votre prochaine sélection.'; message = 'Entrée : bloquer la sélection · U : débloquer une session'; return; }
    if (demo) { diagnostic = 'Démo : résolution réseau non modifiée.'; return; }
    const mode = (await fs.stat(hosts.file)).mode & 0o777;
    if ((mode & 0o444) !== 0o444) {
      diagnostic = 'HOSTS ILLISIBLE pour certains utilisateurs · R pour réparer';
      message = 'La réparation autorise les utilisateurs locaux à lire hosts.';
      return;
    }
    const domains = selectServices(state.active ? state.ids : [...selected]).flatMap(s => s.domains);
    const checks = await Promise.all(domains.map(async domain => {
      let timer;
      try {
        const addresses = await Promise.race([
          lookup(domain, { all: true }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('délai dépassé')), 3000); })
        ]);
        return addresses.length && addresses.every(a => ['0.0.0.0', '::'].includes(a.address)) ? null : domain;
      } catch { return domain + ' (indéterminé)'; }
      finally { clearTimeout(timer); }
    }));
    const failed = checks.filter(Boolean);
    diagnostic = failed.length ? 'À VÉRIFIER : ' + failed[0] : 'RÉSOLUTION SYSTÈME BLOQUÉE · ' + domains.length + ' domaines';
    message = 'Le navigateur peut garder ses connexions : fermez-le complètement.';
  }
  emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  output.write('\x1b[?1049h\x1b[?25l');
  try {
    await verify();
    if (!demo && state.active && diagnostic.startsWith('HOSTS ILLISIBLE')) {
      pending = 'Réparer le blocage : rendre hosts lisible par les utilisateurs locaux ?';
    }
    await new Promise(resolve => {
      const quit = () => { process.stdin.off('keypress', keypress); output.off('resize', render); resolve(); };
      const keypress = async (text, key = {}) => {
        text = text?.toLowerCase();
        if (busy) return;
        if (key.ctrl && key.name === 'c' || text === 'q') return quit();
        if (pending) {
          if (key.name === 'escape' || text === 'n') { pending = null; render(); return; }
          if (text !== 'o' && key.name !== 'return') return;
          const action = pending; pending = null; busy = true; render();
          try {
            if (action.startsWith('Bloquer')) await hosts.block([...selected]);
            else if (action.startsWith('Débloquer')) await hosts.unblock();
            else await hosts.repairPermissions();
            state = await hosts.status();
            message = 'Opération terminée. Sauvegarde conservée.';
            await verify();
          } catch (error) { message = friendlyError(error); }
          finally { busy = false; render(); }
          return;
        }
        if (key.name === 'up') cursor = (cursor + services.length - 1) % services.length;
        if (key.name === 'down') cursor = (cursor + 1) % services.length;
        if (state.active && (text === ' ' || text === 'a')) message = 'Une session est active. Appuyez sur U pour débloquer avant de modifier la sélection.';
        if (text === ' ' && !state.active) { const id = services[cursor].id; selected.has(id) ? selected.delete(id) : selected.add(id); }
        if (text === 'a' && !state.active) selected = new Set(selected.size === services.length ? [] : services.map(s => s.id));
        if (text === 'b' || key.name === 'return') {
          if (state.active) message = 'Débloquez avec U avant de changer les réseaux.';
          else if (!selected.size) message = 'Sélectionnez au moins un réseau avec espace.';
          else pending = 'Bloquer ' + selected.size + ' réseaux et rendre hosts lisible localement ?';
        }
        if (text === 'u') pending = 'Débloquer les réseaux et arrêter la session ?';
        if (text === 'r') pending = 'Rendre hosts lisible par tous les utilisateurs locaux ?';
        if (text === 'd') details = !details;
        if (text === 'v') {
          busy = true; render();
          try { await verify(); } catch (error) { message = friendlyError(error); }
          busy = false;
        }
        render();
      };
      process.stdin.on('keypress', keypress);
      output.on('resize', render);
      render();
    });
  } finally {
    process.stdin.setRawMode(Boolean(wasRaw));
    process.stdin.pause();
    output.write('\x1b[?25h\x1b[?1049l');
  }
}

export function friendlyError(error) {
  if (['EACCES', 'EPERM'].includes(error.code)) return 'Droits insuffisants pour accéder à hosts ou à ses sauvegardes. Relancez la même commande avec sudo. Le mode --demo fonctionne sans sudo.';
  if (error.code === 'EBUSY') return 'hosts est monté ou verrouillé par le système. Remplacement atomique impossible ; aucune réécriture en place ne sera tentée.';
  return error.message;
}
