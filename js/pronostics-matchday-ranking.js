// pronostics-matchday-ranking.js - Classement par journée
// 🔥 Inclut la consolidation des bonus dans le classement journée + récap

// ===============================
// CLASSEMENT PAR JOURNÉE
// (avec bonus consolidés — ex-pronostics-consolidation.js §2)
// ===============================

/**
 * Récupère le classement détaillé pour une journée spécifique
 * Inclut les bonus : Super Joker, Buteur, Combiné, MVP, Défis
 */
async function getMatchDayRanking(matchDay) {
    const players = await getAllPlayers();
    const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay);
    
    // Si aucun match joué cette journée, retourner vide
    if (matchesThisDay.length === 0) {
        return { players: [], iaResult: null, matchesPlayed: 0 };
    }
    
    const results = [];
    
    // Calculer les points de chaque joueur pour cette journée
    for (const player of players) {
        const predictions = await getPlayerPredictions(player.id, currentSeason, matchDay);
        
        if (!predictions || !predictions.predictions) {
            continue;
        }
        
        let dayPoints = 0;
        let exactScores = 0;
        let closeScores = 0;
        let correctResults = 0;
        let wrongResults = 0;
        const matchDetails = [];
        
        for (const pred of predictions.predictions) {
            const match = matchesThisDay.find(m => 
                m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
            );
            
            if (!match || !match.finalScore) continue;
            
            const result = calculatePredictionResult(
                pred.homeScore, pred.awayScore,
                match.finalScore.home, match.finalScore.away,
                pred.savedAt,
                match,
                pred.odds
            );
            
            const points = result.finalPoints || result.points;
            dayPoints += points;
            
            if (result.points === 9) exactScores++;
            else if (result.points === 6) closeScores++;
            else if (result.points > 0) correctResults++;
            else wrongResults++;
            
            const homeTeam = allTeams.find(t => t.id == pred.homeTeamId);
            const awayTeam = allTeams.find(t => t.id == pred.awayTeamId);
            
            matchDetails.push({
                homeTeam: homeTeam?.shortName || '?',
                awayTeam: awayTeam?.shortName || '?',
                prediction: `${pred.homeScore}-${pred.awayScore}`,
                actual: `${match.finalScore.home}-${match.finalScore.away}`,
                points: points,
                basePoints: result.points,
                multiplier: result.oddsMultiplier || 1,
                class: result.class
            });
        }
        
        if (matchDetails.length > 0) {
            results.push({
                playerId: player.id,
                pseudo: player.pseudo,
                points: Math.round(dayPoints * 10) / 10,
                exactScores,
                closeScores,
                correctResults,
                wrongResults,
                totalPredictions: matchDetails.length,
                matchDetails
            });
        }
    }
    
    // ===============================
    // AJOUT DES BONUS PAR JOUEUR
    // (ex-pronostics-consolidation.js §2)
    // ===============================
    
    const season = currentSeason;
    
    for (const player of results) {
        player.bonuses = {};
        let bonusTotal = 0;
        
        // Super Joker
        if (typeof getSuperJoker === 'function') {
            try {
                const sj = await getSuperJoker(player.playerId, season);
                if (sj && sj.used && sj.matchDay === matchDay) {
                    const sjBonus = Math.round(player.points * 0.5 * 10) / 10;
                    player.bonuses.superJoker = sjBonus;
                    bonusTotal += sjBonus;
                }
            } catch (e) {}
        }
        
        // Buteur
        if (typeof calculateScorerPointsForMatchDay === 'function') {
            try {
                const preds = await getPlayerPredictions(player.playerId, season, matchDay);
                if (preds && preds.predictions) {
                    const scorerResult = calculateScorerPointsForMatchDay(preds.predictions, matchDay);
                    const scorerPts = scorerResult?.totalPoints || 0;
                    if (scorerPts > 0) {
                        player.bonuses.scorer = scorerPts;
                        bonusTotal += scorerPts;
                    }
                }
            } catch (e) {}
        }
        
        // Combiné
        if (typeof calculateCombineResult === 'function' && typeof getPlayerCombine === 'function') {
            try {
                const combine = await getPlayerCombine(player.playerId, season, matchDay);
                if (combine && combine.matches) {
                    const matchesWithScore = allMatches.filter(m => m.matchDay === matchDay && m.finalScore);
                    const predictions = await getPlayerPredictions(player.playerId, season, matchDay);
                    if (predictions && predictions.predictions) {
                        const result = calculateCombineResult(combine, predictions.predictions, matchesWithScore);
                        if (result && result.bonusPoints > 0) {
                            player.bonuses.combine = result.bonusPoints;
                            bonusTotal += result.bonusPoints;
                        }
                    }
                }
            } catch (e) {}
        }
        
        // MVP
        if (typeof getMVPBonusForPlayer === 'function') {
            try {
                const mvpBonus = await getMVPBonusForPlayer(player.playerId, season, matchDay);
                if (mvpBonus > 0) {
                    player.bonuses.mvp = mvpBonus;
                    bonusTotal += mvpBonus;
                }
            } catch (e) {}
        }
        
        // Défis IA + buts totaux
        if (typeof calculateAllChallengePoints === 'function') {
            try {
                const challengeResult = await calculateAllChallengePoints(player.playerId, season, matchDay);
                if (challengeResult && challengeResult.points > 0) {
                    player.bonuses.challenges = challengeResult.points;
                    bonusTotal += challengeResult.points;
                }
            } catch (e) {}
        }
        
        player.bonusTotal = Math.round(bonusTotal * 10) / 10;
        player.totalWithBonus = Math.round((player.points + bonusTotal) * 10) / 10;
        player.points = player.totalWithBonus; // Écraser pour compatibilité
    }
    
    // Re-trier avec les bonus inclus
    results.sort((a, b) => b.points - a.points);
    
    // Re-attribuer les rangs
    results.forEach((player, index) => {
        player.rank = index + 1;
    });
    
    // Récupérer les résultats de l'IA pour cette journée
    let iaResult = null;
    if (typeof calculateIAResults === 'function') {
        iaResult = await calculateIAResults(matchDay);
    }
    
    return {
        players: results,
        iaResult,
        matchesPlayed: matchesThisDay.length
    };
}

/**
 * Affiche le widget de classement par journée
 */
async function renderMatchDayRankingWidget() {
    const container = document.getElementById('matchDayRankingContainer');
    if (!container) return;
    
    // Trouver les journées avec des matchs joués
    const playedMatchDays = [...new Set(allMatches.map(m => m.matchDay))].sort((a, b) => b - a);
    
    if (playedMatchDays.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;">Aucune journée jouée</p>';
        return;
    }
    
    // Sélectionner la dernière journée par défaut
    const latestMatchDay = playedMatchDays[0];
    
    // Générer le HTML
    container.innerHTML = `
        <div class="matchday-ranking-widget">
            <div class="matchday-ranking-header">
                <h4>🏆 Classement par journée</h4>
                <select id="matchDayRankingSelect" class="matchday-select">
                    ${playedMatchDays.map(day => 
                        `<option value="${day}" ${day === latestMatchDay ? 'selected' : ''}>Journée ${day}</option>`
                    ).join('')}
                </select>
            </div>
            <div id="matchDayRankingContent">
                <div class="loading">Chargement...</div>
            </div>
        </div>
    `;
    
    // Événement changement de journée
    document.getElementById('matchDayRankingSelect').addEventListener('change', async (e) => {
        const matchDay = parseInt(e.target.value);
        await displayMatchDayRankingContent(matchDay);
    });
    
    // Afficher le contenu initial
    await displayMatchDayRankingContent(latestMatchDay);
}

/**
 * Affiche le contenu du classement pour une journée
 */
async function displayMatchDayRankingContent(matchDay) {
    const container = document.getElementById('matchDayRankingContent');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Chargement...</div>';
    
    try {
        const ranking = await getMatchDayRanking(matchDay);
        
        if (ranking.players.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <p>Aucun pronostic pour cette journée</p>
                </div>
            `;
            return;
        }
        
        // Podium
        const podium = ranking.players.slice(0, 3);
        const rest = ranking.players.slice(3);
        
        let html = `
            <div class="matchday-podium">
                ${podium.map((player, index) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const isCurrentPlayer = currentPlayer && player.playerId === currentPlayer.id;
                    return `
                        <div class="podium-card rank-${index + 1} ${isCurrentPlayer ? 'current-player' : ''}"
                             onclick="showMatchDayPlayerDetail('${player.playerId}', ${matchDay})">
                            <div class="podium-medal">${medals[index]}</div>
                            <div class="podium-name">${player.pseudo} ${renderBonusBadges(player.bonuses)}</div>
                            <div class="podium-points">${player.points} pts</div>
                            <div class="podium-stats">
                                ${player.exactScores > 0 ? `<span class="exact">🎯${player.exactScores}</span>` : ''}
                                ${player.closeScores > 0 ? `<span class="close">✅${player.closeScores}</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        // IA dans le classement
        if (ranking.iaResult) {
            const iaRank = ranking.players.filter(p => p.points > ranking.iaResult.totalPoints).length + 1;
            html += `
                <div class="ia-ranking-badge">
                    <span class="ia-icon">🤖</span>
                    <span class="ia-name">Claude IA</span>
                    <span class="ia-rank">${iaRank}${iaRank === 1 ? 'er' : 'e'}</span>
                    <span class="ia-points">${ranking.iaResult.totalPoints} pts</span>
                </div>
            `;
        }
        
        // Reste du classement
        if (rest.length > 0) {
            html += `
                <div class="matchday-ranking-list">
                    <table>
                        <thead>
                            <tr>
                                <th>Pos</th>
                                <th>Joueur</th>
                                <th>Pts</th>
                                <th>🎯</th>
                                <th>✅</th>
                                <th>❌</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rest.map(player => {
                                const isCurrentPlayer = currentPlayer && player.playerId === currentPlayer.id;
                                return `
                                    <tr class="${isCurrentPlayer ? 'current-player' : ''}"
                                        onclick="showMatchDayPlayerDetail('${player.playerId}', ${matchDay})"
                                        style="cursor:pointer;">
                                        <td>${player.rank}</td>
                                        <td>${player.pseudo} ${renderBonusBadges(player.bonuses)}</td>
                                        <td><strong>${player.points}</strong></td>
                                        <td>${player.exactScores + player.closeScores}</td>
                                        <td>${player.correctResults}</td>
                                        <td>${player.wrongResults}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        // Statistiques de la journée
        const totalPoints = ranking.players.reduce((sum, p) => sum + p.points, 0);
        const avgPoints = ranking.players.length > 0 ? (totalPoints / ranking.players.length).toFixed(1) : 0;
        const bestPlayer = ranking.players[0];
        const totalExacts = ranking.players.reduce((sum, p) => sum + p.exactScores, 0);
        
        html += `
            <div class="matchday-stats-summary">
                <div class="stat-item">
                    <span class="stat-value">${ranking.matchesPlayed}</span>
                    <span class="stat-label">Matchs joués</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${ranking.players.length}</span>
                    <span class="stat-label">Participants</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${avgPoints}</span>
                    <span class="stat-label">Moy. pts</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${totalExacts}</span>
                    <span class="stat-label">Scores exacts</span>
                </div>
            </div>
        `;
        
        // MVP de la journée
        if (typeof renderMVPInRanking === 'function') {
            html = await renderMVPInRanking(matchDay, html);
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Erreur displayMatchDayRankingContent:', error);
        container.innerHTML = '<p style="color:#e74c3c;">Erreur de chargement</p>';
    }
}

/**
 * Affiche le détail des pronostics d'un joueur pour une journée
 */
async function showMatchDayPlayerDetail(playerId, matchDay) {
    const ranking = await getMatchDayRanking(matchDay);
    const playerData = ranking.players.find(p => p.playerId === playerId);
    
    if (!playerData) return;
    
    // Créer une modal ou afficher dans un conteneur
    const modal = document.createElement('div');
    modal.className = 'matchday-detail-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>📊 ${playerData.pseudo} - Journée ${matchDay}</h3>
                <div style="display:flex;gap:0.5rem;align-items:center;">
                    <button onclick="sharePronosticsCard('${playerData.playerId}', '${playerData.pseudo}', ${matchDay})" 
                            style="padding:0.4rem 0.8rem;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;">
                        📸 Partager
                    </button>
                    <button class="btn-close" onclick="this.closest('.matchday-detail-modal').remove()">✕</button>
                </div>
            </div>
            <div class="modal-body">
                <div class="player-summary">
                    <div class="summary-item">
                        <span class="value">${playerData.points}</span>
                        <span class="label">Points</span>
                    </div>
                    <div class="summary-item">
                        <span class="value">${playerData.rank}${playerData.rank === 1 ? 'er' : 'e'}</span>
                        <span class="label">Classement</span>
                    </div>
                    <div class="summary-item">
                        <span class="value">${playerData.exactScores}</span>
                        <span class="label">🎯 Exacts</span>
                    </div>
                </div>
                <div class="matches-detail">
                    ${playerData.matchDetails.map(match => `
                        <div class="match-detail-row ${match.class}">
                            <span class="match-teams">${match.homeTeam} - ${match.awayTeam}</span>
                            <span class="match-prediction">Prono: ${match.prediction}</span>
                            <span class="match-actual">Réel: ${match.actual}</span>
                            <span class="match-points">
                                ${match.multiplier !== 1 
                                    ? `${match.basePoints} × ${match.multiplier} = ${match.points}` 
                                    : match.points
                                } pts
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * Récupère l'historique des classements par journée d'un joueur
 */
async function getPlayerMatchDayHistory(playerId) {
    const playedMatchDays = [...new Set(allMatches.map(m => m.matchDay))].sort((a, b) => a - b);
    const history = [];
    
    for (const matchDay of playedMatchDays) {
        const ranking = await getMatchDayRanking(matchDay);
        const playerData = ranking.players.find(p => p.playerId === playerId);
        
        if (playerData) {
            history.push({
                matchDay,
                rank: playerData.rank,
                points: playerData.points,
                totalPlayers: ranking.players.length
            });
        }
    }
    
    return history;
}


// ===============================
// BADGES BONUS DANS LE CLASSEMENT
// (ex-pronostics-consolidation.js §6)
// ===============================

/**
 * Affiche les icônes de bonus à côté du nom d'un joueur
 */
function renderBonusBadges(bonuses) {
    if (!bonuses) return '';
    let badges = '';
    if (bonuses.superJoker) badges += `<span title="Super Joker +${bonuses.superJoker}" style="font-size:0.7rem;">🃏✨</span> `;
    if (bonuses.scorer) badges += `<span title="Buteur +${bonuses.scorer}" style="font-size:0.7rem;">⚽</span> `;
    if (bonuses.combine) badges += `<span title="Combiné +${bonuses.combine}" style="font-size:0.7rem;">🎲</span> `;
    if (bonuses.challenges) badges += `<span title="Défis IA +${bonuses.challenges}" style="font-size:0.7rem;">🎲🤖</span> `;
    if (bonuses.mvp) badges += `<span title="MVP +${bonuses.mvp}" style="font-size:0.7rem;">🏆</span> `;
    return badges;
}


// ===============================
// RÉCAP FIN DE JOURNÉE
// (ex-pronostics-consolidation.js §4)
// ===============================

/**
 * Calcule le récap complet d'un joueur pour une journée
 */
async function getMatchDayRecap(playerId, matchDay) {
    const season = currentSeason;
    const predictions = await getPlayerPredictions(playerId, season, matchDay);
    const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay && m.finalScore);
    
    if (!predictions || !predictions.predictions || matchesThisDay.length === 0) {
        return null;
    }
    
    const recap = {
        matchDay,
        // Points de base
        basePoints: 0,
        matches: [],
        exact: 0, close: 0, good: 0, correct: 0, wrong: 0,
        // Bonus
        bonuses: [],
        totalBonus: 0,
        // Total
        totalPoints: 0,
        // Classement
        rank: null, totalPlayers: 0,
        previousRank: null,
        newRank: null,
        // MVP
        isMVP: false,
        mvpPseudo: null
    };
    
    // --- Calcul des matchs ---
    for (const pred of predictions.predictions) {
        const match = matchesThisDay.find(m => 
            m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
        );
        if (!match) continue;
        
        const result = calculatePredictionResult(
            pred.homeScore, pred.awayScore,
            match.finalScore.home, match.finalScore.away,
            pred.savedAt, match, pred.odds, pred.joker || false
        );
        
        const pts = result.finalPoints || result.points;
        recap.basePoints += pts;
        
        const homeTeam = allTeams.find(t => t.id == pred.homeTeamId);
        const awayTeam = allTeams.find(t => t.id == pred.awayTeamId);
        
        recap.matches.push({
            homeTeam: homeTeam?.shortName || '?',
            awayTeam: awayTeam?.shortName || '?',
            predHome: pred.homeScore,
            predAway: pred.awayScore,
            realHome: match.finalScore.home,
            realAway: match.finalScore.away,
            points: pts,
            basePoints: result.points,
            class: result.class,
            label: result.label,
            joker: pred.joker || false,
            oddsMultiplier: result.oddsMultiplier
        });
        
        if (result.points === 9) recap.exact++;
        else if (result.points === 6) recap.close++;
        else if (result.points === 4) recap.good++;
        else if (result.points > 0) recap.correct++;
        else recap.wrong++;
    }
    
    recap.basePoints = Math.round(recap.basePoints * 10) / 10;
    recap.totalPoints = recap.basePoints;
    
    // --- Super Joker ---
    if (typeof getSuperJoker === 'function') {
        try {
            const sj = await getSuperJoker(playerId, season);
            if (sj && sj.used && sj.matchDay === matchDay) {
                const sjBonus = Math.round(recap.basePoints * 0.5 * 10) / 10;
                recap.bonuses.push({ type: 'superJoker', label: '🃏✨ Super Joker (×1.5)', points: sjBonus });
                recap.totalBonus += sjBonus;
            }
        } catch (e) {}
    }
    
    // --- Buteur ---
    if (typeof calculateScorerPointsForMatchDay === 'function') {
        try {
            if (predictions && predictions.predictions) {
                const scorerResult = calculateScorerPointsForMatchDay(predictions.predictions, matchDay);
                const scorerPts = scorerResult?.totalPoints || 0;
                if (scorerPts > 0) {
                    recap.bonuses.push({ type: 'scorer', label: '⚽ Défi buteur', points: scorerPts });
                    recap.totalBonus += scorerPts;
                }
                // Ajouter le détail par match
                if (scorerResult?.details) {
                    scorerResult.details.forEach(d => {
                        if (d.result?.participated) {
                            recap.bonuses.push({ 
                                type: 'scorerDetail', 
                                label: `  └ ${d.pick} (${d.match}) : ${d.result.label}`, 
                                points: d.result.points 
                            });
                        }
                    });
                }
            }
        } catch (e) {}
    }
    
    // --- Combiné ---
    if (typeof calculateCombineResult === 'function' && typeof getPlayerCombine === 'function') {
        try {
            const combine = await getPlayerCombine(playerId, season, matchDay);
            if (combine && combine.matches) {
                const combineResult = calculateCombineResult(combine, predictions.predictions, matchesThisDay);
                if (combineResult && combineResult.bonusPoints > 0) {
                    recap.bonuses.push({ type: 'combine', label: '🎲 Pari combiné', points: combineResult.bonusPoints });
                    recap.totalBonus += combineResult.bonusPoints;
                } else if (combineResult && !combineResult.success) {
                    recap.bonuses.push({ type: 'combine', label: '🎲 Pari combiné (raté)', points: 0 });
                }
            }
        } catch (e) {}
    }
    
    // --- MVP ---
    if (typeof getMVP === 'function') {
        try {
            const mvp = await getMVP(season, matchDay);
            if (mvp) {
                recap.mvpPseudo = mvp.pseudo;
                if (mvp.playerId === playerId) {
                    recap.isMVP = true;
                    recap.bonuses.push({ type: 'mvp', label: '🏆 MVP de la journée', points: MVP_BONUS_POINTS || 2 });
                    recap.totalBonus += MVP_BONUS_POINTS || 2;
                }
            }
        } catch (e) {}
    }
    
    // --- Défis IA + Buts totaux ---
    if (typeof calculateAllChallengePoints === 'function') {
        try {
            const challengeResult = await calculateAllChallengePoints(playerId, season, matchDay);
            if (challengeResult && challengeResult.points > 0) {
                recap.bonuses.push({ type: 'challenges', label: '🎲 Défis IA', points: challengeResult.points });
                recap.totalBonus += challengeResult.points;
            }
            if (challengeResult && challengeResult.details) {
                recap.challengeDetails = challengeResult.details;
            }
        } catch (e) {}
    }
    
    recap.totalBonus = Math.round(recap.totalBonus * 10) / 10;
    recap.totalPoints = Math.round((recap.basePoints + recap.totalBonus) * 10) / 10;
    
    // --- Classement de la journée ---
    try {
        const ranking = await getMatchDayRanking(matchDay);
        const playerData = ranking.players.find(p => p.playerId === playerId);
        if (playerData) {
            recap.rank = playerData.rank;
            recap.totalPlayers = ranking.players.length;
        }
    } catch (e) {}
    
    return recap;
}


// ===============================
// AFFICHAGE RÉCAP JOURNÉE
// (ex-pronostics-consolidation.js §5)
// ===============================

/**
 * Affiche le récap complet dans un conteneur
 */
function renderMatchDayRecap(recap) {
    if (!recap) return '<p style="text-align:center;color:#95a5a6;">Aucune donnée</p>';
    
    let html = `<div class="matchday-recap" style="max-width:600px;margin:0 auto;">`;
    
    // --- EN-TÊTE ---
    const rankLabel = recap.rank ? `${recap.rank}${recap.rank === 1 ? 'er' : 'e'} / ${recap.totalPlayers}` : '';
    
    html += `
        <div style="text-align:center;margin-bottom:1rem;">
            <h3 style="margin:0 0 0.25rem;color:#2c3e50;">📋 Journée ${recap.matchDay}</h3>
            ${rankLabel ? `<div style="font-size:0.9rem;color:#7f8c8d;">${rankLabel}</div>` : ''}
        </div>
    `;
    
    // --- SCORE TOTAL ---
    const hasBonuses = recap.bonuses.length > 0;
    
    html += `
        <div style="text-align:center;margin-bottom:1.25rem;padding:1rem;
                    background:linear-gradient(135deg,#667eea15,#764ba215);
                    border-radius:12px;">
            <div style="font-size:2.2rem;font-weight:bold;color:#667eea;">
                ${recap.totalPoints} <span style="font-size:1rem;color:#95a5a6;">pts</span>
            </div>
            ${hasBonuses ? `
                <div style="font-size:0.85rem;color:#7f8c8d;margin-top:0.25rem;">
                    Base ${recap.basePoints} + Bonus ${recap.totalBonus}
                </div>
            ` : ''}
            ${recap.isMVP ? `
                <div style="margin-top:0.5rem;font-size:1.1rem;">
                    🏆 <strong style="color:#f39c12;">MVP de la journée !</strong>
                </div>
            ` : ''}
        </div>
    `;
    
    // --- STATS RÉSUMÉ ---
    html += `
        <div style="display:flex;justify-content:center;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap;">
            ${recap.exact > 0 ? `<span style="background:#f39c1220;color:#f39c12;padding:0.25rem 0.6rem;border-radius:20px;font-size:0.85rem;font-weight:600;">🏆 ${recap.exact}</span>` : ''}
            ${recap.close > 0 ? `<span style="background:#9b59b620;color:#9b59b6;padding:0.25rem 0.6rem;border-radius:20px;font-size:0.85rem;font-weight:600;">🎯 ${recap.close}</span>` : ''}
            ${(recap.good + recap.correct) > 0 ? `<span style="background:#27ae6020;color:#27ae60;padding:0.25rem 0.6rem;border-radius:20px;font-size:0.85rem;font-weight:600;">✅ ${recap.good + recap.correct}</span>` : ''}
            ${recap.wrong > 0 ? `<span style="background:#e74c3c20;color:#e74c3c;padding:0.25rem 0.6rem;border-radius:20px;font-size:0.85rem;font-weight:600;">❌ ${recap.wrong}</span>` : ''}
        </div>
    `;
    
    // --- BONUS ---
    if (recap.bonuses.length > 0) {
        html += `<div style="margin-bottom:1rem;">`;
        recap.bonuses.forEach(b => {
            const color = b.points > 0 ? '#27ae60' : '#95a5a6';
            html += `
                <div style="display:flex;align-items:center;justify-content:space-between;
                            padding:0.4rem 0.75rem;margin-bottom:3px;
                            background:${b.points > 0 ? '#27ae6008' : '#f8f9fa'};
                            border-radius:6px;border-left:3px solid ${color};">
                    <span style="font-size:0.85rem;">${b.label}</span>
                    <span style="font-weight:bold;color:${color};">
                        ${b.points > 0 ? `+${b.points}` : '0'}
                    </span>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    // --- DÉTAIL DES MATCHS ---
    html += `<div style="display:flex;flex-direction:column;gap:4px;">`;
    
    recap.matches.forEach(m => {
        const bg = m.class === 'exact' ? '#f39c1210' : 
                   m.class === 'close' ? '#9b59b610' :
                   m.class === 'correct' ? '#27ae6008' : '#e74c3c08';
        const borderColor = m.class === 'exact' ? '#f39c12' : 
                            m.class === 'close' ? '#9b59b6' :
                            m.class === 'correct' ? '#27ae60' : '#e74c3c';
        
        html += `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;
                        background:${bg};border-left:3px solid ${borderColor};border-radius:6px;">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.85rem;font-weight:600;color:#2c3e50;">
                        ${m.homeTeam} ${m.realHome} - ${m.realAway} ${m.awayTeam}
                    </div>
                    <div style="font-size:0.75rem;color:#7f8c8d;">
                        Prono : ${m.predHome} - ${m.predAway}
                        ${m.joker ? ' 🃏' : ''}
                        ${m.oddsMultiplier > 1 ? ` · ×${m.oddsMultiplier}` : ''}
                    </div>
                </div>
                <div style="text-align:right;min-width:50px;">
                    <div style="font-weight:bold;color:${borderColor};">${m.points} pts</div>
                    <div style="font-size:0.7rem;color:#95a5a6;">${m.label.split(' ')[0]}</div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    
    // --- MVP INFO ---
    if (recap.mvpPseudo && !recap.isMVP) {
        html += `
            <div style="text-align:center;margin-top:1rem;font-size:0.85rem;color:#7f8c8d;">
                🏆 MVP : <strong>${recap.mvpPseudo}</strong>
            </div>
        `;
    }
    
    html += `</div>`;
    return html;
}