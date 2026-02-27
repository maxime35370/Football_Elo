// =====================================================
// 🃏✨ SUPER JOKER - x1.5 sur toute la journée
// Fichier séparé : pronostics-super-joker.js
// 🔥 Inclut les améliorations UX (ex-pronostics-ux-patch.js §4,7)
// =====================================================

const SUPER_JOKER_CONFIG = {
    multiplier: 1.5,        // x1.5 sur tous les matchs de la journée
    maxPerSeason: 1          // 1 seul par saison
};

// Cache local pour accès synchrone depuis renderJokerButton
let _superJokerCache = null;

// ===============================
// STOCKAGE
// ===============================

async function getSuperJoker(playerId, season) {
    const storageKey = `footballEloSuperJoker_${playerId}_${season}`;
    
    try {
        // Essayer Firebase
        if (typeof db !== 'undefined') {
            const doc = await db.collection('pronostiqueurs').doc(playerId).get();
            if (doc.exists && doc.data()[`superJoker_${season}`] !== undefined) {
                const data = doc.data()[`superJoker_${season}`];
                _superJokerCache = data;
                return data;
            }
        }
        
        // Fallback localStorage
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const data = JSON.parse(stored);
            _superJokerCache = data;
            return data;
        }
    } catch (e) {
        console.warn('Erreur getSuperJoker:', e);
    }
    
    // Défaut : pas encore utilisé
    const defaultData = {
        used: false,
        matchDay: null,
        usedAt: null
    };
    _superJokerCache = defaultData;
    return defaultData;
}

/**
 * Accès synchrone au cache Super Joker (pour renderJokerButton dans gameplay.js)
 */
function getSuperJokerCache() {
    return _superJokerCache;
}

async function saveSuperJoker(playerId, season, data) {
    const storageKey = `footballEloSuperJoker_${playerId}_${season}`;
    localStorage.setItem(storageKey, JSON.stringify(data));
    _superJokerCache = data;
    
    // Sync Firebase
    if (typeof db !== 'undefined') {
        try {
            await db.collection('pronostiqueurs').doc(playerId).update({
                [`superJoker_${season}`]: data
            });
        } catch (e) {
            console.warn('Erreur sync Super Joker Firebase:', e);
        }
    }
}

// ===============================
// LOGIQUE
// ===============================

/**
 * Vérifie si le Super Joker est activé pour une journée donnée
 */
function isSuperJokerActive(superJokerData, matchDay) {
    return superJokerData.used && superJokerData.matchDay === matchDay;
}

/**
 * Vérifie si le Super Joker est disponible (pas encore utilisé cette saison)
 */
function isSuperJokerAvailable(superJokerData) {
    return !superJokerData.used;
}

/**
 * Vérifie si un joker individuel est déjà posé sur un match de cette journée
 */
function hasIndividualJokerOnMatchDay(jokers, matchDay) {
    return jokers.used.some(j => j.matchDay === matchDay);
}

/**
 * Active le Super Joker sur une journée
 */
async function activateSuperJoker(playerId, season, matchDay) {
    const superJoker = await getSuperJoker(playerId, season);
    
    // Vérifier disponibilité
    if (superJoker.used) {
        return { success: false, error: 'Super Joker déjà utilisé cette saison' };
    }
    
    // ⚡ Vérifier si la journée a commencé
    if (typeof isMatchDayStarted === 'function' && isMatchDayStarted(matchDay)) {
        return { success: false, error: 'Impossible : la journée a déjà commencé' };
    }
    
    // Vérifier qu'il n'y a pas de joker individuel sur cette journée
    if (typeof getPlayerJokers === 'function') {
        const jokers = await getPlayerJokers(playerId, season);
        if (hasIndividualJokerOnMatchDay(jokers, matchDay)) {
            return { success: false, error: 'Impossible : un joker individuel est déjà posé sur cette journée. Retirez-le d\'abord.' };
        }
    }
    
    // Activer
    superJoker.used = true;
    superJoker.matchDay = matchDay;
    superJoker.usedAt = new Date().toISOString();
    
    await saveSuperJoker(playerId, season, superJoker);
    
    return { success: true };
}

/**
 * Désactive le Super Joker (seulement si la journée n'a pas commencé)
 */
async function deactivateSuperJoker(playerId, season, matchDay) {
    const superJoker = await getSuperJoker(playerId, season);
    
    if (!superJoker.used || superJoker.matchDay !== matchDay) {
        return { success: false, error: 'Super Joker non actif sur cette journée' };
    }
    
    // Vérifier si des matchs ont déjà commencé
    if (typeof isMatchDayStarted === 'function' && isMatchDayStarted(matchDay)) {
        return { success: false, error: 'Impossible de retirer le Super Joker : des matchs ont déjà commencé' };
    }
    
    // Désactiver
    superJoker.used = false;
    superJoker.matchDay = null;
    superJoker.usedAt = null;
    
    await saveSuperJoker(playerId, season, superJoker);
    
    return { success: true };
}

/**
 * Vérifie la compatibilité Super Joker ↔ Joker individuel
 * Retourne true si le joker individuel est bloqué
 */
async function isIndividualJokerBlocked(playerId, season, matchDay) {
    const superJoker = await getSuperJoker(playerId, season);
    return isSuperJokerActive(superJoker, matchDay);
}

// ===============================
// INTERFACE
// ===============================

/**
 * Génère le bandeau Super Joker à afficher en haut de la journée
 * ⚡ UX (ex-ux-patch §4) : masque le bandeau si un joker individuel est actif sur la journée
 */
async function renderSuperJokerBanner(playerId, season, matchDay) {
    const superJoker = await getSuperJoker(playerId, season);
    const isActive = isSuperJokerActive(superJoker, matchDay);
    const isAvailable = isSuperJokerAvailable(superJoker);
    
    // ⚡ Vérifier si un joker individuel est déjà posé → masquer entièrement le bandeau
    let hasIndividualJoker = false;
    if (typeof getPlayerJokers === 'function') {
        const jokers = await getPlayerJokers(playerId, season);
        hasIndividualJoker = hasIndividualJokerOnMatchDay(jokers, matchDay);
    }
    
    if (!isActive && hasIndividualJoker) {
        // Joker individuel actif → Super Joker indisponible, ne pas afficher
        return '';
    }
    
    // Vérifier si la journée a commencé (pour bloquer le toggle)
    const anyStarted = typeof isMatchDayStarted === 'function' 
        ? isMatchDayStarted(matchDay) 
        : false;
    
    if (isActive) {
        // Super Joker activé sur cette journée
        return `
            <div class="super-joker-banner active" style="
                margin-bottom:1rem;padding:0.75rem 1rem;border-radius:12px;
                background:linear-gradient(135deg,#f1c40f20,#f39c1220);
                border:2px solid #f1c40f;display:flex;align-items:center;
                justify-content:space-between;flex-wrap:wrap;gap:0.5rem;
            ">
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <span style="font-size:1.5rem;">🃏✨</span>
                    <div>
                        <div style="font-weight:bold;color:#f39c12;">SUPER JOKER ACTIVÉ !</div>
                        <div style="font-size:0.8rem;color:#7f8c8d;">×${SUPER_JOKER_CONFIG.multiplier} sur tous les matchs de cette journée</div>
                    </div>
                </div>
                ${!anyStarted ? `
                    <button onclick="handleToggleSuperJoker(${matchDay})" style="
                        padding:0.4rem 0.8rem;background:#e74c3c;color:white;
                        border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;">
                        ❌ Retirer
                    </button>
                ` : `
                    <span style="font-size:0.8rem;color:#e74c3c;">🔒 Verrouillé</span>
                `}
            </div>
        `;
    }
    
    if (!isAvailable) {
        // Déjà utilisé sur une autre journée
        return `
            <div class="super-joker-banner used" style="
                margin-bottom:1rem;padding:0.5rem 1rem;border-radius:12px;
                background:#ecf0f1;display:flex;align-items:center;gap:0.5rem;
                font-size:0.85rem;color:#95a5a6;
            ">
                <span>🃏</span>
                <span>Super Joker utilisé sur la Journée ${superJoker.matchDay}</span>
            </div>
        `;
    }
    
    // Disponible mais pas activé
    return `
        <div class="super-joker-banner available" style="
            margin-bottom:1rem;padding:0.75rem 1rem;border-radius:12px;
            background:linear-gradient(135deg,#9b59b610,#8e44ad10);
            border:2px dashed #9b59b6;display:flex;align-items:center;
            justify-content:space-between;flex-wrap:wrap;gap:0.5rem;
        ">
            <div style="display:flex;align-items:center;gap:0.5rem;">
                <span style="font-size:1.5rem;">🃏</span>
                <div>
                    <div style="font-weight:bold;color:#8e44ad;">Super Joker disponible</div>
                    <div style="font-size:0.8rem;color:#7f8c8d;">×${SUPER_JOKER_CONFIG.multiplier} sur TOUS les matchs · 1 seul par saison</div>
                </div>
            </div>
            <button onclick="handleToggleSuperJoker(${matchDay})" style="
                padding:0.4rem 0.8rem;
                background:linear-gradient(135deg,#9b59b6,#8e44ad);
                color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;">
                ✨ Activer
            </button>
        </div>
    `;
}

/**
 * Handler pour le toggle Super Joker
 * ⚡ UX (ex-ux-patch §7) : bloque si journée commencée
 */
async function handleToggleSuperJoker(matchDay) {
    if (!currentPlayer || !currentSeason) return;
    
    // ⚡ Vérifier si la journée a commencé
    if (typeof isMatchDayStarted === 'function' && isMatchDayStarted(matchDay)) {
        alert('La journée a déjà commencé, impossible de modifier le Super Joker.');
        return;
    }
    
    const superJoker = await getSuperJoker(currentPlayer.id, currentSeason);
    const isActive = isSuperJokerActive(superJoker, matchDay);
    
    let result;
    
    if (isActive) {
        // Désactiver
        if (!confirm('Retirer le Super Joker de cette journée ?\n\nVous pourrez le réutiliser sur une autre journée.')) return;
        result = await deactivateSuperJoker(currentPlayer.id, currentSeason, matchDay);
    } else {
        // Activer
        if (!confirm(`Activer le Super Joker sur la Journée ${matchDay} ?\n\n×${SUPER_JOKER_CONFIG.multiplier} sur TOUS les matchs.\nVous ne pourrez plus l'utiliser sur une autre journée.`)) return;
        result = await activateSuperJoker(currentPlayer.id, currentSeason, matchDay);
    }
    
    if (result.success) {
        displayPredictionsForm(); // Rafraîchir
    } else {
        alert(result.error);
    }
}

/**
 * Applique le multiplicateur Super Joker sur les points finaux
 * À utiliser dans le calcul des résultats
 */
async function applySuperJokerMultiplier(playerId, season, matchDay, points) {
    const superJoker = await getSuperJoker(playerId, season);
    
    if (isSuperJokerActive(superJoker, matchDay)) {
        return Math.round(points * SUPER_JOKER_CONFIG.multiplier * 10) / 10;
    }
    
    return points;
}

/**
 * Modifie le comportement du joker individuel :
 * empêche de poser un joker si le Super Joker est actif
 * (à intégrer dans toggleJoker)
 */
async function canUseIndividualJoker(playerId, season, matchDay) {
    const superJoker = await getSuperJoker(playerId, season);
    
    if (isSuperJokerActive(superJoker, matchDay)) {
        return { allowed: false, reason: 'Super Joker actif sur cette journée' };
    }
    
    return { allowed: true };
}

console.log('🃏✨ Module pronostics-super-joker chargé');