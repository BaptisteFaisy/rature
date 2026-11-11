"""Proxy edge Raturé sur Modal — la clé InferHub ne descend jamais au navigateur.

Pourquoi Modal : aucun jeton Cloudflare/Vercel exploitable sur les machines
(celui de Vercel rend 403 « create project »), et Modal est déjà configuré ici.
**CPU uniquement, aucune GPU** : ce proxy ne fait que relayer du JSON.

Déploiement :
    modal deploy proxy/modal_app.py
Secret (créé une fois) :
    modal secret create inferhub-key --from-json cle.json

Contrat identique à `api/analyze.ts` et `worker/worker.js` :
POST /analyze avec le corps [OI]-compatible → 200 {"texte": ...}.
L'en-tête `x-rature-cle` (BYOK) remplace la clé serveur s'il est fourni.

Journal : horodatage + statut + latence uniquement (RNF-P3). Ni image, ni
texte, ni clé, ni IP en clair.
"""

import os
import time

import modal

APP_NOM = "rature-proxy"
AMONT_DEFAUT = "https://api.inferhub.dev/v1"
TAILLE_MAX_OCTETS = 15 * 1024 * 1024
DELAI_AMONT_S = 90.0

# Origines autorisées : la démo publique et le développement local.
ORIGINES = [
    "https://baptistefaisy.github.io",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Quota par conteneur (approximation assumée : un conteneur redémarre à zéro).
PAR_IP_PAR_HEURE = 20
GLOBAL_PAR_JOUR = 400

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


def _empreinte(ip: str) -> str:
    """Empreinte de l'IP pour le quota : jamais l'IP en clair dans les journaux."""
    h = 0
    for caractere in ip:
        h = (h * 31 + ord(caractere)) & 0xFFFFFFFF
    return "v%08x" % h


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("inferhub-key")],
    cpu=0.25,
    memory=256,
    scaledown_window=60,
    max_containers=4,
)
@modal.asgi_app()
def analyze():
    """Point d'entrée ASGI : FastAPI monté dans le conteneur Modal."""
    import httpx
    from fastapi import FastAPI, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse

    web = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    web.add_middleware(
        CORSMiddleware,
        allow_origins=ORIGINES,
        # GET pour la sonde de santé (`/health`) appelée depuis le navigateur :
        # sans lui, la sonde échoue en CORS et l'app annonce à tort « indisponible ».
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["content-type", "x-rature-cle"],
        max_age=600,
    )
    autoriser = _creer_quota()
    amont = os.environ.get("RATURE_AMONT", AMONT_DEFAUT)

    @web.get("/health")
    async def health():
        return {"ok": True, "service": APP_NOM}

    @web.post("/analyze")
    async def analyser(request: Request):
        debut = time.time()
        cle = request.headers.get("x-rature-cle", "").strip() or os.environ.get("INFERHUB_API_KEY", "")
        if not cle:
            return JSONResponse({"erreur": "Proxy non configuré."}, status_code=503)

        ip = request.headers.get("x-forwarded-for", "inconnu").split(",")[0].strip()
        if not autoriser(_empreinte(ip), time.time()):
            # `quota: proxy` distingue notre plafond d'une limite de débit amont :
            # le client n'affiche le recours BYOK que dans ce cas.
            return JSONResponse(
                {
                    "erreur": "Quota du proxy atteint pour cette heure. Réessaie plus tard.",
                    "quota": "proxy",
                },
                status_code=429,
            )

        corps = await request.body()
        if len(corps) > TAILLE_MAX_OCTETS:
            return JSONResponse({"erreur": "Photo trop lourde (15 Mo max après encodage)."}, status_code=413)

        try:
            async with httpx.AsyncClient(timeout=DELAI_AMONT_S) as client:
                reponse = await client.post(
                    f"{amont}/chat/completions",
                    content=corps,
                    headers={"content-type": "application/json", "authorization": f"Bearer {cle}"},
                )
        except httpx.HTTPError:
            _journal(504, debut)
            return JSONResponse({"erreur": "Amont injoignable ou trop lent."}, status_code=504)

        if reponse.status_code != 200:
            _journal(reponse.status_code, debut)
            if reponse.status_code == 429:
                return JSONResponse(
                    {"erreur": "Limite de débit du fournisseur de modèles : réessaie dans une minute."},
                    status_code=429,
                )
            return JSONResponse({"erreur": _message_amont(reponse.text)}, status_code=reponse.status_code)

        texte = _extraire_texte(reponse.text)
        if not texte:
            _journal(502, debut)
            return JSONResponse({"erreur": "Réponse vide du modèle."}, status_code=502)

        _journal(200, debut)
        return JSONResponse({"texte": texte}, headers={"cache-control": "no-store"})

    return web


def _message_amont(corps: str) -> str:
    """Message d'erreur lisible, sans révéler la clé ni l'amont."""
    import json

    try:
        return str(json.loads(corps).get("error", {}).get("message", "Amont indisponible."))[:200]
    except (ValueError, AttributeError):
        return "Amont indisponible."


def _extraire_texte(corps: str) -> str:
    import json

    try:
        data = json.loads(corps)
        return data["choices"][0]["message"].get("content") or ""
    except (ValueError, KeyError, IndexError, TypeError):
        return ""


def _journal(statut: int, debut: float) -> None:
    """Seul journal autorisé : horodatage, statut, latence (RNF-P3)."""
    print("%s %d %dms" % (time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), statut, (time.time() - debut) * 1000))
