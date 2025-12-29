// calendar-difficulty.js - Onglet Difficulté du calendrier

// ===============================
// ONGLET DIFFICULTÉ
// ===============================

function displayDifficulty() {
    const container = document.getElementById('difficultyContent');
    if (!container) return;
    
    if (futureMatches.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:2rem;">Générez d\'abord le calendrier pour voir la difficulté</p>';
        return;
    }
    
    // S'assurer que les Elo sont calculés
    if (!teamsWithElo || teamsWithElo.length === 0) {
        if (typeof EloSystem !== 'undefined') {
            teamsWithElo = EloSystem.initializeTeamsElo(allTeams);
            const sortedMatches = [...allMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
            sortedMatches.forEach(match => {
                EloSystem.processMatch(match, teamsWithElo);
            });
        }
    }
    
    console.log('Teams with Elo:', teamsWithElo);
    
    // Créer un map pour accéder rapidement aux Elo
    const eloMap = {};
    teamsWithElo.forEach(t => {
        eloMap[t.id] = t.eloRating || 1500;
    });
    
    console.log('Elo Map:', eloMap);
    
    // Calculer la difficulté pour chaque équipe
    const difficultyData = allTeams.map(team => {
        const upcomingMatches = futureMatches.filter(m => 
            m.homeTeamId == team.id || m.awayTeamId == team.id
        );
        
        // Calculer la moyenne Elo des adversaires
        let totalElo = 0;
        let opponentDetails = [];
        
        upcomingMatches.forEach(match => {
            const opponentId = match.homeTeamId == team.id ? match.awayTeamId : match.homeTeamId;
            const opponentElo = eloMap[opponentId] || 1500;
            totalElo += opponentElo;
            
            const opponent = allTeams.find(t => t.id == opponentId);
            opponentDetails.push({
                name: opponent ? opponent.shortName : '?',
                elo: opponentElo
            });
        });
        
        const avgOpponentElo = upcomingMatches.length > 0 ? Math.round(totalElo / upcomingMatches.length) : 1500;
        
        return {
            team: team,
            teamElo: eloMap[team.id] || 1500,
            matchesRemaining: upcomingMatches.length,
            avgOpponentElo: avgOpponentElo,
            opponents: opponentDetails,
            difficulty: avgOpponentElo
        };
    }).filter(d => d.matchesRemaining > 0);
    
    // Trier par difficulté décroissante
    difficultyData.sort((a, b) => b.difficulty - a.difficulty);
    
    // Trouver min/max pour normaliser
    const minDiff = Math.min(...difficultyData.map(d => d.difficulty));
    const maxDiff = Math.max(...difficultyData.map(d => d.difficulty));
    const range = maxDiff - minDiff || 1;
    
    // Générer le HTML
    container.innerHTML = difficultyData.map((data, index) => {
        const percentage = ((data.difficulty - minDiff) / range) * 100;
        let diffClass = 'easy';
        if (percentage > 66) diffClass = 'hard';
        else if (percentage > 33) diffClass = 'medium';
        
        const opponentsTooltip = data.opponents
            .sort((a, b) => b.elo - a.elo)
            .slice(0, 5)
            .map(o => `${o.name}: ${o.elo}`)
            .join(', ');
        
        return `
            <div class="difficulty-row" title="Adversaires: ${opponentsTooltip}...">
                <div class="difficulty-rank">${index + 1}</div>
                <div class="difficulty-team">
                    ${data.team.shortName}
                    <small style="color:#7f8c8d;">(Elo: ${data.teamElo})</small>
                </div>
                <div class="difficulty-bar-container">
                    <div class="difficulty-bar ${diffClass}" style="width: ${Math.max(percentage, 10)}%">
                        ${data.avgOpponentElo}
                    </div>
                </div>
                <div class="difficulty-matches">${data.matchesRemaining} matchs</div>
            </div>
        `;
    }).join('');
}