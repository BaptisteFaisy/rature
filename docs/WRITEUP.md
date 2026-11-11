# Raturé — write-up

## 1. Le problème

Un élève rend une copie. Le professeur la corrige, l'annote, la rend. L'élève la regarde dix
secondes, constate la note, et la range dans son sac. C'est fini.

Pourtant cette copie contient la seule information vraiment personnelle de toute sa scolarité : la
liste exacte de ses erreurs. Pas « il faut réviser les fractions », mais « tu as perdu un signe au
développement, comme la semaine dernière, et comme au contrôle d'avant ».

Cette information est jetée en 24 heures. Et elle est d'autant plus précieuse que les erreurs ne
sont pas aléatoires : un élève refait les mêmes toute l'année, sans jamais pouvoir les nommer.

Le professeur, lui, voit bien la récurrence. Mais produire un exercice sur mesure pour 30 élèves,
chaque semaine, n'est matériellement pas possible. Le feedback reste collectif.

## 2. La thèse

Tout le monde utilise l'IA pour **obtenir la réponse**. Photomath résout l'exercice photographié,
ChatGPT explique. Ces outils suppriment l'effort — ils ne ciblent aucune lacune, parce qu'ils ne
connaissent pas l'histoire de l'élève.

Raturé inverse le geste : **on ne photographie pas l'énoncé, on photographie la correction.**

La copie annotée est le seul artefact qui contient déjà le diagnostic. Il suffisait de le lire.

- 1ʳᵉ copie → un diagnostic
- 3ᵉ copie → un pattern (« 62 % de tes erreurs sont des signes perdus au développement »)
- 5ᵉ copie → un plan

On ne révise plus un chapitre. On révise sa faille.

## 3. Ce qu'on a construit

Une webapp statique, sans compte, sans base de données, qui tient en six étapes :

1. **Ingest** — la photo est normalisée (1600 px, contraste étiré) : une copie photographiée au
   téléphone dans un couloir est terne, et le crayon du professeur disparaît.
2. **Anonymise** — le bandeau d'en-tête est pixelisé avant tout affichage. Le nom ne sort jamais de
   l'appareil.
3. **Extrait** — un appel multimodal lit les annotations du professeur : croix, « signe ! »,
   « justifie », corrections manuscrites. Aucun OCR classique : sur du manuscrit, c'est inutilisable.
4. **Classifie** — chaque faute reçoit **un** code d'une taxonomie fermée de 12 types, avec une
   confiance. Le modèle n'a pas le droit d'inventer une catégorie.
5. **Agrège** — le profil d'erreur se construit en local, dans IndexedDB.
6. **Génère** — un exercice ciblé sur le type dominant, puis un **second passage** qui vérifie
   qu'il travaille bien ce type, qu'il ne donne pas la solution d'origine, et qu'il est au bon
   niveau. Deux tentatives maximum, puis un message honnête.

Côté professeur : le paquet de copies photographié en lot donne la statistique d'erreurs de la
classe et un export CSV. Ce sont exactement les mêmes tuyaux, une autre vue.

## 4. Les décisions difficiles

**Une taxonomie fermée plutôt qu'un prompt libre.** C'est la décision structurante du projet. Un
libellé inventé par le modèle (« erreur d'algèbre », « problème de signe ») n'est ni mesurable, ni
comparable d'une copie à l'autre, ni défendable devant un jury technique. Douze codes, une
signature par code, et un `E99` « non typée » pour ce qui ne rentre pas. Conséquence : le profil
devient une statistique, pas une liste de phrases.

**Un seuil de confiance à 0,6, et `E99` exclue du profil.** Mieux vaut une faute non typée qu'une
faute mal typée : une erreur de classification se propage dans toutes les copies suivantes et
fausse le profil durablement.

**`E11` (recopie) signalée mais pondérée à zéro.** Une inattention n'est pas une lacune. La
compter ferait dire à l'app « ta faille, c'est que tu recopies mal », ce qui est vrai, inutile, et
décourageant. Elle est affichée, elle ne pèse pas.

**Zéro backend de données.** Pas de base, pas d'authentification, pas de RGPD serveur. L'historique
vit dans le navigateur, exportable et supprimable en un clic. Un proxy edge minimal cache la clé
et borne le quota — c'est la seule brique serveur du projet.

**Le nom est masqué avant affichage, pas après.** Une copie de lycée porte un nom, parfois une
classe. Pixeliser le bandeau d'en-tête coûte quelques millisecondes et évite qu'une photo de copie
ne devienne une donnée personnelle qui circule.

**Aucun rouge dans l'interface.** La copie arrive déjà couverte d'annotations rouges. Ajouter du
rouge dans l'UI, c'est rajouter de la honte à un document déjà marqué. Le diagnostic est jaune, la
progression est verte. Ce n'est pas un choix esthétique : c'est ce qui rend l'app utilisable par un
élève qui vient de rater un contrôle.

## 5. Les échecs

**L'OCR classique sur le manuscrit.** Premier réflexe, premier échec : la reconnaissance des
annotations manuscrites du professeur est inexploitable. Toute la lecture passe désormais par le
modèle multimodal, en un seul appel.

**Les faux positifs sur copie propre.** La première version du prompt d'extraction « trouvait » des
fautes là où le professeur n'avait rien écrit — c'est le pire défaut possible pour ce produit : un
Raturé qui invente des erreurs détruit la confiance instantanément. Correction en deux temps :
`copiePropre` est devenu une réponse explicitement attendue du modèle, et l'étape de classification
**n'est plus appelée du tout** dans ce cas. Le test correspondant vérifie qu'aucun appel réseau
n'est émis.

**La confiance surévaluée.** Un modèle qui répond 0,95 partout rend le seuil inutile. Le prompt
impose maintenant une consigne de calibration explicite, et le corpus de validation contient une
annotation à 0,31 qui doit finir `E99`.

**Les exercices hors sujet.** Sans second passage, la génération dérive vers la notion générale —
des exercices de fractions alors que la faute portait sur le dénominateur commun. D'où le
garde-fou, et la règle « deux tentatives puis on l'annonce » : un exercice à côté du sujet est pire
que pas d'exercice.

**Le quota partagé.** Un seul jeu de clés pour toute la démonstration, c'est un point de rupture le
jour du jugement. Le BYOK n'était pas prévu au départ ; il est devenu obligatoire.

## 6. Ce qu'on a appris

Un diagnostic n'a de valeur que s'il est **stable** : la même copie analysée deux fois doit donner
le même type d'erreur. La taxonomie fermée et le seuil de confiance ne sont pas des contraintes
techniques, ce sont les conditions pour que l'élève puisse faire confiance à son profil.

Le produit ne vend pas de l'IA, il vend de la **récurrence**. Un seul appel multimodal ne suffit
pas : c'est l'accumulation locale qui transforme un gadget en outil.

Enfin : l'honnêteté est une fonctionnalité. Dire « exercice non disponible pour ce type », afficher
la confiance, annoncer qu'aucune erreur n'a été trouvée sur une copie propre — ces trois
comportements rapportent plus de crédibilité que n'importe quelle animation.

## 7. La suite

- **Autres matières** : l'architecture le permet déjà, il manque les taxonomies (physique, puis
  langues).
- **Validation pédagogique** : mesurer sur une classe réelle si travailler son type dominant
  améliore le résultat au contrôle suivant. Sans cette mesure, Raturé reste une bonne intuition.
- **Intégration LMS** : un professeur qui exporte sa statistique de classe veut la déposer dans
  Pronote ou Moodle, pas dans un CSV.
- **Suivi de progression** : montrer la décroissance d'un type d'erreur au fil des copies, c'est la
  récompense qui fait revenir l'élève.

## 8. Outils IA utilisés

Déclaration complète et détaillée : [`DECLARATION-IA.md`](DECLARATION-IA.md).

En résumé : le produit **appelle** une API multimodale [OI]-compatible servie par InferHub
(extraction des annotations, classification, génération, garde-fou). Le développement a été assisté
par des agents de codage, et chaque ligne est comprise, expliquable et démontrable par l'auteur.
