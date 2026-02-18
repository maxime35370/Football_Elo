// =====================================================
// 📊 PRONOSTIC CLASSEMENT FINAL
// Côtes dynamiques basées sur Monte Carlo
// Fichier : pronostics-ranking-bet.js
// =====================================================

// ===============================
// CONFIGURATION
// ===============================

const RANKING_BET_CONFIG = {
    monteCarloSimulations: 500,  // Nombre de simulations pour calculer les côtes
    minOdds: 1.01,               // Côte minimum (quasi certain)
    maxOdds: 50.0,               // Côte maximum (très improbable)
    scoring: {
        exact: 1.0,              // Position exacte = 100% de la côte
        off1: 0.4,               // ±1 place = 40%
        off2_3: 0.15,            // ±2-3 places = 15%
        off4plus: 0               // > 3 places = 0 pts
    },
    refreshCooldownMs: 60000     // Minimum 1 minute entre 2 recalculs de côtes
};

// ===============================
// CLASSEMENT AUTONOME (pas besoin de app.js)
// ===============================

/**
 * Génère le classement à partir de allTeams et allMatches
 * Version standalone pour la page pronostics
 */
function generateRankingForBet() {
    // Si generateRanking existe (app.js chargé), l'utiliser
    if (typeof generateRanking === 'function') {
        return generateRanking(null, currentSeason, null, false, 'all');
    }
    
    // Sinon, calcul autonome
    const stats = {};
    allTeams.forEach(team => {
        stats[team.id] = {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            played: 0, won: 0, drawn: 0, lost: 0,
            goalsFor: 0, goalsAgainst: 0, points: 0,
            elo: 1500
        };
    });
    
    // Calculer les stats à partir des matchs
    allMatches.forEach(match => {
        if (!match.finalScore) return;
        
        const home = stats[match.homeTeamId];
        const away = stats[match.awayTeamId];
        if (!home || !away) return;
        
        home.played++;
        away.played++;
        home.goalsFor += match.finalScore.home;
        home.goalsAgainst += match.finalScore.away;
        away.goalsFor += match.finalScore.away;
        away.goalsAgainst += match.finalScore.home;
        
        if (match.finalScore.home > match.finalScore.away) {
            home.won++; home.points += 3;
            away.lost++;
        } else if (match.finalScore.home < match.finalScore.away) {
            away.won++; away.points += 3;
            home.lost++;
        } else {
            home.drawn++; home.points += 1;
            away.drawn++; away.points += 1;
        }
    });
    
    // Calculer Elo si EloSystem disponible
    if (typeof EloSystem !== 'undefined') {
        try {
            const eloResults = EloSystem.recalculateAllEloRatings(allTeams, allMatches);
            eloResults.forEach(t => {
                if (stats[t.id]) stats[t.id].elo = t.elo;
            });
        } catch (e) {
            console.warn('Elo non disponible pour ranking bet:', e);
        }
    }
    
    // Trier
    const ranking = Object.values(stats);
    ranking.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const diffA = a.goalsFor - a.goalsAgainst;
        const diffB = b.goalsFor - b.goalsAgainst;
        if (diffB !== diffA) return diffB - diffA;
        return b.goalsFor - a.goalsFor;
    });
    
    return ranking;
}

// ===============================
// CALCUL DES CÔTES VIA MONTE CARLO
// ===============================

/**
 * Lance une simulation Monte Carlo légère et retourne les probabilités
 * de chaque équipe à chaque position
 * @returns { [teamId]: { [position]: probability } }
 */
function calculatePositionProbabilities(numSims) {
    numSims = numSims || RANKING_BET_CONFIG.monteCarloSimulations;
    
    const positionCounts = {};
    allTeams.forEach(team => {
        positionCounts[team.id] = {};
        for (let pos = 1; pos <= allTeams.length; pos++) {
            positionCounts[team.id][pos] = 0;
        }
    });
    
    // Récupérer le classement actuel
    const currentRanking = generateRankingForBet();
    
    // Matchs restants
    const remainingMatches = futureMatches.filter(m => {
        return !allMatches.some(am => 
            am.homeTeamId == m.homeTeamId && am.awayTeamId == m.awayTeamId && am.matchDay == m.matchDay
        );
    });
    
    if (remainingMatches.length === 0) {
        // Saison terminée — classement fixe
        currentRanking.forEach((team, index) => {
            positionCounts[team.id][index + 1] = numSims;
        });
    } else {
        // Simuler
        for (let sim = 0; sim < numSims; sim++) {
            // Copier les stats actuelles
            const simStats = {};
            allTeams.forEach(team => {
                const current = currentRanking.find(t => t.id == team.id);
                simStats[team.id] = {
                    points: current?.points || 0,
                    goalsFor: current?.goalsFor || 0,
                    goalsAgainst: current?.goalsAgainst || 0
                };
            });
            
            // Simuler les matchs restants
            remainingMatches.forEach(match => {
                const homeTeam = currentRanking.find(t => t.id == match.homeTeamId);
                const awayTeam = currentRanking.find(t => t.id == match.awayTeamId);
                
                const homeElo = homeTeam?.elo || 1500;
                const awayElo = awayTeam?.elo || 1500;
                
                // Avantage domicile
                const adjustedHomeElo = homeElo + 65;
                const expectedHome = 1 / (1 + Math.pow(10, (awayElo - adjustedHomeElo) / 400));
                
                // Probabilités
                let drawProb = 0.26;
                let homeWinProb = expectedHome * (1 - drawProb);
                let awayWinProb = (1 - expectedHome) * (1 - drawProb);
                const total = homeWinProb + drawProb + awayWinProb;
                homeWinProb /= total;
                drawProb /= total;
                awayWinProb /= total;
                
                // Tirer le résultat
                const rand = Math.random();
                let homeGoals, awayGoals;
                
                if (rand < homeWinProb) {
                    homeGoals = Math.floor(Math.random() * 3) + 1;
                    awayGoals = Math.floor(Math.random() * homeGoals);
                } else if (rand < homeWinProb + drawProb) {
                    homeGoals = Math.floor(Math.random() * 3);
                    awayGoals = homeGoals;
                } else {
                    awayGoals = Math.floor(Math.random() * 3) + 1;
                    homeGoals = Math.floor(Math.random() * awayGoals);
                }
                
                simStats[match.homeTeamId].goalsFor += homeGoals;
                simStats[match.homeTeamId].goalsAgainst += awayGoals;
                simStats[match.awayTeamId].goalsFor += awayGoals;
                simStats[match.awayTeamId].goalsAgainst += homeGoals;
                
                if (homeGoals > awayGoals) {
                    simStats[match.homeTeamId].points += 3;
                } else if (homeGoals === awayGoals) {
                    simStats[match.homeTeamId].points += 1;
                    simStats[match.awayTeamId].points += 1;
                } else {
                    simStats[match.awayTeamId].points += 3;
                }
            });
            
            // Classement final de cette simulation
            const simRanking = allTeams.map(t => ({
                id: t.id,
                points: simStats[t.id].points,
                goalDiff: simStats[t.id].goalsFor - simStats[t.id].goalsAgainst,
                goalsFor: simStats[t.id].goalsFor
            }));
            
            simRanking.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
                return b.goalsFor - a.goalsFor;
            });
            
            simRanking.forEach((team, index) => {
                positionCounts[team.id][index + 1]++;
            });
        }
    }
    
    // Convertir en probabilités
    const probabilities = {};
    allTeams.forEach(team => {
        probabilities[team.id] = {};
        for (let pos = 1; pos <= allTeams.length; pos++) {
            probabilities[team.id][pos] = positionCounts[team.id][pos] / numSims;
        }
    });
    
    return probabilities;
}

/**
 * Convertit les probabilités en côtes
 * Côte = 1 / probabilité, bornée entre min et max
 */
function probabilitiesToOdds(probabilities) {
    const odds = {};
    
    Object.keys(probabilities).forEach(teamId => {
        odds[teamId] = {};
        Object.keys(probabilities[teamId]).forEach(pos => {
            const prob = probabilities[teamId][pos];
            let cote;
            
            if (prob <= 0) {
                cote = RANKING_BET_CONFIG.maxOdds;
            } else if (prob >= 1) {
                cote = RANKING_BET_CONFIG.minOdds;
            } else {
                cote = Math.round((1 / prob) * 100) / 100;
                cote = Math.max(RANKING_BET_CONFIG.minOdds, Math.min(RANKING_BET_CONFIG.maxOdds, cote));
            }
            
            odds[teamId][pos] = cote;
        });
    });
    
    return odds;
}

/**
 * Calcule et retourne les côtes actuelles
 * Utilise un cache pour éviter les recalculs trop fréquents
 */
let _oddsCache = null;
let _oddsCacheTime = 0;

function getCurrentOdds() {
    const now = Date.now();
    
    if (_oddsCache && (now - _oddsCacheTime) < RANKING_BET_CONFIG.refreshCooldownMs) {
        return _oddsCache;
    }
    
    console.log('📊 Calcul des côtes via Monte Carlo...');
    const startTime = performance.now();
    
    const probabilities = calculatePositionProbabilities();
    const odds = probabilitiesToOdds(probabilities);
    
    const elapsed = Math.round(performance.now() - startTime);
    console.log(`📊 Côtes calculées en ${elapsed}ms`);
    
    _oddsCache = {
        odds,
        probabilities,
        calculatedAt: new Date().toISOString(),
        matchDayContext: Math.max(0, ...allMatches.map(m => m.matchDay || 0))
    };
    _oddsCacheTime = now;
    
    return _oddsCache;
}

function invalidateOddsCache() {
    _oddsCache = null;
    _oddsCacheTime = 0;
}

// ===============================
// STOCKAGE DES PRÉDICTIONS
// ===============================

/**
 * Structure d'une prédiction de classement :
 * {
 *   playerId, season,
 *   predictions: [ { teamId, predictedPosition } ],  // une entrée par équipe
 *   oddsSnapshot: { [teamId]: { [position]: cote } },  // côtes au moment de la prédiction
 *   submittedAt, matchDayContext,
 *   lastModifiedAt, modificationCount
 * }
 */

async function getRankingBet(playerId, season) {
    try {
        const docId = `${playerId}_${season}`;
        
        // Firebase
        if (typeof db !== 'undefined') {
            const doc = await db.collection('rankingBets').doc(docId).get();
            if (doc.exists) return doc.data();
        }
        
        // Fallback localStorage
        const stored = localStorage.getItem(`footballEloRankingBet_${docId}`);
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.error('Erreur getRankingBet:', e);
    }
    
    return null;
}

async function saveRankingBet(playerId, season, betData) {
    const docId = `${playerId}_${season}`;
    
    localStorage.setItem(`footballEloRankingBet_${docId}`, JSON.stringify(betData));
    
    if (typeof db !== 'undefined') {
        try {
            await db.collection('rankingBets').doc(docId).set(betData);
        } catch (e) {
            console.error('Erreur saveRankingBet Firebase:', e);
        }
    }
}

async function getAllRankingBets(season) {
    try {
        if (typeof db !== 'undefined') {
            const snapshot = await db.collection('rankingBets')
                .where('season', '==', season)
                .get();
            return snapshot.docs.map(doc => doc.data());
        }
    } catch (e) {
        console.error('Erreur getAllRankingBets:', e);
    }
    return [];
}

// ===============================
// INTERFACE — DRAG & DROP RANKING
// ===============================

let _rankingBetOrder = []; // Ordre actuel dans l'UI

/**
 * Initialise l'interface de pronostic classement
 * @param containerId - ID du div conteneur
 */
async function initRankingBetUI(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !currentPlayer) return;
    
    container.innerHTML = '<div class="loading">Calcul des côtes en cours...</div>';
    
    // Calculer les côtes
    const { odds, probabilities, matchDayContext } = getCurrentOdds();
    
    // Charger la prédiction existante
    const existingBet = await getRankingBet(currentPlayer.id, currentSeason);
    
    // Classement actuel comme base
    const currentRanking = generateRankingForBet();
    
    // Initialiser l'ordre
    if (existingBet && existingBet.predictions) {
        // Utiliser l'ordre existant
        _rankingBetOrder = existingBet.predictions
            .sort((a, b) => a.predictedPosition - b.predictedPosition)
            .map(p => p.teamId);
    } else {
        // Utiliser le classement actuel par défaut
        _rankingBetOrder = currentRanking.map(t => t.id);
    }
    
    // Vérifier si la saison est terminée
    const remainingMatches = futureMatches.filter(m => {
        return !allMatches.some(am => 
            am.homeTeamId == m.homeTeamId && am.awayTeamId == m.awayTeamId && am.matchDay == m.matchDay
        );
    });
    const seasonFinished = remainingMatches.length === 0 && allMatches.length > 0;
    
    // Info header
    let html = `
        <div style="margin-bottom:1rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">
                <h3 style="margin:0;color:#2c3e50;">📊 Pronostic Classement Final</h3>
                <div style="font-size:0.85rem;color:#7f8c8d;">
                    Journée ${matchDayContext} · ${allTeams.length} équipes
                </div>
            </div>
    `;
    
    if (existingBet) {
        const modCount = existingBet.modificationCount || 0;
        html += `
            <div style="background:#f39c1210;border:1px solid #f39c1240;border-radius:8px;padding:0.5rem 0.75rem;font-size:0.85rem;margin-bottom:0.75rem;">
                ⚠️ Prédiction existante (J${existingBet.matchDayContext || '?'})
                ${modCount > 0 ? `· ${modCount} modification(s)` : ''}
                · <strong>Modifier = nouvelles côtes (potentiellement moins avantageuses)</strong>
            </div>
        `;
    } else {
        html += `
            <div style="background:#27ae6010;border:1px solid #27ae6040;border-radius:8px;padding:0.5rem 0.75rem;font-size:0.85rem;margin-bottom:0.75rem;">
                🆕 Glisse les équipes pour prédire le classement final.
                Les côtes actuelles seront verrouillées au moment de ta sauvegarde.
            </div>
        `;
    }
    
    // Légende des côtes
    html += `
        <div style="display:flex;gap:1rem;font-size:0.8rem;color:#7f8c8d;margin-bottom:0.75rem;flex-wrap:wrap;">
            <span>🟢 Côte basse = facile (peu de pts)</span>
            <span>🟡 Côte moyenne</span>
            <span>🔴 Côte haute = risqué (beaucoup de pts)</span>
        </div>
    `;
    
    // Liste drag & drop
    html += `<div id="rankingBetList" class="ranking-bet-list" style="display:flex;flex-direction:column;gap:2px;">`;
    
    _rankingBetOrder.forEach((teamId, index) => {
        const pos = index + 1;
        const team = allTeams.find(t => t.id == teamId);
        const cote = odds[teamId]?.[pos] || 1;
        const prob = probabilities[teamId]?.[pos] || 0;
        
        // Côte de la prédiction existante (si elle existe)
        const savedOdds = existingBet?.oddsSnapshot?.[teamId]?.[pos];
        
        // Couleur selon la côte
        const coteColor = cote <= 2 ? '#27ae60' : cote <= 5 ? '#f39c12' : cote <= 15 ? '#e67e22' : '#e74c3c';
        
        // Classement actuel pour référence
        const currentPos = currentRanking.findIndex(t => t.id == teamId) + 1;
        const diff = currentPos - pos;
        const diffStr = diff > 0 ? `↑${diff}` : diff < 0 ? `↓${Math.abs(diff)}` : '=';
        const diffColor = diff > 0 ? '#27ae60' : diff < 0 ? '#e74c3c' : '#95a5a6';
        
        html += `
            <div class="ranking-bet-item" draggable="${!seasonFinished}" data-team-id="${teamId}" 
                 style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;
                        background:white;border:1px solid #e9ecef;border-radius:8px;
                        cursor:${seasonFinished ? 'default' : 'grab'};user-select:none;
                        transition:transform 0.15s,box-shadow 0.15s;">
                <span style="font-weight:bold;min-width:28px;color:#7f8c8d;">${pos}.</span>
                <span style="flex:1;font-weight:600;color:#2c3e50;">${team?.shortName || '?'}</span>
                <span style="font-size:0.75rem;color:${diffColor};min-width:30px;text-align:center;">${diffStr}</span>
                <span style="font-size:0.8rem;color:${coteColor};font-weight:bold;min-width:45px;text-align:right;" 
                      title="${Math.round(prob * 100)}% de probabilité">
                    ×${cote.toFixed(1)}
                </span>
                ${savedOdds ? `<span style="font-size:0.7rem;color:#95a5a6;min-width:45px;text-align:right;" title="Côte verrouillée">(×${savedOdds.toFixed(1)})</span>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    
    // Boutons
    if (!seasonFinished) {
        html += `
            <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
                <button onclick="saveRankingBetFromUI()" style="
                    padding:0.6rem 1.2rem;background:linear-gradient(135deg,#667eea,#764ba2);
                    color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:0.9rem;">
                    💾 ${existingBet ? 'Modifier ma prédiction' : 'Sauvegarder ma prédiction'}
                </button>
                <button onclick="resetRankingBetToDefault()" style="
                    padding:0.6rem 1.2rem;background:#ecf0f1;color:#7f8c8d;
                    border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;">
                    ↩️ Remettre le classement actuel
                </button>
                <button onclick="sortRankingBetByOdds()" style="
                    padding:0.6rem 1.2rem;background:#ecf0f1;color:#7f8c8d;
                    border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;">
                    📊 Trier par probabilité
                </button>
            </div>
        `;
    }
    
    // Résultats si saison terminée
    if (seasonFinished && existingBet) {
        const results = calculateRankingBetResults(existingBet, currentRanking);
        html += renderRankingBetResults(results);
    }
    
    // Gains potentiels
    if (existingBet) {
        html += renderPotentialGains(existingBet, odds);
    }
    
    html += '</div>';
    
    container.innerHTML = html;
    
    // Activer le drag & drop
    if (!seasonFinished) {
        initDragAndDrop();
    }
}

/**
 * Initialise le drag & drop sur la liste
 */
function initDragAndDrop() {
    const list = document.getElementById('rankingBetList');
    if (!list) return;
    
    let draggedItem = null;
    let draggedIndex = -1;
    
    list.querySelectorAll('.ranking-bet-item').forEach((item, index) => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            draggedIndex = index;
            item.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
        });
        
        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
            draggedItem = null;
            // Retirer tous les indicateurs
            list.querySelectorAll('.ranking-bet-item').forEach(el => {
                el.style.borderTop = '';
                el.style.borderBottom = '';
            });
        });
        
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            
            // Retirer les indicateurs précédents
            list.querySelectorAll('.ranking-bet-item').forEach(el => {
                el.style.borderTop = '';
                el.style.borderBottom = '';
            });
            
            if (e.clientY < midY) {
                item.style.borderTop = '3px solid #667eea';
            } else {
                item.style.borderBottom = '3px solid #667eea';
            }
        });
        
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!draggedItem || draggedItem === item) return;
            
            const dropIndex = Array.from(list.children).indexOf(item);
            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const insertBefore = e.clientY < midY;
            
            // Réordonner
            const movedTeamId = _rankingBetOrder[draggedIndex];
            _rankingBetOrder.splice(draggedIndex, 1);
            
            const targetIndex = insertBefore ? dropIndex : dropIndex + 1;
            const adjustedIndex = draggedIndex < dropIndex ? targetIndex - 1 : targetIndex;
            _rankingBetOrder.splice(adjustedIndex, 0, movedTeamId);
            
            // Refresh l'UI
            refreshRankingBetList();
        });
    });
    
    // Support tactile pour mobile
    initTouchDragAndDrop(list);
}

/**
 * Support du drag & drop tactile (mobile)
 */
function initTouchDragAndDrop(list) {
    let touchItem = null;
    let touchStartY = 0;
    let touchClone = null;
    let touchStartIndex = -1;
    
    list.querySelectorAll('.ranking-bet-item').forEach((item, index) => {
        item.addEventListener('touchstart', (e) => {
            touchItem = item;
            touchStartIndex = index;
            touchStartY = e.touches[0].clientY;
            
            // Créer un clone visuel
            touchClone = item.cloneNode(true);
            touchClone.style.position = 'fixed';
            touchClone.style.zIndex = '9999';
            touchClone.style.opacity = '0.8';
            touchClone.style.pointerEvents = 'none';
            touchClone.style.width = item.offsetWidth + 'px';
            touchClone.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            document.body.appendChild(touchClone);
            
            item.style.opacity = '0.3';
        }, { passive: true });
        
        item.addEventListener('touchmove', (e) => {
            if (!touchClone) return;
            e.preventDefault();
            
            const touchY = e.touches[0].clientY;
            touchClone.style.top = (touchY - 20) + 'px';
            touchClone.style.left = item.getBoundingClientRect().left + 'px';
            
            // Trouver l'élément survolé
            const elements = list.querySelectorAll('.ranking-bet-item');
            elements.forEach(el => {
                el.style.borderTop = '';
                el.style.borderBottom = '';
            });
            
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (touchY > rect.top && touchY < rect.bottom) {
                    const midY = rect.top + rect.height / 2;
                    if (touchY < midY) {
                        el.style.borderTop = '3px solid #667eea';
                    } else {
                        el.style.borderBottom = '3px solid #667eea';
                    }
                }
            });
        }, { passive: false });
        
        item.addEventListener('touchend', (e) => {
            if (!touchClone) return;
            
            const touchY = e.changedTouches[0].clientY;
            
            // Trouver la position de drop
            let dropIndex = touchStartIndex;
            const elements = list.querySelectorAll('.ranking-bet-item');
            elements.forEach((el, i) => {
                const rect = el.getBoundingClientRect();
                if (touchY > rect.top && touchY < rect.bottom) {
                    const midY = rect.top + rect.height / 2;
                    dropIndex = touchY < midY ? i : i + 1;
                }
                el.style.borderTop = '';
                el.style.borderBottom = '';
            });
            
            // Réordonner
            if (dropIndex !== touchStartIndex) {
                const movedTeamId = _rankingBetOrder[touchStartIndex];
                _rankingBetOrder.splice(touchStartIndex, 1);
                const adjusted = touchStartIndex < dropIndex ? dropIndex - 1 : dropIndex;
                _rankingBetOrder.splice(adjusted, 0, movedTeamId);
                refreshRankingBetList();
            }
            
            // Cleanup
            if (touchClone.parentNode) touchClone.parentNode.removeChild(touchClone);
            touchClone = null;
            if (touchItem) touchItem.style.opacity = '1';
            touchItem = null;
        });
    });
}

/**
 * Rafraîchit l'affichage de la liste après réordonnancement
 */
function refreshRankingBetList() {
    const container = document.getElementById('rankingBetList');
    if (!container) return;
    
    // Recalculer les côtes pour les nouvelles positions
    const { odds, probabilities } = getCurrentOdds();
    const currentRanking = generateRankingForBet();
    
    container.innerHTML = '';
    
    _rankingBetOrder.forEach((teamId, index) => {
        const pos = index + 1;
        const team = allTeams.find(t => t.id == teamId);
        const cote = odds[teamId]?.[pos] || 1;
        const prob = probabilities[teamId]?.[pos] || 0;
        
        const currentPos = currentRanking.findIndex(t => t.id == teamId) + 1;
        const diff = currentPos - pos;
        const diffStr = diff > 0 ? `↑${diff}` : diff < 0 ? `↓${Math.abs(diff)}` : '=';
        const diffColor = diff > 0 ? '#27ae60' : diff < 0 ? '#e74c3c' : '#95a5a6';
        const coteColor = cote <= 2 ? '#27ae60' : cote <= 5 ? '#f39c12' : cote <= 15 ? '#e67e22' : '#e74c3c';
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'ranking-bet-item';
        itemDiv.draggable = true;
        itemDiv.dataset.teamId = teamId;
        itemDiv.style.cssText = `display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:white;border:1px solid #e9ecef;border-radius:8px;cursor:grab;user-select:none;transition:transform 0.15s,box-shadow 0.15s;`;
        
        itemDiv.innerHTML = `
            <span style="font-weight:bold;min-width:28px;color:#7f8c8d;">${pos}.</span>
            <span style="flex:1;font-weight:600;color:#2c3e50;">${team?.shortName || '?'}</span>
            <span style="font-size:0.75rem;color:${diffColor};min-width:30px;text-align:center;">${diffStr}</span>
            <span style="font-size:0.8rem;color:${coteColor};font-weight:bold;min-width:45px;text-align:right;" 
                  title="${Math.round(prob * 100)}% de probabilité">
                ×${cote.toFixed(1)}
            </span>
        `;
        
        container.appendChild(itemDiv);
    });
    
    // Réactiver le drag & drop
    initDragAndDrop();
    
    // Mettre à jour le gain potentiel
    updatePotentialGainDisplay();
}

/**
 * Calcule et affiche le gain potentiel en direct
 */
function updatePotentialGainDisplay() {
    const display = document.getElementById('potentialGainDisplay');
    if (!display) return;
    
    const { odds } = getCurrentOdds();
    let totalPotential = 0;
    
    _rankingBetOrder.forEach((teamId, index) => {
        const pos = index + 1;
        const cote = odds[teamId]?.[pos] || 1;
        totalPotential += cote * RANKING_BET_CONFIG.scoring.exact;
    });
    
    display.textContent = `${Math.round(totalPotential * 10) / 10} pts`;
}

// ===============================
// ACTIONS UI
// ===============================

async function saveRankingBetFromUI() {
    if (!currentPlayer || !currentSeason) return;
    
    const { odds, matchDayContext } = getCurrentOdds();
    
    // Récupérer l'existant
    const existing = await getRankingBet(currentPlayer.id, currentSeason);
    
    const betData = {
        playerId: currentPlayer.id,
        pseudo: currentPlayer.pseudo,
        season: currentSeason,
        predictions: _rankingBetOrder.map((teamId, index) => ({
            teamId,
            predictedPosition: index + 1
        })),
        oddsSnapshot: {},
        submittedAt: existing ? existing.submittedAt : new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
        matchDayContext,
        modificationCount: (existing?.modificationCount || 0) + (existing ? 1 : 0)
    };
    
    // Snapshot des côtes pour chaque team à sa position prédite
    _rankingBetOrder.forEach((teamId, index) => {
        const pos = index + 1;
        if (!betData.oddsSnapshot[teamId]) betData.oddsSnapshot[teamId] = {};
        betData.oddsSnapshot[teamId][pos] = odds[teamId]?.[pos] || 1;
    });
    
    await saveRankingBet(currentPlayer.id, currentSeason, betData);
    
    alert(existing ? '✅ Prédiction modifiée ! Les côtes actuelles ont été verrouillées.' : '✅ Prédiction sauvegardée !');
    
    // Refresh UI
    initRankingBetUI('rankingBetContainer');
}

function resetRankingBetToDefault() {
    const currentRanking = generateRankingForBet();
    _rankingBetOrder = currentRanking.map(t => t.id);
    refreshRankingBetList();
}

function sortRankingBetByOdds() {
    const { probabilities } = getCurrentOdds();
    
    // Trier chaque équipe par sa position la plus probable
    _rankingBetOrder.sort((a, b) => {
        // Trouver la position la plus probable pour chaque équipe
        let bestPosA = 1, bestProbA = 0;
        let bestPosB = 1, bestProbB = 0;
        
        Object.keys(probabilities[a] || {}).forEach(pos => {
            if (probabilities[a][pos] > bestProbA) {
                bestProbA = probabilities[a][pos];
                bestPosA = parseInt(pos);
            }
        });
        Object.keys(probabilities[b] || {}).forEach(pos => {
            if (probabilities[b][pos] > bestProbB) {
                bestProbB = probabilities[b][pos];
                bestPosB = parseInt(pos);
            }
        });
        
        return bestPosA - bestPosB;
    });
    
    refreshRankingBetList();
}

// ===============================
// CALCUL DES RÉSULTATS (FIN DE SAISON)
// ===============================

/**
 * Calcule les points gagnés par un pronostic classement
 */
function calculateRankingBetResults(bet, finalRanking) {
    if (!bet || !bet.predictions || !bet.oddsSnapshot) {
        return { totalPoints: 0, details: [] };
    }
    
    let totalPoints = 0;
    const details = [];
    
    bet.predictions.forEach(pred => {
        const team = allTeams.find(t => t.id == pred.teamId);
        const finalPos = finalRanking.findIndex(t => t.id == pred.teamId) + 1;
        const predictedPos = pred.predictedPosition;
        const offset = Math.abs(finalPos - predictedPos);
        
        // Côte au moment de la prédiction
        const lockedOdds = bet.oddsSnapshot[pred.teamId]?.[predictedPos] || 1;
        
        let multiplier, label;
        if (offset === 0) {
            multiplier = RANKING_BET_CONFIG.scoring.exact;
            label = '🏆 Exact !';
        } else if (offset === 1) {
            multiplier = RANKING_BET_CONFIG.scoring.off1;
            label = '🎯 ±1';
        } else if (offset <= 3) {
            multiplier = RANKING_BET_CONFIG.scoring.off2_3;
            label = `📍 ±${offset}`;
        } else {
            multiplier = RANKING_BET_CONFIG.scoring.off4plus;
            label = `❌ ±${offset}`;
        }
        
        const points = Math.round(lockedOdds * multiplier * 100) / 100;
        totalPoints += points;
        
        details.push({
            teamId: pred.teamId,
            teamName: team?.shortName || '?',
            predictedPos,
            finalPos,
            offset,
            lockedOdds,
            multiplier,
            points,
            label
        });
    });
    
    return {
        totalPoints: Math.round(totalPoints * 10) / 10,
        details: details.sort((a, b) => a.predictedPos - b.predictedPos)
    };
}

// ===============================
// AFFICHAGE DES RÉSULTATS
// ===============================

function renderRankingBetResults(results) {
    if (!results || results.details.length === 0) return '';
    
    let html = `
        <div style="margin-top:1.5rem;padding:1rem;background:linear-gradient(135deg,#667eea10,#764ba210);
                    border:2px solid #667eea;border-radius:12px;">
            <h4 style="margin:0 0 0.75rem;color:#667eea;">
                📊 Résultats — ${results.totalPoints} pts
            </h4>
            <div style="display:flex;flex-direction:column;gap:3px;font-size:0.85rem;">
    `;
    
    results.details.forEach(d => {
        const bgColor = d.offset === 0 ? '#27ae6015' : d.offset === 1 ? '#f39c1215' : d.offset <= 3 ? '#3498db10' : '#e74c3c10';
        
        html += `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0.5rem;background:${bgColor};border-radius:6px;">
                <span style="min-width:28px;font-weight:bold;color:#7f8c8d;">${d.predictedPos}.</span>
                <span style="flex:1;">${d.teamName}</span>
                <span style="color:#7f8c8d;font-size:0.8rem;">Réel: ${d.finalPos}e</span>
                <span style="font-size:0.8rem;">${d.label}</span>
                <span style="font-weight:bold;min-width:50px;text-align:right;">
                    ${d.points > 0 ? `+${d.points}` : '0'}
                </span>
            </div>
        `;
    });
    
    // Stats résumées
    const exacts = results.details.filter(d => d.offset === 0).length;
    const close = results.details.filter(d => d.offset === 1).length;
    const near = results.details.filter(d => d.offset >= 2 && d.offset <= 3).length;
    const missed = results.details.filter(d => d.offset > 3).length;
    
    html += `
            </div>
            <div style="display:flex;gap:1rem;margin-top:0.75rem;font-size:0.85rem;flex-wrap:wrap;
                        padding-top:0.75rem;border-top:1px solid #667eea30;">
                <span>🏆 ${exacts} exact(s)</span>
                <span>🎯 ${close} ±1</span>
                <span>📍 ${near} ±2-3</span>
                <span>❌ ${missed} raté(s)</span>
            </div>
        </div>
    `;
    
    return html;
}

/**
 * Affiche les gains potentiels de la prédiction actuelle
 */
function renderPotentialGains(bet, currentOdds) {
    if (!bet || !bet.predictions) return '';
    
    let totalIfPerfect = 0;
    let totalRealistic = 0;
    
    bet.predictions.forEach(pred => {
        const lockedOdds = bet.oddsSnapshot?.[pred.teamId]?.[pred.predictedPosition] || 1;
        totalIfPerfect += lockedOdds * RANKING_BET_CONFIG.scoring.exact;
        
        // Réaliste : estimer ~30% exact, ~30% ±1, ~20% ±2-3, ~20% raté
        totalRealistic += lockedOdds * (
            0.3 * RANKING_BET_CONFIG.scoring.exact +
            0.3 * RANKING_BET_CONFIG.scoring.off1 +
            0.2 * RANKING_BET_CONFIG.scoring.off2_3
        );
    });
    
    return `
        <div style="margin-top:1rem;padding:0.75rem;background:#f8f9fa;border-radius:8px;font-size:0.85rem;">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
                <span>💰 Gain si tout parfait : <strong>${Math.round(totalIfPerfect * 10) / 10} pts</strong></span>
                <span>📈 Estimation réaliste : <strong>~${Math.round(totalRealistic * 10) / 10} pts</strong></span>
                <span id="potentialGainDisplay"></span>
            </div>
        </div>
    `;
}

// ===============================
// CLASSEMENT ENTRE JOUEURS
// ===============================

/**
 * Classement des joueurs sur le pronostic classement final
 * (utilisable en fin de saison ou en projection)
 */
async function getRankingBetLeaderboard(season) {
    const allBets = await getAllRankingBets(season);
    const finalRanking = generateRankingForBet();
    
    const leaderboard = allBets.map(bet => {
        const results = calculateRankingBetResults(bet, finalRanking);
        return {
            playerId: bet.playerId,
            pseudo: bet.pseudo,
            totalPoints: results.totalPoints,
            exacts: results.details.filter(d => d.offset === 0).length,
            close: results.details.filter(d => d.offset === 1).length,
            matchDayContext: bet.matchDayContext,
            modifications: bet.modificationCount || 0
        };
    });
    
    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
    return leaderboard;
}

async function renderRankingBetLeaderboard(season) {
    const leaderboard = await getRankingBetLeaderboard(season);
    
    if (leaderboard.length === 0) {
        return '<p style="text-align:center;color:#95a5a6;">Aucune prédiction de classement</p>';
    }
    
    let html = '<div style="display:flex;flex-direction:column;gap:0.4rem;">';
    
    leaderboard.forEach((player, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const isMe = currentPlayer && player.playerId === currentPlayer.id;
        
        html += `
            <div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.75rem;
                        background:${isMe ? '#3498db10' : '#f8f9fa'};border-radius:8px;
                        ${i === 0 ? 'border-left:4px solid #f1c40f;' : ''}">
                <span style="font-weight:bold;min-width:30px;">${medal}</span>
                <span style="flex:1;font-weight:${i < 3 ? 'bold' : 'normal'};">${player.pseudo}</span>
                <span style="font-size:0.8rem;color:#7f8c8d;">${player.exacts}🏆 ${player.close}🎯</span>
                <span style="font-weight:bold;color:#667eea;">${player.totalPoints} pts</span>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

console.log('📊 Module pronostics-ranking-bet chargé');