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
import shutil

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

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
    ap.add_argument("--demo", action="store_true", help="génère les photos de la démo (corpus/demo)")
    ap.add_argument("--source-demo", default="corpus/copies-demo.json")
    args = ap.parse_args()

    if args.demo:
        generer_demo(source=args.source_demo, sortie="corpus/demo")
        return

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




# ---------------------------------------------------------------------------
# Démo : copies d'un même élève, rendues puis « photographiées »
# ---------------------------------------------------------------------------

POLICE_MANUSCRITE = "/tmp/Caveat.ttf"
POLICE_IMPRIME = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def _police_manuscrite(taille):
    """Police d'écriture manuscrite ; repli sur DejaVu si le fichier manque."""
    try:
        return ImageFont.truetype(POLICE_MANUSCRITE, taille)
    except OSError:
        return ImageFont.truetype(POLICE_IMPRIME, taille)


def _rendre_copie(copie, dossier_sortie):
    """Une page de cahier : énoncé imprimé, élève au bleu, prof au rouge."""
    largeur, hauteur = 1240, 1754
    page = Image.new("RGB", (largeur, hauteur), (250, 248, 242))
    dessin = ImageDraw.Draw(page)
    imprime = ImageFont.truetype(POLICE_IMPRIME, 24)
    manuscrit = _police_manuscrite(38)
    petit = _police_manuscrite(30)

    # lignes de cahier très légèrement visibles (comme du vrai papier, pas un formulaire)
    for y in range(150, hauteur - 60, 74):
        dessin.line([(90, y), (largeur - 70, y)], fill=(237, 241, 245), width=2)
    dessin.line([(150, 110), (150, hauteur - 60)], fill=(238, 206, 206), width=2)

    y = 150
    dessin.text((180, 60), copie["eleve"], font=manuscrit, fill=(28, 52, 96))
    dessin.text((760, 70), "%s — %s" % (copie["classe"], copie["devoir"]), font=imprime, fill=(40, 40, 40))
    y = 190
    dessin.text((180, y), copie["titre"], font=imprime, fill=(40, 40, 40))
    y += 70

    alea = random.Random(hash(copie["id"]) & 0xFFFF)
    index = 0
    for ligne in copie["lignes"]:
        genre = ligne["type"]
        if genre == "enonce":
            dessin.text((190, y), ligne["texte"], font=imprime, fill=(35, 35, 35))
            y += 62
        elif genre == "eleve":
            # L'écriture manuscrite n'est jamais parfaitement droite
            _texte_manuscrit(dessin, ligne["texte"], 215 + alea.randint(-6, 8), y + alea.randint(-4, 4),
                             manuscrit, (24, 48, 112), alea.uniform(-1.1, 1.1))
            y += 72
        elif genre == "corrige":
            # Le professeur corrige en marge : la position varie d'une ligne à l'autre
            marge = 690 + alea.randint(0, 120)
            _texte_manuscrit(dessin, ligne.get("texte", ""), marge, y + alea.randint(-4, 6),
                             petit, (178, 30, 30), alea.uniform(-1.4, 1.4))
            if ligne.get("prof"):
                _texte_manuscrit(dessin, ligne["prof"], marge, y + 36, petit, (178, 30, 30),
                                 alea.uniform(-1.4, 1.4))
            y += 84
        else:  # annotation libre du professeur
            _texte_manuscrit(dessin, ligne.get("texte", ""), 720 + alea.randint(0, 90), y,
                             petit, (178, 30, 30), alea.uniform(-1.2, 1.2))
            y += 60
        index += 1

    dessin.text((1010, 150), copie.get("note", ""), font=manuscrit, fill=(178, 30, 30))
    return page


def _texte_manuscrit(dessin, texte, x, y, police, couleur, angle):
    """Écrit le texte sur un calque transparent puis le pose légèrement incliné."""
    if not texte:
        return
    largeur = int(police.getbbox(texte)[2] - police.getbbox(texte)[0]) + 24
    hauteur = int(police.getbbox(texte)[3] - police.getbbox(texte)[1]) + 24
    calque = Image.new("RGBA", (largeur + 40, hauteur + 40), (0, 0, 0, 0))
    ImageDraw.Draw(calque).text((20, 20), texte, font=police, fill=couleur + (255,))
    calque = calque.rotate(angle, resample=Image.BICUBIC, expand=False)
    dessin._image.paste(calque, (x - 20, y - 20), calque)


def _deformer(page, graine):
    """Perspective : la page est photographiée de biais, pas à plat."""
    alea = random.Random(graine)
    largeur, hauteur = page.size
    # quadrilatère source : la page penche légèrement
    dx = alea.uniform(0.03, 0.08) * largeur
    dy = alea.uniform(0.02, 0.06) * hauteur
    # Image.QUAD attend 8 valeurs : les 4 coins de la source, dans l'ordre
    # haut-gauche, bas-gauche, bas-droite, haut-droite.
    quadrilatere = (
        int(dx), int(dy),
        int(dx * 0.4), int(hauteur - dy * 0.3),
        int(largeur - dx * 0.3), int(hauteur - dy),
        int(largeur - dx), int(dy * 0.5),
    )
    # recadrage : on garde la page entière avec un peu de marge
    marge = int(largeur * 0.05)
    cible = (largeur + 2 * marge, hauteur + 2 * marge)
    deforme = page.transform(cible, Image.QUAD, quadrilatere, resample=Image.BICUBIC)
    return deforme.crop((marge, marge, marge + largeur, marge + hauteur))


def _eclairage(page, graine):
    """Lumière inégale + vignette : l'appareil n'éclaire pas uniformément."""
    alea = random.Random(graine)
    largeur, hauteur = page.size
    direction = alea.choice((-1, 1))
    # Petit dégradé agrandi : pas de bandes horizontales visibles.
    petit = Image.new("L", (4, 64), 0)
    dessin_p = ImageDraw.Draw(petit)
    for i in range(64):
        valeur = int(255 - (i / 64) * alea.uniform(30, 70))
        dessin_p.line([(0, i), (4, i)], fill=valeur)
    masque = petit.resize((largeur, hauteur), Image.BICUBIC)
    if direction < 0:
        masque = ImageOps.mirror(masque)
    eclaire = ImageChops.multiply(page, Image.merge("RGB", (masque, masque, masque)))
    # vignette : les coins sont plus sombres
    vignette = Image.new("L", (largeur, hauteur), 0)
    dessin_v = ImageDraw.Draw(vignette)
    rayon = int(max(largeur, hauteur) * 0.72)
    dessin_v.ellipse(
        (largeur // 2 - rayon, hauteur // 2 - rayon, largeur // 2 + rayon, hauteur // 2 + rayon),
        fill=255,
    )
    vignette = vignette.filter(ImageFilter.GaussianBlur(rayon // 3))
    # La vignette assombrit un peu, pas tout : une photo sombre reste lisible.
    vignette = ImageEnhance.Brightness(vignette).enhance(0.62)
    return ImageChops.multiply(eclaire, Image.merge("RGB", (vignette, vignette, vignette)))


def _bruit_et_flou(page, graine):
    """Grain de capteur et léger flou de mise au point."""
    alea = random.Random(graine)
    largeur, hauteur = page.size
    bruit = Image.effect_noise((largeur, hauteur), 9).convert("RGB")
    melange = Image.blend(page, bruit, 0.045)
    return melange.filter(ImageFilter.GaussianBlur(alea.uniform(0.4, 0.9)))


def _bureau(page, graine):
    """La page est posée sur une table, avec une ombre portée."""
    alea = random.Random(graine)
    largeur, hauteur = page.size
    marge = int(largeur * 0.06)
    toile = Image.new("RGB", (largeur + 2 * marge, hauteur + 2 * marge), (58, 54, 50))
    texture = Image.effect_noise(toile.size, 14).convert("RGB")
    toile = Image.blend(toile, texture, 0.18)
    grain = Image.effect_noise(toile.size, 7).convert("RGB")
    toile = Image.blend(toile, grain, 0.06)
    ombre = Image.new("L", toile.size, 0)
    ImageDraw.Draw(ombre).rectangle(
        (marge + 18, marge + 22, marge + largeur + 10, marge + hauteur + 10), fill=150
    )
    ombre = ombre.filter(ImageFilter.GaussianBlur(34))
    toile.paste(Image.new("RGB", toile.size, (30, 28, 26)), (0, 0), ombre)
    toile.paste(page, (marge, marge))
    return toile.rotate(alea.uniform(-1.4, 1.4), resample=Image.BICUBIC, expand=False)


def _photographier(page, graine):
    """Chaîne complète : déformation, lumière, grain, flou, table, angle."""
    image = _deformer(page, graine)
    image = _eclairage(image, graine + 1)
    image = _bruit_et_flou(image, graine + 2)
    image = _bureau(image, graine + 3)
    return image


def generer_demo(source="corpus/copies-demo.json", sortie="corpus/demo"):
    """Rend les copies de la démo et les « photographie » (JPEG, comme un téléphone)."""
    donnees = json.loads(pathlib.Path(source).read_text(encoding="utf-8"))
    dossier = pathlib.Path(sortie)
    dossier.mkdir(parents=True, exist_ok=True)
    for index, copie in enumerate(donnees["copies"]):
        page = _rendre_copie(copie, dossier)
        photo = _photographier(page, 1000 + index)
        chemin = dossier / ("%s.jpg" % copie["id"])
        photo.save(chemin, "JPEG", quality=74)
        print("%s — %dx%d, %d Ko" % (chemin, photo.size[0], photo.size[1], chemin.stat().st_size // 1024))


if __name__ == "__main__":
    main()
