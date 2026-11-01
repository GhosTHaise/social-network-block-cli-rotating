import * as p from '@clack/prompts';
import pc from 'picocolors';
import { services, defaults, selectServices, normalizeSite } from './catalog.js';

const names = ids => ids.length ? selectServices(ids).map(item => item.name).join(' · ') : 'Sites personnalisés';

export function banner(demo = false) {
  console.log();
  console.log(`  ${pc.bold(pc.cyan('SILLAGE'))}  ${pc.dim('/ FOCUS')}`);
  console.log(`  Bloquez le bruit. Gardez votre cap.${demo ? pc.yellow('  ·  DÉMO') : ''}`);
  console.log();
}

export function showStatus(state) {
  p.log.info(state.active
    ? `${pc.green('● SESSION ACTIVE')}\n${names(state.ids)}${state.customDomains?.length ? ` · ${state.customDomains.join(', ')}` : ''}`
    : `${pc.dim('○ BLOCAGE DÉSACTIVÉ')}\nLes sites restent accessibles.`);
}

export async function interactive(hosts, demo) {
  const { emitKeypressEvents } = await import('node:readline');
  const { lookup } = await import('node:dns/promises');
  const fs = await import('node:fs/promises');
  let state = await hosts.status();
  let selected = new Set(state.active ? state.ids : defaults);
  let sites = new Set(state.active ? state.customDomains : []);
  let cursor = 0, pending = null, busy = false, details = false, input = null;
  let message = 'Sélectionnez vos sites, puis confirmez le blocage.';
  let diagnostic = state.active ? 'Vérifiez la résolution avec V' : 'Votre sélection reste modifiable jusqu’à confirmation.';
  const output = process.stdout;
  const rows = () => [
    ...services.map(item => ({ id: item.id, label: item.name, checked: selected.has(item.id), type: 'service' })),
    ...[...sites].map(domain => ({ id: domain, label: domain, checked: true, type: 'site' })),
    { id: 'add', label: 'Ajouter un site…', checked: false, type: 'add' }
  ];

  function render() {
    const width = Math.max(42, Math.min(112, (output.columns || 80) - 4));
    const screenRows = output.rows || 30;
    const line = text => {
      let cells = 0;
      return `  ${String(text).replace(/\x1b\[[0-9;]*m|[\x00-\x1a\x1c-\x1f\x7f]|./gu, token => {
        if (token.startsWith('\x1b')) return token;
        if (token.charCodeAt(0) < 32) return ' ';
        return cells++ < width - 2 ? token : '';
      })}`;
    };
    const items = rows();
    cursor = Math.min(cursor, items.length - 1);
    const visible = Math.max(3, Math.min(items.length, screenRows - 17));
    const offset = Math.max(0, Math.min(cursor - visible + 1, items.length - visible));
    const count = selected.size + sites.size;
    const inputPreview = input === null ? '' : input.length > width - 16 ? `…${input.slice(-(width - 17))}` : input || 'https://exemple.com/page';
    const actionHint = input !== null ? 'Entrée valider · Échap annuler' : pending ? 'O / Entrée confirmer · N / Échap annuler' : details ? `Fichier : ${state.file}` : state.active ? 'U débloquer · V vérifier · D détails · Q quitter' : '↑↓ choisir · Espace cocher · Entrée / B bloquer · I ajouter une URL';
    const secondaryHint = input !== null ? 'Seul le domaine exact sera bloqué ; le chemin est ignoré.' : pending ? 'Vérifiez l’action avant de confirmer.' : details ? `Sauvegardes : ${state.backupDir}` : state.active ? 'Sélection verrouillée pendant la session.' : 'A catalogue · U débloquer · V vérifier · D détails · Q quitter';
    const status = state.active
      ? diagnostic.startsWith('RÉSOLUTION BLOQUÉE') ? '● SESSION BLOQUÉE' : '● SESSION ACTIVE · diagnostic requis'
      : '○ PRÊT À BLOQUER';
    const outputLines = [
      '',
      line(`${pc.bold(pc.cyan('SILLAGE'))}  ${pc.dim('/ FOCUS')}   ${demo ? pc.yellow('DÉMO') : pc.dim('CONCENTRATION')}`),
      line('Bloquez le bruit. Gardez votre cap.'),
      pc.cyan(line('─'.repeat(width))),
      line(`${pc.bold(status)}   ${pc.dim(`· ${count} sélectionné(s)`)}`),
      line(diagnostic), '',
      line(state.active ? 'SITES DE LA SESSION' : 'SITES À BLOQUER'),
      ...items.slice(offset, offset + visible).map((item, index) => {
        const actual = offset + index;
        const prefix = actual === cursor ? '›' : ' ';
        const checkbox = item.type === 'add' ? '+' : item.checked ? '✓' : '○';
        const label = item.type === 'add' ? item.label : `${checkbox}  ${item.label}`;
        const row = line(`${prefix} ${label}${item.type === 'service' && item.checked ? '  ·  inclus' : ''}`);
        return actual === cursor ? pc.bold(pc.cyan(row)) : item.type === 'add' ? pc.dim(row) : row;
      }),
      '',
      pc.cyan(line('─'.repeat(width))),
      line(input !== null ? `SITE › ${inputPreview}▏` : pending ? pending.label : busy ? 'Vérification en cours…' : message),
      line(actionHint),
      line(secondaryHint)
    ];
    output.write(`\x1b[H\x1b[2J${outputLines.slice(0, screenRows - 1).join('\n')}`);
  }

  async function verify() {
    if (!state.active) { diagnostic = 'Aucun bloc actif · choisissez un site et appuyez sur Entrée.'; return; }
    if (demo) { diagnostic = 'Mode démo · aucune résolution système modifiée.'; return; }
    const mode = (await fs.stat(hosts.file)).mode & 0o777;
    if ((mode & 0o444) !== 0o444) {
      diagnostic = 'Fichier hosts non lisible · le blocage peut être ignoré.';
      message = 'U pour débloquer, puis Entrée pour réactiver avec les permissions requises.';
      return;
    }
    const domains = [...(state.ids.length ? selectServices(state.ids).flatMap(item => item.domains) : []), ...state.customDomains];
    const results = await Promise.all(domains.map(async domain => {
      let timer;
      try {
        const addresses = await Promise.race([
          lookup(domain, { all: true }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('délai dépassé')), 3000); })
        ]);
        return addresses.length && addresses.every(address => ['0.0.0.0', '::'].includes(address.address)) ? null : domain;
      } catch { return `${domain} · DNS indéterminé`; }
      finally { clearTimeout(timer); }
    }));
    const failed = results.find(Boolean);
    diagnostic = failed ? `À VÉRIFIER · ${failed}` : `RÉSOLUTION BLOQUÉE · ${domains.length} domaines vérifiés`;
    message = failed ? 'Vérifiez le DNS sécurisé, le VPN ou le proxy du navigateur.' : 'Fermez le navigateur pour couper les connexions déjà ouvertes.';
  }

  emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  output.write('\x1b[?1049h\x1b[?25l');
  try {
    await verify();
    if (!demo && state.active && diagnostic.startsWith('Fichier hosts non lisible')) pending = { type: 'repair', label: 'Rendre le fichier hosts lisible pour les utilisateurs locaux ?' };
    await new Promise(resolve => {
      const quit = () => { process.stdin.off('keypress', keypress); output.off('resize', render); resolve(); };
      const keypress = async (text, key = {}) => {
        text = text?.toLowerCase() ?? '';
        if (busy) return;
        if (key.ctrl && key.name === 'c') return quit();
        if (input !== null) {
          if (key.name === 'escape') { input = null; message = 'Ajout annulé.'; }
          else if (key.name === 'backspace') input = Array.from(input).slice(0, -1).join('');
          else if (key.name === 'return') {
            try {
              const domain = normalizeSite(input);
              if (sites.has(domain)) message = `${domain} est déjà dans votre sélection.`;
              else { sites.add(domain); message = `${domain} ajouté · ce domaine exact sera bloqué.`; }
              input = null;
            } catch (error) { message = error.message; }
          } else if (!key.ctrl && !key.meta && text.length) input += text;
          render();
          return;
        }
        if (pending) {
          if (key.name === 'escape' || text === 'n') { pending = null; render(); return; }
          if (text !== 'o' && key.name !== 'return') return;
          const action = pending; pending = null; busy = true; render();
          try {
            if (action.type === 'block') await hosts.block([...selected], [...sites]);
            else if (action.type === 'unblock') await hosts.unblock();
            else await hosts.repairPermissions();
            state = await hosts.status();
            selected = new Set(state.ids); sites = new Set(state.customDomains);
            message = 'Configuration enregistrée · sauvegarde conservée.';
            await verify();
          } catch (error) { message = friendlyError(error); }
          finally { busy = false; render(); }
          return;
        }
        if (text === 'q') return quit();
        const items = rows();
        if (key.name === 'up') cursor = (cursor + items.length - 1) % items.length;
        if (key.name === 'down') cursor = (cursor + 1) % items.length;
        if (key.name === 'backspace' && !state.active) {
          const item = items[cursor];
          if (item?.type === 'site') { sites.delete(item.id); message = `${item.id} retiré de la sélection.`; }
        }
        const item = items[cursor];
        if (state.active && (text === ' ' || text === 'a' || text === 'i')) message = 'Débloquez la session avec U avant de modifier les sites.';
        else if (text === ' ' && item?.type === 'service') selected.has(item.id) ? selected.delete(item.id) : selected.add(item.id);
        else if (text === ' ' && item?.type === 'site') sites.delete(item.id);
        if (text === 'i' && !state.active || key.name === 'return' && item?.type === 'add') input = '';
        else if (text === 'a' && !state.active) selected = new Set(selected.size === services.length ? [] : services.map(service => service.id));
        else if (text === 'b' || key.name === 'return' && item?.type !== 'add') {
          if (state.active) message = 'Débloquez la session avant de changer la sélection.';
          else if (!selected.size && !sites.size) message = 'Cochez un site ou ajoutez une URL avant de continuer.';
          else {
            const parts = [];
            if (selected.size) parts.push(`${selected.size} réseau${selected.size > 1 ? 'x' : ''}`);
            if (sites.size) parts.push(`${sites.size} site${sites.size > 1 ? 's' : ''} personnalisé${sites.size > 1 ? 's' : ''}`);
            pending = { type: 'block', label: `Bloquer ${parts.join(' et ')} ?` };
          }
        } else if (text === 'u') pending = { type: 'unblock', label: 'Débloquer les sites et arrêter la session ?' };
        else if (text === 'r') pending = { type: 'repair', label: 'Rendre hosts lisible par les utilisateurs locaux ?' };
        else if (text === 'd') details = !details;
        else if (text === 'v') {
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
  if (['EACCES', 'EPERM'].includes(error.code)) return 'Droits insuffisants pour accéder à hosts ou à ses sauvegardes. Autorisez la demande système puis réessayez.';
  if (error.code === 'EBUSY') return 'hosts est monté ou verrouillé. Aucune réécriture en place ne sera tentée.';
  return error.message;
}
