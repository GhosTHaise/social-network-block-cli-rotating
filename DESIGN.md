# Direction d’interface · Sillage

L’interface est un terminal Node.js, avec Clack pour les interactions et Picocolors pour les accents. Aucune couche web ni police imposée : le terminal conserve la typographie et le contraste choisis par son utilisateur.

Les recherches UI/UX Pro Max ont proposé « Flat Design » pour l’outil de productivité, puis confirmé le principe de navigation intégralement au clavier. Les propositions de page marketing et de police Inter n’étant pas adaptées au terminal, seuls la sobriété, la hiérarchie et les retours d’état sont transposés.

- Signature : une petite boucle ouverte, un nom court et « reprenez le fil ».
- Accent cyan pour la navigation, vert pour l’état actif, jaune pour la démo. Chaque état a aussi un libellé textuel.
- Espacement entre identité, état, choix et résultat. Un rail Clack garde la continuité de lecture.
- Réseaux présélectionnés, confirmation lisible, sauvegarde affichée et déblocage toujours accessible.
- Contrôles clavier visibles, couleurs facultatives (`NO_COLOR=1`), aucune animation décorative ni effacement complet de l’écran.
- Les principes make-interfaces-feel-better sont adaptés au terminal : alignement, information stable, feedback immédiat et interruptions sûres. Les règles CSS, tactiles et d’ombres ne s’appliquent pas à ce support.
