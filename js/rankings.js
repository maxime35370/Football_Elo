// rankings.js - Logique d'affichage des classements

let currentMatchDay = null;

// Initialisation de la page
document.addEventListener('DOMContentLoaded', function() {
    loadRankingsData();
    setupMatchDaySelector();
    updateSeasonTitle();
    displayRanking();
    updateChampionshipStats();
});

// Charger les données nécessaires
function loadRankingsData() {
    // Les données sont déjà chargées via teams-loader.js et storage.js
    console.log('Données de classement chargées');
}

// Configurer le sélecteur de journée
function setupMatchDaySelector() {
    const matchDaySelect = document.getElementById('matchDaySelect');
    const lastMatchDay = getLastPlayedMatchDay();
    
    // Vider le sélecteur
    matchDaySelect.innerHTML = '<option value="">Classement actuel</option>';
    
    // Ajouter les journées jouées
    for (let i = 1; i <= lastMatchDay; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Journée ${i}`;
        matchDaySelect.appendChild(option);
    }
    
    // Écouteur de changement
    matchDaySelect.addEventListener('change', function() {
        currentMatchDay = this.value ? parseInt(this.value) : null;
        displayRanking();
        updateMatchDayInfo();
    });
    
    updateMatchDayInfo();
}

// Mettre à jour l'info de journée
function updateMatchDayInfo() {
    const matchDayInfo = document.getElementById('matchDayInfo');
    const lastMatchDay = getLastPlayedMatchDay();
    
    if (currentMatchDay) {
        matchDayInfo.textContent = `Après ${currentMatchDay} journée${currentMatchDay > 1 ? 's' : ''}`;
    } else if (lastMatchDay > 0) {
        matchDayInfo.textContent = `Après ${lastMatchDay} journée${lastMatchDay > 1 ? 's' : ''} jouée${lastMatchDay > 1 ? 's' : ''}`;
    } else {
        matchDayInfo.textContent = 'Aucun match joué';
    }
}

// Afficher le classement
function displayRanking() {
    const ranking = generateRanking(currentMatchDay);
    const tableBody = document.querySelector('#traditionalRanking tbody');
    const noMatchesMessage = document.getElementById('noMatchesMessage');
    
    // Vérifier s'il y a des matchs
    if (ranking.length === 0 || ranking.every(team => team.played === 0)) {
        document.querySelector('.ranking-section').style.display = 'none';
        noMatchesMessage.style.display = 'block';
        return;
    }
    
    document.querySelector('.ranking-section').style.display = 'block';
    noMatchesMessage.style.display = 'none';
    
    // Vider le tableau
    tableBody.innerHTML = '';
    
    // Ajouter chaque équipe
    ranking.forEach((team, index) => {
        const row = createRankingRow(team, index + 1);
        tableBody.appendChild(row);
    });
}

// Créer une ligne de classement
function createRankingRow(team, position) {
    const row = document.createElement('tr');
    const config = getSeasonConfig(); // Récupérer la config
    
    // Ajouter des classes selon la position et la configuration
    if (position <= config.championPlaces) {
        row.classList.add('champion');
    } else if (position <= config.europeanPlaces) {
        row.classList.add('european');
    } else {
        // Calculer les places de relégation depuis la fin
        const totalTeams = getAllTeamsWithMatches().length;
        const relegationStart = totalTeams - config.relegationPlaces + 1;
        if (position >= relegationStart && totalTeams >= 6) {
            row.classList.add('relegation');
        }
    }
    
    row.innerHTML = `
        <td class="position">${position}</td>
        <td class="team-name">${team.shortName}</td>
        <td>${team.played}</td>
        <td>${team.won}</td>
        <td>${team.drawn}</td>
        <td>${team.lost}</td>
        <td>${team.goalsFor}</td>
        <td>${team.goalsAgainst}</td>
        <td class="${team.goalDifference >= 0 ? 'positive' : 'negative'}">${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}</td>
        <td class="points">${team.points}</td>
    `;
    
    // Tooltip avec le nom complet et la position
    let positionText = '';
    if (position <= config.championPlaces) {
        positionText = ' - 🥇 Champion';
    } else if (position <= config.europeanPlaces) {
        positionText = ' - 🏆 Place européenne';
    } else {
        const totalTeams = getAllTeamsWithMatches().length;
        const relegationStart = totalTeams - config.relegationPlaces + 1;
        if (position >= relegationStart && totalTeams >= 6) {
            positionText = ' - ⬇️ Relégation';
        }
    }
    
    row.title = `${team.name} - ${team.city}${positionText}`;
    
    return row;
}

// Mettre à jour les statistiques du championnat
function updateChampionshipStats() {
    const matches = getStoredMatches();
    const teams = getStoredTeams();
    
    // Filtrer les matchs selon la journée sélectionnée
    const filteredMatches = currentMatchDay 
        ? matches.filter(match => match.matchDay <= currentMatchDay)
        : matches;
    
    const totalMatchesPlayed = filteredMatches.length;
    const totalGoalsScored = filteredMatches.reduce((total, match) => {
        return total + match.finalScore.home + match.finalScore.away;
    }, 0);
    
    const averageGoalsPerMatch = totalMatchesPlayed > 0 
        ? (totalGoalsScored / totalMatchesPlayed).toFixed(1) 
        : '0.0';
    
    const lastMatchDay = getLastPlayedMatchDay();
    
    // Mettre à jour l'affichage
    document.getElementById('totalMatchesPlayed').textContent = totalMatchesPlayed;
    document.getElementById('totalGoalsScored').textContent = totalGoalsScored;
    document.getElementById('averageGoalsPerMatch').textContent = averageGoalsPerMatch;
    document.getElementById('currentMatchDay').textContent = currentMatchDay || lastMatchDay || 0;
}

// Rafraîchir le classement (appelé depuis d'autres pages)
function refreshRankings() {
    setupMatchDaySelector();
    displayRanking();
    updateChampionshipStats();
}

// Obtenir toutes les équipes qui ont joué au moins un match
function getAllTeamsWithMatches() {
    const ranking = generateRanking(currentMatchDay);
    return ranking.filter(team => team.played > 0);
}

// Récupérer la configuration de saison (fonction partagée)
function getSeasonConfig() {
    try {
        const stored = localStorage.getItem('footballEloSeasonConfig');
        return stored ? JSON.parse(stored) : {
            championPlaces: 1,
            europeanPlaces: 3,
            relegationPlaces: 2,
            seasonName: "2024-2025"
        };
    } catch (error) {
        console.error('Erreur récupération config saison:', error);
        return {
            championPlaces: 1,
            europeanPlaces: 3,
            relegationPlaces: 2,
            seasonName: "2024-2025"
        };
    }
}

// Mettre à jour le titre avec le nom de la saison
function updateSeasonTitle() {
    const config = getSeasonConfig();
    const titleElement = document.querySelector('.rankings-header h2');
    if (titleElement) {
        titleElement.textContent = `🏆 Classement ${config.seasonName}`;
    }
}

// Exposer la fonction pour l'utiliser depuis d'autres scripts
window.refreshRankings = refreshRankings;