// pronostics-ia.js - Comparaison IA vs Joueurs

// ===============================
// GESTION DES PRONOSTICS IA
// ===============================

const IA_PLAYER_ID = 'ia_claude';
const IA_PLAYER_PSEUDO = '🤖 Claude IA';

// Récupérer les pronostics IA stockés
async function getIAPredictions(season) {
    try {
        const stored = localStorage.getItem(`footballEloIAPredictions_${season}`);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.error('Erreur getIAPredictions:', e);
        return null;
    }
}

// Sauvegarder les pronostics IA
async function saveIAPredictions(season, predictions) {
    try {
        localStorage.setItem(`footballEloIAPredictions_${season}`, JSON.stringify(predictions));
    } catch (e) {
        console.error('Erreur saveIAPredictions:', e);
    }
}

// Générer les pronostics IA pour une journée (appelé depuis calendar-predictions.js)
function generateIAPredictionForMatch(match, teamsWithElo) {
    const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
    
    if (!homeTeam || !awayTeam) return null;
    
    // Récupérer les Elo
    const homeEloData = teamsWithElo.find(t => t.id == match.homeTeamId);
    const awayEloData = teamsWithElo.find(t => t.id == match.awayTeamId);
    
    const homeElo = homeEloData?.eloRating || 1500;
    const awayElo = awayEloData?.eloRating || 1500;
    
    // Avantage domicile
    const homeAdvantage = 65;
    const adjustedHomeElo = homeElo + homeAdvantage;
    
    // Probabilité de victoire
    const homeExpectancy = 1 / (1 + Math.pow(10, (awayElo - adjustedHomeElo) / 400));
    
    // Probabilité de nul
    const eloDiff = Math.abs(adjustedHomeElo - awayElo);
    let drawProb = Math.max(0.18, 0.32 - (eloDiff / 800));
    
    // Probabilités ajustées
    let homeWinProb = homeExpectancy * (1 - drawProb);
    let awayWinProb = (1 - homeExpectancy) * (1 - drawProb);
    
    // Déterminer le résultat le plus probable
    let result;
    if (homeWinProb > drawProb && homeWinProb > awayWinProb) {
        result = 'home';
    } else if (awayWinProb > drawProb && awayWinProb > homeWinProb) {
        result = 'away';
    } else {
        result = 'draw';
    }
    
    // Générer un score réaliste
    let homeScore, awayScore;
    
    if (result === 'home') {
        // Domination à domicile
        if (homeWinProb > 0.5) {
            homeScore = 2; awayScore = 0;
        } else if (homeWinProb > 0.35) {
            homeScore = 2; awayScore = 1;
        } else {
            homeScore = 1; awayScore = 0;
        }
    } else if (result === 'away') {
        // Victoire extérieur
        if (awayWinProb > 0.4) {
            homeScore = 0; awayScore = 2;
        } else if (awayWinProb > 0.25) {
            homeScore = 1; awayScore = 2;
        } else {
            homeScore = 0; awayScore = 1;
        }
    } else {
        // Match nul
        if (eloDiff < 50) {
            homeScore = 1; awayScore = 1;
        } else {
            homeScore = 0; awayScore = 0;
        }
    }
    
    return {
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeScore: homeScore,
        awayScore: awayScore,
        homeElo: homeElo,
        awayElo: awayElo,
        homeWinProb: Math.round(homeWinProb * 100),
        drawProb: Math.round(drawProb * 100),
        awayWinProb: Math.round(awayWinProb * 100),
        generatedAt: new Date().toISOString()
    };
}

// Générer tous les pronostics IA pour les matchs à venir
async function generateAllIAPredictions() {
    if (!currentSeason) return;
    
    // Récupérer les équipes avec Elo
    let teamsWithElo = [];
    if (typeof EloSystem !== 'undefined') {
        teamsWithElo = EloSystem.initializeTeamsElo(allTeams);
        const sortedMatches = [...allMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
        sortedMatches.forEach(match => {
            EloSystem.processMatch(match, teamsWithElo);
        });
    }
    
    // Trouver les journées à venir
    const lastPlayedMatchDay = Math.max(0, ...allMatches.map(m => m.matchDay || 0));
    
    // Récupérer les pronostics existants
    let iaPredictions = await getIAPredictions(currentSeason) || {
        season: currentSeason,
        generatedAt: new Date().toISOString(),
        matchDays: {}
    };
    
    // Générer pour chaque journée à venir
    for (const match of futureMatches) {
        const matchDay = match.matchDay;
        
        // Ne pas regénérer si déjà fait
        if (iaPredictions.matchDays[matchDay]) {
            const existingPred = iaPredictions.matchDays[matchDay].predictions.find(p => 
                p.homeTeamId == match.homeTeamId && p.awayTeamId == match.awayTeamId
            );
            if (existingPred) continue;
        }
        
        // Initialiser la journée si nécessaire
        if (!iaPredictions.matchDays[matchDay]) {
            iaPredictions.matchDays[matchDay] = {
                predictions: [],
                generatedAt: new Date().toISOString()
            };
        }
        
        // Générer le pronostic
        const prediction = generateIAPredictionForMatch(match, teamsWithElo);
        if (prediction) {
            iaPredictions.matchDays[matchDay].predictions.push(prediction);
        }
    }
    
    // Sauvegarder
    await saveIAPredictions(currentSeason, iaPredictions);
    
    return iaPredictions;
}

// ===============================
// CALCUL DES RÉSULTATS IA
// ===============================

async function calculateIAResults(matchDay) {
    const iaPredictions = await getIAPredictions(currentSeason);
    if (!iaPredictions || !iaPredictions.matchDays[matchDay]) {
        return null;
    }
    
    const predictions = iaPredictions.matchDays[matchDay].predictions;
    const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay);
    
    let results = {
        totalPoints: 0,
        exactScores: 0,
        closeScores: 0,
        correctResults: 0,
        wrongResults: 0,
        matches: []
    };
    
    for (const pred of predictions) {
        const match = matchesThisDay.find(m => 
            m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
        );
        
        if (!match || !match.finalScore) continue;
        
        const result = calculatePredictionResult(
            pred.homeScore, pred.awayScore,
            match.finalScore.home, match.finalScore.away,
            pred.generatedAt,
            match
        );
        
        results.totalPoints += result.points;
        
        if (result.points === 9) results.exactScores++;
        else if (result.points === 6) results.closeScores++;
        else if (result.points > 0) results.correctResults++;
        else results.wrongResults++;
        
        const homeTeam = allTeams.find(t => t.id == pred.homeTeamId);
        const awayTeam = allTeams.find(t => t.id == pred.awayTeamId);
        
        results.matches.push({
            homeTeam: homeTeam?.shortName || '?',
            awayTeam: awayTeam?.shortName || '?',
            prediction: `${pred.homeScore}-${pred.awayScore}`,
            actual: `${match.finalScore.home}-${match.finalScore.away}`,
            points: result.points,
            class: result.class
        });
    }
    
    return results;
}

// Calculer les stats globales de l'IA
async function calculateIAGlobalStats() {
    const iaPredictions = await getIAPredictions(currentSeason);
    if (!iaPredictions) return null;
    
    let stats = {
        totalPoints: 0,
        totalPredictions: 0,
        exactScores: 0,
        closeScores: 0,
        correctResults: 0,
        wrongResults: 0,
        pointsByMatchDay: {},
        cumulativePoints: {}
    };
    
    const matchDays = Object.keys(iaPredictions.matchDays).map(Number).sort((a, b) => a - b);
    let cumulative = 0;
    
    for (const matchDay of matchDays) {
        const results = await calculateIAResults(matchDay);
        if (!results) continue;
        
        stats.totalPoints += results.totalPoints;
        stats.totalPredictions += results.matches.length;
        stats.exactScores += results.exactScores;
        stats.closeScores += results.closeScores;
        stats.correctResults += results.correctResults;
        stats.wrongResults += results.wrongResults;
        
        stats.pointsByMatchDay[matchDay] = results.totalPoints;
        cumulative += results.totalPoints;
        stats.cumulativePoints[matchDay] = cumulative;
    }
    
    return stats;
}

// ===============================
// AFFICHAGE COMPARAISON IA VS JOUEURS
// ===============================

async function displayIAComparison() {
    const container = document.getElementById('iaComparisonContent');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Chargement...</div>';
    
    try {
        // Générer les pronostics IA si pas encore fait
        await generateAllIAPredictions();
        
        // Stats IA
        const iaStats = await calculateIAGlobalStats();
        
        // Stats des joueurs
        const players = await getAllPlayers();
        const playersStats = [];
        
        for (const player of players) {
            const stats = await calculatePlayerDetailedStats(player.id);
            playersStats.push({
                id: player.id,
                pseudo: player.pseudo,
                stats: stats
            });
        }
        
        // Trier par points
        playersStats.sort((a, b) => b.stats.totalPoints - a.stats.totalPoints);
        
        // Trouver la position de l'IA dans le classement
        let iaRank = 1;
        if (iaStats) {
            for (const p of playersStats) {
                if (p.stats.totalPoints > iaStats.totalPoints) {
                    iaRank++;
                }
            }
        }
        
        // Calculer le taux de réussite
        const iaSuccessRate = iaStats && iaStats.totalPredictions > 0
            ? Math.round((iaStats.totalPredictions - iaStats.wrongResults) / iaStats.totalPredictions * 100)
            : 0;
        
        // Générer le HTML
        let html = `
            <div class="ia-comparison-header">
                <div class="ia-card">
                    <div class="ia-avatar">🤖</div>
                    <div class="ia-info">
                        <h3>Claude IA</h3>
                        <p>Pronostics basés sur l'Elo</p>
                    </div>
                </div>
                <div class="ia-stats-grid">
                    <div class="ia-stat">
                        <span class="value">${iaStats?.totalPoints || 0}</span>
                        <span class="label">Points</span>
                    </div>
                    <div class="ia-stat">
                        <span class="value">${iaRank}${iaRank === 1 ? 'er' : 'e'}</span>
                        <span class="label">Rang</span>
                    </div>
                    <div class="ia-stat">
                        <span class="value">${iaSuccessRate}%</span>
                        <span class="label">Réussite</span>
                    </div>
                    <div class="ia-stat">
                        <span class="value">${iaStats?.exactScores || 0}</span>
                        <span class="label">🎯 Exacts</span>
                    </div>
                </div>
            </div>
            
            <div class="ia-vs-section">
                <h4>📊 Classement IA vs Joueurs</h4>
                <table class="ia-leaderboard">
                    <thead>
                        <tr>
                            <th>Rang</th>
                            <th>Joueur</th>
                            <th>Points</th>
                            <th>🎯</th>
                            <th>✅</th>
                            <th>❌</th>
                            <th>%</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Combiner IA et joueurs, puis trier
        const combined = [
            {
                id: IA_PLAYER_ID,
                pseudo: IA_PLAYER_PSEUDO,
                isIA: true,
                stats: iaStats || { totalPoints: 0, exactScores: 0, correctResults: 0, wrongResults: 0, totalPredictions: 0 }
            },
            ...playersStats.map(p => ({
                id: p.id,
                pseudo: p.pseudo,
                isIA: false,
                stats: p.stats
            }))
        ].sort((a, b) => b.stats.totalPoints - a.stats.totalPoints);
        
        combined.forEach((player, index) => {
            const rank = index + 1;
            const stats = player.stats;
            const successRate = stats.totalPredictions > 0
                ? Math.round((stats.totalPredictions - stats.wrongResults) / stats.totalPredictions * 100)
                : 0;
            
            let rankIcon = rank;
            if (rank === 1) rankIcon = '🥇';
            else if (rank === 2) rankIcon = '🥈';
            else if (rank === 3) rankIcon = '🥉';
            
            const rowClass = player.isIA ? 'ia-row' : (currentPlayer && player.id === currentPlayer.id ? 'current-player' : '');
            
            html += `
                <tr class="${rowClass}">
                    <td><span class="rank-icon">${rankIcon}</span></td>
                    <td>${player.pseudo}</td>
                    <td><strong>${stats.totalPoints}</strong></td>
                    <td>${stats.exactScores + (stats.closeScores || 0)}</td>
                    <td>${(stats.goodScores || 0) + stats.correctResults}</td>
                    <td>${stats.wrongResults}</td>
                    <td>${successRate}%</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Section détail par journée
        html += `
            <div class="ia-matchday-section">
                <h4>📅 Détail par journée</h4>
                <div class="ia-matchday-select">
                    <select id="iaMatchDaySelect">
                        <option value="">Sélectionner une journée</option>
        `;
        
        const iaPredictions = await getIAPredictions(currentSeason);
        if (iaPredictions) {
            const days = Object.keys(iaPredictions.matchDays).sort((a, b) => b - a);
            days.forEach(day => {
                html += `<option value="${day}">Journée ${day}</option>`;
            });
        }
        
        html += `
                    </select>
                </div>
                <div id="iaMatchDayDetail"></div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Événement changement de journée
        document.getElementById('iaMatchDaySelect')?.addEventListener('change', async (e) => {
            const matchDay = parseInt(e.target.value);
            if (matchDay) {
                await displayIAMatchDayDetail(matchDay);
            } else {
                document.getElementById('iaMatchDayDetail').innerHTML = '';
            }
        });
        
    } catch (error) {
        console.error('Erreur displayIAComparison:', error);
        container.innerHTML = '<p style="text-align:center;color:#e74c3c;">Erreur de chargement</p>';
    }
}

async function displayIAMatchDayDetail(matchDay) {
    const container = document.getElementById('iaMatchDayDetail');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Chargement...</div>';
    
    try {
        // Résultats IA
        const iaResults = await calculateIAResults(matchDay);
        
        // Résultats des joueurs
        const playersResults = await getMatchDayLeaderboard(matchDay);
        
        let html = `
            <div class="matchday-comparison">
                <div class="matchday-summary">
                    <div class="summary-card ia">
                        <span class="summary-icon">🤖</span>
                        <span class="summary-name">Claude IA</span>
                        <span class="summary-points">${iaResults?.totalPoints || 0} pts</span>
                    </div>
        `;
        
        // Top 3 joueurs
        playersResults.slice(0, 3).forEach((player, index) => {
            const icons = ['🥇', '🥈', '🥉'];
            html += `
                <div class="summary-card player">
                    <span class="summary-icon">${icons[index]}</span>
                    <span class="summary-name">${player.pseudo}</span>
                    <span class="summary-points">${player.points} pts</span>
                </div>
            `;
        });
        
        html += `
                </div>
        `;
        
        // Détail des matchs IA
        if (iaResults && iaResults.matches.length > 0) {
            html += `
                <div class="ia-matches-detail">
                    <h5>🤖 Pronostics de l'IA</h5>
                    <div class="ia-matches-grid">
            `;
            
            iaResults.matches.forEach(match => {
                html += `
                    <div class="ia-match-card ${match.class}">
                        <div class="match-teams">${match.homeTeam} - ${match.awayTeam}</div>
                        <div class="match-scores">
                            <span class="prono">Prono: ${match.prediction}</span>
                            <span class="actual">Réel: ${match.actual}</span>
                        </div>
                        <div class="match-points">${match.points} pts</div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        html += `</div>`;
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Erreur displayIAMatchDayDetail:', error);
        container.innerHTML = '<p style="text-align:center;color:#e74c3c;">Erreur</p>';
    }
}