// calendar-objectives.js - Onglet Objectifs et projections

// ===============================
// ONGLET OBJECTIFS
// ===============================

function displayObjectives() {
    const container = document.getElementById('objectivesContent');
    if (!container) return;
    
    const config = getSeasonConfig();
    const totalTeams = allTeams.length;
    
    if (totalTeams === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:2rem;">Aucune équipe disponible</p>';
        return;
    }
    
    if (futureMatches.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:2rem;">Générez d\'abord le calendrier pour voir les objectifs</p>';
        return;
    }
    
    const totalMatchDays = (totalTeams - 1) * 2;
    const totalMatchesPerTeam = totalMatchDays;
    
    // Générer le classement actuel
    const ranking = generateRanking(null, currentSeason, null, false, 'all');
    const sortedRanking = ranking.filter(t => allTeams.some(at => at.id === t.id));
    
    if (sortedRanking.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:2rem;">Aucune donnée disponible</p>';
        return;
    }
    
    // Créer le map Elo
    const eloMap = {};
    teamsWithElo.forEach(t => eloMap[t.id] = t.eloRating || 1500);
    
    // Calculer les projections
    const projections = sortedRanking.map((team, index) => {
        const matchesPlayed = team.played || 0;
        const currentPoints = team.points || 0;
        const matchesRemaining = totalMatchesPerTeam - matchesPlayed;
        const teamElo = eloMap[team.id] || 1500;
        
        const upcomingMatches = futureMatches.filter(m => 
            m.homeTeamId == team.id || m.awayTeamId == team.id
        );
        
        let expectedPointsFromFuture = 0;
        const matchDetails = [];
        
        upcomingMatches.forEach(match => {
            const isHome = match.homeTeamId == team.id;
            const opponentId = isHome ? match.awayTeamId : match.homeTeamId;
            const opponent = allTeams.find(t => t.id == opponentId);
            const opponentElo = eloMap[opponentId] || 1500;
            
            const homeAdvantage = 65;
            const teamAdjustedElo = isHome ? teamElo + homeAdvantage : teamElo;
            const opponentAdjustedElo = isHome ? opponentElo : opponentElo + homeAdvantage;
            
            const winExpectancy = 1 / (1 + Math.pow(10, (opponentAdjustedElo - teamAdjustedElo) / 400));
            
            const eloDiff = Math.abs(teamAdjustedElo - opponentAdjustedElo);
            const drawProb = Math.max(0.15, 0.30 - (eloDiff / 1000));
            
            const winProb = winExpectancy * (1 - drawProb);
            const lossProb = (1 - winExpectancy) * (1 - drawProb);
            
            const expectedPts = (winProb * 3) + (drawProb * 1);
            expectedPointsFromFuture += expectedPts;
            
            matchDetails.push({
                matchDay: match.matchDay,
                opponent: opponent ? opponent.shortName : '?',
                opponentElo: opponentElo,
                isHome: isHome,
                winProb: (winProb * 100).toFixed(0),
                drawProb: (drawProb * 100).toFixed(0),
                lossProb: (lossProb * 100).toFixed(0),
                expectedPts: expectedPts.toFixed(2)
            });
        });
        
        const projectedPoints = Math.round(currentPoints + expectedPointsFromFuture);
        const maxPossiblePoints = currentPoints + (matchesRemaining * 3);
        const minPossiblePoints = currentPoints;
        
        return {
            ...team,
            position: index + 1,
            matchesPlayed,
            matchesRemaining,
            currentPoints,
            teamElo,
            projectedPoints,
            expectedPointsFromFuture: expectedPointsFromFuture.toFixed(1),
            maxPossiblePoints,
            minPossiblePoints,
            matchDetails
        };
    });
    
    // Trier par points projetés
    const sortedByProjection = [...projections].sort((a, b) => b.projectedPoints - a.projectedPoints);
    
    // Positions clés
    const relegationPosition = totalTeams - config.relegationPlaces;
    
    // Objectifs
    const titleTarget = sortedByProjection[config.championPlaces - 1]?.projectedPoints || 0;
    const europeTarget = sortedByProjection[config.europeanPlaces - 1]?.projectedPoints || 0;
    const safeTarget = sortedByProjection[relegationPosition - 1]?.projectedPoints || 0;
    
    // Générer le HTML
    let html = `
        <div class="objectives-method">
            <p>📊 <strong>Méthode de calcul</strong> : Pour chaque match à venir, on calcule la probabilité de victoire/nul/défaite 
            basée sur l'<strong>Elo actuel</strong> des équipes et l'<strong>avantage domicile</strong>. 
            Les points attendus sont ensuite additionnés aux points actuels.</p>
        </div>
        
        <div class="objectives-summary">
            <div class="objective-target champion">
                <div class="target-icon">🏆</div>
                <div class="target-info">
                    <div class="target-label">Objectif Titre</div>
                    <div class="target-value">${titleTarget} pts</div>
                    <div class="target-hint">Projection du ${config.championPlaces}${config.championPlaces === 1 ? 'er' : 'e'}</div>
                </div>
            </div>
            <div class="objective-target europe">
                <div class="target-icon">⭐</div>
                <div class="target-info">
                    <div class="target-label">Objectif Europe</div>
                    <div class="target-value">${europeTarget} pts</div>
                    <div class="target-hint">Projection du ${config.europeanPlaces}e</div>
                </div>
            </div>
            <div class="objective-target safe">
                <div class="target-icon">🛡️</div>
                <div class="target-info">
                    <div class="target-label">Objectif Maintien</div>
                    <div class="target-value">${safeTarget} pts</div>
                    <div class="target-hint">Projection du ${relegationPosition}e</div>
                </div>
            </div>
        </div>
    `;
    
    // Tableau des équipes
    html += `
        <div class="objectives-table-wrapper">
            <table class="objectives-table">
                <thead>
                    <tr>
                        <th>Pos.</th>
                        <th>Équipe</th>
                        <th>Elo</th>
                        <th>Pts</th>
                        <th>Reste</th>
                        <th>Pts attendus</th>
                        <th>Projection</th>
                        <th>🏆 Titre</th>
                        <th>⭐ Europe</th>
                        <th>🛡️ Maintien</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    projections.forEach((team, index) => {
        const position = index + 1;
        
        const titleDiff = team.projectedPoints - titleTarget;
        const europeDiff = team.projectedPoints - europeTarget;
        const safeDiff = team.projectedPoints - safeTarget;
        
        const titleStatus = getObjectiveStatus(team, titleTarget, titleDiff, 'title');
        const europeStatus = getObjectiveStatus(team, europeTarget, europeDiff, 'europe');
        const safeStatus = getObjectiveStatus(team, safeTarget, safeDiff, 'safe');
        
        let rowClass = '';
        if (position <= config.championPlaces) rowClass = 'champion-row';
        else if (position <= config.europeanPlaces) rowClass = 'europe-row';
        else if (position > relegationPosition) rowClass = 'relegation-row';
        
        html += `
            <tr class="${rowClass}">
                <td class="position">${position}</td>
                <td class="team-name">${team.shortName}</td>
                <td class="team-elo">${team.teamElo}</td>
                <td class="current-points"><strong>${team.currentPoints}</strong></td>
                <td class="matches-remaining">${team.matchesRemaining}</td>
                <td class="expected-points">+${team.expectedPointsFromFuture}</td>
                <td class="projected-points"><strong>${team.projectedPoints}</strong></td>
                <td class="objective-cell ${titleStatus.class}">${titleStatus.text}</td>
                <td class="objective-cell ${europeStatus.class}">${europeStatus.text}</td>
                <td class="objective-cell ${safeStatus.class}">${safeStatus.text}</td>
                <td>
                    <button class="btn-details" onclick="showMatchDetails('${team.id}')">📋</button>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    // Modal pour les détails
    html += `
        <div id="matchDetailsModal" class="match-details-modal" style="display:none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modalTeamName">Détails des matchs</h3>
                    <button class="btn-close" onclick="closeMatchDetails()">✕</button>
                </div>
                <div id="modalMatchList" class="modal-match-list">
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Stocker les projections pour le modal
    window.teamProjections = projections;
}

function getObjectiveStatus(team, target, diff, type) {
    if (team.minPossiblePoints >= target) {
        if (type === 'safe') {
            return { class: 'achieved', text: '✅ Maintenu' };
        }
        return { class: 'achieved', text: '✅ Assuré' };
    }
    
    if (team.maxPossiblePoints < target) {
        if (type === 'safe') {
            return { class: 'relegated', text: '⬇️ Relégué' };
        }
        return { class: 'impossible', text: '❌ Impossible' };
    }
    
    if (diff >= 3) {
        return { class: 'on-track', text: `+${diff} pts` };
    } else if (diff >= 0) {
        return { class: 'close', text: `+${diff} pts` };
    } else if (diff >= -5) {
        return { class: 'behind', text: `${diff} pts` };
    } else {
        return { class: 'far-behind', text: `${diff} pts` };
    }
}

function showMatchDetails(teamId) {
    const modal = document.getElementById('matchDetailsModal');
    const teamName = document.getElementById('modalTeamName');
    const matchList = document.getElementById('modalMatchList');
    
    const teamData = window.teamProjections.find(t => t.id == teamId);
    if (!teamData) return;
    
    teamName.textContent = `📋 Matchs à venir - ${teamData.shortName}`;
    
    if (!teamData.matchDetails || teamData.matchDetails.length === 0) {
        matchList.innerHTML = '<p>Aucun match à venir</p>';
    } else {
        matchList.innerHTML = `
            <table class="match-details-table">
                <thead>
                    <tr>
                        <th>J.</th>
                        <th>Adversaire</th>
                        <th>Lieu</th>
                        <th>Elo Adv.</th>
                        <th>% Vic.</th>
                        <th>% Nul</th>
                        <th>% Déf.</th>
                        <th>Pts attendus</th>
                    </tr>
                </thead>
                <tbody>
                    ${teamData.matchDetails.map(m => `
                        <tr>
                            <td>J${m.matchDay}</td>
                            <td><strong>${m.opponent}</strong></td>
                            <td>${m.isHome ? '🏠 Dom' : '✈️ Ext'}</td>
                            <td>${m.opponentElo}</td>
                            <td class="prob-win">${m.winProb}%</td>
                            <td class="prob-draw">${m.drawProb}%</td>
                            <td class="prob-loss">${m.lossProb}%</td>
                            <td><strong>${m.expectedPts}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="match-details-summary">
                <strong>Total points attendus :</strong> +${teamData.expectedPointsFromFuture} pts
                → <strong>Projection : ${teamData.projectedPoints} pts</strong>
            </div>
        `;
    }
    
    modal.style.display = 'flex';
}

function closeMatchDetails() {
    document.getElementById('matchDetailsModal').style.display = 'none';
}