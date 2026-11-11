# 100 idées pour Raturé — et les 10 à faire avant dimanche

Brassage du 11 novembre au soir, après livraison du MVP : produit en ligne, 49 tests verts,
mesures réelles (86 % de typage sur copies nettes, 100 % sur copies dégradées, 0 faux positif,
latence 24 à 90 s selon la disponibilité de l'amont).

Contraintes de tri : **0 $**, faisable en 1 à 8 h, démontrable avant le dimanche 15 nov 18 h PT
(tournage vidéo visé jeudi), et hors périmètre respecté (pas d'autres matières, pas de comptes,
pas de base serveur, pas de correction automatique).

---

## Les 10 retenues, dans l'ordre d'exécution

| # | Idée | Ce que ça change | Critère/track servi | Effort |
|---|---|---|---|---|
| 1 | **Un seul appel vision fusionné** (extraction + classification) | La latence est LE point faible mesuré : 40-90 s quand la chaîne rejoue. Deux appels → un seul | Technical Execution, RNF-01 | 3-4 h |
| 2 | **Santé du proxy + repli démo automatique** | Si l'amont tombe pendant le jugement, l'app bascule en mode démo avec un bandeau au lieu d'échouer devant un juge | Best Deployed App, RNF-08/RNF-09 | 2-3 h |
| 3 | **Double passe sur les fautes peu sûres** (confiance < 0,75) | Réduit le seul risque qualifié de « fatal » dans la spec : le faux positif | Best AI Hack, RNF-04 | 2-3 h |
| 4 | **3 lignes d'explication par type** (contenu statique, zéro API) | Le jury comprend des pédagogues (Stanford Code in Place) : nommer l'erreur, dire le geste à faire | Impact & Usefulness, pédagogie | 2 h |
| 5 | **Courbe de décroissance du type dominant** + célébration | Tient la promesse du pitch : 1 copie = diagnostic, 3 = pattern, 5 = plan. Aujourd'hui le profil est une photo, pas une trajectoire | Creativity, Impact | 3 h |
| 6 | **Vue prof « quoi reprendre lundi »** | Le multiplicateur d'impact de la spec : 2 types majoritaires + une phrase d'action + exercice collectif suggéré | Impact & Usefulness | 2 h |
| 7 | **Surbrillance cliquable + zoom sur la copie** | L'écran Diagnostic est le money-shot de la vidéo : cliquer une faute doit zoomer dessus | Design & UX | 3 h |
| 8 | **Plan « copie propre » dans la vidéo** | 5 secondes qui prouvent RNF-04 et l'honnêteté du produit : « aucune erreur détectée » | Presentation, crédibilité | inclus au tournage |
| 9 | **Mesures chiffrées partout** (write-up + incrustation vidéo) | Remplacer les adjectifs par les nombres : 86 %, 0 faux positif, 8 appels dont 6 en 503 | Presentation, Technical Execution | 1-2 h |
| 10 | **GIF de 5 s en tête de README** | Un juge asynchrone comprend sans lire ; le README est lu avant le code | Presentation, Design | 1 h |

**Total ≈ 22 h.** Séquence conseillée : code (1 → 3 → 5 → 6 → 7 → 4), infra (2), puis tournage et
écrits (8, 9, 10) jeudi. La vidéo ne se tourne jamais le dernier jour.

---

## A. Pédagogie et progression (1-15)

1. **Fiche A4 imprimable** — mise en page prête à imprimer avec 3 exercices du type dominant.
2. **Série de 3 exercices progressifs** — même type, difficulté croissante, au lieu d'un seul.
3. **Objectif hebdomadaire** — « 3 copies analysées cette semaine », jauge verte, jamais punitive.
4. **Courbe de décroissance par type** — le type dominant baisse-t-il au fil des copies ?
5. **« Ta faille a disparu »** — célébration quand un type n'est plus dominant sur 3 copies.
6. **Auto-évaluation avant correction** — l'élève coche ce qu'il pense avoir raté, l'app compare.
7. **3 lignes d'explication par type** — pourquoi ça arrive, le geste à faire ; statique, zéro API.
8. **Mini-leçon de 60 s** — texte + un exemple résolu pas à pas sur le type dominant.
9. **Rappel espacé local** — rejouer l'exercice du type dominant à J+3 puis J+7.
10. **Mode révision avant contrôle** — les 2 types dominants, 5 exercices enchaînés.
11. **Journal d'erreurs** — liste chronologique filtrable par type : l'élève voit son histoire.
12. **Repère de niveau** — situer l'exercice généré (seconde / première) sans jugement.
13. **Ton adaptatif** — 3 copies sans faute → message de consolidation, pas d'alerte.
14. **Glossaire des 12 types** — nom + exemple + contre-exemple, accessible depuis chaque badge.
15. **Vue parent** — 2 phrases simples, sans jargon, pour le persona P3.

## B. Diagnostic et IA (16-30)

16. **Double passe sur confiance < 0,75** — second appel de vérification, cible les faux positifs.
17. **Détection de matière** — refuser poliment une copie qui n'est pas de maths.
18. **Recalage des zones** — bounding boxes demandées explicitement, recalées au ratio réel.
19. **Test d'étalonnage des confiances** — 20 annotations étiquetées main, écart confiance/réussite.
20. **Few-shot dans le prompt de classification** — 3 exemples, un par famille d'erreur.
21. **Détection de copie tronquée** — « recadre la page entière » si la photo est coupée.
22. **Multi-pages** — plusieurs photos d'un même devoir regroupées en un diagnostic.
23. **Filtre anti-imprimé** — ignorer l'énoncé imprimé, ne garder que le manuscrit.
24. **Niveau inféré depuis la copie** — calibrer l'exercice généré sur la classe détectée.
25. **Cache par empreinte d'image** — re-analyser la même photo ne coûte rien (hash local).
26. **Journal local anonymisé des réponses** — rejouer un diagnostic en cas de doute.
27. **Taxonomie extensible mais verrouillée** — codes supplémentaires désactivés par défaut.
28. **Score de lisibilité de la photo** — « exploitable à 72 % » avant de lancer l'analyse.
29. **A/B de prompts mesuré sur le corpus** — le banc live existe déjà, l'outillage est prêt.
30. **Correction du typage par le prof** — stockée localement comme exemple few-shot.

## C. UX et design (31-45)

31. **Surbrillance cliquable** — cliquer une faute centre et zoome la zone sur l'image.
32. **Zoom et pinch sur la copie** — indispensable sur mobile, écran de diagnostic.
33. **Progression réelle, pas décorative** — déjà fait ; l'assumer dans la vidéo.
34. **Skeleton screens** — perception de rapidité pendant les 20-40 s d'amont.
35. **Contraste AA testé automatiquement** — calcul de ratio sur les tokens, en CI.
36. **Navigation clavier complète** — focus visible déjà posé, le tester écran par écran.
37. **Mode clair pour l'impression** — le sombre est la marque, le clair sert la fiche.
38. **CSS print sur la fiche de révision** — zéro dépendance, sortie papier propre.
39. **Retour haptique léger** — vibration courte au moment du diagnostic (mobile).
40. **Micro-copy systématique** — « point à travailler » partout, jamais « faute » en titre.
41. **Onboarding 3 écrans** — 10 s au premier lancement, skippable.
42. **États vides soignés** — une phrase et une action par écran vide.
43. **Partage par lien opt-in** — le profil dans l'URL, aucun serveur ; à réserver au volontariat.
44. **Thème nuit** — bleu réduit pour réviser tard, argument Design & UX.
45. **PWA installable** — manifest + service worker, l'app sur l'écran d'accueil.

## D. Mode professeur (46-57)

46. **File d'attente visible** — « 12/30 analysées » avec annulation possible.
47. **Statistique par exercice** — pas seulement par type d'erreur.
48. **CSV enrichi** — une ligne par faute, pas par type : exploitable en tableur.
49. **« Quoi reprendre lundi »** — 2 types majoritaires + une phrase d'action.
50. **Élèves anonymisés** — élève A, B, C : jamais de nom, même côté prof.
51. **Synthèse de classe en PDF** — impression directe en salle des profs.
52. **Détection de doublons de lot** — même empreinte d'image photographiée deux fois.
53. **Mode projection** — grands contrastes, gros textes, pour un vidéoprojecteur.
54. **Comparaison inter-devoirs** — devoir 3 contre devoir 4 pour la même classe.
55. **Filtre E11/E99 dans la stat de classe** — séparer le bruit du signal.
56. **Exercice collectif suggéré** — « 3 élèves bloquent ici : à reprendre en classe entière ».
57. **Temps économisé estimé** — chiffre honnête et sourcé, jamais un argument marketing.

## E. Fiabilité et latence (58-70)

58. **Corpus de démo étendu aux 11 images** — démo garantie même amont mort.
59. **Préchauffage du proxy** — ping toutes les 5 min pour éviter le cold start Modal.
60. **Message d'amont lent après 25 s** — honnêteté plutôt qu'un spinner muet.
61. **Reprise à l'étape 3** — ne pas renvoyer la photo si la classification a échoué.
62. **File hors ligne** — analyse mise en attente, lancée au retour du réseau.
63. **Compression adaptative** — descendre à 1200 px après un premier échec.
64. **Anonymisation en parallèle de l'envoi** — elle est locale, pas besoin de la sérialiser.
65. **Streaming de la réponse** — afficher les annotations au fil de l'eau.
66. **Pastille de santé du proxy** — vert/orange, repli démo automatique si orange.
67. **Backoff exponentiel sur 5xx** — 2 tentatives max par modèle, déjà partiellement en place.
68. **Histogramme local des latences** — les 10 dernières analyses, mesuré côté client.
69. **Appel fusionné extraction + classification** — divise par deux le coût de latence.
70. **Sonde de disponibilité des 6 modèles** — ordonner la chaîne sur le plus disponible.

## F. Vie privée et conformité (71-78)

71. **Preuve « aucune image conservée »** — capture réseau commentée dans le README.
72. **Purge mémoire vérifiée** — data URL mise à null, `revokeObjectURL`, avec un test.
73. **Page « tes données » lisible par un parent** — 6 lignes, sans jargon juridique.
74. **Historique local chiffrable** — WebCrypto + phrase de passe, argument vie privée.
75. **Accusé de suppression** — « historique vidé » explicite après le clic.
76. **Bandeau de masquage ajustable** — l'utilisateur cale la zone du nom avant l'analyse.
77. **Compteur agrégé côté proxy** — nombre d'analyses par jour, sans IP ni contenu.
78. **NOTICE pour la police Caveat** — attribution OFL, conformité concours.

## G. Démo, vidéo, write-up, jury (79-92)

79. **Tourner le plan d'ouverture en premier** — la copie qu'on range : le plus dur, le plus important.
80. **Plan « copie propre »** — « aucune erreur détectée » : 5 s qui prouvent RNF-04.
81. **Latences réelles incrustées** — les chiffres mesurés à l'écran, pas une animation.
82. **Schéma animé du pipeline** — 6 boîtes, 20 s en fin de vidéo.
83. **Sous-titres systématiques** — les juges regardent sans son, en asynchrone.
84. **Voix off au micro, pas de TTS** — une voix humaine dans une pièce calme.
85. **Mobile et desktop côte à côte** — prouve RNF-05 sans un mot.
86. **Second lien de secours** — Vimeo non répertorié, uploadé le jour du tournage.
87. **Raconter le bug du `throw` sans `await`** — trouvé en E2E, invisible en test unitaire : récit réel.
88. **Tableau des mesures dans le write-up** — 86 %, 100 %, 0 faux positif, 6 échecs sur 8 appels.
89. **GIF de 5 s en tête de README** — démonstration → diagnostic, sans lecture.
90. **Tableau comparatif Photomath/ChatGPT/Anki** — déjà dans la spec, le rendre visible.
91. **Retour d'un vrai élève ou prof** — 2 phrases authentiques si l'entourage le permet.
92. **Déclaration IA en 3 puces dans le README** — la rendre lisible, pas seulement présente.

## H. Infrastructure et mesure (93-100)

93. **Sonde uptime horaire + badge** — prouve la disponibilité pendant le jugement (RNF-08).
94. **E2E navigateur automatisé** — rejoué hors PR pour tenir le budget CI de 5 min.
95. **Garde de taille du bundle en CI** — échec au-delà de 300 Ko gzip (RNF-07).
96. **Rapport de précision généré** — le banc écrit le Markdown tout seul, toujours à jour.
97. **Changelog des prompts** — quelle version de prompt a produit quelle mesure.
98. **Relevé de coût et cold starts Modal** — chiffres réels pour le write-up.
99. **Tests de snapshot des écrans** — régression visuelle légère, sans service payant.
100. **Miroir de secours du build** — second hébergeur statique gratuit si Pages tombe.

---

## Idées écartées, et pourquoi

| Idée | Pourquoi elle n'est pas dans les 10 |
|---|---|
| Autre matière (physique) | La spec l'exclut ; la taxonomie ne suit pas, et le jury lit le périmètre assumé |
| Comptes utilisateurs, backend | Hors périmètre assumé ; détruirait l'argument « zéro RGPD serveur » |
| Correction automatique de la copie | Contredit la thèse : on diagnostique, on ne note pas |
| PWA installable (#45) | Joli, mais ne change rien au score dimanche ; à faire après |
| Chiffrement de l'historique (#74) | L'historique ne contient déjà ni image ni nom ; le coût dépasse le bénéfice |
| Streaming (#65) | Effet visuel fort, mais l'amont met 16-50 s à répondre : le streaming ne sauverait pas la latence |
