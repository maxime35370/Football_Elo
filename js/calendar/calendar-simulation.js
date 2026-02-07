// calendar-simulation.js - Onglet Simulation manuelle + Monte Carlo

// ===============================
// VARIABLES
// ===============================
let monteCarloResults = null; // Stocke les résultats de la simulation Monte Carlo

// ===============================
// CONFIGURATION DES ENJEUX
// ===============================
const STAKES_CONFIG = {
    // Ajustements de probabilité de nul selon les enjeux
    drawBonus: {
        relegationDerby: 0.12,      // Match entre 2 relégables → +12% nuls
        titleRace: 0.08,            // Match pour le titre → +8% nuls
        europeanBattle: 0.06,       // Match pour l'Europe → +6% nuls
        survivalVsNothing: -0.05,   // Relégable vs équipe sans enjeu → -5% nuls (le relégable pousse)
        nothingVsNothing: 0.05      // Deux équipes sans enjeu → +5% nuls
    },
    // Ajustements de performance selon la motivation
    motivationBonus: {
        fightingForSurvival: 15,    // Équipe qui lutte pour le maintien → +15 Elo virtuel
        fightingForTitle: 10,       // Équipe qui lutte pour le titre → +10 Elo virtuel
        fightingForEurope: 8,       // Équipe qui lutte pour l'Europe → +8 Elo virtuel
        nothingToPlay: -20,         // Équipe qui n'a plus rien à jouer → -20 Elo virtuel
        lastChance: 20              // Dernier match décisif → +20 Elo virtuel
    }
};

// ===============================
// ANALYSE DES ENJEUX
// ===============================

// Déterminer la situation d'une équipe dans le classement
function getTeamSituation(teamId, ranking, remainingMatches, config) {
    const teamRank = ranking.find(t => t.id == teamId);
    if (!teamRank) return { situation: 'unknown', urgency: 0 };
    
    const position = ranking.indexOf(teamRank) + 1;
    const points = teamRank.points;
    const maxPossiblePoints = points + (remainingMatches * 3);
    
    const totalTeams = ranking.length;
    const championZone = config.championPlaces;
    const europeZone = config.europeanPlaces;
    const relegationZone = totalTeams - config.relegationPlaces;
    
    // Points des équipes aux positions clés
    const championPoints = ranking[championZone - 1]?.points || 0;
    const europePoints = ranking[europeZone - 1]?.points || 0;
    const safePoints = ranking[relegationZone - 1]?.points || 0;
    const relegationPoints = ranking[relegationZone]?.points || 0;
    
    // Déterminer la situation
    let situation = 'midtable';
    let urgency = 0;
    let objective = null;
    
    // En zone de relégation
    if (position > relegationZone) {
        situation = 'relegated';
        const pointsNeeded = safePoints - points + 1;
        urgency = Math.min(100, (pointsNeeded / (remainingMatches * 3)) * 100);
        objective = { type: 'survival', pointsNeeded, targetPosition: relegationZone };
    }
    // Juste au-dessus de la zone de relégation (en danger)
    else if (position > relegationZone - 3 && points - relegationPoints <= remainingMatches * 3) {
        situation = 'danger';
        urgency = Math.max(0, 80 - (points - relegationPoints) * 10);
        objective = { type: 'survival', pointsNeeded: 0, margin: points - relegationPoints };
    }
    // En course pour le titre
    else if (position <= championZone || (championPoints - points <= remainingMatches * 3 && position <= 4)) {
        situation = 'titleRace';
        const pointsNeeded = championPoints - points + 1;
        urgency = position === 1 ? 50 : Math.min(100, (pointsNeeded / (remainingMatches * 3)) * 100);
        objective = { type: 'title', pointsNeeded: position === 1 ? 0 : pointsNeeded };
    }
    // En course pour l'Europe
    else if (position <= europeZone || (europePoints - points <= remainingMatches * 3 && position <= europeZone + 3)) {
        situation = 'europeRace';
        const pointsNeeded = europePoints - points + 1;
        urgency = position <= europeZone ? 30 : Math.min(80, (pointsNeeded / (remainingMatches * 3)) * 100);
        objective = { type: 'europe', pointsNeeded: position <= europeZone ? 0 : pointsNeeded };
    }
    // Mathématiquement sauvé et pas en course pour l'Europe
    else if (maxPossiblePoints < europePoints && points > relegationPoints + remainingMatches * 3) {
        situation = 'nothingToPlay';
        urgency = 0;
        objective = null;
    }
    
    return { situation, urgency, objective, position, points, remainingMatches };
}

// Analyser les enjeux d'un match spécifique
function analyzeMatchStakes(match, ranking, matchDay, totalMatchDays, config) {
    const remainingAfterThis = totalMatchDays - matchDay;
    
    const homeSituation = getTeamSituation(match.homeTeamId, ranking, remainingAfterThis + 1, config);
    const awaySituation = getTeamSituation(match.awayTeamId, ranking, remainingAfterThis + 1, config);
    
    const stakes = {
        homeTeam: homeSituation,
        awayTeam: awaySituation,
        matchType: 'normal',
        intensity: 'normal',
        drawAdjustment: 0,
        homeEloAdjustment: 0,
        awayEloAdjustment: 0,
        description: []
    };
    
    // Déterminer le type de match
    const homeRelegate = ['relegated', 'danger'].includes(homeSituation.situation);
    const awayRelegate = ['relegated', 'danger'].includes(awaySituation.situation);
    const homeTitle = homeSituation.situation === 'titleRace';
    const awayTitle = awaySituation.situation === 'titleRace';
    const homeEurope = homeSituation.situation === 'europeRace';
    const awayEurope = awaySituation.situation === 'europeRace';
    const homeNothing = homeSituation.situation === 'nothingToPlay';
    const awayNothing = awaySituation.situation === 'nothingToPlay';
    
    // Derby de la peur (2 relégables)
    if (homeRelegate && awayRelegate) {
        stakes.matchType = 'relegationDerby';
        stakes.intensity = 'extreme';
        stakes.drawAdjustment = STAKES_CONFIG.drawBonus.relegationDerby;
        stakes.homeEloAdjustment = STAKES_CONFIG.motivationBonus.fightingForSurvival;
        stakes.awayEloAdjustment = STAKES_CONFIG.motivationBonus.fightingForSurvival;
        stakes.description.push('🔥 Derby de la peur');
    }
    // Choc au sommet (2 prétendants au titre)
    else if (homeTitle && awayTitle) {
        stakes.matchType = 'titleClash';
        stakes.intensity = 'extreme';
        stakes.drawAdjustment = STAKES_CONFIG.drawBonus.titleRace;
        stakes.homeEloAdjustment = STAKES_CONFIG.motivationBonus.fightingForTitle;
        stakes.awayEloAdjustment = STAKES_CONFIG.motivationBonus.fightingForTitle;
        stakes.description.push('🏆 Choc pour le titre');
    }
    // Match pour l'Europe
    else if (homeEurope && awayEurope) {
        stakes.matchType = 'europeBattle';
        stakes.intensity = 'high';
        stakes.drawAdjustment = STAKES_CONFIG.drawBonus.europeanBattle;
        stakes.homeEloAdjustment = STAKES_CONFIG.motivationBonus.fightingForEurope;
        stakes.awayEloAdjustment = STAKES_CONFIG.motivationBonus.fightingForEurope;
        stakes.description.push('⭐ Duel pour l\'Europe');
    }
    // Relégable vs équipe sans enjeu
    else if (homeRelegate && awayNothing) {
        stakes.matchType = 'survivalVsNothing';
        stakes.intensity = 'high';
        stakes.drawAdjustment = STAKES_CONFIG.drawBonus.survivalVsNothing;
        stakes.homeEloAdjustment = STAKES_CONFIG.motivationBonus.fightingForSurvival;
        stakes.awayEloAdjustment = STAKES_CONFIG.motivationBonus.nothingToPlay;
        stakes.description.push('🛡️ Match pour le maintien');
    }
    else if (awayRelegate && homeNothing) {
        stakes.matchType = 'survivalVsNothing';
        stakes.intensity = 'high';
        stakes.drawAdjustment = STAKES_CONFIG.drawBonus.survivalVsNothing;
        stakes.homeEloAdjustment = STAKES_CONFIG.motivationBonus.nothingToPlay;
        stakes.awayEloAdjustment = STAKES_CONFIG.motivationBonus.fightingForSurvival;
        stakes.description.push('🛡️ Match pour le maintien');
    }
    // Deux équipes sans enjeu
    else if (homeNothing && awayNothing) {
        stakes.matchType = 'friendly';
        stakes.intensity = 'low';
        stakes.drawAdjustment = STAKES_CONFIG.drawBonus.nothingVsNothing;
        stakes.homeEloAdjustment = STAKES_CONFIG.motivationBonus.nothingToPlay;
        stakes.awayEloAdjustment = STAKES_CONFIG.motivationBonus.nothingToPlay;
        stakes.description.push('😴 Match sans enjeu');
    }
    // Autres combinaisons
    else {
        if (homeRelegate) {
            stakes.homeEloAdjustment = STAKES_CONFIG.motivationBonus.fightingForSurvival;
            stakes.description.push('🏠 Domicile lutte pour le maintien');
        }
        if (awayRelegate) {
            stakes.awayEloAdjustment = STAKES_CONFIG.motivationBonus.fightingForSurvival;
            stakes.description.push('✈️ Extérieur lutte pour le maintien');
        }
        if (homeTitle) {
            stakes.homeEloAdjustment = STAKES_CONFIG.motivationBonus.fightingForTitle;
            stakes.description.push('🏠 Domicile en course pour le titre');
        }
        if (awayTitle) {
            stakes.awayEloAdjustment = STAKES_CONFIG.motivationBonus.fightingForTitle;
            stakes.description.push('✈️ Extérieur en course pour le titre');
        }
    }
    
    // Bonus dernière chance (derniers matchs décisifs)
    if (remainingAfterThis <= 2) {
        if (homeSituation.urgency > 70) {
            stakes.homeEloAdjustment += STAKES_CONFIG.motivationBonus.lastChance;
            stakes.description.push('⚡ Dernière chance domicile');
        }
        if (awaySituation.urgency > 70) {
            stakes.awayEloAdjustment += STAKES_CONFIG.motivationBonus.lastChance;
            stakes.description.push('⚡ Dernière chance extérieur');
        }
    }
    
    return stakes;
}

// Calculer les scénarios de fin de saison pour une équipe
function calculateEndSeasonScenarios(teamId, ranking, futureMatchesList, allMatchesList, config) {
    const teamRank = ranking.find(t => t.id == teamId);
    if (!teamRank) return null;
    
    const position = ranking.indexOf(teamRank) + 1;
    const currentPoints = teamRank.points;
    const totalTeams = ranking.length;
    
    // Matchs restants pour cette équipe
    const teamFutureMatches = futureMatchesList.filter(m => 
        m.homeTeamId == teamId || m.awayTeamId == teamId
    );
    const remainingMatches = teamFutureMatches.length;
    const maxPoints = currentPoints + (remainingMatches * 3);
    const minPoints = currentPoints;
    
    // Identifier les adversaires directs (à +/- 9 points = 3 matchs)
    const directRivals = ranking.filter(t => 
        t.id != teamId && 
        Math.abs(t.points - currentPoints) <= remainingMatches * 3
    );
    
    // Confrontations directes restantes
    const directConfrontations = teamFutureMatches.filter(m => {
        const opponentId = m.homeTeamId == teamId ? m.awayTeamId : m.homeTeamId;
        return directRivals.some(r => r.id == opponentId);
    });
    
    // Calculer les objectifs
    const scenarios = {
        teamId,
        teamName: teamRank.name || teamRank.shortName,
        currentPosition: position,
        currentPoints,
        remainingMatches,
        maxPoints,
        minPoints,
        directRivals: directRivals.length,
        directConfrontations: directConfrontations.length,
        objectives: []
    };
    
    // Objectif: Titre
    if (position <= 3) {
        const leader = ranking[0];
        const pointsToTitle = position === 1 ? 0 : leader.points - currentPoints + 1;
        const canWinTitle = maxPoints >= leader.points;
        
        scenarios.objectives.push({
            type: 'title',
            icon: '🏆',
            label: 'Titre',
            pointsNeeded: pointsToTitle,
            possible: canWinTitle,
            probability: canWinTitle ? (position === 1 ? 'Favorable' : 'Possible') : 'Impossible'
        });
    }
    
    // Objectif: Europe
    const europePosition = config.europeanPlaces;
    const europeTeam = ranking[europePosition - 1];
    const firstOutEurope = ranking[europePosition];
    
    if (position <= europePosition + 3) {
        const pointsToEurope = position <= europePosition ? 0 : europeTeam.points - currentPoints + 1;
        const canReachEurope = maxPoints >= (europeTeam?.points || 0);
        
        scenarios.objectives.push({
            type: 'europe',
            icon: '⭐',
            label: 'Europe',
            pointsNeeded: pointsToEurope,
            possible: canReachEurope,
            probability: position <= europePosition ? 'Acquis' : (canReachEurope ? 'Possible' : 'Impossible')
        });
    }
    
    // Objectif: Maintien
    const relegationPosition = totalTeams - config.relegationPlaces;
    const safeTeam = ranking[relegationPosition - 1];
    const firstRelegated = ranking[relegationPosition];
    
    if (position >= relegationPosition - 3) {
        const pointsToSafety = position <= relegationPosition ? 0 : (safeTeam?.points || 0) - currentPoints + 1;
        const canBeSafe = maxPoints >= (firstRelegated?.points || 0);
        const alreadySafe = minPoints > (firstRelegated?.points || 0) + (remainingMatches * 3);
        
        scenarios.objectives.push({
            type: 'survival',
            icon: '🛡️',
            label: 'Maintien',
            pointsNeeded: pointsToSafety,
            possible: canBeSafe,
            probability: alreadySafe ? 'Assuré' : (position <= relegationPosition ? 'En bonne voie' : 'En danger')
        });
    }
    
    // Ajouter les confrontations directes importantes
    scenarios.keyMatches = directConfrontations.map(m => {
        const opponentId = m.homeTeamId == teamId ? m.awayTeamId : m.homeTeamId;
        const opponent = ranking.find(t => t.id == opponentId);
        const isHome = m.homeTeamId == teamId;
        
        return {
            matchDay: m.matchDay,
            opponent: opponent?.shortName || opponent?.name || '?',
            opponentPosition: ranking.indexOf(opponent) + 1,
            opponentPoints: opponent?.points || 0,
            isHome,
            importance: Math.abs(position - (ranking.indexOf(opponent) + 1)) <= 2 ? 'crucial' : 'important'
        };
    });
    
    return scenarios;
}

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

function createSimulationMatchRow(match) {
    const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
    
    const matchKey = `${match.homeTeamId}-${match.awayTeamId}-${match.matchDay}`;
    
    const homeScore = simulatedResults[matchKey]?.home ?? '';
    const awayScore = simulatedResults[matchKey]?.away ?? '';
    
    return `
        <div class="simulation-match" data-match-key="${matchKey}">
            <span class="team-home">${homeTeam ? homeTeam.name : '?'}</span>
            <input type="number" min="0" max="20" class="score-home" value="${homeScore}" data-match-key="${matchKey}" data-type="home">
            <span class="vs">-</span>
            <input type="number" min="0" max="20" class="score-away" value="${awayScore}" data-match-key="${matchKey}" data-type="away">
            <span class="team-away">${awayTeam ? awayTeam.name : '?'}</span>
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
                <td>${team.name}</td>
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
    
    // ========================================
    // STATS AVANT SIMULATION (matchs réels)
    // ========================================
    const realStats = calculateMatchStats(allMatches);
    console.log('📊 Stats réelles:', realStats);
    
    // Structure pour stocker les positions de chaque équipe à chaque simulation
    const positionCounts = {};
    const pointsSum = {};
    const pointsMin = {};
    const pointsMax = {};
    
    // Stats cumulées des simulations pour comparaison
    let totalSimHomeWins = 0;
    let totalSimDraws = 0;
    let totalSimAwayWins = 0;
    let totalSimMatches = 0;
    
    // ========================================
    // TRACKING DES MOMENTS DÉCISIFS
    // ========================================
    const decisiveMoments = {};  // Par journée
    const matchDecisiveness = {}; // Par match: combien de fois ce match a changé le destin
    const titleDecidedAt = {};   // Journée où le titre a été décidé
    const relegationDecidedAt = {}; // Journée où la relégation a été décidée
    const hypeByMatchDay = {};   // Niveau de hype par journée
    
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
    
    // Configuration de la saison
    const config = getSeasonConfig();
    const totalMatchDays = (allTeams.length - 1) * 2;
    const lastPlayedMatchDay = Math.max(0, ...allMatches.map(m => m.matchDay || 0));
    
    // Initialiser le tracking par journée
    for (let day = lastPlayedMatchDay + 1; day <= totalMatchDays; day++) {
        decisiveMoments[day] = {
            titleRaceAlive: 0,      // Nb de simulations où le titre n'est pas encore décidé
            relegationBattleAlive: 0, // Nb de simulations où la relégation n'est pas décidée
            europeRaceAlive: 0,     // Nb de simulations où l'Europe n'est pas décidée
            keyMatches: {},         // Matchs importants cette journée
            averageHype: 0,         // Niveau moyen de hype
            dramaticFinishes: 0     // Nb de fins dramatiques
        };
        hypeByMatchDay[day] = [];
    }
    
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
        
        // Compteurs pour cette simulation
        let simHomeWins = 0;
        let simDraws = 0;
        let simAwayWins = 0;
        
        // Tracking pour cette simulation
        let titleDecided = false;
        let titleDecidedMatchDay = null;
        let relegationDecided = false;
        let relegationDecidedMatchDay = null;
        
        // Trier les matchs par journée
        const sortedMatches = [...futureMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
        
        // Grouper par journée pour traitement séquentiel
        const matchesByDay = {};
        sortedMatches.forEach(m => {
            const day = m.matchDay || 0;
            if (!matchesByDay[day]) matchesByDay[day] = [];
            matchesByDay[day].push(m);
        });
        
        const matchDays = Object.keys(matchesByDay).map(Number).sort((a, b) => a - b);
        
        // Simuler journée par journée
        matchDays.forEach(matchDay => {
            const matchesThisDay = matchesByDay[matchDay];
            const remainingMatchDays = totalMatchDays - matchDay;
            
            // Calculer le classement simulé AVANT cette journée
            const rankingBefore = calculateSimRankingFromStats(simStats);
            
            // Analyser les enjeux AVANT la journée
            const situationBefore = analyzeSeasonSituation(rankingBefore, remainingMatchDays + 1, config);
            
            // Calculer le niveau de hype pour cette journée
            const hypeLevel = calculateHypeLevel(situationBefore, remainingMatchDays, config);
            hypeByMatchDay[matchDay].push(hypeLevel);
            
            // Tracker si les courses sont encore ouvertes
            if (!titleDecided && situationBefore.titleRaceTeams > 1) {
                decisiveMoments[matchDay].titleRaceAlive++;
            }
            if (!relegationDecided && situationBefore.relegationBattleTeams > 0) {
                decisiveMoments[matchDay].relegationBattleAlive++;
            }
            if (situationBefore.europeRaceTeams > config.europeanPlaces) {
                decisiveMoments[matchDay].europeRaceAlive++;
            }
            
            // Simuler chaque match de la journée
            matchesThisDay.forEach(match => {
                const matchKey = `${match.homeTeamId}-${match.awayTeamId}-${matchDay}`;
                
                // Calculer le classement simulé actuel
                const simRanking = calculateSimRankingFromStats(simStats);
                
                // Analyser les enjeux du match
                const stakes = analyzeMatchStakes(match, simRanking, simStats, config, totalMatchDays);
                
                const homeElo = simElo[match.homeTeamId] || 1500;
                const awayElo = simElo[match.awayTeamId] || 1500;
                
                const homeAdvantage = 50;
                const adjustedHomeElo = homeElo + homeAdvantage;
                
                const homeExpectancy = 1 / (1 + Math.pow(10, (awayElo - adjustedHomeElo) / 400));
                
                // Ajuster les probabilités selon les enjeux
                let { drawProb, homeWinProb, awayWinProb } = adjustProbabilitiesForStakes(
                    homeExpectancy, 
                    adjustedHomeElo, 
                    awayElo, 
                    stakes
                );
                
                const score = generateSimulatedScore(homeWinProb, drawProb, awayWinProb, adjustedHomeElo, awayElo);
                
                // Compter les résultats
                if (score.home > score.away) {
                    simHomeWins++;
                } else if (score.home === score.away) {
                    simDraws++;
                } else {
                    simAwayWins++;
                }
                
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
                
                // Tracker si ce match était décisif (a changé une situation clé)
                if (stakes.matchType !== 'normal') {
                    if (!matchDecisiveness[matchKey]) {
                        matchDecisiveness[matchKey] = {
                            match: match,
                            homeTeam: allTeams.find(t => t.id == match.homeTeamId),
                            awayTeam: allTeams.find(t => t.id == match.awayTeamId),
                            timesDecisive: 0,
                            types: {}
                        };
                    }
                    matchDecisiveness[matchKey].timesDecisive++;
                    matchDecisiveness[matchKey].types[stakes.matchType] = 
                        (matchDecisiveness[matchKey].types[stakes.matchType] || 0) + 1;
                }
            });
            
            // Calculer le classement APRÈS cette journée
            const rankingAfter = calculateSimRankingFromStats(simStats);
            const situationAfter = analyzeSeasonSituation(rankingAfter, remainingMatchDays, config);
            
            // Vérifier si le titre vient d'être décidé
            if (!titleDecided && situationAfter.titleMathematicallyDecided) {
                titleDecided = true;
                titleDecidedMatchDay = matchDay;
                titleDecidedAt[matchDay] = (titleDecidedAt[matchDay] || 0) + 1;
            }
            
            // Vérifier si la relégation vient d'être décidée
            if (!relegationDecided && situationAfter.relegationMathematicallyDecided) {
                relegationDecided = true;
                relegationDecidedMatchDay = matchDay;
                relegationDecidedAt[matchDay] = (relegationDecidedAt[matchDay] || 0) + 1;
            }
            
            // Tracker les fins dramatiques (dernière journée avec enjeu)
            if (matchDay === totalMatchDays) {
                if (!titleDecided || !relegationDecided) {
                    decisiveMoments[matchDay].dramaticFinishes++;
                }
            }
        });
        
        // Ajouter aux totaux cumulés
        totalSimHomeWins += simHomeWins;
        totalSimDraws += simDraws;
        totalSimAwayWins += simAwayWins;
        totalSimMatches += sortedMatches.length;
        
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
    
    // ========================================
    // STATS SIMULÉES MOYENNES
    // ========================================
    const simulatedStats = {
        totalMatches: totalSimMatches / numSimulations,
        homeWins: totalSimHomeWins / numSimulations,
        draws: totalSimDraws / numSimulations,
        awayWins: totalSimAwayWins / numSimulations,
        homeWinPct: Math.round((totalSimHomeWins / totalSimMatches) * 1000) / 10,
        drawPct: Math.round((totalSimDraws / totalSimMatches) * 1000) / 10,
        awayWinPct: Math.round((totalSimAwayWins / totalSimMatches) * 1000) / 10
    };
    console.log('📊 Stats simulées moyennes:', simulatedStats);
    
    // ========================================
    // CALCULER LA HYPE MOYENNE PAR JOURNÉE
    // ========================================
    const hypeTimeline = {};
    Object.keys(hypeByMatchDay).forEach(day => {
        const hypes = hypeByMatchDay[day];
        if (hypes.length > 0) {
            hypeTimeline[day] = {
                average: Math.round(hypes.reduce((a, b) => a + b, 0) / hypes.length),
                max: Math.max(...hypes),
                min: Math.min(...hypes)
            };
        }
    });
    
    // ========================================
    // IDENTIFIER LES MATCHS LES PLUS DÉCISIFS
    // ========================================
    const mostDecisiveMatches = Object.values(matchDecisiveness)
        .sort((a, b) => b.timesDecisive - a.timesDecisive)
        .slice(0, 10)
        .map(m => ({
            ...m,
            decisivePercent: Math.round((m.timesDecisive / numSimulations) * 100)
        }));
    
    // ========================================
    // ANALYSE DES SCÉNARIOS (dernières journées)
    // ========================================
    const scenarios = analyzeEndSeasonScenarios(currentRanking, futureMatches, config, totalMatchDays);
    
    // Ajouter les stats de décision
    scenarios.titleDecidedAt = titleDecidedAt;
    scenarios.relegationDecidedAt = relegationDecidedAt;
    scenarios.hypeTimeline = hypeTimeline;
    scenarios.decisiveMoments = decisiveMoments;
    scenarios.mostDecisiveMatches = mostDecisiveMatches;
    
    // Calculer les statistiques finales
    const results = allTeams.map(team => {
        const avgPoints = pointsSum[team.id] / numSimulations;
        
        // Position moyenne pondérée
        let avgPosition = 0;
        for (let pos = 1; pos <= allTeams.length; pos++) {
            avgPosition += pos * (positionCounts[team.id][pos] / numSimulations);
        }
        
        // Probabilités par zone
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
        teams: results,
        realStats: realStats,
        simulatedStats: simulatedStats,
        scenarios: scenarios
    };
    
    return monteCarloResults;
}

// ========================================
// ANALYSE DE LA SITUATION DE LA SAISON
// ========================================

function analyzeSeasonSituation(ranking, remainingMatches, config) {
    const totalTeams = ranking.length;
    const relegationZone = totalTeams - config.relegationPlaces;
    
    const leader = ranking[0];
    const leaderPoints = leader?.points || 0;
    const maxRemainingPoints = remainingMatches * 3;
    
    // Combien d'équipes peuvent encore mathématiquement être championnes ?
    let titleRaceTeams = 0;
    ranking.forEach(team => {
        if (team.points + maxRemainingPoints >= leaderPoints) {
            titleRaceTeams++;
        }
    });
    
    // Le titre est-il mathématiquement décidé ?
    const secondPlace = ranking[1];
    const titleMathematicallyDecided = secondPlace && 
        (leaderPoints > secondPlace.points + maxRemainingPoints);
    
    // Combien d'équipes luttent pour le maintien ?
    const safeTeam = ranking[relegationZone - 1];
    const safePoints = safeTeam?.points || 0;
    
    let relegationBattleTeams = 0;
    ranking.forEach((team, index) => {
        const pos = index + 1;
        // En zone de relégation ou peut encore y tomber
        if (pos > relegationZone || team.points <= safePoints + maxRemainingPoints) {
            if (team.points + maxRemainingPoints >= safePoints) {
                relegationBattleTeams++;
            }
        }
    });
    
    // La relégation est-elle mathématiquement décidée ?
    const firstRelegated = ranking[relegationZone];
    const relegationMathematicallyDecided = firstRelegated && 
        (safePoints > firstRelegated.points + maxRemainingPoints);
    
    // Combien d'équipes peuvent atteindre l'Europe ?
    const euroThreshold = ranking[config.europeanPlaces - 1]?.points || 0;
    let europeRaceTeams = 0;
    ranking.forEach(team => {
        if (team.points + maxRemainingPoints >= euroThreshold) {
            europeRaceTeams++;
        }
    });
    
    return {
        titleRaceTeams,
        titleMathematicallyDecided,
        relegationBattleTeams,
        relegationMathematicallyDecided,
        europeRaceTeams,
        remainingMatches
    };
}

// ========================================
// CALCUL DU NIVEAU DE HYPE
// ========================================

function calculateHypeLevel(situation, remainingMatchDays, config) {
    let hype = 0;
    
    // Base: plus on se rapproche de la fin, plus c'est intense
    const endOfSeasonBonus = Math.max(0, (10 - remainingMatchDays) * 5);
    hype += endOfSeasonBonus;
    
    // Course au titre serrée
    if (situation.titleRaceTeams >= 2) {
        hype += 20;
        if (situation.titleRaceTeams >= 3) hype += 10;
    }
    
    // Lutte pour le maintien
    if (situation.relegationBattleTeams >= 4) {
        hype += 15;
        if (situation.relegationBattleTeams >= 6) hype += 10;
    }
    
    // Course à l'Europe serrée
    if (situation.europeRaceTeams > config.europeanPlaces + 2) {
        hype += 10;
    }
    
    // Dernières journées avec enjeux = maximum de hype
    if (remainingMatchDays <= 2) {
        if (!situation.titleMathematicallyDecided) hype += 25;
        if (!situation.relegationMathematicallyDecided) hype += 20;
    }
    
    // Bonus "finale" dernière journée
    if (remainingMatchDays === 0) {
        hype += 15;
    }
    
    return Math.min(100, hype); // Plafonner à 100
}

// ========================================
// ANALYSE DES ENJEUX DU MATCH
// ========================================

function analyzeMatchStakes(match, simRanking, simStats, config, totalMatchDays) {
    const homeTeamRank = simRanking.findIndex(t => t.id == match.homeTeamId) + 1;
    const awayTeamRank = simRanking.findIndex(t => t.id == match.awayTeamId) + 1;
    
    const homeTeamData = simRanking.find(t => t.id == match.homeTeamId);
    const awayTeamData = simRanking.find(t => t.id == match.awayTeamId);
    
    const remainingMatches = totalMatchDays - (match.matchDay || 0) + 1;
    const maxRemainingPoints = remainingMatches * 3;
    
    const totalTeams = allTeams.length;
    const relegationZone = totalTeams - config.relegationPlaces;
    
    const stakes = {
        homeStake: 'normal',
        awayStake: 'normal',
        matchType: 'normal',
        intensity: 1.0, // Multiplicateur d'intensité
        drawBonus: 0    // Bonus de probabilité de nul
    };
    
    // Déterminer les enjeux pour l'équipe à domicile
    if (homeTeamRank <= config.championPlaces) {
        stakes.homeStake = 'title';
    } else if (homeTeamRank <= config.europeanPlaces) {
        stakes.homeStake = 'europe';
    } else if (homeTeamRank > relegationZone) {
        stakes.homeStake = 'relegation';
    } else if (homeTeamRank > relegationZone - 3) {
        // Proche de la zone rouge
        stakes.homeStake = 'survival';
    }
    
    // Déterminer les enjeux pour l'équipe à l'extérieur
    if (awayTeamRank <= config.championPlaces) {
        stakes.awayStake = 'title';
    } else if (awayTeamRank <= config.europeanPlaces) {
        stakes.awayStake = 'europe';
    } else if (awayTeamRank > relegationZone) {
        stakes.awayStake = 'relegation';
    } else if (awayTeamRank > relegationZone - 3) {
        stakes.awayStake = 'survival';
    }
    
    // Déterminer le type de match
    if (stakes.homeStake === 'relegation' && stakes.awayStake === 'relegation') {
        stakes.matchType = 'relegation_battle';
        stakes.intensity = 1.4;
        stakes.drawBonus = 0.08; // Matchs très accrochés
    } else if (stakes.homeStake === 'title' && stakes.awayStake === 'title') {
        stakes.matchType = 'title_decider';
        stakes.intensity = 1.5;
        stakes.drawBonus = 0.05;
    } else if ((stakes.homeStake === 'europe' && stakes.awayStake === 'europe')) {
        stakes.matchType = 'europe_battle';
        stakes.intensity = 1.3;
        stakes.drawBonus = 0.05;
    } else if (stakes.homeStake === 'relegation' || stakes.awayStake === 'relegation') {
        stakes.matchType = 'survival_match';
        stakes.intensity = 1.2;
        stakes.drawBonus = 0.03;
    } else if (stakes.homeStake === 'title' || stakes.awayStake === 'title') {
        stakes.matchType = 'title_race';
        stakes.intensity = 1.2;
    }
    
    // Vérifier si une équipe n'a plus rien à jouer
    const homeMaxPoints = (homeTeamData?.points || 0) + maxRemainingPoints;
    const awayMaxPoints = (awayTeamData?.points || 0) + maxRemainingPoints;
    
    // Si l'équipe ne peut plus atteindre l'Europe et est sauvée
    const euroThreshold = simRanking[config.europeanPlaces - 1]?.points || 0;
    const safetyThreshold = simRanking[relegationZone - 1]?.points || 0;
    
    if (homeMaxPoints < euroThreshold && (homeTeamData?.points || 0) > safetyThreshold + 6) {
        stakes.homeStake = 'nothing';
        stakes.intensity *= 0.85; // Moins de motivation
    }
    if (awayMaxPoints < euroThreshold && (awayTeamData?.points || 0) > safetyThreshold + 6) {
        stakes.awayStake = 'nothing';
        stakes.intensity *= 0.85;
    }
    
    // Dernières journées = plus d'intensité
    if (remainingMatches <= 4) {
        stakes.intensity *= 1.15;
        stakes.drawBonus += 0.02;
    }
    if (remainingMatches <= 2) {
        stakes.intensity *= 1.1;
        stakes.drawBonus += 0.03;
    }
    
    return stakes;
}

// Ajuster les probabilités selon les enjeux
function adjustProbabilitiesForStakes(homeExpectancy, homeElo, awayElo, stakes) {
    const eloDiff = Math.abs(homeElo - awayElo);
    const isCloseMatch = eloDiff < 100;
    
    // Probabilité de base de nul
    let drawProb = isCloseMatch ? 0.28 : 0.23;
    
    // Ajouter le bonus de nul selon les enjeux
    drawProb += stakes.drawBonus;
    
    // Plafonner la probabilité de nul
    drawProb = Math.min(drawProb, 0.40);
    
    // Calculer les probabilités de victoire
    let homeWinProb = homeExpectancy * (1 - drawProb);
    let awayWinProb = (1 - homeExpectancy) * (1 - drawProb);
    
    // Ajuster selon la motivation
    if (stakes.homeStake === 'nothing' && stakes.awayStake !== 'nothing') {
        // Équipe à domicile démotivée, extérieur motivé
        homeWinProb *= 0.9;
        awayWinProb *= 1.1;
    } else if (stakes.awayStake === 'nothing' && stakes.homeStake !== 'nothing') {
        // Équipe extérieur démotivée, domicile motivé
        homeWinProb *= 1.1;
        awayWinProb *= 0.9;
    }
    
    // Équipe en danger de relégation = se bat plus
    if (stakes.homeStake === 'relegation') {
        homeWinProb *= 1.08;
    }
    if (stakes.awayStake === 'relegation') {
        awayWinProb *= 1.05; // Un peu moins car extérieur
    }
    
    // Normaliser pour que la somme = 1
    const total = homeWinProb + drawProb + awayWinProb;
    homeWinProb /= total;
    drawProb /= total;
    awayWinProb /= total;
    
    return { drawProb, homeWinProb, awayWinProb };
}

// Calculer le classement à partir des stats simulées
function calculateSimRankingFromStats(simStats) {
    const ranking = allTeams.map(team => {
        const stats = simStats[team.id];
        return {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            points: stats.points,
            goalDifference: stats.goalsFor - stats.goalsAgainst,
            goalsFor: stats.goalsFor
        };
    });
    
    ranking.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });
    
    return ranking;
}

// ========================================
// ANALYSE DES SCÉNARIOS FIN DE SAISON
// ========================================

function analyzeEndSeasonScenarios(currentRanking, futureMatches, config, totalMatchDays) {
    const lastPlayedMatchDay = Math.max(0, ...allMatches.map(m => m.matchDay || 0));
    const remainingMatchDays = totalMatchDays - lastPlayedMatchDay;
    
    const scenarios = {
        title: [],
        europe: [],
        relegation: [],
        keyMatches: []
    };
    
    const totalTeams = allTeams.length;
    const relegationZone = totalTeams - config.relegationPlaces;
    
    // Analyser chaque équipe
    currentRanking.forEach((team, index) => {
        const position = index + 1;
        const remainingMatches = futureMatches.filter(m => 
            m.homeTeamId == team.id || m.awayTeamId == team.id
        );
        const maxPossiblePoints = team.points + (remainingMatches.length * 3);
        const minPossiblePoints = team.points; // Si tout perdu
        
        // Points du leader et du barragiste
        const leaderPoints = currentRanking[0]?.points || 0;
        const euroLastPoints = currentRanking[config.europeanPlaces - 1]?.points || 0;
        const safePoints = currentRanking[relegationZone - 1]?.points || 0;
        const relegatedPoints = currentRanking[relegationZone]?.points || 0;
        
        // Course au titre
        if (position <= 3 || maxPossiblePoints >= leaderPoints) {
            const pointsNeeded = leaderPoints - team.points + 1;
            const canWinTitle = maxPossiblePoints >= leaderPoints;
            
            scenarios.title.push({
                team: team,
                position: position,
                points: team.points,
                maxPoints: maxPossiblePoints,
                pointsFromLeader: leaderPoints - team.points,
                remainingMatches: remainingMatches.length,
                canWinTitle: canWinTitle,
                mustWin: Math.ceil(pointsNeeded / 3)
            });
        }
        
        // Course à l'Europe
        if (position <= config.europeanPlaces + 3 || maxPossiblePoints >= euroLastPoints) {
            const inEuropeZone = position <= config.europeanPlaces;
            const pointsAdvance = inEuropeZone ? team.points - (currentRanking[config.europeanPlaces]?.points || 0) : 0;
            const pointsNeeded = inEuropeZone ? 0 : euroLastPoints - team.points + 1;
            
            scenarios.europe.push({
                team: team,
                position: position,
                points: team.points,
                maxPoints: maxPossiblePoints,
                inZone: inEuropeZone,
                pointsAdvance: pointsAdvance,
                pointsNeeded: pointsNeeded,
                remainingMatches: remainingMatches.length
            });
        }
        
        // Lutte pour le maintien
        if (position >= relegationZone - 3 || minPossiblePoints <= safePoints) {
            const inDanger = position > relegationZone;
            const pointsToSafety = inDanger ? safePoints - team.points + 1 : 0;
            const pointsAdvance = !inDanger ? team.points - relegatedPoints : 0;
            
            scenarios.relegation.push({
                team: team,
                position: position,
                points: team.points,
                maxPoints: maxPossiblePoints,
                inDanger: inDanger,
                pointsToSafety: pointsToSafety,
                pointsAdvance: pointsAdvance,
                remainingMatches: remainingMatches.length,
                isSafe: minPossiblePoints > safePoints
            });
        }
    });
    
    // Identifier les matchs clés
    futureMatches.forEach(match => {
        const homeTeam = currentRanking.find(t => t.id == match.homeTeamId);
        const awayTeam = currentRanking.find(t => t.id == match.awayTeamId);
        
        if (!homeTeam || !awayTeam) return;
        
        const homePos = currentRanking.findIndex(t => t.id == match.homeTeamId) + 1;
        const awayPos = currentRanking.findIndex(t => t.id == match.awayTeamId) + 1;
        
        let keyMatch = null;
        
        // Match entre équipes en lutte pour le titre
        if (homePos <= 3 && awayPos <= 3) {
            keyMatch = {
                match: match,
                type: 'title',
                label: '🏆 Choc pour le titre',
                importance: 5
            };
        }
        // Match entre équipes en lutte pour l'Europe
        else if (homePos <= config.europeanPlaces + 2 && awayPos <= config.europeanPlaces + 2 && 
                 (homePos > config.europeanPlaces - 2 || awayPos > config.europeanPlaces - 2)) {
            keyMatch = {
                match: match,
                type: 'europe',
                label: '⭐ Duel pour l\'Europe',
                importance: 4
            };
        }
        // Match entre relégables
        else if (homePos > relegationZone - 2 && awayPos > relegationZone - 2) {
            keyMatch = {
                match: match,
                type: 'relegation',
                label: '🔥 Match de la peur',
                importance: 5
            };
        }
        // Confrontation directe pour le maintien
        else if ((homePos > relegationZone || awayPos > relegationZone) && 
                 Math.abs(homeTeam.points - awayTeam.points) <= 6) {
            keyMatch = {
                match: match,
                type: 'survival',
                label: '⚔️ 6 points',
                importance: 4
            };
        }
        
        if (keyMatch) {
            keyMatch.homeTeam = homeTeam;
            keyMatch.awayTeam = awayTeam;
            keyMatch.homePos = homePos;
            keyMatch.awayPos = awayPos;
            scenarios.keyMatches.push(keyMatch);
        }
    });
    
    // Trier les matchs clés par journée puis importance
    scenarios.keyMatches.sort((a, b) => {
        if (a.match.matchDay !== b.match.matchDay) return a.match.matchDay - b.match.matchDay;
        return b.importance - a.importance;
    });
    
    return scenarios;
}

// Calculer les stats des matchs (victoires domicile, nuls, défaites domicile)
function calculateMatchStats(matches) {
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    
    matches.forEach(match => {
        if (!match.finalScore) return;
        
        if (match.finalScore.home > match.finalScore.away) {
            homeWins++;
        } else if (match.finalScore.home === match.finalScore.away) {
            draws++;
        } else {
            awayWins++;
        }
    });
    
    const total = homeWins + draws + awayWins;
    
    return {
        totalMatches: total,
        homeWins: homeWins,
        draws: draws,
        awayWins: awayWins,
        homeWinPct: total > 0 ? Math.round((homeWins / total) * 1000) / 10 : 0,
        drawPct: total > 0 ? Math.round((draws / total) * 1000) / 10 : 0,
        awayWinPct: total > 0 ? Math.round((awayWins / total) * 1000) / 10 : 0
    };
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
    
    // Section comparaison stats
    let statsComparisonHtml = '';
    if (results.realStats && results.simulatedStats) {
        const real = results.realStats;
        const sim = results.simulatedStats;
        
        // Calculer les différences
        const homeWinDiff = sim.homeWinPct - real.homeWinPct;
        const drawDiff = sim.drawPct - real.drawPct;
        const awayWinDiff = sim.awayWinPct - real.awayWinPct;
        
        // Fonction pour formater la différence avec couleur
        const formatDiff = (diff) => {
            const sign = diff >= 0 ? '+' : '';
            const color = Math.abs(diff) <= 3 ? '#27ae60' : (Math.abs(diff) <= 6 ? '#f39c12' : '#e74c3c');
            return `<span style="color: ${color}; font-weight: 600;">${sign}${diff.toFixed(1)}%</span>`;
        };
        
        statsComparisonHtml = `
            <div style="background: linear-gradient(135deg, #f8f9fa, #e9ecef); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h5 style="margin: 0 0 1rem 0; color: #2c3e50; display: flex; align-items: center; gap: 0.5rem;">
                    📊 Validation de la simulation
                    <small style="color: #7f8c8d; font-weight: normal;">(comparaison avec les ${real.totalMatches} matchs joués)</small>
                </h5>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                    <!-- Victoires domicile -->
                    <div style="background: white; border-radius: 10px; padding: 1rem; text-align: center; border-left: 4px solid #27ae60;">
                        <div style="font-size: 0.85rem; color: #7f8c8d; margin-bottom: 0.5rem;">🏠 Victoires domicile</div>
                        <div style="display: flex; justify-content: space-around; align-items: center;">
                            <div>
                                <div style="font-size: 1.5rem; font-weight: bold; color: #2c3e50;">${real.homeWinPct}%</div>
                                <div style="font-size: 0.75rem; color: #95a5a6;">Réel (${real.homeWins})</div>
                            </div>
                            <div style="font-size: 1.2rem; color: #95a5a6;">→</div>
                            <div>
                                <div style="font-size: 1.5rem; font-weight: bold; color: #2c3e50;">${sim.homeWinPct}%</div>
                                <div style="font-size: 0.75rem; color: #95a5a6;">Simulé</div>
                            </div>
                        </div>
                        <div style="margin-top: 0.5rem;">Écart: ${formatDiff(homeWinDiff)}</div>
                    </div>
                    
                    <!-- Matchs nuls -->
                    <div style="background: white; border-radius: 10px; padding: 1rem; text-align: center; border-left: 4px solid #f39c12;">
                        <div style="font-size: 0.85rem; color: #7f8c8d; margin-bottom: 0.5rem;">🤝 Matchs nuls</div>
                        <div style="display: flex; justify-content: space-around; align-items: center;">
                            <div>
                                <div style="font-size: 1.5rem; font-weight: bold; color: #2c3e50;">${real.drawPct}%</div>
                                <div style="font-size: 0.75rem; color: #95a5a6;">Réel (${real.draws})</div>
                            </div>
                            <div style="font-size: 1.2rem; color: #95a5a6;">→</div>
                            <div>
                                <div style="font-size: 1.5rem; font-weight: bold; color: #2c3e50;">${sim.drawPct}%</div>
                                <div style="font-size: 0.75rem; color: #95a5a6;">Simulé</div>
                            </div>
                        </div>
                        <div style="margin-top: 0.5rem;">Écart: ${formatDiff(drawDiff)}</div>
                    </div>
                    
                    <!-- Victoires extérieur -->
                    <div style="background: white; border-radius: 10px; padding: 1rem; text-align: center; border-left: 4px solid #3498db;">
                        <div style="font-size: 0.85rem; color: #7f8c8d; margin-bottom: 0.5rem;">✈️ Victoires extérieur</div>
                        <div style="display: flex; justify-content: space-around; align-items: center;">
                            <div>
                                <div style="font-size: 1.5rem; font-weight: bold; color: #2c3e50;">${real.awayWinPct}%</div>
                                <div style="font-size: 0.75rem; color: #95a5a6;">Réel (${real.awayWins})</div>
                            </div>
                            <div style="font-size: 1.2rem; color: #95a5a6;">→</div>
                            <div>
                                <div style="font-size: 1.5rem; font-weight: bold; color: #2c3e50;">${sim.awayWinPct}%</div>
                                <div style="font-size: 0.75rem; color: #95a5a6;">Simulé</div>
                            </div>
                        </div>
                        <div style="margin-top: 0.5rem;">Écart: ${formatDiff(awayWinDiff)}</div>
                    </div>
                </div>
                
                <div style="margin-top: 1rem; text-align: center; font-size: 0.85rem; color: #7f8c8d;">
                    ${Math.abs(homeWinDiff) <= 3 && Math.abs(drawDiff) <= 3 && Math.abs(awayWinDiff) <= 3 
                        ? '✅ <span style="color: #27ae60; font-weight: 600;">Simulation cohérente</span> — Les écarts sont inférieurs à 3%, la simulation reflète bien la réalité de la saison.'
                        : Math.abs(homeWinDiff) <= 6 && Math.abs(drawDiff) <= 6 && Math.abs(awayWinDiff) <= 6
                            ? '⚠️ <span style="color: #f39c12; font-weight: 600;">Simulation acceptable</span> — Écarts entre 3% et 6%, légère différence avec la tendance de la saison.'
                            : '⚡ <span style="color: #e74c3c; font-weight: 600;">Écart notable</span> — La simulation diverge de la tendance observée cette saison (écart > 6%).'
                    }
                </div>
            </div>
        `;
    }
    
    // Section scénarios
    let scenariosHtml = '';
    if (results.scenarios) {
        scenariosHtml = generateScenariosDisplay(results.scenarios, config);
    }
    
    let html = `
        <div class="monte-carlo-section" style="margin-top: 2rem; background: white; border-radius: 15px; padding: 1.5rem; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
            <h4 style="margin-bottom: 1rem; color: #2c3e50;">
                📊 Projection fin de saison 
                <small style="color: #7f8c8d; font-weight: normal;">(${results.numSimulations} simulations)</small>
            </h4>
            
            ${statsComparisonHtml}
            ${scenariosHtml}
            
            <table class="monte-carlo-table" style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead>
                    <tr style="background: linear-gradient(135deg, #2c3e50, #34495e); color: white;">
                        <th style="padding: 0.6rem; text-align: center; width: 50px;">Proj.</th>
                        <th style="padding: 0.6rem; text-align: left; width: 150px;">Équipe</th>
                        <th style="padding: 0.6rem; text-align: center; width: 50px;">Pts</th>
                        <th style="padding: 0.6rem; text-align: center; width: 70px;">Min-Max</th>
                        <th style="padding: 0.6rem; text-align: center; width: 55px;" title="Champion">🏆</th>
                        <th style="padding: 0.6rem; text-align: center; width: 55px;" title="Europe">⭐</th>
                        <th style="padding: 0.6rem; text-align: center; width: 55px;" title="Relégation">⬇️</th>
                        <th style="padding: 0.6rem; text-align: left;">Distribution</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    results.teams.forEach((team, index) => {
        const position = index + 1;
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
                <td style="padding: 0.5rem; text-align: center; font-weight: bold;">${team.avgPosition}</td>
                <td style="padding: 0.5rem; font-weight: 600;">${team.name}</td>
                <td style="padding: 0.5rem; text-align: center; font-weight: bold;">${team.avgPoints}</td>
                <td style="padding: 0.5rem; text-align: center; color: #7f8c8d; font-size: 0.85rem;">${team.minPoints}-${team.maxPoints}</td>
                <td style="padding: 0.5rem; text-align: center;">
                    ${team.champProb > 0 ? `<span style="color: #f39c12; font-weight: bold;">${team.champProb}%</span>` : '-'}
                </td>
                <td style="padding: 0.5rem; text-align: center;">
                    ${team.euroProb > 0 ? `<span style="color: #3498db; font-weight: bold;">${team.euroProb}%</span>` : '-'}
                </td>
                <td style="padding: 0.5rem; text-align: center;">
                    ${team.relegProb > 0 ? `<span style="color: #e74c3c; font-weight: bold;">${team.relegProb}%</span>` : '-'}
                </td>
                <td style="padding: 0.5rem;">${distributionBar}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
            
            <div style="margin-top: 1rem; display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap; font-size: 0.85rem; color: #7f8c8d;">
                <span><span style="display: inline-block; width: 12px; height: 12px; background: #f39c12; border-radius: 2px; margin-right: 4px;"></span> Champion</span>
                <span><span style="display: inline-block; width: 12px; height: 12px; background: #3498db; border-radius: 2px; margin-right: 4px;"></span> Europe</span>
                <span><span style="display: inline-block; width: 12px; height: 12px; background: #95a5a6; border-radius: 2px; margin-right: 4px;"></span> Milieu</span>
                <span><span style="display: inline-block; width: 12px; height: 12px; background: #e74c3c; border-radius: 2px; margin-right: 4px;"></span> Relégation</span>
            </div>
        </div>
    `;
    
    return html;
}

// ========================================
// AFFICHAGE DES SCÉNARIOS
// ========================================

function generateScenariosDisplay(scenarios, config) {
    let html = `
        <div style="margin-bottom: 1.5rem;">
            <!-- Courbe de Hype -->
            ${generateHypeTimelineDisplay(scenarios.hypeTimeline, scenarios.decisiveMoments, scenarios.titleDecidedAt, scenarios.relegationDecidedAt)}
            
            <!-- Matchs les plus décisifs -->
            ${generateMostDecisiveMatchesDisplay(scenarios.mostDecisiveMatches)}
            
            <!-- Matchs clés à venir -->
            ${generateKeyMatchesDisplay(scenarios.keyMatches)}
            
            <!-- Grille des 3 sections -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem;">
                <!-- Course au titre -->
                ${generateTitleRaceDisplay(scenarios.title)}
                
                <!-- Course à l'Europe -->
                ${generateEuropeRaceDisplay(scenarios.europe, config)}
                
                <!-- Lutte pour le maintien -->
                ${generateRelegationBattleDisplay(scenarios.relegation, config)}
            </div>
        </div>
    `;
    
    return html;
}

// ========================================
// AFFICHAGE DE LA TIMELINE DE HYPE
// ========================================

function generateHypeTimelineDisplay(hypeTimeline, decisiveMoments, titleDecidedAt, relegationDecidedAt) {
    if (!hypeTimeline || Object.keys(hypeTimeline).length === 0) return '';
    
    const matchDays = Object.keys(hypeTimeline).map(Number).sort((a, b) => a - b);
    if (matchDays.length === 0) return '';
    
    // Calculer les statistiques
    const avgHypes = matchDays.map(day => hypeTimeline[day]?.average || 0);
    const maxHype = Math.max(...avgHypes, 1);
    
    // Calculer quand le titre/relégation sont décidés en moyenne
    let avgTitleDecided = 0;
    let titleDecidedCount = 0;
    Object.entries(titleDecidedAt || {}).forEach(([day, count]) => {
        avgTitleDecided += parseInt(day) * count;
        titleDecidedCount += count;
    });
    avgTitleDecided = titleDecidedCount > 0 ? Math.round(avgTitleDecided / titleDecidedCount) : null;
    
    let avgRelegationDecided = 0;
    let relegationDecidedCount = 0;
    Object.entries(relegationDecidedAt || {}).forEach(([day, count]) => {
        avgRelegationDecided += parseInt(day) * count;
        relegationDecidedCount += count;
    });
    avgRelegationDecided = relegationDecidedCount > 0 ? Math.round(avgRelegationDecided / relegationDecidedCount) : null;
    
    // Générer les barres de la timeline
    const barWidth = Math.max(8, Math.floor(100 / matchDays.length) - 1);
    
    let barsHtml = matchDays.map(day => {
        const hype = hypeTimeline[day]?.average || 0;
        const height = Math.max(5, (hype / maxHype) * 100);
        
        // Couleur selon le niveau de hype
        let color;
        if (hype >= 70) color = '#e74c3c'; // Rouge = très intense
        else if (hype >= 50) color = '#f39c12'; // Orange = intense
        else if (hype >= 30) color = '#3498db'; // Bleu = modéré
        else color = '#95a5a6'; // Gris = calme
        
        // Ajouter des indicateurs pour les décisions
        let indicator = '';
        const titlePct = titleDecidedAt?.[day] ? Math.round((titleDecidedAt[day] / titleDecidedCount) * 100) : 0;
        const relegPct = relegationDecidedAt?.[day] ? Math.round((relegationDecidedAt[day] / relegationDecidedCount) * 100) : 0;
        
        if (titlePct >= 10) {
            indicator += `<div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 0.6rem;">🏆${titlePct}%</div>`;
        }
        if (relegPct >= 10) {
            indicator += `<div style="position: absolute; top: -30px; left: 50%; transform: translateX(-50%); font-size: 0.6rem;">🛡️${relegPct}%</div>`;
        }
        
        // Info sur les courses encore ouvertes
        const dm = decisiveMoments?.[day];
        const titleAlive = dm?.titleRaceAlive || 0;
        const relegAlive = dm?.relegationBattleAlive || 0;
        
        return `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; flex: 1; min-width: ${barWidth}px;">
                ${indicator}
                <div style="width: 100%; max-width: 20px; height: ${height}%; background: ${color}; border-radius: 3px 3px 0 0; transition: height 0.3s;" 
                     title="J${day}: Hype ${hype}%&#10;🏆 Titre en jeu: ${titleAlive}%&#10;🛡️ Maintien en jeu: ${relegAlive}%"></div>
                <div style="font-size: 0.6rem; color: #95a5a6; margin-top: 2px;">${day}</div>
            </div>
        `;
    }).join('');
    
    // Stats résumées
    const finalHype = avgHypes[avgHypes.length - 1] || 0;
    const peakHype = Math.max(...avgHypes);
    const peakDay = matchDays[avgHypes.indexOf(peakHype)];
    
    let html = `
        <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem;">
            <h5 style="margin: 0 0 1rem 0; color: white; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem;">
                📈 Courbe de Hype de la saison
                <small style="color: #7f8c8d; font-weight: normal;">(intensité des enjeux par journée)</small>
            </h5>
            
            <div style="display: flex; align-items: flex-end; height: 80px; gap: 2px; padding: 20px 0 0 0;">
                ${barsHtml}
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                <div style="text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: #f39c12;">J${peakDay}</div>
                    <div style="font-size: 0.7rem; color: #7f8c8d;">Pic de hype</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: ${finalHype >= 50 ? '#e74c3c' : '#27ae60'};">${finalHype}%</div>
                    <div style="font-size: 0.7rem; color: #7f8c8d;">Hype finale</div>
                </div>
                ${avgTitleDecided ? `
                <div style="text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: #f39c12;">J${avgTitleDecided}</div>
                    <div style="font-size: 0.7rem; color: #7f8c8d;">🏆 Titre décidé (moy.)</div>
                </div>
                ` : ''}
                ${avgRelegationDecided ? `
                <div style="text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: #e74c3c;">J${avgRelegationDecided}</div>
                    <div style="font-size: 0.7rem; color: #7f8c8d;">🛡️ Maintien décidé (moy.)</div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    return html;
}

// ========================================
// MATCHS LES PLUS DÉCISIFS
// ========================================

function generateMostDecisiveMatchesDisplay(mostDecisiveMatches) {
    if (!mostDecisiveMatches || mostDecisiveMatches.length === 0) return '';
    
    // Filtrer pour garder les matchs vraiment décisifs (> 20%)
    const significantMatches = mostDecisiveMatches.filter(m => m.decisivePercent >= 20).slice(0, 6);
    
    if (significantMatches.length === 0) return '';
    
    let matchesHtml = significantMatches.map(m => {
        // Déterminer le type principal
        const mainType = Object.entries(m.types).sort((a, b) => b[1] - a[1])[0]?.[0] || 'normal';
        
        let typeLabel, typeColor, typeIcon;
        switch (mainType) {
            case 'relegation_battle':
                typeLabel = 'Maintien';
                typeColor = '#e74c3c';
                typeIcon = '🔥';
                break;
            case 'title_decider':
            case 'title_race':
                typeLabel = 'Titre';
                typeColor = '#f39c12';
                typeIcon = '🏆';
                break;
            case 'europe_battle':
                typeLabel = 'Europe';
                typeColor = '#3498db';
                typeIcon = '⭐';
                break;
            case 'survival_match':
                typeLabel = 'Survie';
                typeColor = '#e67e22';
                typeIcon = '⚔️';
                break;
            default:
                typeLabel = 'Décisif';
                typeColor = '#9b59b6';
                typeIcon = '⚡';
        }
        
        // Barre de progression
        const barWidth = m.decisivePercent;
        
        return `
            <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 0.75rem; border-left: 3px solid ${typeColor};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.7rem; color: #7f8c8d;">J${m.match.matchDay}</span>
                        <span style="font-weight: 600; color: white;">${m.homeTeam?.shortName || '?'}</span>
                        <span style="color: #7f8c8d;">vs</span>
                        <span style="font-weight: 600; color: white;">${m.awayTeam?.shortName || '?'}</span>
                    </div>
                    <span style="background: ${typeColor}; color: white; padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.7rem;">
                        ${typeIcon} ${typeLabel}
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${barWidth}%; height: 100%; background: ${typeColor}; border-radius: 3px;"></div>
                    </div>
                    <span style="font-size: 0.85rem; font-weight: bold; color: ${typeColor};">${m.decisivePercent}%</span>
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div style="background: linear-gradient(135deg, #2c3e50, #34495e); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
            <h5 style="margin: 0 0 1rem 0; color: white; font-size: 0.95rem;">
                ⚡ Matchs les plus décisifs
                <small style="color: #7f8c8d; font-weight: normal;">(% de simulations où ce match change le destin)</small>
            </h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75rem;">
                ${matchesHtml}
            </div>
        </div>
    `;
}

function generateKeyMatchesDisplay(keyMatches) {
    if (!keyMatches || keyMatches.length === 0) return '';
    
    // Limiter à 6 matchs clés
    const topMatches = keyMatches.slice(0, 6);
    
    let html = `
        <div style="background: linear-gradient(135deg, #2c3e50, #34495e); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
            <h5 style="margin: 0 0 1rem 0; color: white; font-size: 0.95rem;">
                ⚔️ Matchs décisifs à venir
            </h5>
            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
    `;
    
    topMatches.forEach(km => {
        let bgColor, borderColor;
        switch (km.type) {
            case 'title':
                bgColor = 'rgba(241, 196, 15, 0.15)';
                borderColor = '#f39c12';
                break;
            case 'europe':
                bgColor = 'rgba(52, 152, 219, 0.15)';
                borderColor = '#3498db';
                break;
            case 'relegation':
            case 'survival':
                bgColor = 'rgba(231, 76, 60, 0.15)';
                borderColor = '#e74c3c';
                break;
            default:
                bgColor = 'rgba(255,255,255,0.1)';
                borderColor = '#95a5a6';
        }
        
        html += `
            <div style="background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 0.6rem 1rem; flex: 1; min-width: 200px;">
                <div style="font-size: 0.7rem; color: #95a5a6; margin-bottom: 0.25rem;">J${km.match.matchDay} • ${km.label}</div>
                <div style="display: flex; align-items: center; justify-content: space-between; color: white;">
                    <span style="font-weight: 600;">${km.homeTeam?.shortName || '?'}</span>
                    <span style="font-size: 0.75rem; color: #7f8c8d; margin: 0 0.5rem;">${km.homePos}e vs ${km.awayPos}e</span>
                    <span style="font-weight: 600;">${km.awayTeam?.shortName || '?'}</span>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function generateTitleRaceDisplay(titleTeams) {
    if (!titleTeams || titleTeams.length === 0) return '<div></div>';
    
    let html = `
        <div style="background: linear-gradient(135deg, rgba(241, 196, 15, 0.1), rgba(243, 156, 18, 0.15)); border-radius: 12px; padding: 1rem; border: 1px solid rgba(241, 196, 15, 0.3);">
            <h5 style="margin: 0 0 0.75rem 0; color: #f39c12; font-size: 0.9rem;">🏆 Course au titre</h5>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    `;
    
    titleTeams.slice(0, 4).forEach(t => {
        const pointsFromLeader = t.pointsFromLeader;
        const statusText = pointsFromLeader === 0 
            ? `Leader • ${t.remainingMatches} matchs` 
            : `-${pointsFromLeader} pts • doit gagner ${t.mustWin}/${t.remainingMatches}`;
        
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 0.5rem 0.75rem; border-radius: 6px;">
                <div>
                    <span style="font-weight: 600; color: #2c3e50;">${t.position}. ${t.team.shortName || t.team.name}</span>
                    <span style="color: #7f8c8d; font-size: 0.8rem; margin-left: 0.5rem;">${t.points} pts</span>
                </div>
                <div style="font-size: 0.75rem; color: ${pointsFromLeader === 0 ? '#27ae60' : '#f39c12'};">
                    ${statusText}
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function generateEuropeRaceDisplay(europeTeams, config) {
    if (!europeTeams || europeTeams.length === 0) return '<div></div>';
    
    let html = `
        <div style="background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(41, 128, 185, 0.15)); border-radius: 12px; padding: 1rem; border: 1px solid rgba(52, 152, 219, 0.3);">
            <h5 style="margin: 0 0 0.75rem 0; color: #3498db; font-size: 0.9rem;">⭐ Course à l'Europe <small style="color: #7f8c8d;">(Top ${config.europeanPlaces})</small></h5>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    `;
    
    europeTeams.slice(0, 6).forEach(t => {
        let statusText, statusColor;
        
        if (t.inZone) {
            statusText = t.pointsAdvance > 0 ? `+${t.pointsAdvance} pts d'avance` : 'En position';
            statusColor = '#27ae60';
        } else {
            statusText = `${t.pointsNeeded} pts requis`;
            statusColor = '#e74c3c';
        }
        
        const bgColor = t.inZone ? 'rgba(52, 152, 219, 0.1)' : 'white';
        
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; background: ${bgColor}; padding: 0.5rem 0.75rem; border-radius: 6px; border-left: 3px solid ${t.inZone ? '#3498db' : '#e9ecef'};">
                <div>
                    <span style="font-weight: 600; color: #2c3e50;">${t.position}. ${t.team.shortName || t.team.name}</span>
                    <span style="color: #7f8c8d; font-size: 0.8rem; margin-left: 0.5rem;">${t.points} pts</span>
                </div>
                <div style="font-size: 0.75rem; color: ${statusColor};">
                    ${statusText}
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function generateRelegationBattleDisplay(relegationTeams, config) {
    if (!relegationTeams || relegationTeams.length === 0) return '<div></div>';
    
    // Trier par position (descendant = les plus en danger en premier)
    const sorted = [...relegationTeams].sort((a, b) => b.position - a.position);
    
    let html = `
        <div style="background: linear-gradient(135deg, rgba(231, 76, 60, 0.1), rgba(192, 57, 43, 0.15)); border-radius: 12px; padding: 1rem; border: 1px solid rgba(231, 76, 60, 0.3);">
            <h5 style="margin: 0 0 0.75rem 0; color: #e74c3c; font-size: 0.9rem;">🛡️ Lutte pour le maintien</h5>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    `;
    
    sorted.slice(0, 6).forEach(t => {
        let statusText, statusColor, bgColor;
        
        if (t.isSafe) {
            statusText = '✅ Maintenu';
            statusColor = '#27ae60';
            bgColor = 'rgba(39, 174, 96, 0.1)';
        } else if (t.inDanger) {
            statusText = `⚠️ ${t.pointsToSafety} pts requis`;
            statusColor = '#e74c3c';
            bgColor = 'rgba(231, 76, 60, 0.1)';
        } else {
            statusText = `+${t.pointsAdvance} pts d'avance`;
            statusColor = '#27ae60';
            bgColor = 'white';
        }
        
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; background: ${bgColor}; padding: 0.5rem 0.75rem; border-radius: 6px; border-left: 3px solid ${t.inDanger ? '#e74c3c' : '#27ae60'};">
                <div>
                    <span style="font-weight: 600; color: #2c3e50;">${t.position}. ${t.team.shortName || t.team.name}</span>
                    <span style="color: #7f8c8d; font-size: 0.8rem; margin-left: 0.5rem;">${t.points} pts</span>
                </div>
                <div style="font-size: 0.75rem; color: ${statusColor};">
                    ${statusText}
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function generatePositionDistributionBar(positionCounts, totalTeams, config) {
    let bars = '';
    
    for (let pos = 1; pos <= totalTeams; pos++) {
        const count = positionCounts[pos] || 0;
        
        if (count === 0) continue;
        
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
        
        // Utiliser flex-grow proportionnel au pourcentage
        bars += `<div style="flex: ${count}; min-width: 2px; height: 16px; background: ${color}; margin-right: 1px; border-radius: 2px;" title="Position ${pos}: ${count}%"></div>`;
    }
    
    return `<div style="display: flex; align-items: center; height: 16px; width: 100%;">${bars}</div>`;
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