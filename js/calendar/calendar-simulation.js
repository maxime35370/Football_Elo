// calendar-simulation.js - Onglet Simulation manuelle + Monte Carlo

// ===============================
// VARIABLES
// ===============================
let monteCarloResults = null; // Stocke les résultats de la simulation Monte Carlo

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
    
    // Ajouter la section Monte Carlo si disponible
    let monteCarloHtml = '';
    if (monteCarloResults) {
        monteCarloHtml = generateMonteCarloDisplay(monteCarloResults);
    }
    
    container.innerHTML = `
        <div class="simulation-grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
            <div class="simulation-matches">${matchesHtml}</div>
            <div class="simulation-ranking">
                <h4>📊 Classement simulé</h4>
                ${rankingHtml}
            </div>
        </div>
        ${monteCarloHtml}
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
    Object.keys(simulatedResults).forEach(matchKey => {
        const result = simulatedResults[matchKey];
        if (result.home === null || result.away === null) return;
        
        const [homeId, awayId, matchDay] = matchKey.split('-');
        
        if (!simStats[homeId] || !simStats[awayId]) return;
        
        simStats[homeId].played++;
        simStats[awayId].played++;
        simStats[homeId].goalsFor += result.home;
        simStats[homeId].goalsAgainst += result.away;
        simStats[awayId].goalsFor += result.away;
        simStats[awayId].goalsAgainst += result.home;
        
        if (result.home > result.away) {
            simStats[homeId].won++;
            simStats[homeId].points += 3;
            simStats[awayId].lost++;
        } else if (result.home < result.away) {
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
    
    // Générer le classement
    const ranking = allTeams.map(team => {
        const stats = simStats[team.id];
        return {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            ...stats,
            goalDifference: stats.goalsFor - stats.goalsAgainst
        };
    });
    
    // Trier
    ranking.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });
    
    return ranking;
}

function generateSimulatedRankingTable(ranking) {
    if (ranking.length === 0) return '<p>Aucune équipe</p>';
    
    const config = getSeasonConfig();
    
    let html = '<table class="ranking-table compact"><thead><tr>';
    html += '<th>Pos</th><th>Équipe</th><th>Pts</th><th>MJ</th><th>Diff</th>';
    html += '</tr></thead><tbody>';
    
    ranking.forEach((team, index) => {
        const position = index + 1;
        let rowClass = '';
        
        if (position <= config.championPlaces) {
            rowClass = 'champion';
        } else if (position <= config.europeanPlaces) {
            rowClass = 'european';
        } else if (position > ranking.length - config.relegationPlaces) {
            rowClass = 'relegated';
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
// SIMULATION SIMPLE
// ===============================

function simulateRandom() {
    simulatedResults = {};
    monteCarloResults = null;
    
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
    monteCarloResults = null;
    
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
    monteCarloResults = null;
    displaySimulation();
}

// ===============================
// SIMULATION MONTE CARLO (100x)
// ===============================

function simulateMonteCarloElo(numSimulations = 100) {
    console.log(`🎲 Lancement de ${numSimulations} simulations Monte Carlo...`);
    
    const startTime = performance.now();
    
    // Structure pour stocker les positions de chaque équipe à chaque simulation
    const positionCounts = {};
    const pointsSum = {};
    const pointsMin = {};
    const pointsMax = {};
    
    allTeams.forEach(team => {
        positionCounts[team.id] = {};
        for (let pos = 1; pos <= allTeams.length; pos++) {
            positionCounts[team.id][pos] = 0;
        }
        pointsSum[team.id] = 0;
        pointsMin[team.id] = Infinity;
        pointsMax[team.id] = -Infinity;
    });
    
    // Récupérer le classement actuel (basé sur les matchs réels)
    const currentRanking = generateRanking(null, currentSeason, null, false, 'all');
    
    // Lancer les simulations
    for (let sim = 0; sim < numSimulations; sim++) {
        // Copier les stats actuelles
        const simStats = {};
        allTeams.forEach(team => {
            const teamData = currentRanking.find(t => t.id == team.id);
            simStats[team.id] = {
                points: teamData ? teamData.points : 0,
                goalsFor: teamData ? teamData.goalsFor : 0,
                goalsAgainst: teamData ? teamData.goalsAgainst : 0
            };
        });
        
        // Copier l'Elo actuel
        const simElo = {};
        teamsWithElo.forEach(t => {
            simElo[t.id] = t.eloRating || 1500;
        });
        
        // Trier les matchs par journée
        const sortedMatches = [...futureMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
        
        // Simuler chaque match
        sortedMatches.forEach(match => {
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
            
            // Mettre à jour les stats
            simStats[match.homeTeamId].goalsFor += score.home;
            simStats[match.homeTeamId].goalsAgainst += score.away;
            simStats[match.awayTeamId].goalsFor += score.away;
            simStats[match.awayTeamId].goalsAgainst += score.home;
            
            if (score.home > score.away) {
                simStats[match.homeTeamId].points += 3;
            } else if (score.home < score.away) {
                simStats[match.awayTeamId].points += 3;
            } else {
                simStats[match.homeTeamId].points += 1;
                simStats[match.awayTeamId].points += 1;
            }
            
            // Mettre à jour l'Elo simulé
            const K = 32;
            const expectedHome = 1 / (1 + Math.pow(10, (awayElo - adjustedHomeElo) / 400));
            
            let actualHome = score.home > score.away ? 1 : (score.home < score.away ? 0 : 0.5);
            
            simElo[match.homeTeamId] += Math.round(K * (actualHome - expectedHome));
            simElo[match.awayTeamId] += Math.round(K * ((1 - actualHome) - (1 - expectedHome)));
        });
        
        // Calculer le classement final de cette simulation
        const finalRanking = allTeams.map(team => ({
            id: team.id,
            points: simStats[team.id].points,
            goalDifference: simStats[team.id].goalsFor - simStats[team.id].goalsAgainst,
            goalsFor: simStats[team.id].goalsFor
        }));
        
        finalRanking.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            return b.goalsFor - a.goalsFor;
        });
        
        // Enregistrer les positions
        finalRanking.forEach((team, index) => {
            const position = index + 1;
            positionCounts[team.id][position]++;
            pointsSum[team.id] += team.points;
            pointsMin[team.id] = Math.min(pointsMin[team.id], team.points);
            pointsMax[team.id] = Math.max(pointsMax[team.id], team.points);
        });
    }
    
    const endTime = performance.now();
    console.log(`✅ ${numSimulations} simulations terminées en ${Math.round(endTime - startTime)}ms`);
    
    // Calculer les statistiques finales
    const results = allTeams.map(team => {
        const avgPoints = pointsSum[team.id] / numSimulations;
        
        // Position moyenne pondérée
        let avgPosition = 0;
        for (let pos = 1; pos <= allTeams.length; pos++) {
            avgPosition += pos * (positionCounts[team.id][pos] / numSimulations);
        }
        
        // Probabilités par zone
        const config = getSeasonConfig();
        let champProb = 0;
        let euroProb = 0;
        let relegProb = 0;
        
        for (let pos = 1; pos <= allTeams.length; pos++) {
            const prob = positionCounts[team.id][pos] / numSimulations;
            if (pos <= config.championPlaces) champProb += prob;
            if (pos <= config.europeanPlaces) euroProb += prob;
            if (pos > allTeams.length - config.relegationPlaces) relegProb += prob;
        }
        
        return {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            avgPoints: Math.round(avgPoints * 10) / 10,
            minPoints: pointsMin[team.id],
            maxPoints: pointsMax[team.id],
            avgPosition: Math.round(avgPosition * 10) / 10,
            positionCounts: positionCounts[team.id],
            champProb: Math.round(champProb * 100),
            euroProb: Math.round(euroProb * 100),
            relegProb: Math.round(relegProb * 100)
        };
    });
    
    // Trier par position moyenne
    results.sort((a, b) => a.avgPosition - b.avgPosition);
    
    monteCarloResults = {
        numSimulations,
        generatedAt: new Date().toISOString(),
        teams: results
    };
    
    return monteCarloResults;
}

// Bouton pour lancer la simulation Monte Carlo
function simulateMonteCarloBtn() {
    // Récupérer le nombre de simulations choisi
    const selectEl = document.getElementById('monteCarloCount');
    const numSimulations = selectEl ? parseInt(selectEl.value) : 100;
    
    // Afficher un indicateur de chargement
    const btn = document.getElementById('simulateMonteCarloBtn');
    const originalText = btn ? btn.innerHTML : '';
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `⏳ ${numSimulations} simulations...`;
    }
    
    // Utiliser setTimeout pour laisser le temps à l'UI de se mettre à jour
    setTimeout(() => {
        try {
            const startTime = performance.now();
            simulateMonteCarloElo(numSimulations);
            const endTime = performance.now();
            
            console.log(`✅ ${numSimulations} simulations en ${Math.round(endTime - startTime)}ms`);
            displaySimulation();
        } catch (error) {
            console.error('Erreur simulation Monte Carlo:', error);
            alert('Erreur lors de la simulation');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '📊 Lancer la projection';
            }
        }
    }, 50);
}

// ===============================
// AFFICHAGE MONTE CARLO
// ===============================

function generateMonteCarloDisplay(results) {
    if (!results || !results.teams) return '';
    
    const config = getSeasonConfig();
    
    let html = `
        <div class="monte-carlo-section" style="margin-top: 2rem; background: white; border-radius: 15px; padding: 1.5rem; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
            <h4 style="margin-bottom: 1rem; color: #2c3e50;">
                📊 Projection fin de saison 
                <small style="color: #7f8c8d; font-weight: normal;">(${results.numSimulations} simulations)</small>
            </h4>
            
            <div style="overflow-x: auto;">
                <table class="monte-carlo-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem; table-layout: fixed;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, #2c3e50, #34495e); color: white;">
                            <th style="padding: 0.6rem 0.4rem; text-align: center; width: 45px;">Proj.</th>
                            <th style="padding: 0.6rem 0.4rem; text-align: left; width: 60px;">Équipe</th>
                            <th style="padding: 0.6rem 0.4rem; text-align: center; width: 45px;">Pts</th>
                            <th style="padding: 0.6rem 0.4rem; text-align: center; width: 55px;">Min-Max</th>
                            <th style="padding: 0.6rem 0.4rem; text-align: center; width: 40px;" title="Champion">🏆</th>
                            <th style="padding: 0.6rem 0.4rem; text-align: center; width: 40px;" title="Europe">⭐</th>
                            <th style="padding: 0.6rem 0.4rem; text-align: center; width: 40px;" title="Relégation">⬇️</th>
                            <th style="padding: 0.6rem 0.4rem; text-align: left;">Distribution</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    results.teams.forEach((team, index) => {
        const position = index + 1;
        let rowClass = '';
        let rowStyle = '';
        
        if (position <= config.championPlaces) {
            rowStyle = 'background: rgba(241, 196, 15, 0.15);';
        } else if (position <= config.europeanPlaces) {
            rowStyle = 'background: rgba(52, 152, 219, 0.1);';
        } else if (position > results.teams.length - config.relegationPlaces) {
            rowStyle = 'background: rgba(231, 76, 60, 0.1);';
        }
        
        // Générer la barre de distribution des positions
        const distributionBar = generatePositionDistributionBar(team.positionCounts, results.teams.length, config);
        
        html += `
            <tr style="${rowStyle}">
                <td style="padding: 0.4rem; text-align: center; font-weight: bold;">${team.avgPosition}</td>
                <td style="padding: 0.4rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${team.shortName}</td>
                <td style="padding: 0.4rem; text-align: center; font-weight: bold;">${team.avgPoints}</td>
                <td style="padding: 0.4rem; text-align: center; color: #7f8c8d; font-size: 0.8rem;">${team.minPoints}-${team.maxPoints}</td>
                <td style="padding: 0.4rem; text-align: center;">
                    ${team.champProb > 0 ? `<span style="color: #f39c12; font-weight: bold; font-size: 0.8rem;">${team.champProb}%</span>` : '-'}
                </td>
                <td style="padding: 0.4rem; text-align: center;">
                    ${team.euroProb > 0 ? `<span style="color: #3498db; font-weight: bold; font-size: 0.8rem;">${team.euroProb}%</span>` : '-'}
                </td>
                <td style="padding: 0.4rem; text-align: center;">
                    ${team.relegProb > 0 ? `<span style="color: #e74c3c; font-weight: bold; font-size: 0.8rem;">${team.relegProb}%</span>` : '-'}
                </td>
                <td style="padding: 0.4rem;">${distributionBar}</td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; font-size: 0.8rem; color: #7f8c8d;">
                <span><span style="display: inline-block; width: 10px; height: 10px; background: #f39c12; border-radius: 2px; margin-right: 3px;"></span> Champion</span>
                <span><span style="display: inline-block; width: 10px; height: 10px; background: #3498db; border-radius: 2px; margin-right: 3px;"></span> Europe</span>
                <span><span style="display: inline-block; width: 10px; height: 10px; background: #95a5a6; border-radius: 2px; margin-right: 3px;"></span> Milieu</span>
                <span><span style="display: inline-block; width: 10px; height: 10px; background: #e74c3c; border-radius: 2px; margin-right: 3px;"></span> Relégation</span>
            </div>
        </div>
    `;
    
    return html;
}

function generatePositionDistributionBar(positionCounts, totalTeams, config) {
    // Calculer le total pour normaliser
    let total = 0;
    for (let pos = 1; pos <= totalTeams; pos++) {
        total += positionCounts[pos] || 0;
    }
    
    let bars = '';
    
    for (let pos = 1; pos <= totalTeams; pos++) {
        const count = positionCounts[pos] || 0;
        const percent = total > 0 ? (count / total) * 100 : 0;
        
        if (percent === 0) continue;
        
        let color;
        if (pos <= config.championPlaces) {
            color = '#f39c12'; // Or
        } else if (pos <= config.europeanPlaces) {
            color = '#3498db'; // Bleu
        } else if (pos > totalTeams - config.relegationPlaces) {
            color = '#e74c3c'; // Rouge
        } else {
            color = '#95a5a6'; // Gris
        }
        
        // Utiliser des pourcentages au lieu de pixels fixes
        const width = Math.max(2, percent);
        
        bars += `<div style="flex: ${width}; min-width: 2px; height: 14px; background: ${color}; margin-right: 1px; border-radius: 2px;" title="Position ${pos}: ${count}%"></div>`;
    }
    
    return `<div style="display: flex; align-items: center; height: 14px; width: 100%; max-width: 200px;">${bars}</div>`;
}

// ===============================
// MISE À JOUR DES BOUTONS
// ===============================

// Surcharger setupButtons pour ajouter le bouton Monte Carlo
const originalSetupButtons = typeof setupButtons === 'function' ? setupButtons : null;

function setupSimulationButtons() {
    // Ajouter le bouton Monte Carlo s'il existe
    document.getElementById('simulateMonteCarloBtn')?.addEventListener('click', simulateMonteCarloBtn);
}

// Appeler au chargement
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        setupSimulationButtons();
    });
}