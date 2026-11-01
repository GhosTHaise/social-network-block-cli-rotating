import { isIP } from 'node:net';

export const services = [
  { id: 'facebook', name: 'Facebook', hint: 'fil, vidéos et version mobile', domains: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com', 'fb.watch'] },
  { id: 'instagram', name: 'Instagram', hint: 'fil, reels et messages web', domains: ['instagram.com', 'www.instagram.com', 'i.instagram.com'] },
  { id: 'youtube', name: 'YouTube', hint: 'vidéos, shorts et musique', domains: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com'] },
  { id: 'tiktok', name: 'TikTok', hint: 'vidéos courtes', domains: ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'] },
  { id: 'x', name: 'X / Twitter', hint: 'fil et actualités', domains: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com', 't.co'] },
  { id: 'reddit', name: 'Reddit', hint: 'communautés et discussions', domains: ['reddit.com', 'www.reddit.com', 'old.reddit.com', 'new.reddit.com', 'sh.reddit.com', 'redd.it'] },
  { id: 'twitch', name: 'Twitch', hint: 'streams et clips', domains: ['twitch.tv', 'www.twitch.tv', 'm.twitch.tv', 'clips.twitch.tv'] },
  { id: 'snapchat', name: 'Snapchat', hint: 'version web', domains: ['snapchat.com', 'www.snapchat.com', 'web.snapchat.com'] },
  { id: 'threads', name: 'Threads', hint: 'conversations Meta', domains: ['threads.net', 'www.threads.net', 'threads.com', 'www.threads.com'] },
  { id: 'pinterest', name: 'Pinterest', hint: 'inspiration et découvertes', domains: ['pinterest.com', 'www.pinterest.com', 'pinterest.fr', 'www.pinterest.fr', 'pin.it'] },
  { id: 'linkedin', name: 'LinkedIn', hint: 'fil professionnel', domains: ['linkedin.com', 'www.linkedin.com', 'fr.linkedin.com'] },
  { id: 'discord', name: 'Discord', hint: 'application web', domains: ['discord.com', 'www.discord.com', 'canary.discord.com', 'ptb.discord.com', 'discord.gg'] }
];

export const defaults = ['facebook', 'instagram', 'youtube'];

export function selectServices(ids) {
  if (!ids.length) throw new Error('Sélectionnez au moins un réseau.');
  return [...new Set(ids)].map(id => {
    const service = services.find(item => item.id === id);
    if (!service) throw new Error(`Réseau inconnu : ${id}. Consultez « sillage list ». `);
    return service;
  });
}
export function normalizeSite(input) {
  const value = input.trim();
  if (!value || /[\s*]/.test(value)) throw new Error('Saisissez un domaine ou une URL HTTP(S) valide.');
  let url;
  try { url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`); }
  catch { throw new Error('URL invalide. Exemple : https://example.com/page'); }
  const domain = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !domain.includes('.') || isIP(domain)
      || domain.length > 253 || domain.split('.').some(label => !label || label.length > 63 || !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/.test(label))) {
    throw new Error('URL non prise en charge. Utilisez un domaine public en HTTP ou HTTPS.');
  }
  return domain;
}
