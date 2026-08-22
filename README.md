# Sillage

**Moins de bruit. Plus de place pour vous.**

Un CLI Node.js en français pour mettre les réseaux sociaux en pause sur votre ordinateur. Navigation au clavier, sélection multiple et retour à votre configuration sans réécrire vos entrées personnelles.

```text
  ╭─╮  sillage / reprenez le fil
  ╰─╯  Moins de bruit. Plus de place pour vous.

  CONCENTRATION
  Facebook, Instagram, YouTube

  ◆ Que souhaitez-vous faire ?
  │ ● Retrouver l’accès
  │ ○ Voir les détails
  │ ○ Quitter
```

## Essayer sans toucher au système

Linux ou macOS, Node.js 22 ou plus récent :

```bash
npm ci
npm run demo
```

La démo crée un fichier `hosts` dans un dossier temporaire privé et utilise le même moteur que le mode réel. Aucun privilège administrateur requis. Son chemin est affiché ; chaque nouvelle invocation de `--demo` crée un nouveau bac à sable. Pour réexaminer la même démo, utilisez `node bin/sillage.js status --hosts CHEMIN_AFFICHE`.

## Utiliser le vrai blocage

Depuis ce dossier, lancez simplement `npm start`. Sous Linux avec une session graphique et Polkit, une fenêtre système demande votre autorisation. Sans environnement graphique (et sur macOS), le mot de passe est demandé dans le terminal. Le mode démo et les fichiers explicites `--hosts` ne déclenchent pas cette élévation automatique.

Les commandes suivantes restent possibles avec sudo explicite :

```bash
# Interface interactive avec les droits nécessaires pour /etc/hosts
sudo "$(command -v node)" bin/sillage.js

# Blocage immédiat des trois réseaux par défaut
sudo "$(command -v node)" bin/sillage.js block

# Sélection immédiate ou catalogue entier
sudo "$(command -v node)" bin/sillage.js block instagram youtube reddit
sudo "$(command -v node)" bin/sillage.js block --all

# Consultation et déblocage
node bin/sillage.js status
sudo "$(command -v node)" bin/sillage.js unblock
```

Vous pouvez aussi lancer `npm link` pour installer la commande locale `sillage`. Si sudo ne trouve pas cette commande ou votre installation Node via nvm, utilisez la forme ci-dessus avec le chemin absolu vers Node.

`status` n’écrit rien et fonctionne sans sudo lorsque `hosts` est lisible par votre utilisateur. Si ce fichier est privé (par exemple mode `600`), sa consultation nécessite aussi sudo ; Sillage ne change pas ses permissions.

`sillage list` affiche les identifiants disponibles : Facebook, Instagram, YouTube, TikTok, X/Twitter, Reddit, Twitch, Snapchat, Threads, Pinterest, LinkedIn et Discord. « Tout » signifie **tout ce catalogue**. Les présélections sont fixes ; aucune collecte d’historique de navigation.

Flèches pour naviguer, espace pour cocher, entrée pour valider. Le mode interactif demande confirmation avant une modification. `block` et `unblock` explicites s’appliquent immédiatement, utilisables depuis un script. Ctrl+C au cours d’une sélection annule cette sélection ; quitter après activation laisse le blocage actif. Pour changer les réseaux d’une session, débloquez puis choisissez une nouvelle sélection.

## Comment le retour arrière fonctionne

1. Sillage résout le chemin réel de `hosts`, en conservant un éventuel lien symbolique légitime.
2. Un verrou exclut les autres opérations Sillage. Une copie exacte de l’original et un journal sont écrits et synchronisés avant de modifier `hosts`.
3. Un bloc identifiable est ajouté avec les domaines IPv4 et IPv6. Le remplacement passe par un fichier voisin et un renommage atomique. La copie système conserve les métadonnées ; mode et propriétaire sont préservés. Si le remplacement échoue, aucune réécriture en place n’est tentée.
4. `unblock` vérifie la sauvegarde et retire uniquement la séquence exacte ajoutée. Les octets extérieurs au bloc restent en place, y compris les modifications faites depuis l’activation. Sans modification extérieure, on retrouve le contenu initial à l’octet près.

Le proxy, le DNS configuré, le VPN, le pare-feu et la configuration des interfaces réseau ne sont pas modifiés. Les entrées existantes pour un domaine sélectionné provoquent un refus explicite, car les doublons pourraient rendre le blocage inefficace.

Les sauvegardes restent dans `.hosts.sillage` à côté du fichier réel : `/etc/.hosts.sillage` sur un Linux standard, généralement `/private/etc/.hosts.sillage` sur macOS. Dossier privé `700`, sauvegardes et journal `600`. Elles peuvent contenir vos noms d’hôtes privés : gardez-les privées. `status` consulte uniquement les marqueurs dans `hosts` ; il ne certifie pas que chaque application applique le blocage.

### Interruption ou conflit

- Après une interruption, relancez `unblock` avec les mêmes droits et le même `--hosts` si vous en utilisiez un. Le journal permet le nettoyage avant l’activation ou après un déblocage interrompu.
- Un arrêt brutal peut laisser un dossier `lock`. Vérifiez qu’aucun processus Sillage ne travaille, puis utilisez la commande `rmdir` affichée dans l’erreur pour enlever ce verrou vide. Réessayez `unblock`.
- Si le bloc a été modifié, dupliqué ou si la sauvegarde est corrompue, Sillage refuse de deviner. Comparez le fichier courant au `.hosts.bak` conservé et retirez manuellement seulement les entrées Sillage après vérification. **Ne recopiez pas aveuglément toute la sauvegarde** : cela effacerait les modifications ultérieures d’autres outils.
- Les fichiers montés séparément, certains conteneurs ou fichiers protégés peuvent refuser le renommage atomique. Sillage s’arrête avec sa sauvegarde, plutôt que tronquer le fichier.

Le verrou coordonne les instances Sillage. Une vérification juste avant le remplacement détecte les modifications externes déjà visibles ; aucun mécanisme portable ne verrouille les autres éditeurs. Évitez de modifier `hosts` simultanément avec un autre outil.

## Portée et limites

Le fichier hosts fait correspondre des **noms exacts** à des adresses ; il n’accepte pas les jokers. Le catalogue inclut les principaux domaines web et variantes mobiles, sans prétendre couvrir tous les sous-domaines, domaines régionaux, applications natives ou adresses IP directes. Sillage est une aide à la concentration, pas un contrôle parental inviolable.

Les pages en cache, sessions déjà ouvertes, VPN/proxy ou résolveurs propres à certaines applications peuvent retarder ou contourner le résultat. Fermez les onglets concernés et redémarrez le navigateur si nécessaire. Sillage ne force pas une purge DNS et n’arrête aucun service système. Même délai possible au déblocage. Windows n’est pas pris en charge dans cette version ; macOS est prévu mais nécessite une validation sur une machine réelle.

Références techniques : [format de hosts](https://man7.org/linux/man-pages/man5/hosts.5.html), [API de fichiers Node.js](https://nodejs.org/api/fs.html).

## Vérifier

```bash
npm test
npm run check
```

Les tests travaillent exclusivement dans des dossiers temporaires : restauration des octets et permissions, ajouts extérieurs, blocs altérés, sauvegarde corrompue, verrou, concurrence, liens symboliques, échec avant remplacement, récupération du journal et commandes CLI. Aucun test ne modifie `/etc/hosts`.

## Tableau de bord interactif

L’interface utilise un écran fixe : flèches pour naviguer, espace pour cocher,
A pour sélectionner le catalogue, B pour bloquer, U pour débloquer, V pour
vérifier la résolution système, D pour les détails, Q pour quitter.
Les modifications se confirment avec O ; Échap annule.

Si hosts est privé (mode 600), le navigateur peut ignorer ses entrées faute
de pouvoir le lire. R propose de le rendre lisible aux utilisateurs locaux,
après confirmation explicite. Les permissions initiales sont mémorisées dans
le journal et restaurées au déblocage, sauf changement externe des permissions.
Cette réparation nécessite une session Sillage existante.

La vérification teste les domaines de la sélection via le résolveur système.
Un résultat positif ne vérifie pas les caches, connexions ou résolveurs propres
au navigateur. Le diagnostic distingue les entrées configurées de la résolution
effectivement bloquée.

### Activation et déblocage

Chaque activation rend désormais hosts lisible par les utilisateurs locaux,
avec mémorisation de son mode initial. Le déblocage restaure ce mode ; une
nouvelle activation réapplique automatiquement la lecture. Il n’est donc plus
nécessaire de réparer après chaque cycle. La confirmation interactive annonce
ce changement ; la commande explicite block l’applique également.

Les cases représentent la sélection, pas une preuve de blocage. Entrée propose
son activation et U propose l’arrêt de la session. Quand la session est arrêtée,
l’écran indique « BLOCAGE DÉSACTIVÉ » sans demander de réparation de lecture.
