// calendar-simulation.js - Onglet Simulation manuelle

// ===============================
// ONGLET SIMULATION
// ===============================

function displaySimulation() {
    const container = document.getElementById('simulationContent');
    if (!container) return;
    
    if (futureMatches.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:2rem;">Générez d\'abord le calendrier pour faire une simulation</p>';
        return;
    }
    
    // Grouper les matchs par journée
    const matchesByDay = {};
    futureMatches.forEach(match => {
        const day = match.matchDay || 0;
        if (!matchesByDay[day]) matchesByDay[day] = [];
        matchesByDay[day].push(match);
    });
    
    const sortedDays = Object.keys(matchesByDay).sort((a, b) => a - b);
    
    // Générer les matchs à simuler
    let matchesHtml = sortedDays.map(day => `
        <div class="matchday-section">
            <div class="matchday-header">Journée ${day}</div>
            <div style="padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                ${matchesByDay[day].map(match => createSimulationMatchRow(match)).join('')}
            </div>
        </div>
    `).join('');
    
    // Générer le classement simulé
    const simulatedRanking = calculateSimulatedRankingFromResults();
    let rankingHtml = generateSimulatedRankingTable(simulatedRanking);
    
    container.innerHTML = `
        <div class="simulation-matches">${matchesHtml}</div>
        <div class="simulation-ranking">
            <h4>📊 Classement simulé</h4>
            ${rankingHtml}
        </div>
    `;
    
    // Ajouter les événements aux inputs
    document.querySelectorAll('.simulation-match input').forEach(input => {
        input.addEventListener('change', onSimulationInputChange);
    });
}

function createSimulationMatchRow(match) {
    const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
    
    const matchKey = `${match.homeTeamId}-${match.awayTeamId}-${match.matchDay}`;
    
    const homeScore = simulatedResults[matchKey]?.home ?? '';
    const awayScore = simulatedResults[matchKey]?.away ?? '';
    
    return `
        <div class="simulation-match" data-match-key="${matchKey}">
            <span class="team-home">${homeTeam ? homeTeam.shortName : '?'}</span>
            <input type="number" min="0" max="20" class="score-home" value="${homeScore}" data-match-key="${matchKey}" data-type="home">
            <span class="vs">-</span>
            <input type="number" min="0" max="20" class="score-away" value="${awayScore}" data-match-key="${matchKey}" data-type="away">
            <span class="team-away">${awayTeam ? awayTeam.shortName : '?'}</span>
        </div>
    `;
}

function onSimulationInputChange(event) {
    const matchKey = event.target.dataset.matchKey;
    const type = event.target.dataset.type;
    const value = parseInt(event.target.value);
    
    if (isNaN(value)) return;
    
    if (!simulatedResults[matchKey]) {
        simulatedResults[matchKey] = { home: null, away: null };
    }
    
    simulatedResults[matchKey][type] = value;
    
    updateSimulatedRankingDisplay();
}

// Calculer le classement simulé à partir des résultats simulés
function calculateSimulatedRankingFromResults() {
    // Récupérer le classement actuel (basé sur les matchs réels)
    const currentRanking = generateRanking(null, currentSeason, null, false, 'all');
    
    // Copier les stats actuelles
    const simStats = {};
    allTeams.forEach(team => {
        const teamData = currentRanking.find(t => t.id == team.id);
        simStats[team.id] = {
            played: teamData ? teamData.played : 0,
            won: teamData ? teamData.won : 0,
            drawn: teamData ? teamData.drawn : 0,
            lost: teamData ? teamData.lost : 0,
            goalsFor: teamData ? teamData.goalsFor : 0,
            goalsAgainst: teamData ? teamData.goalsAgainst : 0,
            points: teamData ? teamData.points : 0
        };
    });
    
    // Appliquer les résultats simulés
    Object.entries(simulatedResults).forEach(([matchKey, score]) => {
        if (score.home === null || score.away === null) return;
        
        const parts = matchKey.split('-');
        const homeId = parseInt(parts[0]);
        const awayId = parseInt(parts[1]);
        
        if (!simStats[homeId] || !simStats[awayId]) return;
        
        simStats[homeId].played++;
        simStats[awayId].played++;
        simStats[homeId].goalsFor += score.home;
        simStats[homeId].goalsAgainst += score.away;
        simStats[awayId].goalsFor += score.away;
        simStats[awayId].goalsAgainst += score.home;
        
        if (score.home > score.away) {
            simStats[homeId].won++;
            simStats[homeId].points += 3;
            simStats[awayId].lost++;
        } else if (score.home < score.away) {
            simStats[awayId].won++;
            simStats[awayId].points += 3;
            simStats[homeId].lost++;
        } else {
            simStats[homeId].drawn++;
            simStats[awayId].drawn++;
            simStats[homeId].points += 1;
            simStats[awayId].points += 1;
        }
    });
    
    // Créer le classement
    const simRanking = allTeams.map(team => {
        const stats = simStats[team.id];
        return {
            id: team.id,
            shortName: team.shortName,
            played: stats.played,
            won: stats.won,
            drawn: stats.drawn,
            lost: stats.lost,
            goalsFor: stats.goalsFor,
            goalsAgainst: stats.goalsAgainst,
            goalDifference: stats.goalsFor - stats.goalsAgainst,
            points: stats.points
        };
    });
    
    // Trier
    simRanking.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });
    
    return simRanking;
}

function calculateSimulatedRanking(simulatedStats) {
    const ranking = allTeams.map(team => {
        const stats = simulatedStats[team.id] || { points: 0, goalsFor: 0, goalsAgainst: 0, played: 0 };
        return {
            id: team.id,
            shortName: team.shortName,
            points: stats.points || 0,
            goalDifference: (stats.goalsFor || 0) - (stats.goalsAgainst || 0),
            goalsFor: stats.goalsFor || 0,
            played: stats.played || 0,
            rank: 0
        };
    });
    
    ranking.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });
    
    for (let i = 0; i < ranking.length; i++) {
        ranking[i].rank = i + 1;
    }
    
    return ranking;
}

function generateSimulatedRankingTable(ranking) {
    const config = getSeasonConfig();
    const totalTeams = ranking.length;
    const relegationPosition = totalTeams - config.relegationPlaces;
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Pos</th>
                    <th>Équipe</th>
                    <th>Pts</th>
                    <th>MJ</th>
                    <th>Diff</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    ranking.forEach((team, index) => {
        const position = index + 1;
        let rowClass = '';
        
        if (position <= config.championPlaces) {
            rowClass = 'champion';
        } else if (position <= config.europeanPlaces) {
            rowClass = 'european';
        } else if (position > relegationPosition) {
            rowClass = 'relegation';
        }
        
        html += `
            <tr class="${rowClass}">
                <td>${position}</td>
                <td>${team.shortName}</td>
                <td><strong>${team.points}</strong></td>
                <td>${team.played}</td>
                <td>${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    return html;
}

function updateSimulatedRankingDisplay() {
    const ranking = calculateSimulatedRankingFromResults();
    const container = document.querySelector('.simulation-ranking');
    if (container) {
        container.innerHTML = `
            <h4>📊 Classement simulé</h4>
            ${generateSimulatedRankingTable(ranking)}
        `;
    }
}

// ===============================
// BOUTONS DE SIMULATION
// ===============================

function simulateRandom() {
    simulatedResults = {};
    
    futureMatches.forEach(match => {
        const matchKey = `${match.homeTeamId}-${match.awayTeamId}-${match.matchDay}`;
        simulatedResults[matchKey] = {
            home: Math.floor(Math.random() * 5),
            away: Math.floor(Math.random() * 5)
        };
    });
    
    displaySimulation();
}

function simulateWithElo() {
    simulatedResults = {};
    
    // Créer une copie des Elo pour la simulation
    const simElo = {};
    teamsWithElo.forEach(t => {
        simElo[t.id] = t.eloRating || 1500;
    });
    
    // Trier les matchs par journée
    const sortedMatches = [...futureMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
    
    sortedMatches.forEach(match => {
        const matchKey = `${match.homeTeamId}-${match.awayTeamId}-${match.matchDay}`;
        
        const homeElo = simElo[match.homeTeamId] || 1500;
        const awayElo = simElo[match.awayTeamId] || 1500;
        
        const homeAdvantage = 50;
        const adjustedHomeElo = homeElo + homeAdvantage;
        
        const homeExpectancy = 1 / (1 + Math.pow(10, (awayElo - adjustedHomeElo) / 400));
        
        const eloDiff = Math.abs(adjustedHomeElo - awayElo);
        const isCloseMatch = eloDiff < 100;
        let drawProb = isCloseMatch ? 0.30 : 0.25;
        
        let homeWinProb = homeExpectancy * (1 - drawProb);
        let awayWinProb = (1 - homeExpectancy) * (1 - drawProb);
        
        const score = generateSimulatedScore(homeWinProb, drawProb, awayWinProb, adjustedHomeElo, awayElo);
        
        simulatedResults[matchKey] = score;
        
        // Mettre à jour l'Elo simulé
        const K = 32;
        const expectedHome = 1 / (1 + Math.pow(10, (awayElo - adjustedHomeElo) / 400));
        
        let actualHome, actualAway;
        if (score.home > score.away) {
            actualHome = 1; actualAway = 0;
        } else if (score.home < score.away) {
            actualHome = 0; actualAway = 1;
        } else {
            actualHome = 0.5; actualAway = 0.5;
        }
        
        simElo[match.homeTeamId] += Math.round(K * (actualHome - expectedHome));
        simElo[match.awayTeamId] += Math.round(K * (1 - actualHome - (1 - expectedHome)));
    });
    
    displaySimulation();
}

function generateSimulatedScore(homeWinProb, drawProb, awayWinProb, homeElo, awayElo) {
    const random = Math.random();
    
    let result;
    if (random < homeWinProb) {
        result = 'home';
    } else if (random < homeWinProb + drawProb) {
        result = 'draw';
    } else {
        result = 'away';
    }
    
    let homeGoals, awayGoals;
    
    if (result === 'draw') {
        const randScore = Math.random();
        if (randScore < 0.30) {
            homeGoals = 0; awayGoals = 0;
        } else if (randScore < 0.70) {
            homeGoals = 1; awayGoals = 1;
        } else if (randScore < 0.90) {
            homeGoals = 2; awayGoals = 2;
        } else {
            homeGoals = 3; awayGoals = 3;
        }
    } else if (result === 'home') {
        const randScore = Math.random();
        if (randScore < 0.55) {
            const goals = Math.random() < 0.6 ? 1 : 2;
            homeGoals = goals;
            awayGoals = goals - 1;
        } else if (randScore < 0.85) {
            const goals = Math.random() < 0.5 ? 2 : 3;
            homeGoals = goals;
            awayGoals = goals - 2;
        } else {
            homeGoals = Math.floor(Math.random() * 2) + 3;
            awayGoals = Math.floor(Math.random() * 2);
        }
    } else {
        const randScore = Math.random();
        if (randScore < 0.60) {
            const goals = Math.random() < 0.5 ? 1 : 2;
            awayGoals = goals;
            homeGoals = goals - 1;
        } else if (randScore < 0.88) {
            const goals = Math.random() < 0.5 ? 2 : 3;
            awayGoals = goals;
            homeGoals = goals - 2;
        } else {
            awayGoals = Math.floor(Math.random() * 2) + 3;
            homeGoals = Math.floor(Math.random() * 2);
        }
    }
    
    return { home: homeGoals, away: awayGoals };
}

function resetSimulation() {
    simulatedResults = {};
    displaySimulation();
}