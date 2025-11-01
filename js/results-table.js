// results-table.js - Logique pour le tableau croisé des résultats

let allTeams = [];
let allMatches = [];
let selectedSeason = null; // ← AJOUTER

// Initialisation de la page
document.addEventListener('DOMContentLoaded', function() {
    selectedSeason = getCurrentSeason(); // ← AJOUTER
    populateSeasonSelector(); // ← AJOUTER
    loadData();
    generateResultsTable();
    calculateStats();
});

// Remplir le sélecteur de saison
function populateSeasonSelector() {
    const seasonSelect = document.getElementById('seasonSelectTable');
    if (!seasonSelect) return;
    
    seasonSelect.innerHTML = '';
    
    const seasons = getSeasonsOrderedByDate();
    
    seasons.forEach(season => {
        const option = document.createElement('option');
        option.value = season.name;
        option.textContent = season.name;
        
        if (season.isActive) {
            option.selected = true;
        }
        
        seasonSelect.appendChild(option);
    });
    
    // Écouteur de changement
    seasonSelect.addEventListener('change', function() {
        selectedSeason = this.value;
        loadData();
        generateResultsTable();
        calculateStats();
    });
}


// Charger les données
function loadData() {
    allTeams = getStoredTeams();
    const season = selectedSeason || getCurrentSeason();
    allMatches = getMatchesBySeason(season); // ← MODIFIER pour filtrer par saison
    console.log('Données chargées:', allTeams.length, 'équipes,', allMatches.length, 'matchs');
}

// Générer le tableau des résultats
function generateResultsTable() {
    const table = document.getElementById('resultsTable');
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');
    
    // Vider le tableau
    thead.innerHTML = '<th class="team-header">Domicile \\ Extérieur</th>';
    tbody.innerHTML = '';
    
    if (allTeams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%">Aucune équipe configurée</td></tr>';
        return;
    }
    
    // Créer les en-têtes des colonnes (équipes extérieures)
    allTeams.forEach(team => {
        const th = document.createElement('th');
        th.className = 'team-column-header';
        th.textContent = team.shortName;
        th.title = team.name;
        thead.appendChild(th);
    });
    
    // Créer les lignes (équipes domicile)
    allTeams.forEach(homeTeam => {
        const tr = document.createElement('tr');
        
        // En-tête de ligne (équipe domicile)
        const thRow = document.createElement('td');
        thRow.className = 'team-row-header';
        thRow.textContent = homeTeam.shortName;
        thRow.title = homeTeam.name;
        tr.appendChild(thRow);
        
        // Cellules pour chaque équipe extérieure
        allTeams.forEach(awayTeam => {
            const td = document.createElement('td');
            td.className = 'match-cell';
            
            if (homeTeam.id === awayTeam.id) {
                // Même équipe - cellule grisée
                td.className += ' same-team';
                td.textContent = '-';
                td.title = 'Une équipe ne peut pas jouer contre elle-même';
            } else {
                // Chercher le match entre ces équipes (domicile vs extérieur)
                const match = findMatch(homeTeam.id, awayTeam.id);
                
                if (match) {
                    // Match joué
                    td.className += ' played';
                    td.innerHTML = createMatchCellContent(match);
                    td.title = createMatchTooltip(match, homeTeam, awayTeam);
                    td.addEventListener('click', () => showMatchDetails(match));
                } else {
                    // Match pas encore joué
                    td.className += ' not-played';
                    td.textContent = '-';
                    td.title = `Match à jouer : ${homeTeam.shortName} vs ${awayTeam.shortName}`;
                    td.addEventListener('click', () => suggestMatch(homeTeam, awayTeam));
                }
            }
            
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
}

// Trouver un match spécifique (équipe domicile vs équipe extérieure)
function findMatch(homeTeamId, awayTeamId) {
    return allMatches.find(match => 
        match.homeTeamId == homeTeamId && match.awayTeamId == awayTeamId
    );
}

// Créer le contenu d'une cellule de match
function createMatchCellContent(match) {
    const score = `<div class="match-score">${match.finalScore.home} - ${match.finalScore.away}</div>`;
    const date = `<div class="match-date">${formatMatchDate(match.date)}</div>`;
    return score + date;
}

// Créer le tooltip d'un match
function createMatchTooltip(match, homeTeam, awayTeam) {
    const date = new Date(match.date).toLocaleDateString('fr-FR');
    let tooltip = `${homeTeam.name} ${match.finalScore.home} - ${match.finalScore.away} ${awayTeam.name}\n`;
    tooltip += `Date: ${date}\n`;
    tooltip += `Mi-temps: ${match.halftimeScore}`;
    
    if (match.goals && match.goals.length > 0) {
        tooltip += '\nButs: ';
        match.goals.forEach(goal => {
            const team = goal.teamId == homeTeam.id ? homeTeam.shortName : awayTeam.shortName;
            const time = goal.extraTime > 0 ? `${goal.minute}+${goal.extraTime}` : goal.minute;
            tooltip += `${time}' ${goal.scorer} (${team}), `;
        });
        tooltip = tooltip.slice(0, -2); // Enlever la dernière virgule
    }
    
    return tooltip;
}

// Formater la date d'un match
function formatMatchDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit' 
    });
}

// Afficher les détails d'un match
function showMatchDetails(match) {
    const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
    
    if (!homeTeam || !awayTeam) return;
    
    const date = new Date(match.date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    let details = `🏟️ ${homeTeam.name} ${match.finalScore.home} - ${match.finalScore.away} ${awayTeam.name}\n\n`;
    details += `📅 ${date}\n`;
    details += `⏱️ Mi-temps: ${match.halftimeScore}\n\n`;
    
    if (match.goals && match.goals.length > 0) {
        details += '⚽ Buts du match:\n';
        const sortedGoals = match.goals.sort((a, b) => {
            if (a.minute !== b.minute) return a.minute - b.minute;
            return (a.extraTime || 0) - (b.extraTime || 0);
        });
        
        sortedGoals.forEach(goal => {
            const team = goal.teamId == homeTeam.id ? homeTeam.shortName : awayTeam.shortName;
            const time = goal.extraTime > 0 ? `${goal.minute}+${goal.extraTime}'` : `${goal.minute}'`;
            details += `${time} ${goal.scorer} (${team})\n`;
        });
    } else {
        details += '⚽ Match sans but marqué';
    }
    
    alert(details);
}

// Suggérer d'ajouter un match
function suggestMatch(homeTeam, awayTeam) {
    const message = `Match à ajouter:\n${homeTeam.name} (domicile) vs ${awayTeam.name} (extérieur)\n\nVoulez-vous aller à la page d'ajout de match ?`;
    
    if (confirm(message)) {
        // Rediriger vers la page d'ajout avec des paramètres
        const url = new URL('add-match.html', window.location.href);
        url.searchParams.set('home', homeTeam.id);
        url.searchParams.set('away', awayTeam.id);
        window.location.href = url.toString();
    }
}

// Calculer et afficher les statistiques
function calculateStats() {
    const totalTeams = allTeams.length;
    const totalPossibleMatches = totalTeams * (totalTeams - 1); // Chaque équipe joue contre toutes les autres (aller-retour)
    const playedMatches = allMatches.length;
    
    // Mettre à jour les éléments du DOM
    document.getElementById('playedMatches').textContent = playedMatches;
    document.getElementById('totalMatches').textContent = totalPossibleMatches;
    
    // Barre de progression
    const progressPercentage = totalPossibleMatches > 0 ? (playedMatches / totalPossibleMatches) * 100 : 0;
    document.getElementById('progressFill').style.width = `${progressPercentage}%`;
    
    // Statistiques domicile/extérieur
    let homeWins = 0;
    let homeLosses = 0;
    let draws = 0;
    let totalGoals = 0;
    let highestScoringMatch = { home: 0, away: 0, total: 0 };
    
    allMatches.forEach(match => {
        const homeScore = match.finalScore.home;
        const awayScore = match.finalScore.away;
        const matchGoals = homeScore + awayScore;
        
        totalGoals += matchGoals;
        
        if (matchGoals > highestScoringMatch.total) {
            highestScoringMatch = { 
                home: homeScore, 
                away: awayScore, 
                total: matchGoals 
            };
        }
        
        if (homeScore > awayScore) {
            homeWins++;
        } else if (homeScore < awayScore) {
            homeLosses++;
        } else {
            draws++;
        }
    });
    
    document.getElementById('homeWins').textContent = homeWins;
    document.getElementById('homeLosses').textContent = homeLosses;
    document.getElementById('draws').textContent = draws;
    document.getElementById('totalGoals').textContent = totalGoals;
    
    const avgGoals = playedMatches > 0 ? (totalGoals / playedMatches).toFixed(1) : '0';
    document.getElementById('avgGoals').textContent = avgGoals;
    
    const highestScore = highestScoringMatch.total > 0 
        ? `${highestScoringMatch.home}-${highestScoringMatch.away}` 
        : '-';
    document.getElementById('highestScore').textContent = highestScore;
}

// Rafraîchir le tableau (utile si appelé depuis d'autres pages)
function refreshTable() {
    loadData();
    generateResultsTable();
    calculateStats();
}

// Exposer la fonction pour l'utiliser depuis d'autres scripts
window.refreshResultsTable = refreshTable;