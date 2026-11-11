#!/usr/bin/env python3
"""Génère le corpus de copies synthétiques servant à valider le modèle.

Deux familles d'images :
  - **nettes** : une copie par type d'erreur visé, pour mesurer la justesse du
    typage (E01..E12) ;
  - **dégradées** : rotation, lumière inégale, bruit et flou légers, pour
    approcher une photo de téléphone et mesurer la robustesse.

Chaque image est décrite dans `COPIES` (une seule source de vérité) : le
rendu et le manifeste `corpus/images/manifeste.json` en découlent, donc la
vérité terrain du banc live (`tests/live/`) ne peut pas diverger des images.

Usage :
    python3 scripts/generer-copies.py [--sortie corpus/images] [--police /tmp/Caveat.ttf]

Limite assumée : une copie synthétique n'est pas un vrai manuscrit. Elle
valide le contrat des prompts et la robustesse aux conditions de prise de vue,
pas la lecture d'une écriture réelle (protocole dans corpus/README.md).
"""

import argparse
import json
import pathlib
import random

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

BLEU_ELEVE = (27, 58, 107)
ROUGE_PROF = (198, 40, 40)
NOIR = (30, 30, 30)
PAPIER = (252, 251, 247)
LIGNES = (214, 224, 236)
LARGEUR, HAUTEUR = 1240, 1754
PAS_LIGNE = 64


def charger_polices(chemin: str):
    """Police manuscrite pour l'élève, DejaVu pour l'imprimé."""
    try:
        return {
            "eleve": ImageFont.truetype(chemin, 34),
            "eleve_petit": ImageFont.truetype(chemin, 28),
            "imprime": ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22),
        }
    except OSError:
        defaut = ImageFont.load_default()
        return {"eleve": defaut, "eleve_petit": defaut, "imprime": defaut}


def feuille():
    """Fond papier, lignes de cahier et marge."""
    image = Image.new("RGB", (LARGEUR, HAUTEUR), PAPIER)
    dessin = ImageDraw.Draw(image)
    for y in range(180, HAUTEUR - 60, PAS_LIGNE):
        dessin.line([(90, y), (LARGEUR - 90, y)], fill=LIGNES, width=2)
    dessin.line([(150, 120), (150, HAUTEUR - 60)], fill=(232, 176, 176), width=2)
    return image, dessin


def rendre(copie, polices):
    """Dessine une copie : en-tête, énoncé, lignes de l'élève, annotations, note."""
    image, dessin = feuille()
    dessin.text((180, 60), copie["eleve"], font=polices["eleve"], fill=BLEU_ELEVE)
    dessin.text((700, 66), f'{copie["classe"]} — {copie["devoir"]}', font=polices["imprime"], fill=NOIR)
    dessin.text((180, 190), copie["titre"], font=polices["imprime"], fill=NOIR)

    y = 260
    for ligne in copie["lignes"]:
        dessin.text((180, y), ligne["texte"], font=polices["eleve"], fill=BLEU_ELEVE)
        annotation = ligne.get("annotation")
        if annotation:
            if ligne.get("croix"):
                dessin.line([(820, y + 6), (842, y + 28)], fill=ROUGE_PROF, width=4)
                dessin.line([(842, y + 6), (820, y + 28)], fill=ROUGE_PROF, width=4)
            dessin.text((880, y), annotation, font=polices["eleve_petit"], fill=ROUGE_PROF)
        y += PAS_LIGNE * 2

    if copie.get("mention"):
        dessin.text((820, y), copie["mention"], font=polices["eleve"], fill=ROUGE_PROF)
    dessin.text((980, 150), copie["note"], font=polices["eleve"], fill=ROUGE_PROF)
    return image


def degrader(image, niveau, graine):
    """Rotation, lumière inégale, bruit et flou : approche d'une photo téléphone."""
    aleatoire = random.Random(graine)
    sortie = image.rotate(niveau["rotation"], expand=True, fillcolor=PAPIER, resample=Image.BICUBIC)
    if niveau.get("lumiere"):
        gradient = Image.new("L", sortie.size, 0)
        dessin = ImageDraw.Draw(gradient)
        for i in range(sortie.size[1]):
            teinte = int(255 - (i / sortie.size[1]) * niveau["lumiere"])
            dessin.line([(0, i), (sortie.size[0], i)], fill=teinte)
        sortie = Image.composite(sortie, Image.new("RGB", sortie.size, (90, 90, 95)), gradient)
    if niveau.get("flou"):
        sortie = sortie.filter(ImageFilter.GaussianBlur(niveau["flou"]))
    if niveau.get("bruit"):
        pixels = sortie.load()
        for _ in range(int(niveau["bruit"] * sortie.size[0] * sortie.size[1] / 100)):
            x, y = aleatoire.randrange(sortie.size[0]), aleatoire.randrange(sortie.size[1])
            delta = aleatoire.randint(-24, 24)
            r, g, b = pixels[x, y]
            pixels[x, y] = (max(0, min(255, r + delta)), max(0, min(255, g + delta)), max(0, min(255, b + delta)))
    if niveau.get("contraste"):
        sortie = ImageEnhance.Contrast(sortie).enhance(niveau["contraste"])
    return sortie


COPIES = [
    {
        "id": "copie-1-signes",
        "eleve": "Léa M.", "classe": "2nde 4", "devoir": "Devoir n°3", "note": "11/20",
        "titre": "Exercice 1 : développer et réduire",
        "dominant": "E01",
        "lignes": [
            {"texte": "A = -2(3x - 5)"},
            {"texte": "A = -6x - 10", "annotation": "signe !", "croix": True},
            {"texte": "B = 4(x - 1) - 3(x + 2)"},
            {"texte": "B = 4x - 4 - 3x + 6", "annotation": "-3 x +2 ?", "croix": True},
            {"texte": "C = 2x + 7"},
            {"texte": "C = 2x + 3 + 4", "annotation": "recopié 2x+3"},
        ],
    },
    {
        "id": "copie-2-identites",
        "eleve": "Thomas R.", "classe": "2nde 1", "devoir": "Devoir n°4", "note": "9/20",
        "titre": "Exercice 2 : identités remarquables et fractions",
        "dominant": "E03",
        "lignes": [
            {"texte": "(x + 3)² = x² + 9", "annotation": "double produit !", "croix": True},
            {"texte": "(2x - 1)² = 4x² + 1", "annotation": "-4x oublié", "croix": True},
            {"texte": "1/3 + 1/4 = 2/7", "annotation": "dénominateur commun ?", "croix": True},
            {"texte": "3/8 + 1/2 = 4/10", "annotation": "non", "croix": True},
        ],
    },
    {
        "id": "copie-3-propre",
        "eleve": "Nina B.", "classe": "1ère 2", "devoir": "Devoir n°5", "note": "18/20",
        "titre": "Exercice 3 : résoudre",
        "dominant": None,
        "lignes": [
            {"texte": "2x + 6 = 0"}, {"texte": "2x = -6"}, {"texte": "x = -3"},
            {"texte": "3(x - 2) = 3x - 6"}, {"texte": "(x + 5)² = x² + 10x + 25"},
        ],
        "mention": "Très bien !",
    },
    {
        "id": "copie-4-developpement",
        "eleve": "Hugo P.", "classe": "3ème 2", "devoir": "Brevet blanc", "note": "10/20",
        "titre": "Exercice 1 : développer",
        "dominant": "E02",
        "lignes": [
            {"texte": "5(2x + 3) = 10x + 3", "annotation": "le 5 sur 3 ?", "croix": True},
            {"texte": "x(x + 7) - 2 = x² + 7 - 2", "annotation": "incomplet", "croix": True},
            {"texte": "(x + 2)(x + 3) = x² + 6", "annotation": "il manque des termes", "croix": True},
        ],
    },
    {
        "id": "copie-5-domaine",
        "eleve": "Sara L.", "classe": "1ère 5", "devoir": "DM n°2", "note": "12/20",
        "titre": "Exercice 2 : étude de fonction",
        "dominant": "E05",
        "lignes": [
            {"texte": "f(x) = (x + 1)/(x - 2)"},
            {"texte": "Df = R", "annotation": "et x = 2 ?", "croix": True},
            {"texte": "g(x) = √(x - 3) ; g(-1) = √-4", "annotation": "possible ?", "croix": True},
            {"texte": "f(x) = 0 donc x = -1", "annotation": "sans justifier", "croix": True},
        ],
    },
    {
        "id": "copie-6-puissances",
        "eleve": "Adam D.", "classe": "2nde 3", "devoir": "Devoir n°6", "note": "8/20",
        "titre": "Exercice 3 : puissances et racines",
        "dominant": "E06",
        "lignes": [
            {"texte": "(2x²)³ = 2x⁶", "annotation": "le 2 aussi ?", "croix": True},
            {"texte": "x⁵ x x² = x¹⁰", "annotation": "règle des puissances", "croix": True},
            {"texte": "√(9 + 16) = 3 + 4", "annotation": "non !", "croix": True},
            {"texte": "√50 = 5√2", "annotation": "7√2 ?", "croix": True},
        ],
    },
    {
        "id": "copie-7-equations",
        "eleve": "Maya C.", "classe": "2nde 6", "devoir": "Devoir n°7", "note": "11/20",
        "titre": "Exercice 4 : résoudre les équations",
        "dominant": "E08",
        "lignes": [
            {"texte": "3x + 4 = 10 donc 3x = 14", "annotation": "+4 passe comment ?", "croix": True},
            {"texte": "2x - 5 = 7 donc x = 7 - 5 / 2", "annotation": "transposition", "croix": True},
            {"texte": "donc x = 1", "annotation": "d'où sort ce 1 ?", "croix": True},
        ],
    },
    {
        "id": "copie-8-grandeurs",
        "eleve": "Lucas V.", "classe": "1ère 1", "devoir": "DS n°3", "note": "13/20",
        "titre": "Exercice 5 : grandeurs et arrondis",
        "dominant": "E09",
        "lignes": [
            {"texte": "v = 100/3 = 33 donc d = 33 x 7", "annotation": "valeur exacte ?", "croix": True},
            {"texte": "d = 231", "annotation": "unité !", "croix": True},
            {"texte": "t = 2 h 30 = 2,3 h", "annotation": "conversion", "croix": True},
            {"texte": "donc la vitesse moyenne est 92", "annotation": "km/h ?", "croix": True},
        ],
    },
]

DEGRADATIONS = {
    "copie-1-signes-photo": ("copie-1-signes", {"rotation": -2.5, "lumiere": 70, "bruit": 1.6, "flou": 0.5, "contraste": 0.85}),
    "copie-6-puissances-photo": ("copie-6-puissances", {"rotation": 3.0, "lumiere": 90, "bruit": 2.4, "flou": 0.7, "contraste": 0.8}),
    "copie-3-propre-photo": ("copie-3-propre", {"rotation": 1.8, "lumiere": 55, "bruit": 1.2, "flou": 0.4, "contraste": 0.9}),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sortie", default="corpus/images")
    ap.add_argument("--police", default="/tmp/Caveat.ttf")
    args = ap.parse_args()

    sortie = pathlib.Path(args.sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    polices = charger_polices(args.police)
    par_id = {copie["id"]: copie for copie in COPIES}
    manifeste = []

    for copie in COPIES:
        image = rendre(copie, polices)
        image.save(sortie / f'{copie["id"]}.png')
        manifeste.append({"fichier": f'{copie["id"]}.png', "dominant": copie["dominant"], "degradee": False})

    for nom, (source, niveau) in DEGRADATIONS.items():
        image = degrader(rendre(par_id[source], polices), niveau, graine=len(nom))
        image.save(sortie / f"{nom}.png")
        manifeste.append({"fichier": f"{nom}.png", "dominant": par_id[source]["dominant"], "degradee": True})

    (sortie / "manifeste.json").write_text(json.dumps({"copies": manifeste}, indent=2) + "\n")
    for entree in manifeste:
        print("%-34s dominant=%-5s dégradée=%s" % (entree["fichier"], entree["dominant"], entree["degradee"]))


if __name__ == "__main__":
    main()
