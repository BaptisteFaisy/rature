#!/usr/bin/env python3
"""Génère les copies synthétiques du corpus de validation.

Trois images : deux copies corrigées (avec fautes typées) et une copie propre
(sans aucune annotation de faute). L'écriture de l'élève est rendue dans une
police manuscrite (Caveat), les annotations du professeur en rouge.

Usage :
    python3 scripts/generer-copies.py [--sortie corpus/images] [--police /tmp/Caveat.ttf]

Ces images servent à `tests/live/inferhub.test.ts` : elles valident le contrat
des prompts (extraction + classification) contre le vrai modèle. Elles ne
remplacent PAS la validation sur de vraies copies photographiées (protocole
dans corpus/README.md) : une copie synthétique est trop propre pour mesurer la
lecture du manuscrit réel.
"""

import argparse
import pathlib

from PIL import Image, ImageDraw, ImageFont

BLEU_ELEVE = (27, 58, 107)
ROUGE_PROF = (198, 40, 40)
NOIR = (30, 30, 30)
PAPIER = (252, 251, 247)
LIGNES = (214, 224, 236)


def charger_polices(chemin: str):
    """Police manuscrite pour l'élève, DejaVu pour l'imprimé."""
    try:
        manuscrite = ImageFont.truetype(chemin, 34)
        manuscrite_petite = ImageFont.truetype(chemin, 28)
    except OSError:
        manuscrite = ImageFont.load_default()
        manuscrite_petite = manuscrite
    imprime = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
    return {"eleve": manuscrite, "eleve_petit": manuscrite_petite, "imprime": imprime}


def feuille(largeur=1240, hauteur=1754):
    """Fond papier + lignes de cahier."""
    image = Image.new("RGB", (largeur, hauteur), PAPIER)
    dessin = ImageDraw.Draw(image)
    for y in range(180, hauteur - 60, 64):
        dessin.line([(90, y), (largeur - 90, y)], fill=LIGNES, width=2)
    dessin.line([(150, 120), (150, hauteur - 60)], fill=(232, 176, 176), width=2)
    return image, dessin


def entete(dessin, polices, nom, classe, devoir):
    dessin.text((180, 60), f"{nom}", font=polices["eleve"], fill=BLEU_ELEVE)
    dessin.text((700, 66), f"{classe} — {devoir}", font=polices["imprime"], fill=NOIR)


def ligne_eleve(dessin, polices, y, texte):
    dessin.text((180, y), texte, font=polices["eleve"], fill=BLEU_ELEVE)


def annotation(dessin, polices, y, texte, x=880):
    """Annotation du professeur en rouge, à droite de la copie."""
    dessin.text((x, y), texte, font=polices["eleve_petit"], fill=ROUGE_PROF)


def croix(dessin, y, x=820, taille=22):
    dessin.line([(x, y), (x + taille, y + taille)], fill=ROUGE_PROF, width=4)
    dessin.line([(x + taille, y), (x, y + taille)], fill=ROUGE_PROF, width=4)


def note(dessin, polices, texte):
    dessin.text((980, 150), texte, font=polices["eleve"], fill=ROUGE_PROF)


def copie_signes(polices, sortie):
    """Deux développements avec signe perdu (E01) + une recopie (E11)."""
    image, dessin = feuille()
    entete(dessin, polices, "Léa M.", "2nde 4", "Devoir n°3")
    dessin.text((180, 190), "Exercice 1 : développer et réduire", font=polices["imprime"], fill=NOIR)
    ligne_eleve(dessin, polices, 260, "A = -2(3x - 5)")
    ligne_eleve(dessin, polices, 324, "A = -6x - 10")
    croix(dessin, 330)
    annotation(dessin, polices, 324, "signe !")
    ligne_eleve(dessin, polices, 452, "B = 4(x - 1) - 3(x + 2)")
    ligne_eleve(dessin, polices, 516, "B = 4x - 4 - 3x + 6")
    croix(dessin, 522)
    annotation(dessin, polices, 516, "-3 x +2 ?")
    ligne_eleve(dessin, polices, 644, "C = 2x + 7")
    ligne_eleve(dessin, polices, 708, "C = 2x + 3 + 4")
    annotation(dessin, polices, 708, "recopié 2x+3", x=860)
    note(dessin, polices, "11/20")
    image.save(sortie / "copie-1-signes.png")


def copie_fractions(polices, sortie):
    """Identité remarquable (E03) et dénominateur commun (E04)."""
    image, dessin = feuille()
    entete(dessin, polices, "Thomas R.", "2nde 1", "Devoir n°4")
    dessin.text((180, 190), "Exercice 2 : développer, puis calculer", font=polices["imprime"], fill=NOIR)
    ligne_eleve(dessin, polices, 260, "(x + 3)² = x² + 9")
    croix(dessin, 266)
    annotation(dessin, polices, 260, "double produit !")
    ligne_eleve(dessin, polices, 388, "(2x - 1)² = 4x² + 1")
    croix(dessin, 394)
    annotation(dessin, polices, 388, "-4x oublié")
    ligne_eleve(dessin, polices, 516, "1/3 + 1/4 = 2/7")
    croix(dessin, 522)
    annotation(dessin, polices, 516, "dénominateur commun ?")
    ligne_eleve(dessin, polices, 644, "3/8 + 1/2 = 4/10")
    croix(dessin, 650)
    annotation(dessin, polices, 644, "non")
    note(dessin, polices, "9/20")
    image.save(sortie / "copie-2-fractions.png")


def copie_propre(polices, sortie):
    """Aucune faute : le professeur n'a rien annoté (RNF-04)."""
    image, dessin = feuille()
    entete(dessin, polices, "Nina B.", "1ère 2", "Devoir n°5")
    dessin.text((180, 190), "Exercice 3 : résoudre", font=polices["imprime"], fill=NOIR)
    ligne_eleve(dessin, polices, 260, "2x + 6 = 0")
    ligne_eleve(dessin, polices, 324, "2x = -6")
    ligne_eleve(dessin, polices, 388, "x = -3")
    ligne_eleve(dessin, polices, 516, "3(x - 2) = 3x - 6")
    ligne_eleve(dessin, polices, 580, "(x + 5)² = x² + 10x + 25")
    annotation(dessin, polices, 700, "Très bien !", x=820)
    note(dessin, polices, "18/20")
    image.save(sortie / "copie-3-propre.png")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sortie", default="corpus/images")
    ap.add_argument("--police", default="/tmp/Caveat.ttf")
    args = ap.parse_args()

    sortie = pathlib.Path(args.sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    polices = charger_polices(args.police)

    copie_signes(polices, sortie)
    copie_fractions(polices, sortie)
    copie_propre(polices, sortie)

    for image in sorted(sortie.glob("copie-*.png")):
        print("%s — %d octets" % (image, image.stat().st_size))


if __name__ == "__main__":
    main()
