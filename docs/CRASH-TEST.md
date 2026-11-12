# Crash test — 12 novembre 2026

Objectif : vérifier que le produit ne casse ni sur des **données hostiles**, ni sur le
**volume**, ni en cas de **panne**. Trois volets, tous automatisés sauf le dernier.

Résumé : **75 tests de crash ajoutés** (171 tests au total), **8 défauts réels trouvés et
corrigés**, un comportement d'infrastructure documenté honnêtement (quota best-effort).

---

## Volet 1 — Données hostiles (`tests/crash/modele-hostile.test.ts`)

17 payloads adverses × 3 points d'entrée (extraction, analyse fusionnée, classification) = 53 cas.
Payloads : JSON tronqué, pas-JSON, tableau au lieu d'objet, `null` partout, types inversés,
confiances absurdes (`-5`, `999`, `NaN`, `"0.9"`), codes inconnus (`E42`, `""`, `null`, `12`),
zones hors cadre (`x: -3`, `largeur: 1e9`, `NaN`, `Infinity`), ligne de **100 Ko**,
**5 000 annotations**, champs inconnus, injection de prompt, markdown autour du JSON.

**Invariants exigés** : aucune exception autre qu'`ErreurLLM` ; aucun code hors taxonomie ;
confiance dans [0,1] et finie ; textes et listes bornés ; zones assainies ou écartées ;
une copie sans annotation valide reste « propre » (RNF-04).

### Défauts trouvés et corrigés

| # | Défaut | Impact réel | Correctif |
|---|---|---|---|
| 1 | Ligne non bornée : un modèle pouvait rendre 100 Ko de texte | Carte de diagnostic illisible, DOM énorme | `tronquer()` à 300 caractères, ellipse à la fin |
| 2 | Liste non bornée : 5 000 annotations acceptées | Gel du rendu (5 000 cartes + 5 000 rectangles) | plafond `MAX_ANNOTATIONS = 50` |
| 3 | **Une annotation invalide faisait rejeter toute la réponse** | Une zone à `NaN` suffisait à perdre une copie entière | parsing **élément par élément** (`listeTolerante`) : l'élément fautif est écarté, pas le lot |
| 4 | Zones non assainies | `x: -3` ou `largeur: 1e9` → rectangle hors écran, mise en page cassée | `zoneAssainie()` : nombres finis, ramenés dans [0,1], largeur/hauteur contenues ; sinon zone écartée et l'annotation reste valable |
| 5 | Corps de réponse non-JSON sur un 200 | `SyntaxError` nue → message brut en anglais dans l'UI | traduction en `ErreurLLM` « Réponse du proxy illisible » |
| 6 | Verdict de garde-fou absent/illisible | silence = exercice servi sans vérification | tout champ manquant vaut `false` : **un verdict illisible est un refus** |
| 8 | **Attente non bornée** : 6 modèles × 90 s de timeout proxy = jusqu'à 9 minutes avant de rendre la main | l'utilisateur reste devant un écran d'analyse sans fin | timeout de 60 s **par appel** (`AbortSignal.timeout`) + **budget global de 130 s** sur toute la chaîne, puis message explicite proposant la démonstration |

Le nouveau module `src/domain/tolerance.ts` centralise ces règles (bornes, assainissement,
plafonds) : aucune duplication entre l'extraction, l'analyse fusionnée, la classification et la
seconde passe.

---

## Volet 2 — Volume (`tests/crash/volume.test.ts`)

Générateur déterministe (graine fixe, donc aucun test qui flotte).

| Scénario | Résultat |
|---|---|
| 1 000 copies × 4 fautes agrégées | **< 1 s** (mesuré ~50 ms), sommes des parts = 1,000 ± 0,001, aucun NaN |
| Classement + phrase de synthèse sur 1 000 copies | bornés (≤ 12 lignes, phrase < 200 caractères) |
| Exports CSV / fiche Markdown sur 1 000 copies | **ne grossissent pas** : CSV ≤ 14 lignes, fiche < 40 lignes (les 5 dernières copies seulement) |
| Trajectoire sur 1 000 copies | série complète, tendance cohérente |
| Mode prof, paquet de 200 copies × 5 fautes | < 300 ms, total exact, 200 entrées |
| Un diagnostic de 5 000 fautes brutes | dominant correct, E99 hors profil mais signalé |
| Confiances extrêmes (`MAX_VALUE`, `MIN_VALUE`, négatif) | aucune propagation de NaN/Infinity |

### Vérification en navigateur réel (site publié)

1 000 diagnostics (**1,37 Mo**) injectés dans IndexedDB sur
<https://baptistefaisy.github.io/rature/>, puis ouverture de l'écran Profil :

- chargement + rendu : **412 ms** (DOMContentLoaded 164 ms)
- tas JS : **6 Mo**
- **0** occurrence de `NaN` ou `undefined` dans le DOM rendu
- **0** erreur en console
- synthèse correcte : « 10 % de tes erreurs : cas particulier oublié », 8 types listés

Piège rencontré : la base IndexedDB d'`idb-keyval` s'appelle **`keyval-store`** (et non `keyval`) ;
la première injection est partie dans une base créée pour l'occasion, et l'écran affichait
légitimement l'état vide.

### Défaut trouvé et corrigé

| # | Défaut | Correctif |
|---|---|---|
| 7 | Un diagnostic abîmé en stockage local (`erreurs: null`) faisait lever l'agrégation | `agreger()` ignore un diagnostic illisible ; `chargerDiagnostics()` et `chargerProfil()` **filtrent et reconstruisent** au chargement (écriture interrompue, quota navigateur, données d'une version antérieure) |

---

## Volet 3 — Pannes (`tests/crash/pannes.test.ts` + tests réels sur le proxy)

### Simulé (hors ligne)

| Scénario | Comportement attendu et vérifié |
|---|---|
| Réseau coupé (`fetch` rejette) | **1 seul appel**, `ErreurLLM` « Réseau indisponible » — pas de boucle |
| Chaîne entière en 503 | exactement **6 appels** (un par modèle), message réel de l'amont remonté |
| Panachage 503 / 402 / 500 / 504 puis succès | aboutit au 5ᵉ modèle, **5 appels** |
| 429 « quota du proxy » | **1 appel**, message proposant le BYOK |
| 429 amont puis 503 partout | borne à **≤ 7 appels** (une seconde chance par modèle), pas de tempête |
| Corps HTML sur un 200 | `ErreurLLM`, jamais `SyntaxError` |
| Génération d'exercice en panne | l'erreur remonte (l'orchestrateur la traduit en message honnête) |
| Verdicts de seconde passe hostiles (index 99, −3, code inconnu) | liste **intacte en longueur**, seule la faute visée change, code inconnu → E99 |
| Seconde passe en panne | les fautes d'origine sont conservées telles quelles |

### Réel, sur le proxy déployé (Modal)

- **20 requêtes `/health` en parallèle** : 20 × 200, ~0,87 s chacune — pas de file d'attente.
- **25 appels `/analyze` en parallèle** (texte court) : 14 succès, 2 timeouts amont (504),
  2 erreurs internes Modal (500, « function was terminated by signal »), le reste en 200.
  Les statuts 500/504 font partie de la chaîne de repli côté client : ils sont rejoués.
- **Corps de 16 Mo** : `413` et « Photo trop lourde (15 Mo max après encodage) » en 4,5 s — la
  garde de taille tient en production.
- **Image réelle de 476 Ko en pleine saturation** : `504` après 90 s (timeout du proxy sur
  l'amont). C'est ce cas précis qui a révélé le défaut n° 8 : sans budget global, le navigateur
  aurait enchaîné six fois 90 s.

**Constat honnête sur le quota** : aucun 429 n'a été observé sur 25 appels parallèles. Le quota est
en mémoire **par conteneur** et Modal recycle ses instances sous charge (les deux 500 observés) :
le plafond est donc **best-effort**, pas une garantie. C'est acceptable pour un garde-fou de
démonstration, insuffisant pour un produit facturé. Les plafonds ont été divisés par le nombre de
conteneurs (`PAR_IP_PAR_HEURE = 20 / 4`) pour que le total vu par un visiteur reste proche de
l'objectif ; un vrai plafond exigerait un compteur partagé (KV, Upstash), donc un service tiers.

---

## Ce que ce crash test ne couvre pas

- **Le DOM** : les tests tournent en environnement Node, sans `jsdom`. Le rendu sous charge a donc
  été vérifié **à la main dans un vrai navigateur** (volet 2), pas automatisé. Un test E2E rejouable
  (Playwright/agent-browser) reste à ajouter — idée #94 de `docs/IDEES-100.md`.
- **Les images réelles** : le corpus est synthétique. Le comportement sur un manuscrit réel, un
  reflet, un pli ou une photo très floue n'est pas mesuré (protocole : `corpus/README.md`).
- **La concurrence d'écritures IndexedDB** : deux analyses lancées en même temps sur le même
  navigateur (double clic). Le bouton passe en `disabled` pendant l'analyse, mais ce n'est pas
  testé automatiquement.
- **Les coupures longues** : perte de réseau en plein appel, reprise, file d'attente hors ligne
  (idée #62, non implémentée).
