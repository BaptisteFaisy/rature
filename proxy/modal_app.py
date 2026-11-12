"""Proxy edge Raturé sur Modal — la clé InferHub ne descend jamais au navigateur.

Pourquoi Modal : aucun jeton Cloudflare/Vercel exploitable sur les machines, et
Modal est déjà configuré ici. **CPU uniquement, aucune GPU** : ce proxy ne fait
que relayer du JSON.

Déploiement :
    modal deploy proxy/modal_app.py
Secret (créé une fois) :
    modal secret create inferhub-key --from-json cle.json

Ce que fait ce proxy de plus qu'un simple relais (idées 2, 5 et 9 du brassage
« rester sur InferHub ») :

1. **Chaîne de repli côté serveur** : InferHub est une place de marché où 5
   modèles vision sur 6 peuvent être en 503 au même instant. Le client n'a plus
   à faire un aller-retour par modèle mort — c'est le proxy qui descend la
   chaîne, ce qui économise 1 à 5 allers-retours HTTP par analyse.
2. **Disjoncteur par modèle** : un 402/503 met le modèle en cooldown 60 s, donc
   on ne repaye pas 1 à 2 s par modèle déjà mort à chaque analyse.
3. **Enchères paramétrables** : si `RATURE_MAX_IN_PRICE` / `RATURE_MAX_OUT_PRICE`
   sont posées, les en-têtes `x-max-input-price` / `x-max-output-price` sont
   transmis. Sans elles, seuls les modèles inclus dans les préférences du compte
   répondent (les autres rendent 402).

Contrat : POST /analyze {model, messages, …} → 200 {"texte": …, "modele": …}.
L'en-tête `x-rature-cle` (BYOK) remplace la clé serveur s'il est fourni.
En cas d'échec de toute la chaîne : 503 {"erreur": …, "chaineEpuisee": true} —
le client s'arrête alors au lieu de rejouer sa propre chaîne.

Journal : horodatage, statut, latence, modèle. Jamais l'image, jamais le texte
extrait, jamais la clé, jamais l'IP en clair (RNF-P3).
"""

import json
import os
import time

import modal

APP_NOM = "rature-proxy"
AMONT_DEFAUT = "https://api.inferhub.dev/v1"
TAILLE_MAX_OCTETS = 15 * 1024 * 1024
DELAI_AMONT_S = 90.0

# Chaîne de repli serveur. À garder alignée sur CHAINE_MODELES de
# src/domain/config.ts : le client commence par son modèle préféré, le proxy
# termine le travail.
CHAINE = [
    "ag/gemini-4-carbon",
    "ag/claude-sonnet-4-6",
    "ag/gemini-4-argon",
    "ag/claude-sonnet-5-5",
    "ag/gemini-3.8-flash-high",
    "ag/claude-opus-4-6-thinking",
]
# 402 (hors enchère) et 503 (sans capacité) sont transitoires mais coûtent cher :
# cooldown court pour ne pas les retryer à chaque analyse.
REESSAYABLES = {402, 429, 500, 502, 503, 504}
COOLDOWN_S = 60

ORIGINES = [
    "https://tradoooo.github.io",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

MAX_CONTENEURS = 4
PAR_IP_PAR_HEURE = 20 // MAX_CONTENEURS      # 5 par conteneur → ~20/heure/visiteur
GLOBAL_PAR_JOUR = 400 // MAX_CONTENEURS      # 100 par conteneur → ~400/jour

image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "fastapi==0.115.*",
    "httpx==0.27.*",
)

app = modal.App(APP_NOM)


def _creer_quota():
    """Fenêtre glissante en mémoire : {id: [instants]} + compteur journalier."""
    historique: dict[str, list[float]] = {}
    etat = {"jour": 0.0, "utilise": 0}

    def autoriser(cle: str, maintenant: float) -> bool:
        if maintenant - etat["jour"] >= 86_400:
            etat["jour"] = maintenant
            etat["utilise"] = 0
        fenetre = [t for t in historique.get(cle, []) if maintenant - t < 3600]
        if len(fenetre) >= PAR_IP_PAR_HEURE or etat["utilise"] >= GLOBAL_PAR_JOUR:
            historique[cle] = fenetre
            return False
        fenetre.append(maintenant)
        historique[cle] = fenetre
        etat["utilise"] += 1
        return True

    return autoriser


def _creer_disjoncteur():
    """Cooldown par modèle : un modèle en panne n'est pas retenté pendant 60 s."""
    hors_service: dict[str, float] = {}

    def disponible(modele: str, maintenant: float) -> bool:
        return hors_service.get(modele, 0.0) <= maintenant

    def signaler(modele: str, maintenant: float, panne: bool) -> None:
        if panne:
            hors_service[modele] = maintenant + COOLDOWN_S
        else:
            hors_service.pop(modele, None)

    def etat() -> dict[str, float]:
        return {m: round(t - time.time(), 1) for m, t in hors_service.items() if t > time.time()}

    return disponible, signaler, etat


def _empreinte(ip: str) -> str:
    """Empreinte de l'IP pour le quota : jamais l'IP en clair dans les journaux."""
    h = 0
    for caractere in ip:
        h = (h * 31 + ord(caractere)) & 0xFFFFFFFF
    return "v%08x" % h


def _chaine_pour(modele_demande: str) -> list[str]:
    """Le modèle demandé d'abord, puis le reste de la chaîne, sans doublon."""
    demande = (modele_demande or "").strip()
    if not demande:
        return list(CHAINE)
    return [demande] + [m for m in CHAINE if m != demande]


def _entetes_amont(cle: str) -> dict[str, str]:
    entetes = {"content-type": "application/json", "authorization": "Bearer " + cle}
    prix_in = os.environ.get("RATURE_MAX_IN_PRICE", "").strip()
    prix_out = os.environ.get("RATURE_MAX_OUT_PRICE", "").strip()
    if prix_in:
        entetes["x-max-input-price"] = prix_in
    if prix_out:
        entetes["x-max-output-price"] = prix_out
    return entetes


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("inferhub-key")],
    cpu=0.25,
    memory=256,
    scaledown_window=60,
    max_containers=MAX_CONTENEURS,
)
@modal.asgi_app()
def analyze():
    """Point d'entrée ASGI : FastAPI monté dans le conteneur Modal."""
    from fastapi import FastAPI, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse

    web = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    web.add_middleware(
        CORSMiddleware,
        allow_origins=ORIGINES,
        # GET pour les sondes (/health, /modeles) appelées depuis le navigateur.
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["content-type", "x-rature-cle"],
        max_age=600,
    )
    autoriser = _creer_quota()
    disponible, signaler, etat_disjoncteur = _creer_disjoncteur()
    amont = os.environ.get("RATURE_AMONT", AMONT_DEFAUT)

    @web.get("/health")
    async def health():
        return {"ok": True, "service": APP_NOM, "disjoncteur": etat_disjoncteur()}

    @web.get("/modeles")
    async def modeles():
        """Chaîne server + état du disjoncteur : utile au diagnostic, sans clé exposée."""
        return {"chaine": CHAINE, "disjoncteur": etat_disjoncteur(), "amont": amont}

    @web.post("/analyze")
    async def analyser(request: Request):
        debut = time.time()
        cle = request.headers.get("x-rature-cle", "").strip() or os.environ.get("INFERHUB_API_KEY", "")
        if not cle:
            return JSONResponse({"erreur": "Proxy non configuré."}, status_code=503)

        ip = request.headers.get("x-forwarded-for", "inconnu").split(",")[0].strip()
        if not autoriser(_empreinte(ip), time.time()):
            return JSONResponse(
                {"erreur": "Quota du proxy atteint pour cette heure. Réessaie plus tard.", "quota": "proxy"},
                status_code=429,
            )

        corps = await request.body()
        if len(corps) > TAILLE_MAX_OCTETS:
            return JSONResponse({"erreur": "Photo trop lourde (15 Mo max après encodage)."}, status_code=413)

        try:
            charge = json.loads(corps)
        except ValueError:
            _journal(400, debut, "-")
            return JSONResponse({"erreur": "Corps JSON invalide."}, status_code=400)

        if charge.get("stream") is True:
            return await _relayer_en_flux(
                charge, cle, amont, debut, disponible, signaler, JSONResponse
            )
        return await _relayer_avec_chaine(charge, cle, amont, debut, disponible, signaler, JSONResponse)

    return web


async def _relayer_avec_chaine(charge, cle, amont, debut, disponible, signaler, JSONResponse):
    """Descend la chaîne de modèles côté serveur, disjoncteur inclus."""
    import httpx

    demande = str(charge.get("model") or "")
    derniere_erreur = "aucun modèle disponible"
    dernier_statut = 503
    tentes = 0

    async with httpx.AsyncClient(timeout=DELAI_AMONT_S) as client:
        for modele in _chaine_pour(demande):
            if not disponible(modele, time.time()):
                continue
            tentes += 1
            charge["model"] = modele
            try:
                reponse = await client.post(
                    f"{amont}/chat/completions",
                    content=json.dumps(charge),
                    headers=_entetes_amont(cle),
                )
            except httpx.HTTPError:
                signaler(modele, time.time(), True)
                derniere_erreur, dernier_statut = "Amont injoignable ou trop lent.", 504
                continue

            if reponse.status_code == 200:
                signaler(modele, time.time(), False)
                texte = _extraire_texte(reponse.text)
                if not texte:
                    _journal(502, debut, modele)
                    return JSONResponse({"erreur": "Réponse vide du modèle."}, status_code=502)
                _journal(200, debut, modele, tentes)
                return JSONResponse(
                    {"texte": texte, "modele": modele, "tentatives": tentes},
                    headers={"cache-control": "no-store"},
                )

            signaler(modele, time.time(), reponse.status_code in REESSAYABLES)
            dernier_statut = reponse.status_code
            derniere_erreur = _message_amont(reponse.text)
            if reponse.status_code not in REESSAYABLES:
                break

    _journal(dernier_statut, debut, demande, tentes)
    return JSONResponse(
        {"erreur": derniere_erreur, "chaineEpuisee": True, "tentatives": tentes},
        status_code=dernier_statut,
    )


async def _relayer_en_flux(charge, cle, amont, debut, disponible, signaler, JSONResponse):
    """Streaming SSE (idée 7) : pendant que l'amont réfléchit, on publie ce qui
    se passe — « modèle 2/6 : 503, essai suivant ». L'attente devient une
    démonstration de robustesse au lieu d'un spinner muet.

    Le format est volontairement simple : des événements `progres` puis un
    événement `resultat`. Un client qui ne parle pas SSE retombe sur le chemin
    JSON classique (l'endpoint `/analyze` reste compatible).
    """
    import httpx
    from fastapi.responses import StreamingResponse

    demande = str(charge.get("model") or "")
    charge.pop("stream", None)

    async def generateur():
        derniere_erreur = "aucun modèle disponible"
        dernier_statut = 503
        tentes = 0
        async with httpx.AsyncClient(timeout=DELAI_AMONT_S) as client:
            for modele in _chaine_pour(demande):
                if not disponible(modele, time.time()):
                    continue
                tentes += 1
                charge["model"] = modele
                try:
                    reponse = await client.post(
                        f"{amont}/chat/completions",
                        content=json.dumps(charge),
                        headers=_entetes_amont(cle),
                    )
                except httpx.HTTPError:
                    signaler(modele, time.time(), True)
                    derniere_erreur, dernier_statut = "Amont injoignable ou trop lent.", 504
                    yield _evenement("progres", {"modele": modele, "statut": 504, "essai": tentes})
                    continue

                if reponse.status_code == 200:
                    signaler(modele, time.time(), False)
                    texte = _extraire_texte(reponse.text)
                    if not texte:
                        yield _evenement("progres", {"modele": modele, "statut": 502, "essai": tentes})
                        continue
                    _journal(200, debut, modele, tentes)
                    yield _evenement(
                        "resultat", {"texte": texte, "modele": modele, "tentatives": tentes}
                    )
                    return

                signaler(modele, time.time(), reponse.status_code in REESSAYABLES)
                dernier_statut = reponse.status_code
                derniere_erreur = _message_amont(reponse.text)
                yield _evenement(
                    "progres",
                    {"modele": modele, "statut": reponse.status_code, "essai": tentes},
                )
                if reponse.status_code not in REESSAYABLES:
                    break
        _journal(dernier_statut, debut, demande, tentes)
        yield _evenement("erreur", {"erreur": derniere_erreur, "statut": dernier_statut})

    return StreamingResponse(
        generateur(),
        media_type="text/event-stream",
        headers={"cache-control": "no-store", "x-accel-buffering": "no"},
    )


def _evenement(nom: str, donnees: dict) -> str:
    """Un événement SSE : `event: nom` puis `data: {...}`."""
    return "event: %s\ndata: %s\n\n" % (nom, json.dumps(donnees, ensure_ascii=False))


def _message_amont(corps: str) -> str:
    """Message d'erreur lisible, sans révéler la clé ni l'amont."""
    try:
        return str(json.loads(corps).get("error", {}).get("message", "Amont indisponible."))[:200]
    except (ValueError, AttributeError):
        return "Amont indisponible."


def _extraire_texte(corps: str) -> str:
    try:
        data = json.loads(corps)
        return data["choices"][0]["message"].get("content") or ""
    except (ValueError, KeyError, IndexError, TypeError):
        return ""


def _journal(statut: int, debut: float, modele: str, tentatives: int = 0) -> None:
    """Seul journal autorisé : horodatage, statut, latence, modèle, tentatives."""
    print(
        "%s %d %dms modele=%s tentatives=%d"
        % (time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), statut, (time.time() - debut) * 1000, modele, tentatives)
    )
