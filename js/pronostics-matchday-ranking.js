// pronostics-matchday-ranking.js - Classement par journée

// ===============================
// CLASSEMENT PAR JOURNÉE
// ===============================

/**
 * Récupère le classement détaillé pour une journée spécifique
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
    
    // Trier par points décroissants
    results.sort((a, b) => b.points - a.points);
    
    // Ajouter les rangs
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
                            <div class="podium-name">${player.pseudo}</div>
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
                                        <td>${player.pseudo}</td>
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
                <button class="btn-close" onclick="this.closest('.matchday-detail-modal').remove()">✕</button>
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