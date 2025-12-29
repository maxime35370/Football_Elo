// calendar-core.js - Variables globales, initialisation, chargement des données

// ===============================
// VARIABLES GLOBALES (partagées entre modules)
// ===============================
let currentSeason = '';
let allTeams = [];
let allMatches = [];
let futureMatches = [];
let teamsWithElo = [];

// Variables pour le mode manuel
let manualModeActive = false;
let selectedHomeTeam = null;
let manualMatchDay = 17;
let createdManualMatches = [];

// Variables pour les pronostics
let currentPredictionMatchDay = null;
let storedPredictions = null;

// Variables pour la simulation
let simulatedResults = {};

// ===============================
// INITIALISATION
// ===============================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📅 Initialisation de la page Calendrier');
    
    // Charger les données
    allTeams = await getStoredTeamsAsync();
    await loadSeasons();
    
    // Événements des onglets
    setupTabs();
    
    // Événements des boutons
    setupButtons();
    
    // Événements des filtres
    setupFilters();
});

// ===============================
// CHARGEMENT DES DONNÉES
// ===============================

async function loadSeasons() {
    const seasonSelect = document.getElementById('seasonSelect');
    
    const seasons = await getStoredSeasons();
    
    if (seasons.length === 0) {
        seasonSelect.innerHTML = '<option value="">Aucune saison</option>';
        return;
    }
    
    seasonSelect.innerHTML = seasons.map(s => 
        `<option value="${s.name}">${s.name}</option>`
    ).join('');
    
    // Sélectionner la saison courante
    const current = getCurrentSeason();
    if (current && seasons.find(s => s.name === current)) {
        seasonSelect.value = current;
        currentSeason = current;
    } else {
        currentSeason = seasons[0].name;
    }
    
    // Événement changement de saison
    seasonSelect.addEventListener('change', function() {
        currentSeason = this.value;
        loadSeasonData();
    });
    
    // Charger les données
    await loadSeasonData();
}

async function loadSeasonData() {
    if (!currentSeason) return;
    
    // Charger les matchs
    allMatches = await getStoredMatchesAsync();
    allMatches = allMatches.filter(m => m.season === currentSeason);
    
    // Charger les matchs à venir (stockés séparément)
    futureMatches = await getFutureMatches(currentSeason);
    
    // Charger les équipes de la saison
    allTeams = getTeamsBySeason(currentSeason);
    
    console.log('All Teams:', allTeams);
    console.log('All Matches:', allMatches.length);
    
    // Calculer les Elo
    teamsWithElo = [];
    
    if (typeof EloSystem !== 'undefined' && allTeams.length > 0) {
        teamsWithElo = EloSystem.initializeTeamsElo(allTeams);
        const sortedMatches = [...allMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
        sortedMatches.forEach(match => {
            EloSystem.processMatch(match, teamsWithElo);
        });
        console.log('Elo calculé via EloSystem:', teamsWithElo.length);
    } else {
        console.log('Calcul manuel des Elo...');
        teamsWithElo = calculateEloManually();
        console.log('Elo calculé manuellement:', teamsWithElo.length);
    }
    
    // Mettre à jour le statut
    updateCalendarStatus();
    
    // Peupler les filtres
    populateFilters();
    
    // Afficher l'onglet actif
    displayActiveTab();
}

// Calculer les Elo manuellement si EloSystem n'est pas disponible
function calculateEloManually() {
    const K = 32;
    const HOME_ADVANTAGE = 50;
    const INITIAL_RATING = 1500;
    
    const teams = allTeams.map(team => ({
        ...team,
        eloRating: INITIAL_RATING
    }));
    
    const teamMap = {};
    teams.forEach(t => teamMap[t.id] = t);
    
    const sortedMatches = [...allMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
    
    sortedMatches.forEach(match => {
        const homeTeam = teamMap[match.homeTeamId];
        const awayTeam = teamMap[match.awayTeamId];
        
        if (!homeTeam || !awayTeam) return;
        if (!match.finalScore) return;
        
        const homeScore = match.finalScore.home;
        const awayScore = match.finalScore.away;
        
        const homeRating = homeTeam.eloRating + HOME_ADVANTAGE;
        const awayRating = awayTeam.eloRating;
        
        const expectedHome = 1 / (1 + Math.pow(10, (awayRating - homeRating) / 400));
        const expectedAway = 1 - expectedHome;
        
        let actualHome, actualAway;
        if (homeScore > awayScore) {
            actualHome = 1;
            actualAway = 0;
        } else if (homeScore < awayScore) {
            actualHome = 0;
            actualAway = 1;
        } else {
            actualHome = 0.5;
            actualAway = 0.5;
        }
        
        homeTeam.eloRating = Math.round(homeTeam.eloRating + K * (actualHome - expectedHome));
        awayTeam.eloRating = Math.round(awayTeam.eloRating + K * (actualAway - expectedAway));
    });
    
    return teams;
}

// Récupérer les matchs à venir
async function getFutureMatches(season) {
    try {
        const stored = localStorage.getItem(`footballEloFutureMatches_${season}`);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Erreur chargement matchs à venir:', e);
        return [];
    }
}

// Sauvegarder les matchs à venir
async function saveFutureMatches(season, matches) {
    try {
        localStorage.setItem(`footballEloFutureMatches_${season}`, JSON.stringify(matches));
    } catch (e) {
        console.error('Erreur sauvegarde matchs à venir:', e);
    }
}

function updateCalendarStatus() {
    const status = document.getElementById('calendarStatus');
    if (!status) return;
    
    const played = allMatches.length;
    const upcoming = futureMatches.length;
    const total = played + upcoming;
    
    if (total === 0) {
        status.textContent = 'Aucun match dans le calendrier';
        status.style.color = '#e74c3c';
    } else {
        status.textContent = `${played} joués / ${upcoming} à venir (${total} total)`;
        status.style.color = '#27ae60';
    }
}

// ===============================
// NAVIGATION PAR ONGLETS
// ===============================

function setupTabs() {
    document.querySelectorAll('.calendar-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.calendar-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            this.classList.add('active');
            const tabId = this.dataset.tab + 'Tab';
            document.getElementById(tabId).classList.add('active');
            
            displayActiveTab();
        });
    });
}

function displayActiveTab() {
    const activeTab = document.querySelector('.calendar-tab.active');
    if (!activeTab) return;
    
    const tab = activeTab.dataset.tab;
    
    switch (tab) {
        case 'schedule':
            displaySchedule();
            break;
        case 'difficulty':
            displayDifficulty();
            break;
        case 'objectives':
            displayObjectives();
            break;
        case 'simulation':
            displaySimulation();
            break;
        case 'predictions':
            displayPredictions();
            break;
    }
}

// ===============================
// BOUTONS
// ===============================

function setupButtons() {
    document.getElementById('generateCalendarBtn')?.addEventListener('click', generateFullCalendar);
    document.getElementById('clearFutureMatchesBtn')?.addEventListener('click', clearFutureMatches);
    document.getElementById('simulateRandomBtn')?.addEventListener('click', simulateRandom);
    document.getElementById('simulateEloBtn')?.addEventListener('click', simulateWithElo);
    document.getElementById('resetSimulationBtn')?.addEventListener('click', resetSimulation);
    setupManualMode();
}

// ===============================
// CONFIGURATION
// ===============================

function getSeasonConfig() {
    try {
        const stored = localStorage.getItem('footballEloSeasonConfig');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {}
    
    return {
        championPlaces: 1,
        europeanPlaces: 4,
        relegationPlaces: 3
    };
}