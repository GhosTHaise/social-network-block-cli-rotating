import fs from 'node:fs/promises';
import childProcess from 'node:child_process';

export async function refreshDns(file) {
  if (file !== await fs.realpath('/etc/hosts')) return null;
  const commands = process.platform === 'darwin'
    ? [['/usr/bin/dscacheutil', ['-flushcache']], ['/usr/bin/killall', ['-HUP', 'mDNSResponder']]]
    : [['/usr/bin/resolvectl', ['flush-caches']], ['/usr/sbin/nscd', ['-i', 'hosts']]];
  let refreshed = false, failed = false;
  for (const [command, args] of commands) {
    try {
      await new Promise((resolve, reject) => {
        childProcess.execFile(command, args, { timeout: 3000 }, error => error ? reject(error) : resolve());
      });
      refreshed = true;
    } catch (error) {
      if (error.code !== 'ENOENT' || process.platform === 'darwin') failed = true;
    }
  }
  if (failed) return 'Attention : cache DNS système non actualisé complètement. Réessayez le déblocage.';
  if (!refreshed) return 'Attention : actualisation automatique du cache DNS indisponible sur ce système.';
  return 'Cache DNS système actualisé.';
}
