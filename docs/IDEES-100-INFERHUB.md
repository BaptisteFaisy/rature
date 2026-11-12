# 100 idées — Raturé à 100 % sur InferHub

Contrainte posée par l'utilisateur le 12/11 : **le fournisseur de modèles reste InferHub**. Aucune
idée ne suppose un changement de fournisseur. Ce document est le second brassage (le premier,
généraliste, est dans [`IDEES-100.md`](IDEES-100.md)) : il est entièrement consacré à la contrainte
mesurée n° 1 du produit — **la latence et la disponibilité de l'amont**.

## Rappel des faits mesurés (ils servent à trier)

| Fait | Mesure |
|---|---|
| Latence d'un appel vision | **16 s** (modèle rapide disponible) à **57 s** (saturation diurne) |
| Appel texte de 5 tokens à 13 h | **56,7 s** |
| Disponibilité | **5 modèles vision `ag/*` sur 6 en 503** au même instant |
| Modèles hors `ag/*` | `402 no_provider_under_bid` ou `403 model disabled in your preferences` |
| Enchère par en-tête | `x-max-input-price` / `x-max-output-price` **sans effet** avec cette clé (testé à 0,5 / 3 : toujours 402) → le plafond est dans les préférences du compte |
| Taille d'image | 900 px vs 1240 px : **52 s vs 48 s** → la taille ne pilote pas la latence |
| Cold start du proxy Modal | **3 à 5 s** |
| Appels par analyse | 1 vision (fusionné) + 0-1 texte (seconde passe) + 2 texte (exercice + garde-fou) |
| Quota proxy | en mémoire **par conteneur** → best-effort, jusqu'à 4 × le plafond nominal |

**Conséquence structurante** : la latence totale ≈ (nombre d'appels) × (latence d'un appel).
Réduire le **nombre d'appels** rapporte bien plus que d'optimiser chacun d'eux.

---

## Les 10 retenues, dans l'ordre d'exécution

| # | Idée | Gain attendu | Effort |
|---|---|---|---|
| 1 | **Banque d'exercices locale** (12 types × 3 exercices pré-générés, garde-fou validé à l'avance) | L'étape 6 passe de **2 appels à 0** : diagnostic complet en **un seul** appel vision. Moins 30 à 110 s | 3 h |
| 2 | **Chaîne de repli déplacée dans le proxy** + disjoncteur par modèle (cooldown après 503) | Supprime 1 à 5 allers-retours HTTP par modèle mort : **-5 à -15 s**, et un seul endroit à maintenir | 3-4 h |
| 3 | **Pré-warm du proxy** (cron 5 min sur `/health`) | Supprime le cold start de **3-5 s** à chaque visite de juge | 30 min |
| 4 | **Cache par empreinte d'image** (proxy + local, TTL 24 h) | La même photo rejouée = **réponse immédiate** ; protège le quota si 30 juges testent la même copie | 2-3 h |
| 5 | **Sonde de disponibilité des modèles** au chargement, chaîne réordonnée sur le résultat | Évite de commencer par un modèle mort : **-2 à -10 s** | 2 h |
| 6 | **Sortie bornée** : JSON compact, explications ≤ 15 mots, `max_tokens` 2500 → 900, interdiction du markdown | La latence suit les tokens de sortie : **-20 à -40 %** sur l'appel vision (à re-mesurer sur le corpus) | 1-2 h |
| 7 | **Streaming SSE** de la réponse | Latence **perçue** divisée : les annotations apparaissent au fil de l'eau. Fort en vidéo | 4-5 h |
| 8 | **Mode asynchrone** : l'analyse continue en tâche de fond, l'élève navigue, badge de notification | La latence cesse d'être bloquante ; reprise à l'étape 3 sans renvoyer la photo | 3-4 h |
| 9 | **Arbitrage utilisateur sur les préférences InferHub** : activer des modèles / relever le plafond d'enchère | **Seul levier qui débloque les ~100 autres fournisseurs** (les 402 ne viennent pas du code). À peser contre le coût par Mtok | 15 min (dashboard) |
| 10 | **Banc de latence horaire + badge uptime public** | Choisir l'heure du tournage sur des données, et **prouver** la disponibilité pendant le jugement (RNF-08) | 2 h |

**Total ≈ 22 h.** Les idées 1 à 5 sont cumulatives et s'attaquent toutes au même produit
(nombre d'appels × latence × cold start) : ensemble elles peuvent ramener une analyse complète de
~2-4 min à **~20-30 s**, sans quitter InferHub.

---

## A. Disponibilité de l'amont (1-14)

1. Chaîne de repli **côté proxy** : le client fait un appel, le proxy descend les modèles.
2. **Disjoncteur par modèle** : un 503 met le modèle en cooldown 60 s (comme `mini_router`).
3. **Sonde de disponibilité** au chargement : 6 appels texte de 1 token, chaîne réordonnée.
4. Lire `/v1/models` et ne garder que les modèles dont `min_ask_in/out` est sous notre plafond.
5. Deux chaînes distinctes : une **vision** (analyse) et une **texte** (revue, exercice, garde-fou).
6. Élargir la chaîne vision à d'autres familles si les préférences du compte le permettent.
7. **Arbitrage utilisateur** : activer les modèles désactivés dans le tableau de bord InferHub.
8. Journaliser quel modèle a réellement répondu, et l'afficher dans l'UI (transparence).
9. Compteur de succès/échecs par modèle en mémoire au proxy, exposé sur `/health` (diagnostic).
10. Bascule automatique sur le **mode démo** si 3 analyses consécutives échouent.
11. Retry avec backoff exponentiel borné (2 tentatives, 1 s puis 3 s) sur les 5xx.
12. Ne jamais retenter un 403 « model disabled » : c'est une préférence de compte, pas une panne.
13. Message distinct pour 402 (enchère) et 503 (capacité) : l'utilisateur ne peut rien y faire, mais
    le write-up, si.
14. Page d'état publique (`/health` enrichi : modèles testés, latence médiane, dernier succès).

## B. Latence réelle — réduire le nombre d'appels (15-30)

15. **Banque d'exercices locale** : 12 types × 3 exercices, générés une fois hors ligne, garde-fou
    validé à l'avance → l'étape 6 ne coûte plus aucun appel.
16. Tirage aléatoire dans la banque + « un autre exercice » gratuit (pas d'appel).
17. Appel modèle pour l'exercice **seulement si l'élève le demande explicitement** (« exercice
    inédit »), pas systématiquement.
18. Seconde passe déclenchée **seulement** si une faute est sous le seuil (déjà fait) et bornée à 3
    fautes au lieu de 5.
19. Fusionner seconde passe et génération d'exercice en un seul appel texte quand les deux sont
    nécessaires.
20. Sortie bornée : `max_tokens` 900 au lieu de 2500 pour l'analyse.
21. JSON compact exigé (pas d'indentation, pas de markdown) : moins de tokens de sortie.
22. Explications ≤ 15 mots au lieu de 25 dans la réponse modèle (le texte pédagogique statique
    complète, lui ne coûte rien).
23. Ne demander les `zone` que si l'écran Diagnostic les affiche (sinon, tokens perdus).
24. Supprimer `eleve`/`attendu` de la réponse demandée quand ils ne servent pas à l'affichage.
25. Image en 1200 px et JPEG 0,75 : peu d'effet sur la latence (mesuré), mais **moins de coût** et
    moins de 413.
26. Recadrage assisté de la page avant envoi : moins de pixels inutiles, meilleure lecture.
27. Pré-découpage : envoyer seulement la zone annotée si le prof n'a annoté qu'un exercice.
28. Pré-génération nocturne des exercices du jour pour les types dominants de l'utilisateur.
29. Cache local des analyses par empreinte d'image (même photo → même diagnostic, 0 appel).
30. Cache **proxy** des réponses (empreinte → réponse, TTL 24 h) : protège le quota et accélère les
    retests des juges.

## C. Latence perçue (31-42)

31. **Streaming SSE** : les annotations s'affichent au fil de l'eau.
32. Afficher la première annotation dès qu'elle arrive, pas le lot entier.
33. Message « l'amont est lent ce soir » après 25 s, avec le nombre de modèles déjà tentés.
34. Compteur visible « modèle 2/6 essayé » : l'attente devient une démonstration de robustesse.
35. Skeleton screens sur le Diagnostic pendant le chargement.
36. **Mode asynchrone** : l'analyse continue en arrière-plan, l'élève navigue ailleurs.
37. Badge de notification quand l'analyse se termine en arrière-plan.
38. Reprise à l'étape 3 : ne pas renvoyer la photo si seule la classification a échoué.
39. File d'attente locale hors ligne : l'analyse part au retour du réseau.
40. Afficher la latence réelle de la dernière analyse (honnêteté + donnée utile).
41. Histogramme local des 10 dernières latences, visible dans Réglages.
42. Estimation d'attente avant de lancer (« ~30 s en ce moment ») à partir de la sonde.

## D. Quota, coût et maîtrise (43-54)

43. Compteur partagé du quota (KV, Upstash, ou un petit état dans Modal `Dict`) : plafond réel.
44. Quota par jour et par visiteur affiché dans l'UI (« 17 analyses restantes aujourd'hui »).
45. Suivi du coût par analyse (tokens × prix du modèle choisi) dans le proxy.
46. Plafond de dépense quotidien au proxy : au-delà, bascule automatique en mode démo.
47. Choisir le modèle le **moins cher** à capacité égale (le champ `pricing.min_ask_in` est public
    dans `/v1/models`).
48. Ne pas renvoyer l'image pour la seconde passe (déjà le cas : texte seul) — le documenter.
49. Compression de l'image en WebP plutôt que JPEG (gain de 25 à 35 % d'octets).
50. Cache HTTP (`ETag`) sur les assets pour les rechargements répétés des juges.
51. Journal agrégé quotidien (nombre d'analyses, modèles utilisés, latences) sans donnée personnelle.
52. Alerte si le taux d'échec dépasse 30 % sur une heure.
53. Limiter le nombre d'analyses simultanées par visiteur (une à la fois).
54. Page « état du service » publique alimentée par le banc horaire.

## E. Robustesse et reprise (55-64)

55. Disjoncteur global : si 3 analyses échouent, proposer la démo avant même d'essayer.
56. Reprise d'analyse après rechargement de page (l'état local garde l'image normalisée 5 min).
57. Double envoi empêché (bouton désactivé + verrou en mémoire) — déjà fait, à tester.
58. Journal local des échecs (statut, modèle, durée) exportable pour diagnostiquer.
59. **Mode dégradé** : diagnostic sans exercice si l'étape 6 échoue (déjà), et analyse sans typage
    (annotations seules) si la classification échoue.
60. Repli BYOK automatique proposé après 2 échecs du proxy.
61. Test de charge automatisé du proxy (10 appels parallèles) en CI hors PR.
62. Sonde de santé du proxy toutes les 5 min depuis un cron GitHub Actions, publiée en badge.
63. Second proxy de secours (Worker Cloudflare) activable par un réglage si Modal tombe.
64. Bascule automatique sur le proxy de secours après 2 échecs de sonde.

## F. Infrastructure (65-74)

65. **Pré-warm** : cron sur `/health` toutes les 5 min pour garder un conteneur chaud.
66. `scaledown_window` à 300 s pendant la période de jugement (15-17/11) : moins de cold starts.
67. `max_containers` à 8 pendant le jugement, 4 en temps normal.
68. Réserver une région plus proche (`eu` plutôt qu'`us-east`) si Modal la propose : moins de RTT.
69. Cache npm dans la CI (`actions/setup-node` + `cache: npm`) : le CI sur runner neuf met 4 min 57.
70. Déployer le proxy depuis la CI (push sur `main` → `modal deploy`) au lieu de le faire à la main.
71. Versionner le secret InferHub (rotation documentée, procédure de remplacement).
72. Surveillance Modal (coût, cold starts, erreurs 500 « terminated by signal ») relevée chaque jour.
73. Documenter la procédure de redémarrage des runners (déjà fait) et l'automatiser.
74. Miroir du build statique sur un second hébergeur (idée #100 du premier brassage).

## G. Mesure et preuves (75-84)

75. **Banc de latence horaire** : un appel texte de 5 tokens toutes les heures, 7 modèles, publié en
    Markdown (choisir l'heure du tournage sur des données).
76. Rapport de précision du corpus régénéré automatiquement après chaque changement de prompt.
77. A/B de prompts mesuré sur le corpus : deux variantes, même banc, garder la meilleure.
78. Suivi de la qualité par modèle (lequel type le mieux ?) sur les 11 copies.
79. Mesure du coût réel d'une analyse complète, par modèle.
80. Badge uptime dans le README, alimenté par la sonde.
81. Tableau de bord des latences dans l'écran Réglages (données locales uniquement).
82. Journal de bord des mesures dans `docs/VALIDATION-MODELE.md` à chaque changement de prompt.
83. Test de non-régression du mode démo à chaque modification de la structure d'appels (déjà fait).
84. Capture automatique d'une nouvelle démo quand les prompts changent.

## H. Produit sans appel supplémentaire (85-94)

85. Contenus pédagogiques statiques des 12 types (fait) étendus d'exemples supplémentaires.
86. Exercices de la banque classés par difficulté (1 à 3) pour une progression hors ligne.
87. Fiche de révision générée localement (fait) enrichie des exercices de la banque.
88. Mode révision hors ligne : 10 exercices sur les 2 types dominants, sans réseau.
89. Statistiques locales de réussite (l'élève coche ce qu'il a réussi) sans aucun appel.
90. Export de la banque d'exercices en PDF pour travailler sur papier.
91. Glossaire consultable depuis chaque badge (fait) + recherche par mot-clé.
92. Suggestions de révision textuelles par type (geste, piège, exercice type) 100 % locales.
93. Mode prof hors ligne : statistique de classe à partir des analyses déjà faites.
94. Thème impression (noir sur blanc) pour les fiches.

## I. Concours et jury (95-100)

95. **Transformer la contrainte en argument** : une slide « pourquoi nous survivons à un amont qui
    tombe » (chaîne, disjoncteur, budget, démo) — les juges ingénieurs notent ça.
96. Montrer la chaîne de repli **en direct** dans la vidéo : le compteur « modèle 2/6 » à l'écran.
97. Publier le banc de latence horaire dans le write-up : des données, pas des adjectifs.
98. Déclarer le quota best-effort et le coût réel mesuré : l'honnêteté est notée.
99. Tourner la vidéo à l'heure la plus rapide mesurée par le banc (soir, d'après les relevés).
100. Prévoir une **capture de secours** : si l'amont tombe pendant le jugement, la démo enregistrée
     prend le relais automatiquement, et l'UI le dit.

---

## Idées écartées, avec la mesure qui les écarte

| Idée | Pourquoi elle est écartée |
|---|---|
| Réduire la taille de l'image pour gagner en latence | **Mesuré** : 900 px = 52 s, 1240 px = 48 s. Aucun gain de latence ; à garder seulement pour le coût et les 413 |
| Passer les enchères par en-tête (`x-max-input-price`) | **Testé** à 0,01/0,05 puis 0,5/3 : toujours `402 no_provider_under_bid`. Le plafond est dans les préférences du compte, pas dans la requête |
| Changer de fournisseur (OpenAI, Anthropic en direct) | Exclu par la contrainte utilisateur : InferHub uniquement |
| Ajouter un second fournisseur de secours (Agnes) | Même raison ; et le routeur local montre qu'il faut alors gérer des clés et des plafonds différents |
| Augmenter `max_containers` au-delà de 8 | Le quota en mémoire par conteneur deviendrait encore plus approximatif, et le coût suivrait |
| Streaming pour réduire la latence réelle | Le streaming ne réduit pas le temps de réponse de l'amont, il le rend visible — classé en latence **perçue** (idée 31), pas en gain réel |
