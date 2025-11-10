// === HEAD TO HEAD DISPLAY ===

let h2hSelectedTeam = null;
let h2hSelectedMatchday = 'all';
let h2hAllTeams = []; // ← Ajouter cette variable locale
let h2hAllMatches = []; // ← Ajouter cette variable locale

// Initialiser les sélecteurs H2H
function initializeH2HSelectors() {
    // Charger les données
    const season = selectedSeason || getCurrentSeason();
    h2hAllTeams = getTeamsBySeason(season); // ← Utiliser h2hAllTeams
    h2hAllMatches = getMatchesBySeason(season); // ← Utiliser h2hAllMatches
    
    const teamSelect = document.getElementById('h2hTeamSelect');
    const matchdaySelect = document.getElementById('h2hMatchdaySelect');
    
    if (!teamSelect || !matchdaySelect) return;
    
    // Remplir le sélecteur d'équipes
    teamSelect.innerHTML = '<option value="">Choisir une équipe...</option>';
    h2hAllTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        teamSelect.appendChild(option);
    });
    
    // Remplir le sélecteur de journées
    const maxMatchday = Math.max(...h2hAllMatches.map(m => m.matchDay || 0));
    matchdaySelect.innerHTML = '<option value="all">Toutes les journées</option>';
    for (let i = 1; i <= maxMatchday; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Journée ${i}`;
        matchdaySelect.appendChild(option);
    }
    
    // Événements
    teamSelect.addEventListener('change', (e) => {
        h2hSelectedTeam = e.target.value ? parseInt(e.target.value) : null;
        displayH2HTable();
    });
    
    matchdaySelect.addEventListener('change', (e) => {
        h2hSelectedMatchday = e.target.value;
        displayH2HTable();
    });
}

// Afficher le tableau Head to Head
function displayH2HTable() {
    const container = document.getElementById('h2hTableContainer');
    
    if (!h2hSelectedTeam) {
        container.innerHTML = '<p class="info-message">Sélectionnez une équipe pour voir ses résultats face aux autres équipes</p>';
        return;
    }
    
    const selectedTeam = h2hAllTeams.find(t => t.id === h2hSelectedTeam); // ← h2hAllTeams
    if (!selectedTeam) return;
    
    // Filtrer les matchs selon la journée sélectionnée
    let filteredMatches = h2hAllMatches; // ← h2hAllMatches
    if (h2hSelectedMatchday !== 'all') {
        const matchday = parseInt(h2hSelectedMatchday);
        filteredMatches = h2hAllMatches.filter(m => m.matchDay <= matchday); // ← h2hAllMatches
    }
    
    // Calculer le classement pour la journée sélectionnée
    const standings = calculateStandings(filteredMatches);
    
    // Construire le tableau HTML
    let html = `
        <table class="h2h-table">
            <thead>
                <tr>
                    <th class="rank-column">#</th>
                    <th class="team-column">Équipe</th>
                    <th>J</th>
                    <th>Points</th>
                    <th>Domicile</th>
                    <th>Exterieur</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    standings.forEach((team, index) => {
        const teamData = h2hAllTeams.find(t => t.id === team.teamId); // ← h2hAllTeams
        if (!teamData) return;
        
        // Si c'est l'équipe sélectionnée
        if (team.teamId === h2hSelectedTeam) {
            html += `
                <tr>
                    <td class="rank-column">${index + 1}</td>
                    <td class="team-column">${teamData.name}</td>
                    <td>${team.played}</td>
                    <td><strong>${team.points}</strong></td>
                    <td class="result-cell result-selected">-</td>
                    <td class="result-cell result-selected">-</td>
                </tr>
            `;
        } else {
            // Trouver les matchs entre l'équipe sélectionnée et cette équipe
            // homeMatch = Rennes (équipe sélectionnée) joue À DOMICILE contre cette équipe
            const homeMatch = findMatch(filteredMatches, h2hSelectedTeam, team.teamId);
            // awayMatch = Rennes (équipe sélectionnée) joue À L'EXTÉRIEUR contre cette équipe
            const awayMatch = findMatch(filteredMatches, team.teamId, h2hSelectedTeam);
            
            html += `
                <tr>
                    <td class="rank-column">${index + 1}</td>
                    <td class="team-column">${teamData.name}</td>
                    <td>${team.played}</td>
                    <td><strong>${team.points}</strong></td>
                    <td class="result-cell ${getResultClass(homeMatch, h2hSelectedTeam)}">${getResultDisplay(homeMatch, h2hSelectedTeam)}</td>
                    <td class="result-cell ${getResultClass(awayMatch, h2hSelectedTeam)}">${getResultDisplay(awayMatch, h2hSelectedTeam)}</td>
                </tr>
            `;
        }
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// Trouver un match entre deux équipes
function findMatch(matches, homeTeamId, awayTeamId) {
    return matches.find(m => m.homeTeamId == homeTeamId && m.awayTeamId == awayTeamId);
}

// Obtenir la classe CSS selon le résultat
function getResultClass(match, teamId) {
    if (!match) return 'result-none';
    
    const homeScore = match.finalScore.home;
    const awayScore = match.finalScore.away;
    
    // Déterminer si l'équipe sélectionnée a gagné, fait match nul ou perdu
    let isWin, isDraw, isLoss;
    
    if (match.homeTeamId == teamId) {
        // L'équipe sélectionnée joue à domicile
        isWin = homeScore > awayScore;
        isDraw = homeScore === awayScore;
        isLoss = homeScore < awayScore;
    } else {
        // L'équipe sélectionnée joue à l'extérieur
        isWin = awayScore > homeScore;
        isDraw = homeScore === awayScore;
        isLoss = awayScore < homeScore;
    }
    
    if (isWin) return 'result-win';
    if (isDraw) return 'result-draw';
    if (isLoss) return 'result-loss';
    
    return 'result-none';
}

// Obtenir l'affichage du résultat
function getResultDisplay(match, teamId) {
    if (!match) return '';
    
    const homeScore = match.finalScore.home;
    const awayScore = match.finalScore.away;
    
    // Si l'équipe sélectionnée est à domicile dans ce match
    if (match.homeTeamId == teamId) {
        return `${homeScore} - ${awayScore}`;
    } 
    // Si l'équipe sélectionnée est à l'extérieur dans ce match
    else {
        return `${awayScore} - ${homeScore}`;
    }
}

// Fonction pour calculer le classement (réutilise ou adapte celle existante)
function calculateStandings(matches) {
    const standings = {};
    
    // Initialiser les statistiques pour chaque équipe
    h2hAllTeams.forEach(team => { // ← h2hAllTeams
        standings[team.id] = {
            teamId: team.id,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0
        };
    });
    
    // Calculer les statistiques
    matches.forEach(match => {
        const homeId = match.homeTeamId;
        const awayId = match.awayTeamId;
        const homeScore = match.finalScore.home;
        const awayScore = match.finalScore.away;
        
        if (!standings[homeId] || !standings[awayId]) return;
        
        standings[homeId].played++;
        standings[awayId].played++;
        standings[homeId].goalsFor += homeScore;
        standings[homeId].goalsAgainst += awayScore;
        standings[awayId].goalsFor += awayScore;
        standings[awayId].goalsAgainst += homeScore;
        
        if (homeScore > awayScore) {
            standings[homeId].won++;
            standings[homeId].points += 3;
            standings[awayId].lost++;
        } else if (homeScore < awayScore) {
            standings[awayId].won++;
            standings[awayId].points += 3;
            standings[homeId].lost++;
        } else {
            standings[homeId].drawn++;
            standings[awayId].drawn++;
            standings[homeId].points++;
            standings[awayId].points++;
        }
        
        standings[homeId].goalDifference = standings[homeId].goalsFor - standings[homeId].goalsAgainst;
        standings[awayId].goalDifference = standings[awayId].goalsFor - standings[awayId].goalsAgainst;
    });
    
    // Convertir en tableau et trier
    return Object.values(standings).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });
}