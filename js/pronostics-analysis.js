// pronostics-analysis.js - Head-to-head, Analyse post-match, Heatmap

// ===============================
// HEAD-TO-HEAD JOUEURS
// ===============================

async function renderDuelsTab() {
    const container = document.getElementById('duelsContent');
    if (!container) return;
    
    const players = await getAllPlayers();
    
    if (players.length < 2) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:2rem;">Il faut au moins 2 joueurs pour comparer</p>';
        return;
    }
    
    // Générer le HTML avec les sélecteurs
    container.innerHTML = `
        <div class="duels-header">
            <div class="duel-selector">
                <div class="duel-player">
                    <label>Joueur 1</label>
                    <select id="duelPlayer1">
                        ${players.map(p => `<option value="${p.id}">${p.pseudo}</option>`).join('')}
                    </select>
                </div>
                <div class="duel-vs">⚔️</div>
                <div class="duel-player">
                    <label>Joueur 2</label>
                    <select id="duelPlayer2">
                        ${players.map((p, i) => `<option value="${p.id}" ${i === 1 ? 'selected' : ''}>${p.pseudo}</option>`).join('')}
                    </select>
                </div>
            </div>
            <button class="btn btn-primary" onclick="comparePlayers()">Comparer</button>
        </div>
        <div id="duelResults" class="duel-results">
            <p style="text-align:center;color:#7f8c8d;">Sélectionnez 2 joueurs et cliquez sur Comparer</p>
        </div>
    `;
}

async function comparePlayers() {
    const player1Id = document.getElementById('duelPlayer1').value;
    const player2Id = document.getElementById('duelPlayer2').value;
    const container = document.getElementById('duelResults');
    
    if (player1Id === player2Id) {
        container.innerHTML = '<p style="text-align:center;color:#e74c3c;">⚠️ Sélectionnez deux joueurs différents</p>';
        return;
    }
    
    container.innerHTML = '<div class="loading">Chargement...</div>';
    
    try {
        const players = await getAllPlayers();
        const player1 = players.find(p => p.id === player1Id);
        const player2 = players.find(p => p.id === player2Id);
        
        // Récupérer les pronostics des deux joueurs
        const preds1 = await getAllPredictionsForPlayer(player1Id);
        const preds2 = await getAllPredictionsForPlayer(player2Id);
        
        // Trouver les matchs en commun (mêmes journées pronostiquées)
        const commonMatchDays = Object.keys(preds1).filter(day => preds2[day]);
        
        if (commonMatchDays.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#7f8c8d;">Aucune journée en commun</p>';
            return;
        }
        
        // Calculer les stats pour chaque journée commune
        let p1Wins = 0, p2Wins = 0, ties = 0;
        let p1TotalPoints = 0, p2TotalPoints = 0;
        let matchDetails = [];
        
        for (const matchDay of commonMatchDays.sort((a, b) => a - b)) {
            const matchesThisDay = allMatches.filter(m => m.matchDay == matchDay && m.finalScore);
            
            if (matchesThisDay.length === 0) continue;
            
            let p1DayPoints = 0, p2DayPoints = 0;
            let dayDetails = [];
            
            for (const match of matchesThisDay) {
                const pred1 = preds1[matchDay]?.find(p => 
                    p.homeTeamId == match.homeTeamId && p.awayTeamId == match.awayTeamId
                );
                const pred2 = preds2[matchDay]?.find(p => 
                    p.homeTeamId == match.homeTeamId && p.awayTeamId == match.awayTeamId
                );
                
                if (!pred1 || !pred2) continue;
                
                const result1 = calculatePredictionResult(
                    pred1.homeScore, pred1.awayScore,
                    match.finalScore.home, match.finalScore.away,
                    pred1.savedAt, match, pred1.odds, pred1.joker || false
                );
                const result2 = calculatePredictionResult(
                    pred2.homeScore, pred2.awayScore,
                    match.finalScore.home, match.finalScore.away,
                    pred2.savedAt, match, pred2.odds, pred2.joker || false
                );
                
                const pts1 = result1.finalPoints || result1.points;
                const pts2 = result2.finalPoints || result2.points;
                
                p1DayPoints += pts1;
                p2DayPoints += pts2;
                
                const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
                const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
                
                dayDetails.push({
                    match: `${homeTeam?.shortName} - ${awayTeam?.shortName}`,
                    score: `${match.finalScore.home}-${match.finalScore.away}`,
                    pred1: `${pred1.homeScore}-${pred1.awayScore}`,
                    pred2: `${pred2.homeScore}-${pred2.awayScore}`,
                    pts1: pts1,
                    pts2: pts2,
                    winner: pts1 > pts2 ? 1 : pts2 > pts1 ? 2 : 0
                });
            }
            
            // Bonus de la journée (Super Joker, buteur, combiné, défis, MVP) :
            // comptés comme dans le classement de journée
            if (typeof computeDayBonuses === 'function') {
                const dayNum = parseInt(matchDay);
                const b1 = await computeDayBonuses(player1Id, dayNum, preds1[matchDay], p1DayPoints);
                const b2 = await computeDayBonuses(player2Id, dayNum, preds2[matchDay], p2DayPoints);
                if (b1.total > 0 || b2.total > 0) {
                    dayDetails.push({
                        match: '🎁 Bonus journée',
                        score: '—',
                        pred1: formatDayBonuses(b1.parts) || '—',
                        pred2: formatDayBonuses(b2.parts) || '—',
                        pts1: b1.total,
                        pts2: b2.total,
                        winner: b1.total > b2.total ? 1 : b2.total > b1.total ? 2 : 0
                    });
                    p1DayPoints += b1.total;
                    p2DayPoints += b2.total;
                }
            }

            p1DayPoints = Math.round(p1DayPoints * 10) / 10;
            p2DayPoints = Math.round(p2DayPoints * 10) / 10;
            p1TotalPoints += p1DayPoints;
            p2TotalPoints += p2DayPoints;

            if (p1DayPoints > p2DayPoints) p1Wins++;
            else if (p2DayPoints > p1DayPoints) p2Wins++;
            else ties++;

            matchDetails.push({
                matchDay: matchDay,
                p1Points: p1DayPoints,
                p2Points: p2DayPoints,
                winner: p1DayPoints > p2DayPoints ? 1 : p2DayPoints > p1DayPoints ? 2 : 0,
                details: dayDetails
            });
        }
        
        // Générer le HTML des résultats
        const overallWinner = p1TotalPoints > p2TotalPoints ? 1 : p2TotalPoints > p1TotalPoints ? 2 : 0;
        
        container.innerHTML = `
            <div class="duel-summary">
                <div class="duel-player-card ${overallWinner === 1 ? 'winner' : ''}">
                    <div class="player-avatar">👤</div>
                    <div class="player-name">${player1.pseudo}</div>
                    <div class="player-total-points">${Math.round(p1TotalPoints * 10) / 10} pts</div>
                    <div class="player-wins">${p1Wins} journées gagnées</div>
                </div>
                
                <div class="duel-vs-result">
                    <div class="vs-score">${p1Wins} - ${ties} - ${p2Wins}</div>
                    <div class="vs-label">V - N - D</div>
                </div>
                
                <div class="duel-player-card ${overallWinner === 2 ? 'winner' : ''}">
                    <div class="player-avatar">👤</div>
                    <div class="player-name">${player2.pseudo}</div>
                    <div class="player-total-points">${Math.round(p2TotalPoints * 10) / 10} pts</div>
                    <div class="player-wins">${p2Wins} journées gagnées</div>
                </div>
            </div>
            
            <div class="duel-details">
                <h4>📊 Détail par journée</h4>
                <div class="duel-matchdays">
                    ${matchDetails.map(day => `
                        <div class="duel-matchday ${day.winner === 1 ? 'p1-win' : day.winner === 2 ? 'p2-win' : 'tie'}">
                            <div class="matchday-header" onclick="toggleDuelDetails(${day.matchDay})">
                                <span class="matchday-label">J${day.matchDay}</span>
                                <span class="matchday-score">
                                    <span class="${day.winner === 1 ? 'winner' : ''}">${day.p1Points}</span>
                                    -
                                    <span class="${day.winner === 2 ? 'winner' : ''}">${day.p2Points}</span>
                                </span>
                                <span class="matchday-toggle">▼</span>
                            </div>
                            <div class="matchday-details" id="duelDetails${day.matchDay}" style="display:none;">
                                ${day.details.map(d => `
                                    <div class="match-detail">
                                        <span class="match-info">${d.match} (${d.score})</span>
                                        <span class="match-preds">
                                            <span class="${d.winner === 1 ? 'winner' : ''}">${d.pred1} (${d.pts1})</span>
                                            vs
                                            <span class="${d.winner === 2 ? 'winner' : ''}">${d.pred2} (${d.pts2})</span>
                                        </span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Erreur comparaison:', error);
        container.innerHTML = '<p style="text-align:center;color:#e74c3c;">Erreur lors de la comparaison</p>';
    }
}

function toggleDuelDetails(matchDay) {
    const details = document.getElementById(`duelDetails${matchDay}`);
    const isVisible = details.style.display !== 'none';
    details.style.display = isVisible ? 'none' : 'block';
}

// ===============================
// ANALYSE POST-MATCH (IA vs Joueur)
// ===============================

async function calculateIAComparison(playerId, matchDay) {
    try {
        // Récupérer les pronostics du joueur
        const allPlayerPreds = await getAllPredictionsForPlayer(playerId);
        if (!allPlayerPreds || !allPlayerPreds[matchDay]) return null;
        
        const playerPreds = { [matchDay]: allPlayerPreds[matchDay] };
        
        // Récupérer les pronostics de l'IA
        const iaPredictions = JSON.parse(localStorage.getItem(`footballEloIAPredictions_${currentSeason}`));
        if (!iaPredictions || !iaPredictions.matchDays[matchDay]) return null;
        
        const matchesThisDay = allMatches.filter(m => m.matchDay == matchDay && m.finalScore);
        if (matchesThisDay.length === 0) return null;
        
        let playerPoints = 0;
        let iaPoints = 0;
        let ifFollowedIA = 0; // Points si le joueur avait suivi l'IA
        let matchComparisons = [];
        
        for (const match of matchesThisDay) {
            const playerPred = playerPreds[matchDay]?.find(p => 
                p.homeTeamId == match.homeTeamId && p.awayTeamId == match.awayTeamId
            );
            const iaPred = iaPredictions.matchDays[matchDay].predictions.find(p =>
                p.homeTeamId == match.homeTeamId && p.awayTeamId == match.awayTeamId
            );
            
            if (!playerPred || !iaPred) continue;
            
            const playerResult = calculatePredictionResult(
                playerPred.homeScore, playerPred.awayScore,
                match.finalScore.home, match.finalScore.away,
                null, match
            );
            const iaResult = calculatePredictionResult(
                iaPred.homeScore, iaPred.awayScore,
                match.finalScore.home, match.finalScore.away,
                null, match
            );
            
            const pPts = playerResult.finalPoints || playerResult.points;
            const iPts = iaResult.finalPoints || iaResult.points;
            
            playerPoints += pPts;
            iaPoints += iPts;
            ifFollowedIA += iPts;
            
            const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
            const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
            
            matchComparisons.push({
                match: `${homeTeam?.shortName}-${awayTeam?.shortName}`,
                score: `${match.finalScore.home}-${match.finalScore.away}`,
                playerPred: `${playerPred.homeScore}-${playerPred.awayScore}`,
                iaPred: `${iaPred.homeScore}-${iaPred.awayScore}`,
                playerPts: pPts,
                iaPts: iPts,
                diff: iPts - pPts
            });
        }
        
        const diff = ifFollowedIA - playerPoints;
        
        return {
            playerPoints: Math.round(playerPoints * 10) / 10,
            iaPoints: Math.round(iaPoints * 10) / 10,
            ifFollowedIA: Math.round(ifFollowedIA * 10) / 10,
            diff: Math.round(diff * 10) / 10,
            matchComparisons: matchComparisons
        };
    } catch (error) {
        console.error('Erreur calcul comparaison IA:', error);
        return null;
    }
}

function renderIAComparisonSummary(comparison) {
    if (!comparison) return '';
    
    const diffClass = comparison.diff > 0 ? 'positive' : comparison.diff < 0 ? 'negative' : 'neutral';
    const diffText = comparison.diff > 0 
        ? `+${comparison.diff} pts` 
        : comparison.diff < 0 
            ? `${comparison.diff} pts` 
            : '0 pts';
    const diffMessage = comparison.diff > 0 
        ? "🤖 Si tu avais suivi l'IA, tu aurais gagné plus !" 
        : comparison.diff < 0 
            ? "🎉 Tu as fait mieux que l'IA !" 
            : "🤝 Égalité avec l'IA";
    
    return `
        <div class="ia-comparison-summary">
            <div class="comparison-header">
                <span class="comparison-icon">🤖</span>
                <span class="comparison-title">Comparaison avec l'IA</span>
            </div>
            <div class="comparison-stats">
                <div class="comparison-stat">
                    <span class="stat-label">Tes points</span>
                    <span class="stat-value">${comparison.playerPoints}</span>
                </div>
                <div class="comparison-stat">
                    <span class="stat-label">Points IA</span>
                    <span class="stat-value">${comparison.iaPoints}</span>
                </div>
                <div class="comparison-stat ${diffClass}">
                    <span class="stat-label">Différence</span>
                    <span class="stat-value">${diffText}</span>
                </div>
            </div>
            <div class="comparison-message ${diffClass}">${diffMessage}</div>
            <details class="comparison-details">
                <summary>📊 Voir le détail par match</summary>
                <div class="comparison-matches">
                    ${comparison.matchComparisons.map(m => `
                        <div class="comparison-match ${m.diff > 0 ? 'ia-better' : m.diff < 0 ? 'player-better' : ''}">
                            <span class="match-name">${m.match} (${m.score})</span>
                            <span class="match-pred">Toi: ${m.playerPred} (${m.playerPts})</span>
                            <span class="match-pred">IA: ${m.iaPred} (${m.iaPts})</span>
                        </div>
                    `).join('')}
                </div>
            </details>
        </div>
    `;
}

// ===============================
// HEATMAP TEMPORELLE
// ===============================

async function renderHeatmapTab() {
    const container = document.getElementById('heatmapContent');
    if (!container) return;
    
    if (!currentPlayer) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:2rem;">Connectez-vous pour voir votre heatmap</p>';
        return;
    }
    
    container.innerHTML = '<div class="loading">Chargement de la heatmap...</div>';
    
    try {
        const players = await getAllPlayers();
        const playerPreds = await getAllPredictionsForPlayer(currentPlayer.id);
        
        if (!playerPreds || Object.keys(playerPreds).length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:2rem;">Aucun pronostic enregistré</p>';
            return;
        }
        
        // Calculer les données pour la heatmap
        const matchDays = Object.keys(playerPreds).map(Number).sort((a, b) => a - b);
        const heatmapData = [];
        
        for (const matchDay of matchDays) {
            const matchesThisDay = allMatches.filter(m => m.matchDay == matchDay && m.finalScore);
            if (matchesThisDay.length === 0) continue;
            
            let dayPoints = 0;
            let exactCount = 0;
            let goodCount = 0;
            let wrongCount = 0;
            let totalMatches = 0;
            
            for (const match of matchesThisDay) {
                const pred = playerPreds[matchDay]?.find(p => 
                    p.homeTeamId == match.homeTeamId && p.awayTeamId == match.awayTeamId
                );
                
                if (!pred) continue;
                totalMatches++;
                
                const result = calculatePredictionResult(
                    pred.homeScore, pred.awayScore,
                    match.finalScore.home, match.finalScore.away,
                    pred.savedAt, match, pred.odds, pred.joker || false
                );

                const pts = result.finalPoints || result.points;
                dayPoints += pts;

                if (result.points === 9) exactCount++;
                else if (result.points >= 3) goodCount++;
                else wrongCount++;
            }

            // Total de la journée = matchs + tous les bonus (Super Joker,
            // buteur, combiné, défis, MVP), comme au classement de journée
            if (typeof computeDayBonuses === 'function') {
                const bonuses = await computeDayBonuses(currentPlayer.id, matchDay, playerPreds[matchDay], dayPoints);
                dayPoints += bonuses.total;
            }

            heatmapData.push({
                matchDay: matchDay,
                points: Math.round(dayPoints * 10) / 10,
                exact: exactCount,
                good: goodCount,
                wrong: wrongCount,
                total: totalMatches,
                rate: totalMatches > 0 ? Math.round((exactCount + goodCount) / totalMatches * 100) : 0
            });
        }
        
        // Calculer min/max pour les couleurs
        const maxPoints = Math.max(...heatmapData.map(d => d.points));
        const minPoints = Math.min(...heatmapData.map(d => d.points));
        
        // Générer le sélecteur de joueur pour comparaison
        const playerOptions = players
            .filter(p => p.id !== currentPlayer.id)
            .map(p => `<option value="${p.id}">${p.pseudo}</option>`)
            .join('');
        
        container.innerHTML = `
            <div class="heatmap-header">
                <h4>🔥 Performance par Journée</h4>
                <div class="heatmap-legend">
                    <span class="legend-item bad">Faible</span>
                    <span class="legend-gradient"></span>
                    <span class="legend-item good">Fort</span>
                </div>
            </div>
            
            <div class="heatmap-grid">
                ${heatmapData.map(day => {
                    const intensity = maxPoints > minPoints 
                        ? (day.points - minPoints) / (maxPoints - minPoints) 
                        : 0.5;
                    const bgColor = getHeatmapColor(intensity);
                    
                    return `
                        <div class="heatmap-cell" style="background: ${bgColor};" 
                             title="J${day.matchDay}: ${day.points} pts (${day.rate}% réussite)">
                            <span class="cell-day">J${day.matchDay}</span>
                            <span class="cell-points">${day.points}</span>
                            <span class="cell-rate">${day.rate}%</span>
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="heatmap-stats">
                <div class="heatmap-stat">
                    <span class="stat-icon">🏆</span>
                    <span class="stat-value">${Math.max(...heatmapData.map(d => d.points))}</span>
                    <span class="stat-label">Meilleure journée</span>
                </div>
                <div class="heatmap-stat">
                    <span class="stat-icon">📉</span>
                    <span class="stat-value">${Math.min(...heatmapData.map(d => d.points))}</span>
                    <span class="stat-label">Pire journée</span>
                </div>
                <div class="heatmap-stat">
                    <span class="stat-icon">📊</span>
                    <span class="stat-value">${Math.round(heatmapData.reduce((sum, d) => sum + d.points, 0) / heatmapData.length * 10) / 10}</span>
                    <span class="stat-label">Moyenne/journée</span>
                </div>
                <div class="heatmap-stat">
                    <span class="stat-icon">🎯</span>
                    <span class="stat-value">${heatmapData.reduce((sum, d) => sum + d.exact, 0)}</span>
                    <span class="stat-label">Scores exacts</span>
                </div>
            </div>
            
            ${playerOptions ? `
                <div class="heatmap-compare">
                    <h4>📊 Comparer avec un autre joueur</h4>
                    <div class="compare-selector">
                        <select id="heatmapComparePlayer">
                            <option value="">-- Choisir un joueur --</option>
                            ${playerOptions}
                        </select>
                        <button class="btn btn-secondary" onclick="compareHeatmaps()">Comparer</button>
                    </div>
                    <div id="heatmapComparison"></div>
                </div>
            ` : ''}
        `;
    } catch (error) {
        console.error('Erreur heatmap:', error);
        container.innerHTML = '<p style="text-align:center;color:#e74c3c;">Erreur lors du chargement</p>';
    }
}

function getHeatmapColor(intensity) {
    // Du rouge (faible) au vert (fort)
    const r = Math.round(220 - intensity * 170);
    const g = Math.round(80 + intensity * 140);
    const b = Math.round(80);
    return `rgb(${r}, ${g}, ${b})`;
}

async function compareHeatmaps() {
    const comparePlayerId = document.getElementById('heatmapComparePlayer').value;
    const container = document.getElementById('heatmapComparison');
    
    if (!comparePlayerId) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = '<div class="loading">Chargement...</div>';
    
    try {
        const players = await getAllPlayers();
        const comparePlayer = players.find(p => p.id === comparePlayerId);
        
        const myPreds = await getAllPredictionsForPlayer(currentPlayer.id);
        const theirPreds = await getAllPredictionsForPlayer(comparePlayerId);
        
        // Trouver les journées communes
        const commonDays = Object.keys(myPreds)
            .filter(day => theirPreds[day])
            .map(Number)
            .sort((a, b) => a - b);
        
        if (commonDays.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#7f8c8d;">Aucune journée en commun</p>';
            return;
        }
        
        let myWins = 0, theirWins = 0, ties = 0;
        let comparisonRows = [];
        
        for (const day of commonDays) {
            const matches = allMatches.filter(m => m.matchDay == day && m.finalScore);
            
            let myPoints = 0, theirPoints = 0;
            
            for (const match of matches) {
                const myPred = myPreds[day]?.find(p => 
                    p.homeTeamId == match.homeTeamId && p.awayTeamId == match.awayTeamId
                );
                const theirPred = theirPreds[day]?.find(p => 
                    p.homeTeamId == match.homeTeamId && p.awayTeamId == match.awayTeamId
                );
                
                if (myPred) {
                    const r = calculatePredictionResult(myPred.homeScore, myPred.awayScore,
                        match.finalScore.home, match.finalScore.away, myPred.savedAt, match, myPred.odds, myPred.joker || false);
                    myPoints += r.finalPoints || r.points;
                }
                if (theirPred) {
                    const r = calculatePredictionResult(theirPred.homeScore, theirPred.awayScore,
                        match.finalScore.home, match.finalScore.away, theirPred.savedAt, match, theirPred.odds, theirPred.joker || false);
                    theirPoints += r.finalPoints || r.points;
                }
            }

            // Bonus de la journée pour les deux joueurs (mêmes règles que le
            // classement de journée)
            if (typeof computeDayBonuses === 'function') {
                myPoints += (await computeDayBonuses(currentPlayer.id, day, myPreds[day], myPoints)).total;
                theirPoints += (await computeDayBonuses(comparePlayerId, day, theirPreds[day], theirPoints)).total;
            }

            if (myPoints > theirPoints) myWins++;
            else if (theirPoints > myPoints) theirWins++;
            else ties++;
            
            comparisonRows.push({
                day: day,
                myPoints: Math.round(myPoints * 10) / 10,
                theirPoints: Math.round(theirPoints * 10) / 10,
                winner: myPoints > theirPoints ? 'me' : theirPoints > myPoints ? 'them' : 'tie'
            });
        }
        
        container.innerHTML = `
            <div class="comparison-result">
                <div class="comparison-score">
                    <span class="score-player">${currentPlayer.pseudo}</span>
                    <span class="score-vs">${myWins} - ${ties} - ${theirWins}</span>
                    <span class="score-player">${comparePlayer.pseudo}</span>
                </div>
                <div class="comparison-bars">
                    ${comparisonRows.map(row => `
                        <div class="comparison-bar-row">
                            <span class="bar-day">J${row.day}</span>
                            <div class="bar-container">
                                <div class="bar-left ${row.winner === 'me' ? 'winner' : ''}" 
                                     style="width: ${row.myPoints / Math.max(row.myPoints, row.theirPoints) * 100}%">
                                    ${row.myPoints}
                                </div>
                                <div class="bar-right ${row.winner === 'them' ? 'winner' : ''}"
                                     style="width: ${row.theirPoints / Math.max(row.myPoints, row.theirPoints) * 100}%">
                                    ${row.theirPoints}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Erreur comparaison heatmap:', error);
        container.innerHTML = '<p style="text-align:center;color:#e74c3c;">Erreur</p>';
    }
}

// ===============================
// HELPER: Récupérer TOUS les pronostics d'un joueur (pour analyse)
// ===============================

async function getAllPredictionsForPlayer(playerId) {
    try {
        // Essayer Firebase d'abord
        if (typeof db !== 'undefined') {
            const snapshot = await db.collection('pronostics')
                .where('playerId', '==', playerId)
                .get();
            
            // Ne garder que la saison en cours : la heatmap et les duels
            // mélangeaient sinon les journées des saisons passées.
            const season = (typeof currentSeason !== 'undefined' && currentSeason) ? currentSeason : null;
            const predictions = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (season && data.season && data.season !== season) return;
                if (data.matchDay && data.predictions) {
                    predictions[data.matchDay] = data.predictions;
                }
            });
            return predictions;
        }
        
        // Fallback localStorage
        const stored = localStorage.getItem(`footballEloPredictions_${playerId}`);
        if (stored) {
            const data = JSON.parse(stored);
            return data.matchDays || {};
        }
        
        return {};
    } catch (error) {
        console.error('Erreur récupération pronostics:', error);
        return {};
    }
}

// ===============================
// INITIALISATION DES ONGLETS
// ===============================

function initAnalysisTabs() {
    // Ajouter les event listeners pour les nouveaux onglets
    document.querySelectorAll('.game-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            
            if (tabName === 'duels') {
                renderDuelsTab();
            } else if (tabName === 'heatmap') {
                renderHeatmapTab();
            }
        });
    });
}

// Auto-init si le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalysisTabs);
} else {
    initAnalysisTabs();
}

console.log('📊 Module pronostics-analysis chargé');