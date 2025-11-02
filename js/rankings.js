// rankings.js - Logique d'affichage des classements

let currentMatchDay = null;
let selectedSeason = null; // ← AJOUTER CETTE LIGNE
let teamsWithElo = [];

// Initialisation de la page
document.addEventListener('DOMContentLoaded', function() {
    selectedSeason = getCurrentSeason(); // ← AJOUTER
    loadRankingsData();
    populateSeasonSelector(); // ← AJOUTER
    setupMatchDaySelector();
    updateSeasonTitle();

    if (typeof EloSystem !== 'undefined') {
        recalculateEloRatings();
        displayEloRanking();
        displayComparison();
    }

    displayRanking();
    updateChampionshipStats();
});

// Charger les données nécessaires
function loadRankingsData() {
    // Les données sont déjà chargées via teams-loader.js et storage.js
    console.log('Données de classement chargées');
}

// NOUVEAUTÉ ELO : Recalculer tous les ratings Elo
function recalculateEloRatings() {
    if (typeof EloSystem === 'undefined') {
        console.warn('Système Elo non chargé - classement Elo désactivé');
        return;
    }
    
    const season = selectedSeason || getCurrentSeason();
    const teams = getTeamsBySeason(season); // Utiliser vos équipes de la saison
    const matches = getMatchesBySeason(season); // Utiliser vos matchs de la saison
    
    teamsWithElo = EloSystem.recalculateAllEloRatings(teams, matches);
    
    // Sauvegarder les ratings (adapter selon votre système)
    teamsWithElo.forEach(team => {
        const storedTeams = getStoredTeams();
        const teamIndex = storedTeams.findIndex(t => t.id === team.id);
        if (teamIndex !== -1) {
            storedTeams[teamIndex].eloRating = team.eloRating;
            storedTeams[teamIndex].eloHistory = team.eloHistory;
        }
    });
    saveTeams(getStoredTeams());
    
    console.log('✅ Ratings Elo recalculés pour', teamsWithElo.length, 'équipes');
}

// Configurer le sélecteur de journée
function setupMatchDaySelector() {
    const matchDaySelect = document.getElementById('matchDaySelect');
    const season = selectedSeason || getCurrentSeason(); // ← AJOUTER
    const lastMatchDay = getLastPlayedMatchDay(season);
    
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
        if (typeof EloSystem !== 'undefined') {
            displayEloRanking();
            displayComparison();
        }

        updateMatchDayInfo();
    });
    
    updateMatchDayInfo();
}

function updateSeasonTitle() {
    const season = selectedSeason || getCurrentSeason();
    const titleElement = document.querySelector('.rankings-header h2');
    if (titleElement) {
        titleElement.textContent = `🏆 Classement ${season}`;
    }
}

// Remplir le sélecteur de saison
function populateSeasonSelector() {
    const seasonSelect = document.getElementById('seasonSelect');
    if (!seasonSelect) return;
    
    seasonSelect.innerHTML = '';
    
    // Récupérer toutes les saisons triées
    const seasons = getSeasonsOrderedByDate();
    
    // Ajouter chaque saison
    seasons.forEach(season => {
        const option = document.createElement('option');
        option.value = season.name;
        option.textContent = season.name;
        
        // Sélectionner la saison active par défaut
        if (season.isActive) {
            option.selected = true;
            selectedSeason = season.name;
        }
        
        seasonSelect.appendChild(option);
    });
    
    // Écouteur de changement
    seasonSelect.addEventListener('change', function() {
        selectedSeason = this.value;

        if (typeof EloSystem !== 'undefined') {
            recalculateEloRatings();
            displayEloRanking();
            displayComparison();
        }

        setupMatchDaySelector();
        displayRanking();
        updateChampionshipStats();
        updateSeasonTitle();
    });
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
    const season = selectedSeason || getCurrentSeason();
    const ranking = generateRanking(currentMatchDay, season);
    const tableBody = document.querySelector('#traditionalRanking tbody');
    const noMatchesMessage = document.getElementById('noMatchesMessage');
    
    // Filtrer seulement les équipes de la saison
    const seasonTeams = getTeamsBySeason(season);
    const seasonTeamIds = seasonTeams.map(t => t.id);
    const filteredRanking = ranking.filter(team => seasonTeamIds.includes(team.id));
    
    // Vérifier s'il y a des matchs - UTILISER filteredRanking
    if (filteredRanking.length === 0 || filteredRanking.every(team => team.played === 0)) {
        document.querySelector('.ranking-section').style.display = 'none';
        noMatchesMessage.style.display = 'block';
        return;
    }
    
    document.querySelector('.ranking-section').style.display = 'block';
    noMatchesMessage.style.display = 'none';
    
    // Vider le tableau
    tableBody.innerHTML = '';
    
    // Ajouter chaque équipe - UTILISER filteredRanking
    filteredRanking.forEach((team, index) => {
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

    if (typeof EloSystem !== 'undefined') {
        recalculateEloRatings();
        displayEloRanking();
        displayComparison();
    }

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

// NOUVEAUTÉ ELO : Afficher le classement Elo
function displayEloRanking() {
    const eloRankingSection = document.querySelector('#eloRanking');
    if (!eloRankingSection) {
        console.log('Section Elo non présente dans le HTML');
        return;
    }
    
    const tableBody = eloRankingSection.querySelector('tbody');
    if (!tableBody) return;
    
    const eloRanking = EloSystem.generateEloRanking(teamsWithElo);
    
    let filteredEloRanking = eloRanking;
    if (currentMatchDay) {
        filteredEloRanking = eloRanking.map(team => {
            const historyAtMatchDay = team.eloHistory?.find(h => h.matchDay === currentMatchDay);
            return {
                ...team,
                eloRating: historyAtMatchDay ? historyAtMatchDay.rating : EloSystem.ELO_CONFIG.INITIAL_RATING
            };
        }).sort((a, b) => b.eloRating - a.eloRating);
    }
    
    tableBody.innerHTML = '';
    
    filteredEloRanking.forEach((team, index) => {
        const row = createEloRankingRow(team, index + 1);
        tableBody.appendChild(row);
    });
}

// NOUVEAUTÉ ELO : Créer une ligne de classement Elo
function createEloRankingRow(team, position) {
    const row = document.createElement('tr');
    const config = getSeasonConfig();
    
    if (position <= config.championPlaces) {
        row.classList.add('champion');
    } else if (position <= config.europeanPlaces) {
        row.classList.add('european');
    } else {
        const totalTeams = teamsWithElo.filter(t => t.eloHistory && t.eloHistory.length > 0).length;
        const relegationStart = totalTeams - config.relegationPlaces + 1;
        if (position >= relegationStart && totalTeams >= 6) {
            row.classList.add('relegation');
        }
    }
    
    const eloRating = Math.round(team.eloRating || EloSystem.ELO_CONFIG.INITIAL_RATING);
    const eloChange = team.eloHistory && team.eloHistory.length > 0 
        ? eloRating - EloSystem.ELO_CONFIG.INITIAL_RATING 
        : 0;
    
    const changeClass = eloChange >= 0 ? 'positive' : 'negative';
    const changeSymbol = eloChange > 0 ? '+' : '';
    
    row.innerHTML = `
        <td class="position">${position}</td>
        <td class="team-name">${team.shortName}</td>
        <td class="elo-rating">${eloRating}</td>
        <td class="${changeClass}">${changeSymbol}${eloChange}</td>
        <td>${team.eloHistory ? team.eloHistory.length : 0}</td>
    `;
    
    const stats = EloSystem.getTeamEloStats(team);
    let tooltipText = `${team.name} - Elo: ${eloRating}`;
    if (stats && stats.form && stats.form.length > 0) {
        const formString = stats.form.map(h => h.result).join('');
        tooltipText += `\nForme récente: ${formString}`;
    }
    row.title = tooltipText;
    
    return row;
}

// NOUVEAUTÉ ELO : Afficher la comparaison des classements
function displayComparison() {
    const comparisonSection = document.querySelector('#comparisonRanking');
    if (!comparisonSection) {
        console.log('Section comparaison non présente dans le HTML');
        return;
    }
    
    const tableBody = comparisonSection.querySelector('tbody');
    if (!tableBody) return;
    
    const season = selectedSeason || getCurrentSeason();
    const traditionalRanking = generateRanking(currentMatchDay, season);
    
    // Filtrer pour la saison
    const seasonTeams = getTeamsBySeason(season);
    const seasonTeamIds = seasonTeams.map(t => t.id);
    const filteredTraditionalRanking = traditionalRanking.filter(team => seasonTeamIds.includes(team.id));
    
    const eloRanking = EloSystem.generateEloRanking(teamsWithElo);
    
    const comparison = EloSystem.compareRankings(filteredTraditionalRanking, eloRanking);
    
    tableBody.innerHTML = '';
    
    comparison.forEach(team => {
        const row = createComparisonRow(team);
        tableBody.appendChild(row);
    });
}

// NOUVEAUTÉ ELO : Créer une ligne de comparaison
function createComparisonRow(team) {
    const row = document.createElement('tr');
    
    const diff = team.positionDifference;
    let diffClass = 'no-change';
    let diffSymbol = '=';
    
    if (diff > 0) {
        diffClass = 'positive-diff';
        diffSymbol = `↑${diff}`;
    } else if (diff < 0) {
        diffClass = 'negative-diff';
        diffSymbol = `↓${Math.abs(diff)}`;
    }
    
    row.innerHTML = `
        <td class="team-name">${team.shortName}</td>
        <td>${team.traditionalPosition}</td>
        <td>${team.eloPosition}</td>
        <td class="${diffClass}">${diffSymbol}</td>
        <td>${team.points}</td>
        <td>${Math.round(team.eloRating || EloSystem.ELO_CONFIG.INITIAL_RATING)}</td>
    `;
    
    row.title = `${team.name}`;
    
    return row;
}

// Exposer la fonction pour l'utiliser depuis d'autres scripts
window.refreshRankings = refreshRankings;