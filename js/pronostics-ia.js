// pronostics-ia.js - Comparaison IA vs Joueurs
// Version compatible avec elo.js (utilise recalculateAllEloRatings)

// ===============================
// CONSTANTES
// ===============================

const IA_PLAYER_ID = 'ia_claude';
const IA_PLAYER_PSEUDO = '🤖 Claude IA';

// ===============================
// STOCKAGE DES PRONOSTICS IA
// ===============================

async function getIAPredictions(season) {
    try {
        const stored = localStorage.getItem(`footballEloIAPredictions_${season}`);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.error('Erreur getIAPredictions:', e);
        return null;
    }
}

async function saveIAPredictions(season, predictions) {
    try {
        localStorage.setItem(`footballEloIAPredictions_${season}`, JSON.stringify(predictions));
    } catch (e) {
        console.error('Erreur saveIAPredictions:', e);
    }
}

// ===============================
// CALCUL ELO BASÉ SUR LES MATCHS JOUÉS
// Compatible avec elo.js
// ===============================

function calculateEloAtDate(targetDate, allMatchesData, teamsData) {
    if (typeof EloSystem === 'undefined' || !EloSystem.recalculateAllEloRatings) {
        // Retourner les équipes avec Elo par défaut
        return teamsData.map(t => ({ ...t, eloRating: 1500 }));
    }
    
    // Récupérer tous les matchs JOUÉS (avec finalScore) AVANT la date cible
    const playedMatchesBefore = allMatchesData
        .filter(m => m.finalScore)
        .filter(m => {
            if (m.scheduledAt) {
                return new Date(m.scheduledAt) < new Date(targetDate);
            }
            // Si pas de date scheduledAt, on regarde la date du match ou on l'inclut
            if (m.date) {
                return new Date(m.date) < new Date(targetDate);
            }
            return true;
        });
    
    // Utiliser recalculateAllEloRatings de elo.js
    const teamsWithElo = EloSystem.recalculateAllEloRatings(teamsData, playedMatchesBefore);
    
    return teamsWithElo;
}

function calculateCurrentElo(allMatchesData, teamsData) {
    if (typeof EloSystem === 'undefined' || !EloSystem.recalculateAllEloRatings) {
        return teamsData.map(t => ({ ...t, eloRating: 1500 }));
    }
    
    // Tous les matchs joués
    const playedMatches = allMatchesData.filter(m => m.finalScore);
    
    // Utiliser recalculateAllEloRatings de elo.js
    const teamsWithElo = EloSystem.recalculateAllEloRatings(teamsData, playedMatches);
    
    return teamsWithElo;
}

// ===============================
// GÉNÉRATION PRONOSTIC IA POUR UN MATCH
// ===============================

function generateIAPredictionForMatch(match, teamsWithElo) {
    const homeTeam = teamsWithElo.find(t => t.id == match.homeTeamId);
    const awayTeam = teamsWithElo.find(t => t.id == match.awayTeamId);
    
    if (!homeTeam || !awayTeam) return null;
    
    // Récupérer les Elo (ou 1500 par défaut)
    const homeElo = homeTeam.eloRating || 1500;
    const awayElo = awayTeam.eloRating || 1500;
    
    // Avantage domicile (utiliser la config de elo.js si disponible)
    const homeAdvantage = (typeof EloSystem !== 'undefined' && EloSystem.ELO_CONFIG) 
        ? EloSystem.ELO_CONFIG.HOME_ADVANTAGE 
        : 100;
    
    const adjustedHomeElo = homeElo + homeAdvantage;
    
    // Différence d'Elo
    const eloDiff = adjustedHomeElo - awayElo;
    
    // Probabilité de victoire domicile
    const homeExpectancy = 1 / (1 + Math.pow(10, -eloDiff / 400));
    
    // Probabilité de nul (plus haute quand les équipes sont proches)
    const absDiff = Math.abs(eloDiff);
    let drawProb = Math.max(0.15, 0.35 - (absDiff / 600));
    
    // Probabilités ajustées
    let homeWinProb = homeExpectancy * (1 - drawProb);
    let awayWinProb = (1 - homeExpectancy) * (1 - drawProb);
    
    // Normaliser
    const total = homeWinProb + drawProb + awayWinProb;
    homeWinProb /= total;
    drawProb /= total;
    awayWinProb /= total;
    
    // Déterminer le résultat
    let result;
    if (homeWinProb > drawProb && homeWinProb > awayWinProb) {
        result = 'home';
    } else if (awayWinProb > drawProb && awayWinProb > homeWinProb) {
        result = 'away';
    } else {
        result = 'draw';
    }
    
    // Générer un score basé sur la force relative
    let homeScore, awayScore;
    
    // Utiliser un seed basé sur les IDs des équipes pour avoir des résultats consistants
    const seed = (match.homeTeamId * 1000 + match.awayTeamId + (match.matchDay || 0)) % 100 / 100;
    
    if (result === 'home') {
        if (eloDiff > 200) {
            // Large favori domicile
            homeScore = seed < 0.3 ? 3 : (seed < 0.7 ? 2 : 4);
            awayScore = seed < 0.5 ? 0 : 1;
        } else if (eloDiff > 120) {
            // Favori clair
            homeScore = seed < 0.4 ? 2 : (seed < 0.8 ? 3 : 1);
            awayScore = seed < 0.6 ? 0 : 1;
        } else if (eloDiff > 60) {
            // Léger favori
            homeScore = seed < 0.5 ? 2 : 1;
            awayScore = seed < 0.4 ? 1 : 0;
        } else {
            // Match serré, victoire domicile
            homeScore = seed < 0.6 ? 1 : 2;
            awayScore = homeScore - 1;
        }
    } else if (result === 'away') {
        if (eloDiff < -200) {
            // Large favori extérieur
            awayScore = seed < 0.3 ? 3 : (seed < 0.7 ? 2 : 4);
            homeScore = seed < 0.5 ? 0 : 1;
        } else if (eloDiff < -120) {
            // Favori clair extérieur
            awayScore = seed < 0.4 ? 2 : (seed < 0.8 ? 3 : 1);
            homeScore = seed < 0.6 ? 0 : 1;
        } else if (eloDiff < -60) {
            // Léger favori extérieur
            awayScore = seed < 0.5 ? 2 : 1;
            homeScore = seed < 0.4 ? 1 : 0;
        } else {
            // Match serré, victoire extérieur
            awayScore = seed < 0.6 ? 1 : 2;
            homeScore = awayScore - 1;
        }
    } else {
        // Match nul
        if (absDiff < 50) {
            // Équipes très proches
            homeScore = seed < 0.35 ? 1 : (seed < 0.6 ? 0 : 2);
            awayScore = homeScore;
        } else {
            // Nul avec buts
            homeScore = seed < 0.5 ? 1 : 2;
            awayScore = homeScore;
        }
    }
    
    homeScore = Math.max(0, Math.round(homeScore));
    awayScore = Math.max(0, Math.round(awayScore));
    
    return {
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeScore: homeScore,
        awayScore: awayScore,
        homeElo: Math.round(homeElo),
        awayElo: Math.round(awayElo),
        homeWinProb: Math.round(homeWinProb * 100),
        drawProb: Math.round(drawProb * 100),
        awayWinProb: Math.round(awayWinProb * 100),
        generatedAt: new Date().toISOString()
    };
}

// ===============================
// GÉNÉRATION TOUS LES PRONOSTICS IA
// ===============================

async function generateAllIAPredictions() {
    if (!currentSeason) return;
    
    // Récupérer les pronostics existants
    let iaPredictions = await getIAPredictions(currentSeason) || {
        season: currentSeason,
        generatedAt: new Date().toISOString(),
        matchDays: {}
    };
    
    // Calculer l'Elo actuel (basé sur TOUS les matchs joués)
    const currentElo = calculateCurrentElo(allMatches, allTeams);
    
    // Trouver toutes les journées avec des matchs à venir
    const allFutureMatchDays = [...new Set(futureMatches.map(m => m.matchDay))].sort((a, b) => a - b);
    
    // Aussi vérifier les matchs de journées "en cours" (certains joués, d'autres non)
    const partialMatchDays = [...new Set(
        allMatches
            .filter(m => !m.finalScore)
            .map(m => m.matchDay)
    )];
    
    const matchDaysToProcess = [...new Set([...allFutureMatchDays, ...partialMatchDays])].sort((a, b) => a - b);
    
    for (const matchDay of matchDaysToProcess) {
        // Récupérer les matchs de cette journée (futurs + sans résultat)
        const matchesThisDay = [
            ...futureMatches.filter(m => m.matchDay === matchDay),
            ...allMatches.filter(m => m.matchDay === matchDay && !m.finalScore)
        ];
        
        // Éviter les doublons
        const uniqueMatches = [];
        const seen = new Set();
        for (const m of matchesThisDay) {
            const key = `${m.homeTeamId}-${m.awayTeamId}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueMatches.push(m);
            }
        }
        
        if (uniqueMatches.length === 0) continue;
        
        // Pour cette journée, calculer l'Elo en fonction des matchs joués AVANT
        let teamsWithElo;
        const firstMatchDate = uniqueMatches
            .filter(m => m.scheduledAt)
            .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0]?.scheduledAt;
        
        if (firstMatchDate) {
            teamsWithElo = calculateEloAtDate(firstMatchDate, allMatches, allTeams);
        } else {
            teamsWithElo = currentElo;
        }
        
        // Initialiser ou mettre à jour la journée
        if (!iaPredictions.matchDays[matchDay]) {
            iaPredictions.matchDays[matchDay] = {
                predictions: [],
                generatedAt: new Date().toISOString()
            };
        }
        
        // Générer/Mettre à jour les pronostics pour chaque match
        for (const match of uniqueMatches) {
            const existingIndex = iaPredictions.matchDays[matchDay].predictions.findIndex(p =>
                p.homeTeamId == match.homeTeamId && p.awayTeamId == match.awayTeamId
            );
            
            const prediction = generateIAPredictionForMatch(match, teamsWithElo);
            
            if (prediction) {
                if (existingIndex >= 0) {
                    // Mettre à jour si l'Elo a changé significativement
                    const existing = iaPredictions.matchDays[matchDay].predictions[existingIndex];
                    const eloChanged = Math.abs(existing.homeElo - prediction.homeElo) > 10 ||
                                       Math.abs(existing.awayElo - prediction.awayElo) > 10;
                    
                    if (eloChanged) {
                        iaPredictions.matchDays[matchDay].predictions[existingIndex] = prediction;
                    }
                } else {
                    iaPredictions.matchDays[matchDay].predictions.push(prediction);
                }
            }
        }
        
        iaPredictions.matchDays[matchDay].generatedAt = new Date().toISOString();
    }
    
    // Sauvegarder
    iaPredictions.lastUpdated = new Date().toISOString();
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
        
        results.totalPoints += result.finalPoints || result.points;
        
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
            points: result.finalPoints || result.points,
            class: result.class
        });
    }
    
    results.totalPoints = Math.round(results.totalPoints * 10) / 10;
    
    return results;
}

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
    
    stats.totalPoints = Math.round(stats.totalPoints * 10) / 10;
    
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
                stats: iaStats || { totalPoints: 0, exactScores: 0, closeScores: 0, correctResults: 0, wrongResults: 0, totalPredictions: 0 }
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
        
        // Stocker pour le clic
        window.currentMatchDayData = {
            matchDay: matchDay,
            iaResults: iaResults,
            playersResults: playersResults
        };
        
        let html = `
            <div class="matchday-comparison">
                <div class="matchday-summary">
                    <div class="summary-card ia clickable ${!playersResults.length ? 'active' : ''}" 
                         onclick="showParticipantPredictions('ia', ${matchDay})">
                        <span class="summary-icon">🤖</span>
                        <span class="summary-name">Claude IA</span>
                        <span class="summary-points">${iaResults?.totalPoints || 0} pts</span>
                    </div>
        `;
        
        // Tous les joueurs
        playersResults.forEach((player, index) => {
            const icons = ['🥇', '🥈', '🥉'];
            const icon = index < 3 ? icons[index] : `${index + 1}e`;
            const isCurrentPlayer = currentPlayer && player.playerId === currentPlayer.id;
            
            html += `
                <div class="summary-card player clickable ${isCurrentPlayer ? 'current' : ''}" 
                     onclick="showParticipantPredictions('${player.playerId}', ${matchDay})"
                     data-player-id="${player.playerId}">
                    <span class="summary-icon">${icon}</span>
                    <span class="summary-name">${player.pseudo}</span>
                    <span class="summary-points">${Math.round(player.points * 10) / 10} pts</span>
                </div>
            `;
        });
        
        html += `
                </div>
                <div id="participantPredictionsDetail">
                    <p style="text-align:center;color:#7f8c8d;padding:1rem;">
                        👆 Clique sur un participant pour voir ses pronostics
                    </p>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Afficher les pronos de l'IA par défaut si aucun joueur
        if (!playersResults.length && iaResults) {
            showParticipantPredictions('ia', matchDay);
        }
        
    } catch (error) {
        console.error('Erreur displayIAMatchDayDetail:', error);
        container.innerHTML = '<p style="text-align:center;color:#e74c3c;">Erreur</p>';
    }
}

async function showParticipantPredictions(participantId, matchDay) {
    const container = document.getElementById('participantPredictionsDetail');
    if (!container) return;
    
    // Mettre à jour la classe active sur les cartes
    document.querySelectorAll('.summary-card.clickable').forEach(card => {
        card.classList.remove('active');
    });
    
    if (participantId === 'ia') {
        document.querySelector('.summary-card.ia')?.classList.add('active');
    } else {
        document.querySelector(`.summary-card[data-player-id="${participantId}"]`)?.classList.add('active');
    }
    
    container.innerHTML = '<div class="loading">Chargement...</div>';
    
    try {
        const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay);
        let predictions = [];
        let participantName = '';
        let participantIcon = '';
        
        if (participantId === 'ia') {
            participantName = 'Claude IA';
            participantIcon = '🤖';
            
            const iaPredictions = await getIAPredictions(currentSeason);
            if (iaPredictions && iaPredictions.matchDays[matchDay]) {
                predictions = iaPredictions.matchDays[matchDay].predictions;
            }
        } else {
            const playerPredictions = await getPlayerPredictions(participantId, currentSeason, matchDay);
            
            if (playerPredictions) {
                participantName = playerPredictions.pseudo;
                predictions = playerPredictions.predictions || [];
            }
            
            const playersResults = window.currentMatchDayData?.playersResults || [];
            const playerIndex = playersResults.findIndex(p => p.playerId === participantId);
            const icons = ['🥇', '🥈', '🥉'];
            participantIcon = playerIndex >= 0 && playerIndex < 3 ? icons[playerIndex] : '👤';
        }
        
        if (predictions.length === 0) {
            container.innerHTML = `
                <div class="participant-predictions-empty">
                    <p>Aucun pronostic pour cette journée</p>
                </div>
            `;
            return;
        }
        
        let totalPoints = 0;
        let matchesHtml = '';
        
        for (const pred of predictions) {
            const match = matchesThisDay.find(m => 
                m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
            );
            
            const homeTeam = allTeams.find(t => t.id == pred.homeTeamId);
            const awayTeam = allTeams.find(t => t.id == pred.awayTeamId);
            
            let result = { points: 0, finalPoints: 0, class: 'pending', label: '⏳ En attente' };
            let realScore = '-';
            
            if (match && match.finalScore) {
                result = calculatePredictionResult(
                    pred.homeScore, pred.awayScore,
                    match.finalScore.home, match.finalScore.away,
                    pred.savedAt || pred.generatedAt,
                    match,
                    pred.odds
                );
                totalPoints += result.finalPoints || result.points;
                realScore = `${match.finalScore.home}-${match.finalScore.away}`;
            }
            
            let pointsDisplay = `${result.finalPoints || result.points} pts`;
            if (result.oddsMultiplier && result.oddsMultiplier !== 1) {
                pointsDisplay = `${result.points} × ${result.oddsMultiplier} = ${result.finalPoints} pts`;
            }
            
            matchesHtml += `
                <div class="ia-match-card ${result.class}">
                    <div class="match-teams">${homeTeam?.shortName || '?'} - ${awayTeam?.shortName || '?'}</div>
                    <div class="match-scores">
                        <span class="prono">Prono: ${pred.homeScore}-${pred.awayScore}</span>
                        <span class="actual">Réel: ${realScore}</span>
                    </div>
                    <div class="match-points">${pointsDisplay}</div>
                </div>
            `;
        }
        
        container.innerHTML = `
            <div class="ia-matches-detail">
                <h5>${participantIcon} Pronostics de ${participantName}</h5>
                <div class="participant-total-points">
                    Total: <strong>${Math.round(totalPoints * 10) / 10} pts</strong>
                </div>
                <div class="ia-matches-grid">
                    ${matchesHtml}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Erreur showParticipantPredictions:', error);
        container.innerHTML = '<p style="text-align:center;color:#e74c3c;">Erreur de chargement</p>';
    }
}

// ===============================
// FONCTIONS UTILITAIRES
// ===============================

function isMatchDayComplete(matchDay) {
    const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay);
    
    if (matchesThisDay.length === 0) return false;
    
    const allHaveResults = matchesThisDay.every(m => m.finalScore);
    if (allHaveResults) return true;
    
    const lastMatchDate = matchesThisDay
        .filter(m => m.scheduledAt)
        .map(m => new Date(m.scheduledAt))
        .sort((a, b) => b - a)[0];
    
    if (lastMatchDate) {
        const now = new Date();
        const hoursSinceLastMatch = (now - lastMatchDate) / (1000 * 60 * 60);
        if (hoursSinceLastMatch > 3) return true;
    }
    
    return false;
}

async function regenerateIAPredictions(forceAll = false) {
    if (!currentSeason) return;
    
    if (forceAll) {
        localStorage.removeItem(`footballEloIAPredictions_${currentSeason}`);
    }
    
    const newPredictions = await generateAllIAPredictions();
    
    console.log('Pronostics IA regénérés:', newPredictions);
    
    if (typeof displayIAComparison === 'function') {
        await displayIAComparison();
    }
    
    return newPredictions;
}

function debugIAPrediction(matchDay) {
    const iaPredictions = JSON.parse(localStorage.getItem(`footballEloIAPredictions_${currentSeason}`));
    
    if (!iaPredictions || !iaPredictions.matchDays[matchDay]) {
        console.log('Pas de pronostics pour cette journée');
        return;
    }
    
    const preds = iaPredictions.matchDays[matchDay].predictions;
    
    console.log(`=== Pronostics IA Journée ${matchDay} ===`);
    console.log(`Généré le: ${iaPredictions.matchDays[matchDay].generatedAt}`);
    console.log('');
    
    preds.forEach(p => {
        const homeTeam = allTeams.find(t => t.id == p.homeTeamId);
        const awayTeam = allTeams.find(t => t.id == p.awayTeamId);
        
        console.log(`${homeTeam?.shortName || homeTeam?.name} (${p.homeElo}) vs ${awayTeam?.shortName || awayTeam?.name} (${p.awayElo})`);
        console.log(`  Prono: ${p.homeScore}-${p.awayScore}`);
        console.log(`  Probas: ${p.homeWinProb}% / ${p.drawProb}% / ${p.awayWinProb}%`);
        console.log('');
    });
}