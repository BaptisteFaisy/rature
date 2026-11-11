/**
 * Variante Cloudflare Worker du proxy (§18.1) — même contrat, zéro dépendance.
 * Le quota est en mémoire par isolate : c'est une approximation assumée
 * (un Worker redémarre souvent), suffisante pour borner un quota de démo.
 *
 * Déploiement : `wrangler deploy worker/worker.js --name rature-proxy`
 * puis `wrangler secret put INFERHUB_API_KEY`.
 */

const TAILLE_MAX = 15 * 1024 * 1024
const PAR_IP_PAR_HEURE = 20
const HEURE_MS = 60 * 60 * 1000
const historique = new Map()

function autoriser(id, maintenant) {
  const fenetre = (historique.get(id) || []).filter((t) => maintenant - t < HEURE_MS)
  if (fenetre.length >= PAR_IP_PAR_HEURE) {
    historique.set(id, fenetre)
    return false
  }
  fenetre.push(maintenant)
  historique.set(id, fenetre)
  return true
}

function json(corps, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function empreinte(ip) {
  let h = 0
  for (let i = 0; i < ip.length; i += 1) h = (h * 31 + ip.charCodeAt(i)) >>> 0
  return `v${h.toString(36)}`
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
    // Sonde de santé : l'app la consulte au chargement pour annoncer un repli.
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
      return json({ ok: true, service: 'rature-proxy-worker' })
    }
    if (request.method !== 'POST') return json({ erreur: 'Méthode non autorisée.' }, 405)

    const cle = request.headers.get('x-rature-cle') || env.INFERHUB_API_KEY
    if (!cle) return json({ erreur: 'Proxy non configuré : colle ta clé (BYOK).' }, 503)

    const debut = Date.now()
    const ip = request.headers.get('cf-connecting-ip') || 'inconnu'
    if (!autoriser(empreinte(ip), Date.now())) {
      return json({ erreur: 'Quota du proxy atteint pour cette heure. Réessaie plus tard.', quota: 'proxy' }, 429)
    }

    const corps = await request.text()
    if (corps.length > TAILLE_MAX) return json({ erreur: 'Photo trop lourde.' }, 413)

    const amont = env.RATURE_AMONT || 'https://api.inferhub.dev/v1'
    try {
      const reponse = await fetch(`${amont}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${cle}` },
        body: corps,
        signal: AbortSignal.timeout(60000),
      })
      const data = await reponse.json()
      if (reponse.status === 429) {
        return json({ erreur: 'Limite de débit du fournisseur de modèles : réessaie dans une minute.' }, 429)
      }
      if (!reponse.ok) return json({ erreur: data?.error?.message || 'Amont indisponible.' }, reponse.status)
      const texte = data?.choices?.[0]?.message?.content || ''
      if (!texte) return json({ erreur: 'Réponse vide du modèle.' }, 502)
      console.info(`${new Date().toISOString()} 200 ${Date.now() - debut}ms`)
      return json({ texte })
    } catch {
      return json({ erreur: 'Amont injoignable ou trop lent.' }, 504)
    }
  },
}
