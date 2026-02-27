// =====================================================
// 🏆 MVP DE LA JOURNÉE
// Fichier séparé : pronostics-mvp.js
// =====================================================

const MVP_BONUS_POINTS = 2;

// ===============================
// CALCUL & STOCKAGE MVP
// ===============================

/**
 * Détermine le MVP d'une journée (meilleur score pronostics)
 * Retourne null si pas assez de données
 */
async function calculateMatchDayMVP(matchDay) {
    try {
        const ranking = await getMatchDayRanking(matchDay);
        
        if (!ranking || ranking.players.length < 2) return null;
        
        const best = ranking.players[0];
        
        // Vérifier qu'il est seul en tête (pas d'ex-aequo)
        const isUnique = ranking.players.length === 1 || best.points > ranking.players[1].points;
        
        return {
            matchDay,
            playerId: best.playerId,
            pseudo: best.pseudo,
            points: best.points,
            exactScores: best.exactScores,
            closeScores: best.closeScores,
            isUnique,
            // Si ex-aequo, on donne le MVP à celui avec le plus de scores exacts
            tieBreaker: !isUnique ? 'exactScores' : null
        };
    } catch (error) {
        console.error('Erreur calculateMatchDayMVP:', error);
        return null;
    }
}

/**
 * Résout les ex-aequo : plus de scores exacts > plus de scores proches > premier arrivé
 */
async function resolveMatchDayMVP(matchDay) {
    try {
        const ranking = await getMatchDayRanking(matchDay);
        if (!ranking || ranking.players.length === 0) return null;
        
        const topScore = ranking.players[0].points;
        const tied = ranking.players.filter(p => p.points === topScore);
        
        if (tied.length === 1) {
            return {
                matchDay,
                playerId: tied[0].playerId,
                pseudo: tied[0].pseudo,
                points: tied[0].points,
                exactScores: tied[0].exactScores,
                shared: false
            };
        }
        
        // Départage : scores exacts, puis scores proches, puis correctResults
        tied.sort((a, b) => {
            if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
            if (b.closeScores !== a.closeScores) return b.closeScores - a.closeScores;
            return b.correctResults - a.correctResults;
        });
        
        return {
            matchDay,
            playerId: tied[0].playerId,
            pseudo: tied[0].pseudo,
            points: tied[0].points,
            exactScores: tied[0].exactScores,
            shared: tied.length > 1 && tied[0].exactScores === tied[1].exactScores && tied[0].closeScores === tied[1].closeScores
        };
    } catch (error) {
        console.error('Erreur resolveMatchDayMVP:', error);
        return null;
    }
}

/**
 * Sauvegarde le MVP dans Firebase
 */
async function saveMVP(season, matchDay, mvpData) {
    try {
        const docId = `${season}_J${matchDay}`;
        await db.collection('mvps').doc(docId).set({
            ...mvpData,
            season,
            savedAt: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error('Erreur saveMVP:', error);
        return false;
    }
}

/**
 * Récupère le MVP d'une journée
 */
async function getMVP(season, matchDay) {
    try {
        const docId = `${season}_J${matchDay}`;
        const doc = await db.collection('mvps').doc(docId).get();
        if (!doc.exists) return null;
        return doc.data();
    } catch (error) {
        console.error('Erreur getMVP:', error);
        return null;
    }
}

/**
 * Récupère tous les MVPs de la saison
 */
async function getAllMVPs(season) {
    try {
        const snapshot = await db.collection('mvps')
            .where('season', '==', season)
            .get();
        
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Erreur getAllMVPs:', error);
        return [];
    }
}

/**
 * Met à jour les MVPs après chaque journée terminée
 * Appelé après l'ajout d'un match
 */
async function updateMVPs() {
    const season = currentSeason;
    const playedMatchDays = [...new Set(allMatches.map(m => m.matchDay))].sort((a, b) => a - b);
    
    for (const matchDay of playedMatchDays) {
        // Vérifier si le MVP est déjà enregistré
        const existing = await getMVP(season, matchDay);
        if (existing) continue;
        
        // Vérifier si la journée est complète
        const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay);
        const expectedMatches = Math.floor(allTeams.length / 2);
        
        if (matchesThisDay.length < expectedMatches) continue; // Journée incomplète
        
        const mvp = await resolveMatchDayMVP(matchDay);
        if (mvp) {
            await saveMVP(season, matchDay, mvp);
            console.log(`🏆 MVP J${matchDay}: ${mvp.pseudo} (${mvp.points} pts)`);
        }
    }
}

// ===============================
// STATISTIQUES MVP
// ===============================

/**
 * Compte le nombre de fois MVP pour chaque joueur
 */
async function getMVPStats(season) {
    const mvps = await getAllMVPs(season);
    
    const stats = {};
    mvps.forEach(mvp => {
        if (!stats[mvp.playerId]) {
            stats[mvp.playerId] = {
                playerId: mvp.playerId,
                pseudo: mvp.pseudo,
                count: 0,
                matchDays: [],
                totalMVPPoints: 0
            };
        }
        stats[mvp.playerId].count++;
        stats[mvp.playerId].matchDays.push(mvp.matchDay);
        stats[mvp.playerId].totalMVPPoints += mvp.points;
    });
    
    return Object.values(stats).sort((a, b) => b.count - a.count);
}

/**
 * Vérifie si un joueur est le MVP d'une journée donnée
 */
async function isPlayerMVP(playerId, season, matchDay) {
    const mvp = await getMVP(season, matchDay);
    return mvp && mvp.playerId === playerId;
}

// ===============================
// AFFICHAGE
// ===============================

/**
 * Génère le badge MVP pour l'affichage dans le chat ou le classement
 */
function getMVPBadge(matchDay) {
    return `<span class="mvp-badge" title="🏆 MVP Journée ${matchDay}" style="
        display:inline-flex;align-items:center;gap:0.2rem;
        background:linear-gradient(135deg,#f1c40f,#f39c12);
        color:#2c3e50;padding:0.15rem 0.5rem;border-radius:12px;
        font-size:0.75rem;font-weight:bold;margin-left:0.3rem;
        box-shadow:0 2px 4px rgba(241,196,15,0.4);
    ">🏆 MVP</span>`;
}

/**
 * Génère le badge MVP étendu avec le numéro de journée
 */
function getMVPBadgeExtended(matchDay) {
    return `<span class="mvp-badge-ext" title="🏆 MVP Journée ${matchDay}" style="
        display:inline-flex;align-items:center;gap:0.2rem;
        background:linear-gradient(135deg,#f1c40f,#f39c12);
        color:#2c3e50;padding:0.2rem 0.6rem;border-radius:12px;
        font-size:0.8rem;font-weight:bold;
        box-shadow:0 2px 4px rgba(241,196,15,0.4);
    ">🏆 MVP J${matchDay}</span>`;
}

/**
 * Affiche la section MVP dans le classement par journée
 * À appeler dans displayMatchDayRankingContent après le podium
 */
async function renderMVPInRanking(matchDay, containerHtml) {
    const mvp = await getMVP(currentSeason, matchDay);
    
    if (!mvp) return containerHtml;
    
    const mvpHtml = `
        <div class="mvp-announcement" style="
            text-align:center;margin:1rem 0;padding:1rem;
            background:linear-gradient(135deg,#f1c40f10,#f39c1210);
            border:2px solid #f1c40f;border-radius:12px;
        ">
            <div style="font-size:1.5rem;margin-bottom:0.25rem;">🏆</div>
            <div style="font-weight:bold;font-size:1.1rem;color:#2c3e50;">
                ${mvp.pseudo} est le MVP de la Journée ${matchDay} !
            </div>
            <div style="color:#7f8c8d;font-size:0.9rem;">
                ${mvp.points} pts ${mvp.exactScores > 0 ? `· ${mvp.exactScores} score(s) exact(s)` : ''}
                ${!mvp.shared ? '' : '· Ex-aequo départagé aux scores exacts'}
            </div>
            <div style="color:#f39c12;font-weight:bold;font-size:0.85rem;margin-top:0.3rem;">
                +${MVP_BONUS_POINTS} pts bonus MVP
            </div>
        </div>
    `;
    
    return mvpHtml + containerHtml;
}

/**
 * Widget MVP dans la section stats/profil du joueur
 */
async function renderMVPStatsWidget(playerId) {
    const mvps = await getAllMVPs(currentSeason);
    const playerMVPs = mvps.filter(m => m.playerId === playerId);
    
    if (playerMVPs.length === 0) {
        return `
            <div class="mvp-stats-widget" style="text-align:center;padding:1rem;color:#95a5a6;">
                <span style="font-size:2rem;">🏆</span>
                <p>Pas encore MVP cette saison</p>
            </div>
        `;
    }
    
    return `
        <div class="mvp-stats-widget" style="padding:1rem;background:linear-gradient(135deg,#f1c40f10,#f39c1210);border-radius:12px;border-left:4px solid #f1c40f;">
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.5rem;">
                <span style="font-size:2rem;">🏆</span>
                <div>
                    <div style="font-size:1.5rem;font-weight:bold;color:#f39c12;">${playerMVPs.length}×</div>
                    <div style="font-size:0.85rem;color:#7f8c8d;">MVP cette saison</div>
                </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:0.3rem;">
                ${playerMVPs.map(m => `
                    <span style="background:#f1c40f;color:#2c3e50;padding:0.15rem 0.5rem;border-radius:10px;font-size:0.75rem;font-weight:bold;">
                        J${m.matchDay}
                    </span>
                `).join('')}
            </div>
            <div style="margin-top:0.5rem;font-size:0.85rem;color:#7f8c8d;">
                +${playerMVPs.length * MVP_BONUS_POINTS} pts bonus total
            </div>
        </div>
    `;
}

/**
 * Ajoute le badge MVP à côté du pseudo dans le chat
 * Retourne le pseudo avec ou sans badge
 */
async function getPseudoWithMVPBadge(playerId, pseudo, matchDay) {
    // Le MVP de la journée PRÉCÉDENTE a le badge dans le chat de la journée actuelle
    const previousMatchDay = matchDay - 1;
    if (previousMatchDay < 1) return pseudo;
    
    const mvp = await getMVP(currentSeason, previousMatchDay);
    
    if (mvp && mvp.playerId === playerId) {
        return `${pseudo} ${getMVPBadgeExtended(previousMatchDay)}`;
    }
    
    return pseudo;
}

/**
 * Intégration dans le leaderboard global : ajoute les bonus MVP aux points
 * 
 * ⚡ FIX (ex-pronostics-consolidation.js §8) :
 * - Si matchDay est fourni : retourne le bonus MVP gagné à la journée PRÉCÉDENTE
 *   (être MVP à J5 donne le bonus sur J6, pas J5)
 * - Si matchDay n'est pas fourni : retourne le total saison (rétro-compatible)
 */
async function getMVPBonusForPlayer(playerId, season, matchDay) {
    if (matchDay !== undefined) {
        // Mode par journée : le bonus vient du MVP de la journée PRÉCÉDENTE
        const prevDay = matchDay - 1;
        if (prevDay < 1) return 0;
        
        const mvp = await getMVP(season, prevDay);
        return (mvp && mvp.playerId === playerId) ? MVP_BONUS_POINTS : 0;
    }
    
    // Mode saison complète (rétro-compatible)
    const mvps = await getAllMVPs(season);
    const playerMVPs = mvps.filter(m => m.playerId === playerId);
    return playerMVPs.length * MVP_BONUS_POINTS;
}

/**
 * Récupère le classement MVP de la saison (pour un widget dédié)
 */
async function renderMVPLeaderboard() {
    const stats = await getMVPStats(currentSeason);
    
    if (stats.length === 0) {
        return '<p style="text-align:center;color:#95a5a6;">Aucun MVP cette saison</p>';
    }
    
    let html = `
        <div style="display:flex;flex-direction:column;gap:0.5rem;">
    `;
    
    stats.forEach((player, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const isCurrentPlayer = currentPlayer && player.playerId === currentPlayer.id;
        
        html += `
            <div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.75rem;
                        background:${isCurrentPlayer ? '#3498db10' : '#f8f9fa'};border-radius:8px;
                        ${i === 0 ? 'border-left:4px solid #f1c40f;' : ''}">
                <span style="font-weight:bold;min-width:30px;">${medal}</span>
                <span style="flex:1;font-weight:${i < 3 ? 'bold' : 'normal'};">${player.pseudo}</span>
                <span style="font-weight:bold;color:#f39c12;">${player.count}× 🏆</span>
                <span style="font-size:0.85rem;color:#7f8c8d;">+${player.count * MVP_BONUS_POINTS} pts</span>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

console.log('🏆 Module pronostics-mvp chargé');