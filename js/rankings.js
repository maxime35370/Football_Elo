// rankings.js - Logique d'affichage des classements

let currentMatchDay = null;
let selectedSeason = null; // ← AJOUTER CETTE LIGNE
let teamsWithElo = [];
let rankingMode = 'all';
let fromMatchDay = null;
let locationFilter = 'all'; // 'all', 'home', 'away'
let rankingEvolutionChart = null;
let eloEvolutionChart = null;

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
    // Mode mi-temps
    document.getElementById('rankingPeriod').addEventListener('change', function() {
        rankingMode = this.value;
        displayRanking();
        updateChampionshipStats();
    });

    // Onglets domicile/extérieur
    document.querySelectorAll('.ranking-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Retirer la classe active de tous les onglets
            document.querySelectorAll('.ranking-tab').forEach(t => t.classList.remove('active'));
            // Ajouter la classe active à l'onglet cliqué
            this.classList.add('active');
            
            // Mettre à jour le filtre
            locationFilter = this.dataset.filter;
            
            // Rafraîchir le classement
            displayRanking();
        });
    });

    displayRanking();
    updateChampionshipStats();
    initializeH2HSelectors();
    initEvolutionCharts();
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
    const teams = getTeamsBySeason(season);
    const matches = getMatchesBySeason(season);
    
    // AJOUTER CE DEBUG
    console.log('=== ANALYSE DES MATCHS ===');
    console.log('Total matchs dans la saison:', matches.length);
    
    // Grouper par journée
    const matchesByDay = {};
    matches.forEach(match => {
        const day = match.matchDay || 'sans journée';
        if (!matchesByDay[day]) matchesByDay[day] = [];
        matchesByDay[day].push(match);
    });
    
    console.log('Répartition par journée:');
    Object.keys(matchesByDay).sort().forEach(day => {
        console.log(`  Journée ${day}: ${matchesByDay[day].length} matchs`);
    });
    
    // Compter les matchs par équipe
    const matchCountByTeam = {};
    matches.forEach(match => {
        const homeId = match.homeTeamId;
        const awayId = match.awayTeamId;
        matchCountByTeam[homeId] = (matchCountByTeam[homeId] || 0) + 1;
        matchCountByTeam[awayId] = (matchCountByTeam[awayId] || 0) + 1;
    });
    
    console.log('Matchs par équipe:');
    teams.forEach(team => {
        const count = matchCountByTeam[team.id] || 0;
        console.log(`  ${team.shortName}: ${count} matchs`);
    });
    console.log('========================');
    
    teamsWithElo = EloSystem.recalculateAllEloRatings(teams, matches, getSeasonStartingElo(season));

    console.log('✅ Ratings Elo recalculés pour', teamsWithElo.length, 'équipes');
}

// Configurer le sélecteur de journée
function setupMatchDaySelector() {
    const matchDaySelect = document.getElementById('matchDaySelect');
    const fromMatchDaySelect = document.getElementById('fromMatchDaySelect');
    const season = selectedSeason || getCurrentSeason();
    const lastMatchDay = getLastPlayedMatchDay(season);
    const teams = getTeamsBySeason(season);
    const maxMatchDay = (teams.length - 1) * 2;
    
    // Sélecteur "jusqu'à"
    matchDaySelect.innerHTML = '<option value="">Actuel</option>';
    for (let i = 1; i <= maxMatchDay; i++) {
        const played = i <= lastMatchDay ? ' ✓' : '';
        matchDaySelect.innerHTML += `<option value="${i}">J${i}${played}</option>`;
    }
    
    // Sélecteur "depuis"
    fromMatchDaySelect.innerHTML = '<option value="">1</option>';
    for (let i = 2; i <= maxMatchDay; i++) {
        fromMatchDaySelect.innerHTML += `<option value="${i}">${i}</option>`;
    }
    
    // Événement "jusqu'à"
    matchDaySelect.addEventListener('change', function() {
        currentMatchDay = this.value ? parseInt(this.value) : null;
        displayRanking();
        if (typeof EloSystem !== 'undefined') {
            displayEloRanking();
            displayComparison();
        }
        updateMatchDayInfo();
        updateChampionshipStats();
    });
    
    // Événement "depuis"
    fromMatchDaySelect.addEventListener('change', function() {
        fromMatchDay = this.value ? parseInt(this.value) : null;
        displayRanking();
        updateMatchDayInfo();
        updateChampionshipStats();
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
        initEvolutionCharts();
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
    const ranking = generateRanking(currentMatchDay, season, fromMatchDay, rankingMode, locationFilter);
    
    const tableBody = document.querySelector('#traditionalRanking tbody');
    const noMatchesMessage = document.getElementById('noMatchesMessage');
    // Filtrer seulement les équipes de la saison
    const seasonTeams = getTeamsBySeason(season);
    const seasonTeamIds = seasonTeams.map(t => t.id);
    const filteredRanking = ranking.filter(team => seasonTeamIds.includes(team.id)); 
    // Mettre à jour le titre selon le mode
    const sectionTitle = document.querySelector('.ranking-section h3');

    // Mettre à jour le titre selon le filtre
    const titleElement = document.getElementById('rankingTitle');
    if (titleElement) {
        let titleText;
        switch (rankingMode) {
            case 'firstHalf': titleText = '⏱️ Classement 1ère mi-temps'; break;
            case 'secondHalf': titleText = '⏱️ Classement 2ème mi-temps'; break;
            case 'noExtraTime': titleText = '⏱️ Classement sans temps additionnel'; break;
            default: titleText = '📊 Classement traditionnel'; break;
        }
        if (locationFilter === 'home') {
            titleText += ' (Domicile)';
        } else if (locationFilter === 'away') {
            titleText += ' (Extérieur)';
        }
        titleElement.textContent = titleText;
    }

    if (sectionTitle) {
        switch (rankingMode) {
            case 'firstHalf': sectionTitle.innerHTML = '⏱️ Classement 1ère mi-temps (45\')'; break;
            case 'secondHalf': sectionTitle.innerHTML = '⏱️ Classement 2ème mi-temps (46\'-90\')'; break;
            case 'noExtraTime': sectionTitle.innerHTML = '⏱️ Classement sans temps additionnel'; break;
            default: sectionTitle.innerHTML = '📊 Classement traditionnel (points)'; break;
        }
    }

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
    
    // Calculer la forme et la série
    const season = selectedSeason || getCurrentSeason();
    const form = getTeamForm(team.id, currentMatchDay, season, 5, locationFilter);
    const streak = getTeamStreak(team.id, currentMatchDay, season, locationFilter);

    // Générer les badges de forme
    const formHTML = form.map(result => {
        let className = 'form-badge ';
        if (result === 'V') className += 'form-win';
        else if (result === 'D') className += 'form-loss';
        else className += 'form-draw';
        return `<span class="${className}">${result}</span>`;
    }).join('');

    // Générer le badge de série
    let streakClass = 'streak-badge ';
    if (streak.type === 'V') streakClass += 'streak-win';
    else if (streak.type === 'D') streakClass += 'streak-loss';
    else if (streak.type === 'N') streakClass += 'streak-draw';

    const streakHTML = streak.count > 0 
        ? `<span class="${streakClass}">${streak.count}${streak.type}</span>`
        : '-';

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
        <td class="form-cell">${formHTML || '-'}</td>
        <td class="streak-cell">${streakHTML}</td>
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
    const season = selectedSeason || getCurrentSeason();
    const teamRanking = generateRanking(currentMatchDay, season, fromMatchDay, rankingMode, locationFilter);
    return teamRanking.filter(team => team.played > 0);
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
        console.log(`${team.shortName}: ${team.eloHistory?.length || 0} matchs dans l'historique`);
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
    let matchesPlayed = 0;
    if (team.eloHistory) {
        if (currentMatchDay) {
            // Compter seulement les matchs jusqu'à la journée sélectionnée
            matchesPlayed = team.eloHistory.filter(h => h.matchDay <= currentMatchDay).length;
        } else {
            // Compter tous les matchs
            matchesPlayed = team.eloHistory.length;
        }
    }
    
    row.innerHTML = `
        <td class="position">${position}</td>
        <td class="team-name">${team.shortName}</td>
        <td class="elo-rating">${eloRating}</td>
        <td class="${changeClass}">${changeSymbol}${eloChange}</td>
        <td>${matchesPlayed}</td>  <!-- ← C'est ici le problème -->
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
    const traditionalRanking = generateRanking(currentMatchDay, season, fromMatchDay, rankingMode, locationFilter);
    
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
    
    // Récupérer le rating Elo depuis teamsWithElo
    const teamWithElo = teamsWithElo.find(t => t.id === team.id);
    const eloRating = teamWithElo ? Math.round(teamWithElo.eloRating) : EloSystem.ELO_CONFIG.INITIAL_RATING;
    
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
        <td>${eloRating}</td>
    `;
    
    row.title = `${team.name}`;
    
    return row;
}

// ===============================
// GRAPHIQUES D'ÉVOLUTION
// ===============================

// Couleurs pour les équipes
const teamColors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
    '#e67e22', '#34495e', '#16a085', '#c0392b', '#27ae60', '#2980b9',
    '#8e44ad', '#f1c40f', '#d35400', '#2c3e50', '#7f8c8d', '#95a5a6'
];

function getTeamColor(index) {
    return teamColors[index % teamColors.length];
}

// Initialiser les sélecteurs d'équipes pour les graphiques
function initEvolutionCharts() {
    const season = selectedSeason || getCurrentSeason();
    const teams = getTeamsBySeason(season);
    const ranking = generateRanking(null, season, null, false, 'all');
    
    // Trier par classement actuel
    const sortedTeams = ranking
        .filter(t => t.played > 0)
        .sort((a, b) => b.points - a.points);
    
    // Remplir les sélecteurs
    const rankingSelect = document.getElementById('rankingChartTeams');
    const eloSelect = document.getElementById('eloChartTeams');
    
    if (rankingSelect) {
        rankingSelect.innerHTML = sortedTeams.map((team, index) => 
            `<option value="${team.id}">${index + 1}. ${team.shortName}</option>`
        ).join('');
    }
    
    if (eloSelect) {
        eloSelect.innerHTML = sortedTeams.map((team, index) => 
            `<option value="${team.id}">${index + 1}. ${team.shortName}</option>`
        ).join('');
    }
    
    // Événements pour les boutons
    setupChartButtons();
    
    // Événements pour les sélecteurs
    if (rankingSelect) {
        rankingSelect.addEventListener('change', updateRankingEvolutionChart);
    }
    if (eloSelect) {
        eloSelect.addEventListener('change', updateEloEvolutionChart);
    }
    
    // Sélectionner le top 6 par défaut
    selectTopTeams(6, 'rankingChartTeams');
    selectTopTeams(6, 'eloChartTeams');
    
    // Générer les graphiques
    updateRankingEvolutionChart();
    updateEloEvolutionChart();
}

// Configurer les boutons de sélection
function setupChartButtons() {
    // Boutons pour le classement
    document.getElementById('selectTop6')?.addEventListener('click', () => {
        selectTopTeams(6, 'rankingChartTeams');
        updateRankingEvolutionChart();
    });
    
    document.getElementById('selectBottom6')?.addEventListener('click', () => {
        selectBottomTeams(6, 'rankingChartTeams');
        updateRankingEvolutionChart();
    });
    
    document.getElementById('selectAllTeams')?.addEventListener('click', () => {
        selectAllTeamsInSelect('rankingChartTeams');
        updateRankingEvolutionChart();
    });
    
    document.getElementById('clearTeams')?.addEventListener('click', () => {
        clearSelection('rankingChartTeams');
        updateRankingEvolutionChart();
    });
    
    // Boutons pour l'Elo
    document.getElementById('selectTop6Elo')?.addEventListener('click', () => {
        selectTopTeams(6, 'eloChartTeams');
        updateEloEvolutionChart();
    });
    
    document.getElementById('selectBottom6Elo')?.addEventListener('click', () => {
        selectBottomTeams(6, 'eloChartTeams');
        updateEloEvolutionChart();
    });
    
    document.getElementById('selectAllTeamsElo')?.addEventListener('click', () => {
        selectAllTeamsInSelect('eloChartTeams');
        updateEloEvolutionChart();
    });
    
    document.getElementById('clearTeamsElo')?.addEventListener('click', () => {
        clearSelection('eloChartTeams');
        updateEloEvolutionChart();
    });
}

function selectTopTeams(count, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    Array.from(select.options).forEach((option, index) => {
        option.selected = index < count;
    });
}

function selectBottomTeams(count, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const total = select.options.length;
    Array.from(select.options).forEach((option, index) => {
        option.selected = index >= total - count;
    });
}

function selectAllTeamsInSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    Array.from(select.options).forEach(option => {
        option.selected = true;
    });
}

function clearSelection(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    Array.from(select.options).forEach(option => {
        option.selected = false;
    });
}

// Calculer le classement à chaque journée
function calculateRankingByMatchDay() {
    const season = selectedSeason || getCurrentSeason();
    const matches = getMatchesBySeason(season);
    const teams = getTeamsBySeason(season);
    
    const maxMatchDay = Math.max(...matches.map(m => m.matchDay || 0), 0);
    
    const rankingHistory = {};
    
    // Initialiser l'historique pour chaque équipe
    teams.forEach(team => {
        rankingHistory[team.id] = {
            team: team,
            positions: [] // Position à chaque journée
        };
    });
    
    // Calculer le classement à chaque journée
    for (let day = 1; day <= maxMatchDay; day++) {
        const ranking = generateRanking(day, season, null, false, 'all');
        
        // Filtrer les équipes qui ont joué
        const activeTeams = ranking.filter(t => t.played > 0);
        
        activeTeams.forEach((team, index) => {
            if (rankingHistory[team.id]) {
                rankingHistory[team.id].positions.push({
                    matchDay: day,
                    position: index + 1,
                    points: team.points
                });
            }
        });
        
        // Pour les équipes qui n'ont pas encore joué, ne pas ajouter de position
    }
    
    return { rankingHistory, maxMatchDay };
}

// Mettre à jour le graphique d'évolution du classement
function updateRankingEvolutionChart() {
    const canvas = document.getElementById('rankingEvolutionChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Détruire le graphique existant
    if (rankingEvolutionChart) {
        rankingEvolutionChart.destroy();
    }
    
    // Récupérer les équipes sélectionnées
    const select = document.getElementById('rankingChartTeams');
    const selectedTeamIds = Array.from(select.selectedOptions).map(opt => opt.value);
    
    if (selectedTeamIds.length === 0) {
        return;
    }
    
    // Calculer l'historique des classements
    const { rankingHistory, maxMatchDay } = calculateRankingByMatchDay();
    
    // Préparer les datasets
    const datasets = [];
    
    selectedTeamIds.forEach((teamId, index) => {
        const history = rankingHistory[teamId];
        if (!history || history.positions.length === 0) return;
        
        const color = getTeamColor(index);
        
        datasets.push({
            label: history.team.shortName,
            data: history.positions.map(p => ({ x: p.matchDay, y: p.position })),
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            pointRadius: 1,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.2
        });
    });
    
    // Créer le graphique
    rankingEvolutionChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y}${getOrdinalSuffix(context.parsed.y)} place`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Journée',
                        font: { weight: 'bold' }
                    },
                    min: 1,
                    max: maxMatchDay,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return 'J' + value;
                        }
                    }
                },
                y: {
                    reverse: true, // 1er en haut
                    title: {
                        display: true,
                        text: 'Position',
                        font: { weight: 'bold' }
                    },
                    min: 1,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return value + getOrdinalSuffix(value);
                        }
                    }
                }
            }
        }
    });
}

// Mettre à jour le graphique d'évolution Elo
function updateEloEvolutionChart() {
    const canvas = document.getElementById('eloEvolutionChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Détruire le graphique existant
    if (eloEvolutionChart) {
        eloEvolutionChart.destroy();
    }
    
    // Récupérer les équipes sélectionnées
    const select = document.getElementById('eloChartTeams');
    const selectedTeamIds = Array.from(select.selectedOptions).map(opt => opt.value);
    
    if (selectedTeamIds.length === 0) {
        return;
    }
    
    // Vérifier que le système Elo est chargé
    if (typeof EloSystem === 'undefined' || teamsWithElo.length === 0) {
        return;
    }
    
    // Préparer les datasets
    const datasets = [];
    const initialRating = EloSystem.ELO_CONFIG?.INITIAL_RATING || 1500;
    
    selectedTeamIds.forEach((teamId, index) => {
        const team = teamsWithElo.find(t => t.id == teamId);
        if (!team || !team.eloHistory || team.eloHistory.length === 0) return;
        
        const color = getTeamColor(index);
        
        // Ajouter le point initial (avant J1)
        const data = [{ x: 0, y: initialRating }];
        
        // Ajouter les points après chaque journée
        team.eloHistory.forEach(h => {
            data.push({ x: h.matchDay, y: h.rating });
        });
        
        datasets.push({
            label: team.shortName,
            data: data,
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            pointRadius: 0.5,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.25

        });
    });
    
    // Trouver les bornes du graphique
    let minElo = initialRating;
    let maxElo = initialRating;
    let maxMatchDay = 1;
    
    datasets.forEach(ds => {
        ds.data.forEach(point => {
            if (point.y < minElo) minElo = point.y;
            if (point.y > maxElo) maxElo = point.y;
            if (point.x > maxMatchDay) maxMatchDay = point.x;
        });
    });
    
    // Créer le graphique
    eloEvolutionChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const diff = context.parsed.y - initialRating;
                            const sign = diff >= 0 ? '+' : '';
                            return `${context.dataset.label}: ${Math.round(context.parsed.y)} (${sign}${Math.round(diff)})`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Journée',
                        font: { weight: 'bold' }
                    },
                    min: 0,
                    max: maxMatchDay,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return value === 0 ? 'Début' : 'J' + value;
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Rating Elo',
                        font: { weight: 'bold' }
                    },
                    min: Math.floor((minElo - 50) / 50) * 50,
                    max: Math.ceil((maxElo + 50) / 50) * 50,
                    ticks: {
                        stepSize: 50
                    }
                }
            },
            annotation: {
                annotations: {
                    line1: {
                        type: 'line',
                        yMin: initialRating,
                        yMax: initialRating,
                        borderColor: 'rgba(0, 0, 0, 0.3)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        label: {
                            display: true,
                            content: 'Rating initial',
                            position: 'end'
                        }
                    }
                }
            }
        }
    });
}

// Helper pour les suffixes ordinaux
function getOrdinalSuffix(n) {
    if (n === 1) return 'er';
    return 'e';
}

// Exposer la fonction pour l'utiliser depuis d'autres scripts
window.refreshRankings = refreshRankings;