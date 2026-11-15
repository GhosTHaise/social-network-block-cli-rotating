<div align="center">

<img src="assets/sillage-banner.svg" alt="Sillage — Reprenez le fil. Bloquez le bruit, gardez votre cap." width="100%">

<br>

**Un raccourci vers votre attention.**<br>
Mettez Facebook, Instagram, YouTube et d’autres distractions en pause, directement depuis le terminal.

<br>

![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-29D3C2?style=flat-square&labelColor=21132B)
![Linux · macOS](https://img.shields.io/badge/Linux%20·%20macOS-supported-29D3C2?style=flat-square&labelColor=21132B)
![License MIT](https://img.shields.io/badge/license-MIT-C4A7E7?style=flat-square&labelColor=21132B)

</div>

<br>

## Sillage en action

Le tableau de bord démarre sans site coché. Sélectionnez les sites avec **Espace**, puis confirmez le blocage.

```text
  S I L L A G E   /   FOCUS
  ─────────────────────────────────────────────
  ○ PRÊT À BLOQUER · 0 sélectionné(s)

  SITES À BLOQUER
  › ○ Facebook
    ○ Instagram
    ○ YouTube
    ○ TikTok
    ○ Reddit
    + Ajouter un site…

  ↑↓ choisir · Espace cocher · Entrée / B bloquer · I ajouter une URL
```

## Commencer

Avec Node.js 22 ou plus récent, npm et Git installés, lancez :

```bash
curl -fsSL https://raw.githubusercontent.com/GhosTHaise/social-network-block-cli-rotating/main/install.sh | sh
sillage
```

Installation directe avec npm, si vous préférez :

```bash
npm install -g github:GhosTHaise/social-network-block-cli-rotating
sillage
```

La commande `sillage` fonctionne ensuite depuis n’importe quel dossier. Choisissez les sites avec les flèches et **Espace**, ajoutez une URL avec **I** ou la ligne « Ajouter un site… », puis appuyez sur **Entrée** et confirmez. Sillage demande l’autorisation système nécessaire à la modification de `/etc/hosts` : fenêtre système sous Linux graphique, mot de passe dans le terminal sans interface graphique ou sous macOS.

Pour recevoir les dernières corrections, relancez la commande d’installation globale.

Pour essayer sans toucher aux réglages réseau :

```bash
sillage --demo
```

La démo utilise un `hosts` temporaire. Elle montre l’interface sans bloquer les sites.

## Les commandes utiles

| Commande | Action |
| --- | --- |
| `sillage` | Ouvrir le tableau de bord interactif |
| `sillage --demo` | Découvrir l’interface sans blocage réel |
| `sillage block` | Bloquer Facebook, Instagram et YouTube |
| `sillage block reddit tiktok` | Bloquer une sélection précise |
| `sillage block --url https://example.com/page` | Bloquer le domaine de cette URL |
| `sillage block facebook --url example.com` | Combiner le catalogue et un domaine personnalisé |
| `sillage block --url one.example --url two.example` | Bloquer plusieurs domaines personnalisés |
| `sillage block --all` | Bloquer les 12 services du catalogue |
| `sillage status` | Voir les marqueurs enregistrés dans `hosts` |
| `sillage unblock` | Retirer le bloc Sillage et garder `hosts` lisible |
| `sillage list` | Parcourir le catalogue |

Le catalogue comprend Facebook, Instagram, YouTube, TikTok, X, Reddit, Twitch, Snapchat, Threads, Pinterest, LinkedIn et Discord. Dans l’interface, aucun site n’est coché au départ : choisissez exactement ceux à bloquer. La commande `sillage block` sans argument bloque Facebook, Instagram et YouTube. Une URL personnalisée est aussi acceptée ; son chemin et ses paramètres sont ignorés, seul son nom d’hôte est enregistré. Par exemple, `https://example.com/video?id=1` bloque `example.com`.

## Piloter au clavier

| Touche | Action |
| --- | --- |
| `↑` / `↓` | Se déplacer dans la liste |
| `Espace` | Cocher ou décocher un réseau |
| `A` | Sélectionner ou vider le catalogue prédéfini |
| `I` | Saisir une URL personnalisée |
| `Entrée` | Ajouter le site sélectionné ou lancer le blocage |
| `Retour arrière` | Retirer un domaine personnalisé de la sélection |
| `B` | Lancer le blocage de la sélection |
| `O` | Confirmer l’action proposée |
| `U` | Demander le déblocage d’une session active (confirmer avec `O` ou `Entrée`) |
| `V` | Vérifier la résolution système des domaines sélectionnés |
| `D` | Afficher le chemin du fichier et des sauvegardes |
| `Q` / `Ctrl+C` | Quitter |

Les touches ne changent pas les réglages sans confirmation. Quitter laisse une session de blocage active. Une URL personnalisée bloque son nom d’hôte exact : les sous-domaines, autres domaines régionaux et chemins d’URL restent distincts.

## Ce que Sillage change

Sillage ajoute à `hosts` un bloc clairement délimité, qui redirige les domaines sélectionnés vers `0.0.0.0` et `::`. Le blocage couvre ainsi les résolutions IPv4 et IPv6. Une sauvegarde exacte et un journal sont conservés dans `.hosts.sillage`, dans un dossier privé.

Si `hosts` était trop privé pour que le navigateur lise ses règles, l’activation ajoute les permissions de lecture nécessaires aux utilisateurs locaux. **Au déblocage, le fichier reste lisible** pour que le résolveur puisse prendre en compte le retrait des règles ; les droits d’écriture sont conservés. Relancer `unblock` répare aussi la lecture après un ancien déblocage, même sans session active. Vérifiez les marqueurs avec `V` : « session active » signifie que le bloc existe ; « résolution bloquée » signifie que le résolveur système renvoie les adresses de blocage.

Le retrait enlève uniquement le bloc Sillage et préserve les autres lignes, y compris celles ajoutées pendant la session. Si le bloc ou sa sauvegarde a été modifié, Sillage s’arrête sans deviner quoi supprimer. Ne restaurez pas toute la sauvegarde à l’aveugle : vous pourriez effacer les modifications d’autres outils.

Le déblocage (`unblock` ou **U** dans le tableau de bord) actualise automatiquement le cache DNS système : `resolvectl` et `nscd` lorsqu’ils sont disponibles sous Linux, `dscacheutil` et `mDNSResponder` sous macOS. Aucune commande de réparation séparée n’est nécessaire. Si l’actualisation échoue ou qu’aucun outil compatible n’est disponible, le CLI le signale ; les règles restent retirées et vous pouvez relancer le déblocage. La démo et les fichiers `hosts` de bac à sable ne déclenchent aucune purge système.

## Portée honnête

`hosts` agit sur des noms de domaine précis : il ne bloque pas automatiquement tous leurs sous-domaines, chaque domaine régional, les applications mobiles ou l’accès direct par adresse IP. Un navigateur avec DNS sécurisé, VPN ou proxy peut aussi contourner cette méthode. Les onglets déjà ouverts peuvent garder leur contenu en mémoire ; fermez complètement le navigateur puis rouvrez-le pour vérifier l’effet.

Sillage est un outil personnel de concentration, pas un pare-feu ni un contrôle parental. Il ne modifie pas votre DNS configuré, votre VPN, votre proxy ou votre pare-feu. Windows n’est pas pris en charge.

## Développement

```bash
npm ci
npm test
npm run check
```

Les tests vérifient la restauration exacte du fichier, le maintien des permissions de lecture, la conservation des changements extérieurs et la récupération des interruptions pour les 12 services et les domaines personnalisés. Ils utilisent des fichiers temporaires ; ils ne modifient pas `/etc/hosts`.

<div align="center">

**Faites une place au travail qui compte.**

</div>
