// calendar.js - Gestion du calendrier et des prédictions

// Variables globales
let currentSeason = '';
let allTeams = [];
let allMatches = [];
let futureMatches = []; // Matchs générés mais pas encore joués
let teamsWithElo = [];
let manualModeActive = false;
let selectedHomeTeam = null;
let manualMatchDay = 17;
let createdManualMatches = [];
// Variables pour les pronostics
let currentPredictionMatchDay = null;
let storedPredictions = null;

// Initialisation
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
    
    // Utiliser les Elo des équipes directement (depuis rankings.js ou les données stockées)
    // Essayer d'abord de récupérer les Elo calculés depuis le localStorage ou via EloSystem
    teamsWithElo = [];
    
    if (typeof EloSystem !== 'undefined' && allTeams.length > 0) {
        // Si EloSystem est disponible, l'utiliser
        teamsWithElo = EloSystem.initializeTeamsElo(allTeams);
        const sortedMatches = [...allMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
        sortedMatches.forEach(match => {
            EloSystem.processMatch(match, teamsWithElo);
        });
        console.log('Elo calculé via EloSystem:', teamsWithElo.length);
    } else {
        // Sinon, calculer manuellement les Elo
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
    const K = 32; // Facteur K standard
    const HOME_ADVANTAGE = 50; // Avantage domicile
    const INITIAL_RATING = 1500;
    
    // Initialiser les ratings
    const teams = allTeams.map(team => ({
        ...team,
        eloRating: INITIAL_RATING
    }));
    
    // Créer un map pour accès rapide
    const teamMap = {};
    teams.forEach(t => teamMap[t.id] = t);
    
    // Trier les matchs par journée
    const sortedMatches = [...allMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
    
    // Traiter chaque match
    sortedMatches.forEach(match => {
        const homeTeam = teamMap[match.homeTeamId];
        const awayTeam = teamMap[match.awayTeamId];
        
        if (!homeTeam || !awayTeam) return;
        if (!match.finalScore) return;
        
        const homeScore = match.finalScore.home;
        const awayScore = match.finalScore.away;
        
        // Calculer le résultat attendu
        const homeRating = homeTeam.eloRating + HOME_ADVANTAGE;
        const awayRating = awayTeam.eloRating;
        
        const expectedHome = 1 / (1 + Math.pow(10, (awayRating - homeRating) / 400));
        const expectedAway = 1 - expectedHome;
        
        // Résultat réel
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
        
        // Mettre à jour les ratings
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

// ===============================
// GÉNÉRATION DU CALENDRIER
// ===============================

function generateFullCalendar() {
    const teams = getTeamsBySeason(currentSeason);
    
    if (teams.length < 2) {
        alert('Il faut au moins 2 équipes pour générer un calendrier.');
        return;
    }
    
    const numTeams = teams.length;
    const matchesPerDay = Math.floor(numTeams / 2);
    const totalMatchDays = (numTeams - 1) * 2; // 34 journées pour 18 équipes
    
    // Trouver toutes les confrontations possibles (aller + retour)
    const allPossibleConfrontations = [];
    for (let i = 0; i < teams.length; i++) {
        for (let j = 0; j < teams.length; j++) {
            if (i !== j) {
                allPossibleConfrontations.push({
                    homeTeamId: teams[i].id,
                    awayTeamId: teams[j].id
                });
            }
        }
    }
    
    // Créer un set des confrontations DÉJÀ JOUÉES
    const playedConfrontations = new Set();
    allMatches.forEach(match => {
        playedConfrontations.add(`${match.homeTeamId}-${match.awayTeamId}`);
    });
    
    // Trouver les confrontations manquantes
    let missingConfrontations = allPossibleConfrontations.filter(conf => 
        !playedConfrontations.has(`${conf.homeTeamId}-${conf.awayTeamId}`)
    );
    
    if (missingConfrontations.length === 0) {
        alert('✅ Tous les matchs ont déjà été joués !');
        return;
    }
    
    // Trouver la dernière journée jouée
    const lastPlayedMatchDay = Math.max(...allMatches.map(m => m.matchDay || 0), 0);
    
    // Compter combien de matchs chaque équipe doit encore jouer
    const teamRemainingMatches = {};
    teams.forEach(t => teamRemainingMatches[t.id] = 0);
    missingConfrontations.forEach(conf => {
        teamRemainingMatches[conf.homeTeamId]++;
        teamRemainingMatches[conf.awayTeamId]++;
    });
    
    // Fonction pour trier les confrontations par priorité
    // (équipes avec le plus de matchs restants en premier)
    function sortByPriority(confrontations) {
        return confrontations.sort((a, b) => {
            const priorityA = teamRemainingMatches[a.homeTeamId] + teamRemainingMatches[a.awayTeamId];
            const priorityB = teamRemainingMatches[b.homeTeamId] + teamRemainingMatches[b.awayTeamId];
            return priorityB - priorityA;
        });
    }
    
    // Générer les matchs avec un algorithme optimisé
    const generatedMatches = [];
    let matchId = Date.now();
    let currentMatchDay = lastPlayedMatchDay + 1;
    
    // Copier et mélanger les confrontations
    let remainingConfrontations = [...missingConfrontations];
    
    while (remainingConfrontations.length > 0 && currentMatchDay <= totalMatchDays) {
        const teamsPlayingThisDay = new Set();
        const matchesThisDay = [];
        
        // Trier par priorité à chaque journée
        sortByPriority(remainingConfrontations);
        
        // Parcourir et sélectionner les matchs compatibles
        const toRemove = [];
        
        for (let i = 0; i < remainingConfrontations.length; i++) {
            const conf = remainingConfrontations[i];
            
            // Vérifier que les deux équipes ne jouent pas déjà ce jour
            if (!teamsPlayingThisDay.has(conf.homeTeamId) && !teamsPlayingThisDay.has(conf.awayTeamId)) {
                matchesThisDay.push({
                    id: matchId++,
                    season: currentSeason,
                    matchDay: currentMatchDay,
                    homeTeamId: conf.homeTeamId,
                    awayTeamId: conf.awayTeamId,
                    status: 'upcoming'
                });
                
                teamsPlayingThisDay.add(conf.homeTeamId);
                teamsPlayingThisDay.add(conf.awayTeamId);
                toRemove.push(i);
                
                // Décrémenter le compteur de matchs restants
                teamRemainingMatches[conf.homeTeamId]--;
                teamRemainingMatches[conf.awayTeamId]--;
                
                // Si on a atteint le max de matchs par jour, arrêter
                if (matchesThisDay.length >= matchesPerDay) {
                    break;
                }
            }
        }
        
        // Retirer les confrontations assignées (en ordre inverse pour ne pas décaler les indices)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            remainingConfrontations.splice(toRemove[i], 1);
        }
        
        generatedMatches.push(...matchesThisDay);
        currentMatchDay++;
    }
    
    // S'il reste des matchs (ne devrait pas arriver avec un bon algo)
    if (remainingConfrontations.length > 0) {
        console.warn(`⚠️ ${remainingConfrontations.length} matchs n'ont pas pu être assignés dans les ${totalMatchDays} journées`);
        
        // Les ajouter quand même en journées supplémentaires
        while (remainingConfrontations.length > 0) {
            const teamsPlayingThisDay = new Set();
            const matchesThisDay = [];
            const toRemove = [];
            
            for (let i = 0; i < remainingConfrontations.length; i++) {
                const conf = remainingConfrontations[i];
                
                if (!teamsPlayingThisDay.has(conf.homeTeamId) && !teamsPlayingThisDay.has(conf.awayTeamId)) {
                    matchesThisDay.push({
                        id: matchId++,
                        season: currentSeason,
                        matchDay: currentMatchDay,
                        homeTeamId: conf.homeTeamId,
                        awayTeamId: conf.awayTeamId,
                        status: 'upcoming'
                    });
                    
                    teamsPlayingThisDay.add(conf.homeTeamId);
                    teamsPlayingThisDay.add(conf.awayTeamId);
                    toRemove.push(i);
                }
            }
            
            for (let i = toRemove.length - 1; i >= 0; i--) {
                remainingConfrontations.splice(toRemove[i], 1);
            }
            
            generatedMatches.push(...matchesThisDay);
            currentMatchDay++;
        }
    }
    
    futureMatches = generatedMatches;
    
    // Sauvegarder
    saveFutureMatches(currentSeason, futureMatches);
    
    // Mettre à jour l'affichage
    updateCalendarStatus();
    displayActiveTab();
    
    const finalMatchDay = currentMatchDay - 1;
    const expectedMatchDays = totalMatchDays;
    
    let statusMsg = `✅ Calendrier généré !\n\n📊 Statistiques:\n- ${playedConfrontations.size} matchs déjà joués\n- ${generatedMatches.length} matchs à venir\n- Journées ${lastPlayedMatchDay + 1} à ${finalMatchDay}`;
    
    if (finalMatchDay <= expectedMatchDays) {
        statusMsg += `\n\n✅ Calendrier optimal (${expectedMatchDays} journées)`;
    } else {
        statusMsg += `\n\n⚠️ ${finalMatchDay - expectedMatchDays} journée(s) supplémentaire(s) nécessaire(s)`;
    }
    
    alert(statusMsg);
}

function clearFutureMatches() {
    if (!confirm('Êtes-vous sûr de vouloir supprimer tous les matchs à venir ?')) {
        return;
    }
    
    futureMatches = [];
    saveFutureMatches(currentSeason, []);
    
    updateCalendarStatus();
    displayActiveTab();
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
            // Retirer active de tous les onglets
            document.querySelectorAll('.calendar-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            // Activer l'onglet cliqué
            this.classList.add('active');
            const tabId = this.dataset.tab + 'Tab';
            document.getElementById(tabId).classList.add('active');
            
            // Afficher le contenu
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
// ONGLET CALENDRIER
// ===============================

function populateFilters() {
    // Filtre journées
    const matchdayFilter = document.getElementById('matchdayFilter');
    const allMatchDays = [...new Set([
        ...allMatches.map(m => m.matchDay),
        ...futureMatches.map(m => m.matchDay)
    ])].sort((a, b) => a - b);
    
    matchdayFilter.innerHTML = '<option value="all">Toutes</option>' +
        allMatchDays.map(d => `<option value="${d}">Journée ${d}</option>`).join('');
    
    // Filtre équipes
    const teamFilter = document.getElementById('teamFilter');
    teamFilter.innerHTML = '<option value="all">Toutes</option>' +
        allTeams.map(t => `<option value="${t.id}">${t.shortName}</option>`).join('');
}

function setupFilters() {
    ['matchdayFilter', 'teamFilter', 'statusFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', displaySchedule);
        }
    });
}

function displaySchedule() {
    const container = document.getElementById('scheduleContent');
    if (!container) return;
    
    // Récupérer les filtres
    const matchdayFilter = document.getElementById('matchdayFilter').value;
    const teamFilter = document.getElementById('teamFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    // Combiner matchs joués et à venir
    const playedWithStatus = allMatches.map(m => ({ ...m, status: 'played' }));
    const upcomingWithStatus = futureMatches.map(m => ({ ...m, status: 'upcoming' }));
    let combinedMatches = [...playedWithStatus, ...upcomingWithStatus];
    
    // Appliquer les filtres
    if (matchdayFilter !== 'all') {
        combinedMatches = combinedMatches.filter(m => m.matchDay == matchdayFilter);
    }
    if (teamFilter !== 'all') {
        combinedMatches = combinedMatches.filter(m => 
            m.homeTeamId == teamFilter || m.awayTeamId == teamFilter
        );
    }
    if (statusFilter !== 'all') {
        combinedMatches = combinedMatches.filter(m => m.status === statusFilter);
    }
    
    // Grouper par journée
    const matchesByDay = {};
    combinedMatches.forEach(match => {
        const day = match.matchDay || 0;
        if (!matchesByDay[day]) matchesByDay[day] = [];
        matchesByDay[day].push(match);
    });
    
    // Générer le HTML
    const sortedDays = Object.keys(matchesByDay).sort((a, b) => a - b);
    
    if (sortedDays.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:2rem;">Aucun match trouvé</p>';
        return;
    }
    
    container.innerHTML = sortedDays.map(day => {
        const matches = matchesByDay[day];
        const playedCount = matches.filter(m => m.status === 'played').length;
        const upcomingCount = matches.filter(m => m.status === 'upcoming').length;
        
        return `
            <div class="matchday-section">
                <div class="matchday-header">
                    <span>Journée ${day}</span>
                    <span class="match-count">${playedCount} joués, ${upcomingCount} à venir</span>
                </div>
                <div class="matchday-matches">
                    ${matches.map(match => createMatchCard(match)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function createMatchCard(match) {
    const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
    
    const isPlayed = match.status === 'played';
    const score = isPlayed ? `${match.finalScore.home} - ${match.finalScore.away}` : 'À venir';
    
    return `
        <div class="match-card ${match.status}">
            <div class="match-teams">
                <div class="match-team home">${homeTeam ? homeTeam.shortName : '?'}</div>
                <div class="match-team away">${awayTeam ? awayTeam.shortName : '?'}</div>
            </div>
            <div class="match-score ${match.status}">${score}</div>
            <span class="match-status ${match.status}">${isPlayed ? 'Joué' : 'À venir'}</span>
        </div>
    `;
}

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
    
    // Debug
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
    
    // Trier par difficulté décroissante (calendrier le plus difficile en premier)
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
        
        // Tooltip avec le détail des adversaires
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

// ===============================
// ONGLET OBJECTIFS
// ===============================

function displayObjectives() {
    const container = document.getElementById('objectivesContent');
    if (!container) return;
    
    // Récupérer la config
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
    
    // Calculer le nombre total de journées
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
    
    // Calculer les projections basées sur les matchs à venir
    const projections = sortedRanking.map((team, index) => {
        const matchesPlayed = team.played || 0;
        const currentPoints = team.points || 0;
        const matchesRemaining = totalMatchesPerTeam - matchesPlayed;
        const teamElo = eloMap[team.id] || 1500;
        
        // Récupérer les matchs à venir de cette équipe
        const upcomingMatches = futureMatches.filter(m => 
            m.homeTeamId == team.id || m.awayTeamId == team.id
        );
        
        // Calculer les points attendus pour chaque match
        let expectedPointsFromFuture = 0;
        const matchDetails = [];
        
        upcomingMatches.forEach(match => {
            const isHome = match.homeTeamId == team.id;
            const opponentId = isHome ? match.awayTeamId : match.homeTeamId;
            const opponent = allTeams.find(t => t.id == opponentId);
            const opponentElo = eloMap[opponentId] || 1500;
            
            // Calcul de la probabilité avec avantage domicile
            const homeAdvantage = 65; // Points Elo d'avantage domicile
            const teamAdjustedElo = isHome ? teamElo + homeAdvantage : teamElo;
            const opponentAdjustedElo = isHome ? opponentElo : opponentElo + homeAdvantage;
            
            // Probabilité de victoire (formule Elo)
            const winExpectancy = 1 / (1 + Math.pow(10, (opponentAdjustedElo - teamAdjustedElo) / 400));
            
            // Distribution victoire/nul/défaite
            // Plus l'écart Elo est faible, plus il y a de chances de nul
            const eloDiff = Math.abs(teamAdjustedElo - opponentAdjustedElo);
            const drawProb = Math.max(0.15, 0.30 - (eloDiff / 1000)); // Entre 15% et 30%
            
            const winProb = winExpectancy * (1 - drawProb);
            const lossProb = (1 - winExpectancy) * (1 - drawProb);
            
            // Points attendus pour ce match
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
        
        // Points max et min possibles
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
    
    // Trier par points projetés pour déterminer les objectifs
    const sortedByProjection = [...projections].sort((a, b) => b.projectedPoints - a.projectedPoints);
    
    // Positions clés
    const relegationPosition = totalTeams - config.relegationPlaces;
    
    // Objectifs (points projetés aux positions clés)
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
    
    // Tableau des équipes (trié par classement actuel)
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
        
        // Calculer l'écart avec les objectifs
        const titleDiff = team.projectedPoints - titleTarget;
        const europeDiff = team.projectedPoints - europeTarget;
        const safeDiff = team.projectedPoints - safeTarget;
        
        // Déterminer les statuts
        const titleStatus = getObjectiveStatus(team, titleTarget, titleDiff, 'title');
        const europeStatus = getObjectiveStatus(team, europeTarget, europeDiff, 'europe');
        const safeStatus = getObjectiveStatus(team, safeTarget, safeDiff, 'safe');
        
        // Classe de ligne
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
    
    // Modal pour les détails des matchs (caché par défaut)
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
    // Mathématiquement assuré
    if (team.minPossiblePoints >= target) {
        if (type === 'safe') {
            return { class: 'achieved', text: '✅ Maintenu' };
        }
        return { class: 'achieved', text: '✅ Assuré' };
    }
    
    // Mathématiquement impossible
    if (team.maxPossiblePoints < target) {
        if (type === 'safe') {
            return { class: 'relegated', text: '⬇️ Relégué' };
        }
        return { class: 'impossible', text: '❌ Impossible' };
    }
    
    // En bonne voie ou en retard
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

// Afficher les détails des matchs à venir d'une équipe
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

// Projection basée sur l'Elo
function calculateEloBasedProjections(projections) {
    const eloMap = {};
    teamsWithElo.forEach(t => eloMap[t.id] = t.eloRating || 1500);
    
    return projections.map(team => {
        const teamElo = eloMap[team.id] || 1500;
        
        // Récupérer les matchs à venir de cette équipe
        const upcomingMatches = futureMatches.filter(m => 
            m.homeTeamId == team.id || m.awayTeamId == team.id
        );
        
        // Calculer les points attendus basés sur l'Elo
        let expectedPoints = team.currentPoints;
        
        upcomingMatches.forEach(match => {
            const isHome = match.homeTeamId == team.id;
            const opponentId = isHome ? match.awayTeamId : match.homeTeamId;
            const opponentElo = eloMap[opponentId] || 1500;
            
            // Avantage domicile
            const homeAdvantage = 50;
            const adjustedTeamElo = isHome ? teamElo + homeAdvantage : teamElo;
            const adjustedOpponentElo = isHome ? opponentElo : opponentElo + homeAdvantage;
            
            // Probabilité de victoire
            const expectedWin = 1 / (1 + Math.pow(10, (adjustedOpponentElo - adjustedTeamElo) / 400));
            
            // Points attendus (approximation: 3 × P(win) + 1 × P(draw) + 0 × P(loss))
            // P(draw) ≈ 0.25 (approximation standard)
            const drawProb = 0.25;
            const winProb = expectedWin * (1 - drawProb);
            const lossProb = (1 - expectedWin) * (1 - drawProb);
            
            const matchExpectedPoints = (winProb * 3) + (drawProb * 1) + (lossProb * 0);
            expectedPoints += matchExpectedPoints;
        });
        
        return {
            ...team,
            projectedPoints: Math.round(expectedPoints)
        };
    });
}

// Fonctions de statut
function getTitleStatus(team, target, position, championPlaces) {
    const diff = team.projectedPoints - target;
    
    if (team.minPossiblePoints >= target) {
        return { class: 'achieved', text: '✅ Assuré' };
    }
    if (team.maxPossiblePoints < target) {
        return { class: 'impossible', text: '❌ Impossible' };
    }
    if (diff >= 0) {
        return { class: 'on-track', text: `+${diff} pts` };
    }
    return { class: 'behind', text: `${diff} pts` };
}

function getEuropeStatus(team, target, position, europePlaces) {
    const diff = team.projectedPoints - target;
    
    if (team.minPossiblePoints >= target) {
        return { class: 'achieved', text: '✅ Assuré' };
    }
    if (team.maxPossiblePoints < target) {
        return { class: 'impossible', text: '❌ Impossible' };
    }
    if (diff >= 0) {
        return { class: 'on-track', text: `+${diff} pts` };
    }
    return { class: 'behind', text: `${diff} pts` };
}

function getSafeStatus(team, target, position, relegationPosition, totalTeams, relegationPlaces) {
    const diff = team.projectedPoints - target;
    
    if (team.minPossiblePoints >= target) {
        return { class: 'achieved', text: '✅ Maintenu' };
    }
    if (team.maxPossiblePoints < target) {
        return { class: 'relegated', text: '⬇️ Relégué' };
    }
    if (diff >= 0) {
        return { class: 'on-track', text: `+${diff} pts` };
    }
    return { class: 'behind', text: `${diff} pts` };
}

function calculateObjectiveStatus(points, maxPossible, targetPoints, position, targetPosition, remaining, type) {
    // Déjà à la position cible ou mieux
    if (position <= targetPosition) {
        // Vérifier si c'est mathématiquement assuré
        // (même si tous les autres gagnent, on reste devant)
        const worstCase = points; // On ne gagne plus rien
        const othersMaxPoints = targetPoints + (remaining * 3);
        
        if (worstCase > othersMaxPoints) {
            return { class: 'achieved', text: '✅ Assuré' };
        }
        return { class: 'possible', text: `${targetPoints - points} pts d'avance` };
    }
    
    // Peut-on encore atteindre l'objectif ?
    if (maxPossible >= targetPoints) {
        const needed = targetPoints - points + 1;
        return { class: 'possible', text: `${needed} pts requis` };
    }
    
    return { class: 'impossible', text: '❌ Impossible' };
}

function calculateSafetyStatus(points, maxPossible, safePoints, position, safePosition, remaining, ranking) {
    // Au-dessus de la zone de relégation
    if (position <= safePosition) {
        // Vérifier si mathématiquement sauvé
        const relegatedTeamMaxPoints = ranking[safePosition]?.points + (remaining * 3) || 0;
        
        if (points > relegatedTeamMaxPoints) {
            return { class: 'achieved', text: '✅ Maintenu' };
        }
        return { class: 'possible', text: `${points - safePoints} pts d'avance` };
    }
    
    // En zone de relégation
    const pointsNeeded = safePoints - points + 1;
    
    if (maxPossible >= safePoints) {
        return { class: 'possible', text: `${pointsNeeded} pts requis` };
    }
    
    return { class: 'relegated', text: '⬇️ Relégué' };
}

function getSeasonConfig() {
    try {
        const stored = localStorage.getItem('footballEloSeasonConfig');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {}
    
    // Config par défaut
    return {
        championPlaces: 1,
        europeanPlaces: 4,
        relegationPlaces: 3
    };
}

// ===============================
// ONGLET SIMULATION
// ===============================

let simulatedResults = {};

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
    const simulatedRanking = calculateSimulatedRanking();
    let rankingHtml = generateSimulatedRankingTable(simulatedRanking);
    
    container.innerHTML = `
        <div class="simulation-matches">${matchesHtml}</div>
        <div class="simulation-ranking">
            <h4>📊 Classement simulé</h4>
            ${rankingHtml}
        </div>
    `;
    
    // Ajouter les événements aux inputs
    document.querySelectorAll('.simulation-match input').forEach(input => {
        input.addEventListener('change', onSimulationInputChange);
    });
}

function createSimulationMatchRow(match) {
    const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
    
    const homeScore = simulatedResults[match.id]?.home ?? '';
    const awayScore = simulatedResults[match.id]?.away ?? '';
    
    return `
        <div class="simulation-match" data-match-id="${match.id}">
            <span class="team-home">${homeTeam ? homeTeam.shortName : '?'}</span>
            <input type="number" min="0" max="20" class="score-home" value="${homeScore}" data-match-id="${match.id}" data-type="home">
            <span class="vs">-</span>
            <input type="number" min="0" max="20" class="score-away" value="${awayScore}" data-match-id="${match.id}" data-type="away">
            <span class="team-away">${awayTeam ? awayTeam.shortName : '?'}</span>
        </div>
    `;
}

function onSimulationInputChange(event) {
    const matchId = event.target.dataset.matchId;
    const type = event.target.dataset.type;
    const value = parseInt(event.target.value) || 0;
    
    if (!simulatedResults[matchId]) {
        simulatedResults[matchId] = { home: null, away: null };
    }
    
    simulatedResults[matchId][type] = value;
    
    // Mettre à jour le classement
    updateSimulatedRanking();
}

// Calculer le classement simulé à partir des stats
function calculateSimulatedRanking(simulatedStats) {
    const ranking = allTeams.map(team => {
        const stats = simulatedStats[team.id] || { points: 0, goalsFor: 0, goalsAgainst: 0 };
        return {
            id: team.id,
            shortName: team.shortName,
            points: stats.points,
            goalDifference: stats.goalsFor - stats.goalsAgainst,
            goalsFor: stats.goalsFor,
            played: stats.played
        };
    });
    
    // Trier par points, puis différence de buts, puis buts marqués
    ranking.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });
    
    // Ajouter le rang
    ranking.forEach((team, index) => {
        team.rank = index + 1;
    });
    
    return ranking;
}

function calculateSimulatedRanking() {
    // Partir du classement actuel
    const baseRanking = generateRanking(null, currentSeason, null, false, 'all');
    
    // Ajouter les résultats simulés
    futureMatches.forEach(match => {
        const result = simulatedResults[match.id];
        if (result && result.home !== null && result.away !== null) {
            const homeTeam = baseRanking.find(t => t.id == match.homeTeamId);
            const awayTeam = baseRanking.find(t => t.id == match.awayTeamId);
            
            if (homeTeam && awayTeam) {
                homeTeam.played++;
                awayTeam.played++;
                homeTeam.goalsFor += result.home;
                homeTeam.goalsAgainst += result.away;
                awayTeam.goalsFor += result.away;
                awayTeam.goalsAgainst += result.home;
                
                if (result.home > result.away) {
                    homeTeam.won++;
                    homeTeam.points += 3;
                    awayTeam.lost++;
                } else if (result.home < result.away) {
                    awayTeam.won++;
                    awayTeam.points += 3;
                    homeTeam.lost++;
                } else {
                    homeTeam.drawn++;
                    awayTeam.drawn++;
                    homeTeam.points += 1;
                    awayTeam.points += 1;
                }
                
                homeTeam.goalDifference = homeTeam.goalsFor - homeTeam.goalsAgainst;
                awayTeam.goalDifference = awayTeam.goalsFor - awayTeam.goalsAgainst;
            }
        }
    });
    
    // Trier
    baseRanking.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });
    
    return baseRanking.filter(t => allTeams.some(at => at.id === t.id));
}

function generateSimulatedRankingTable(ranking) {
    const config = getSeasonConfig();
    const totalTeams = ranking.length;
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Pos</th>
                    <th>Équipe</th>
                    <th>Pts</th>
                    <th>Diff</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    ranking.forEach((team, index) => {
        const position = index + 1;
        let rowClass = '';
        
        if (position <= config.championPlaces) {
            rowClass = 'champion';
        } else if (position <= config.europeanPlaces) {
            rowClass = 'european';
        } else if (position > totalTeams - config.relegationPlaces) {
            rowClass = 'relegation';
        }
        
        html += `
            <tr class="${rowClass}">
                <td>${position}</td>
                <td>${team.shortName}</td>
                <td><strong>${team.points}</strong></td>
                <td>${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    return html;
}

function updateSimulatedRanking() {
    const ranking = calculateSimulatedRanking();
    const container = document.querySelector('.simulation-ranking');
    if (container) {
        container.innerHTML = `
            <h4>📊 Classement simulé</h4>
            ${generateSimulatedRankingTable(ranking)}
        `;
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

function simulateRandom() {
    futureMatches.forEach(match => {
        simulatedResults[match.id] = {
            home: Math.floor(Math.random() * 5),
            away: Math.floor(Math.random() * 5)
        };
    });
    displaySimulation();
}

function simulateWithElo() {
    futureMatches.forEach(match => {
        const homeTeam = teamsWithElo.find(t => t.id == match.homeTeamId);
        const awayTeam = teamsWithElo.find(t => t.id == match.awayTeamId);
        
        const homeElo = homeTeam?.eloRating || 1500;
        const awayElo = awayTeam?.eloRating || 1500;
        
        // Avantage domicile
        const homeAdvantage = 50;
        const adjustedHomeElo = homeElo + homeAdvantage;
        
        // Probabilité de victoire domicile
        const expectedHome = 1 / (1 + Math.pow(10, (awayElo - adjustedHomeElo) / 400));
        
        // Simuler le résultat
        const rand = Math.random();
        let homeScore, awayScore;
        
        if (rand < expectedHome * 0.7) {
            // Victoire domicile
            homeScore = Math.floor(Math.random() * 3) + 1;
            awayScore = Math.floor(Math.random() * homeScore);
        } else if (rand < expectedHome * 0.7 + (1 - expectedHome) * 0.7) {
            // Victoire extérieur
            awayScore = Math.floor(Math.random() * 3) + 1;
            homeScore = Math.floor(Math.random() * awayScore);
        } else {
            // Match nul
            homeScore = Math.floor(Math.random() * 3);
            awayScore = homeScore;
        }
        
        simulatedResults[match.id] = { home: homeScore, away: awayScore };
    });
    
    displaySimulation();
}

function resetSimulation() {
    simulatedResults = {};
    displaySimulation();
}

// ===============================
// MODE CRÉATION MANUELLE
// ===============================

function setupManualMode() {
    document.getElementById('manualModeBtn')?.addEventListener('click', openManualMode);
    document.getElementById('closeManualMode')?.addEventListener('click', closeManualMode);
    document.getElementById('manualMatchDay')?.addEventListener('change', onManualMatchDayChange);
    document.getElementById('saveManualMatches')?.addEventListener('click', saveManualMatches);
    document.getElementById('clearManualMatches')?.addEventListener('click', clearManualMatches);
}

function openManualMode() {
    manualModeActive = true;
    document.getElementById('manualCreationSection').style.display = 'block';
    
    // Trouver la prochaine journée à créer
    const lastPlayedMatchDay = Math.max(...allMatches.map(m => m.matchDay || 0), 0);
    const lastFutureMatchDay = futureMatches.length > 0 
        ? Math.max(...futureMatches.map(m => m.matchDay || 0), 0) 
        : lastPlayedMatchDay;
    
    manualMatchDay = Math.max(lastPlayedMatchDay, lastFutureMatchDay) + 1;
    
    // Peupler le sélecteur de journées
    populateManualMatchDaySelector();
    
    // Initialiser
    selectedHomeTeam = null;
    createdManualMatches = [];
    
    // Afficher les équipes
    renderAvailableTeams();
    renderCreatedMatches();
    updateMatchCounter();
}

function closeManualMode() {
    manualModeActive = false;
    document.getElementById('manualCreationSection').style.display = 'none';
    selectedHomeTeam = null;
    createdManualMatches = [];
    updateCalendarStatus();
    populateFilters();
    displayActiveTab();
}

function populateManualMatchDaySelector() {
    const select = document.getElementById('manualMatchDay');
    if (!select) return;
    
    const numTeams = allTeams.length;
    const totalMatchDays = (numTeams - 1) * 2;
    
    // Trouver les journées qui ont déjà des matchs (joués ou à venir)
    const existingMatchDays = new Set([
        ...allMatches.map(m => m.matchDay),
        ...futureMatches.map(m => m.matchDay)
    ]);
    
    let options = '';
    for (let day = 1; day <= totalMatchDays + 5; day++) {
        const hasMatches = existingMatchDays.has(day);
        const label = hasMatches ? `Journée ${day} (existante)` : `Journée ${day}`;
        const selected = day === manualMatchDay ? 'selected' : '';
        options += `<option value="${day}" ${selected}>${label}</option>`;
    }
    
    select.innerHTML = options;
}

function onManualMatchDayChange(event) {
    manualMatchDay = parseInt(event.target.value);
    
    // Charger les matchs existants pour cette journée
    createdManualMatches = futureMatches
        .filter(m => m.matchDay === manualMatchDay)
        .map(m => ({
            id: m.id,
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId
        }));
    
    selectedHomeTeam = null;
    renderAvailableTeams();
    renderCreatedMatches();
    updateMatchCounter();
}

function renderAvailableTeams() {
    const container = document.getElementById('availableTeams');
    if (!container) return;
    
    // Trouver les équipes déjà utilisées dans cette journée
    const usedTeamIds = new Set();
    createdManualMatches.forEach(match => {
        usedTeamIds.add(match.homeTeamId);
        usedTeamIds.add(match.awayTeamId);
    });
    
    // Vérifier aussi les matchs déjà joués cette journée
    allMatches.filter(m => m.matchDay === manualMatchDay).forEach(match => {
        usedTeamIds.add(match.homeTeamId);
        usedTeamIds.add(match.awayTeamId);
    });
    
    // Créer un set des confrontations déjà existantes (joués + à venir)
    // Format: "homeId-awayId"
    const existingConfrontations = new Set();
    allMatches.forEach(match => {
        existingConfrontations.add(`${match.homeTeamId}-${match.awayTeamId}`);
    });
    futureMatches.forEach(match => {
        existingConfrontations.add(`${match.homeTeamId}-${match.awayTeamId}`);
    });
    // Ajouter aussi les matchs créés manuellement (pas encore sauvegardés)
    createdManualMatches.forEach(match => {
        existingConfrontations.add(`${match.homeTeamId}-${match.awayTeamId}`);
    });
    
    // Générer les boutons
    container.innerHTML = allTeams.map(team => {
        const isUsed = usedTeamIds.has(team.id);
        const isSelected = selectedHomeTeam && selectedHomeTeam.id === team.id;
        
        // Vérifier si cette confrontation existe déjà (quand une équipe domicile est sélectionnée)
        let isAlreadyPlayed = false;
        if (selectedHomeTeam && !isSelected) {
            const confrontationKey = `${selectedHomeTeam.id}-${team.id}`;
            isAlreadyPlayed = existingConfrontations.has(confrontationKey);
        }
        
        const isDisabled = isUsed || isAlreadyPlayed;
        
        let className = 'team-btn';
        if (isDisabled) className += ' disabled';
        if (isSelected) className += ' selected home';
        if (isAlreadyPlayed) className += ' already-played';
        
        // Titre pour expliquer pourquoi c'est désactivé
        let title = '';
        if (isUsed) {
            title = 'Équipe déjà assignée à cette journée';
        } else if (isAlreadyPlayed) {
            title = `${selectedHomeTeam.shortName} a déjà reçu ${team.shortName} cette saison`;
        }
        
        return `
            <button class="${className}" 
                    data-team-id="${team.id}" 
                    ${isDisabled ? 'disabled' : ''}
                    ${title ? `title="${title}"` : ''}
                    onclick="onTeamClick(${team.id})">
                <span class="team-icon">${isSelected ? '🏠' : isAlreadyPlayed ? '🚫' : '⚽'}</span>
                ${team.shortName}
            </button>
        `;
    }).join('');
    
    // Mettre à jour l'indice
    const hint = document.getElementById('selectionHint');
    if (hint) {
        if (selectedHomeTeam) {
            hint.innerHTML = `<strong>${selectedHomeTeam.shortName}</strong> à domicile - Cliquez sur l'équipe <strong>extérieur</strong>`;
            hint.classList.add('away');
        } else {
            hint.innerHTML = `Cliquez sur l'équipe à <strong>domicile</strong>`;
            hint.classList.remove('away');
        }
    }
}

function onTeamClick(teamId) {
    const team = allTeams.find(t => t.id === teamId);
    if (!team) return;
    
    if (!selectedHomeTeam) {
        // Premier clic : sélectionner l'équipe domicile
        selectedHomeTeam = team;
    } else {
        // Deuxième clic : créer le match
        if (teamId === selectedHomeTeam.id) {
            // Clic sur la même équipe = désélectionner
            selectedHomeTeam = null;
        } else {
            // Créer le match
            createdManualMatches.push({
                id: Date.now(),
                homeTeamId: selectedHomeTeam.id,
                awayTeamId: teamId
            });
            selectedHomeTeam = null;
            renderCreatedMatches();
            updateMatchCounter();
        }
    }
    
    renderAvailableTeams();
}

function renderCreatedMatches() {
    const container = document.getElementById('createdMatchesList');
    if (!container) return;
    
    if (createdManualMatches.length === 0) {
        container.innerHTML = '<div class="empty-matches">Aucun match créé pour cette journée</div>';
        return;
    }
    
    container.innerHTML = createdManualMatches.map((match, index) => {
        const homeTeam = allTeams.find(t => t.id === match.homeTeamId);
        const awayTeam = allTeams.find(t => t.id === match.awayTeamId);
        
        return `
            <div class="created-match-item">
                <span class="match-number">#${index + 1}</span>
                <div class="match-teams">
                    <span class="home-team">🏠 ${homeTeam ? homeTeam.shortName : '?'}</span>
                    <span class="vs">vs</span>
                    <span class="away-team">✈️ ${awayTeam ? awayTeam.shortName : '?'}</span>
                </div>
                <button class="delete-match" onclick="deleteManualMatch(${index})">🗑️</button>
            </div>
        `;
    }).join('');
}

function deleteManualMatch(index) {
    createdManualMatches.splice(index, 1);
    renderAvailableTeams();
    renderCreatedMatches();
    updateMatchCounter();
}

function updateMatchCounter() {
    const counter = document.getElementById('matchCounter');
    const max = document.getElementById('maxMatches');
    
    if (counter) counter.textContent = createdManualMatches.length;
    if (max) max.textContent = Math.floor(allTeams.length / 2);
}

function saveManualMatches() {
    if (createdManualMatches.length === 0) {
        alert('Aucun match à sauvegarder !');
        return;
    }
    
    // Supprimer les anciens matchs de cette journée
    futureMatches = futureMatches.filter(m => m.matchDay !== manualMatchDay);
    
    // Ajouter les nouveaux matchs
    createdManualMatches.forEach(match => {
        futureMatches.push({
            id: match.id,
            season: currentSeason,
            matchDay: manualMatchDay,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            status: 'upcoming'
        });
    });
    
    // Sauvegarder
    saveFutureMatches(currentSeason, futureMatches);
    
    // Mettre à jour l'affichage
    updateCalendarStatus();
    populateManualMatchDaySelector();
    
    alert(`✅ ${createdManualMatches.length} matchs sauvegardés pour la journée ${manualMatchDay} !`);
    
    // Passer à la journée suivante
    manualMatchDay++;
    document.getElementById('manualMatchDay').value = manualMatchDay;
    onManualMatchDayChange({ target: { value: manualMatchDay } });
}

function clearManualMatches() {
    if (createdManualMatches.length === 0) return;
    
    if (!confirm('Réinitialiser tous les matchs de cette journée ?')) return;
    
    // Supprimer aussi de futureMatches si déjà sauvegardés
    futureMatches = futureMatches.filter(m => m.matchDay !== manualMatchDay);
    saveFutureMatches(currentSeason, futureMatches);
    
    createdManualMatches = [];
    selectedHomeTeam = null;
    renderAvailableTeams();
    renderCreatedMatches();
    updateMatchCounter();
    updateCalendarStatus();
}

// ===============================
// ONGLET PRONOSTICS
// ===============================

function initPredictions() {
    // Trouver la prochaine journée à pronostiquer
    const lastPlayedMatchDay = Math.max(...allMatches.map(m => m.matchDay || 0), 0);
    const maxFutureMatchDay = futureMatches.length > 0 
        ? Math.max(...futureMatches.map(m => m.matchDay || 0)) 
        : lastPlayedMatchDay;
    
    // Vérifier si la dernière journée jouée est complète
    const matchesInLastDay = allMatches.filter(m => m.matchDay === lastPlayedMatchDay).length;
    const expectedMatchesPerDay = Math.floor(allTeams.length / 2);
    
    if (matchesInLastDay < expectedMatchesPerDay && lastPlayedMatchDay > 0) {
        // Journée en cours
        currentPredictionMatchDay = lastPlayedMatchDay;
    } else {
        // Prochaine journée
        currentPredictionMatchDay = lastPlayedMatchDay + 1;
    }
    
    // Vérifier qu'il y a des matchs à cette journée
    const matchesAtDay = futureMatches.filter(m => m.matchDay === currentPredictionMatchDay);
    if (matchesAtDay.length === 0 && currentPredictionMatchDay <= maxFutureMatchDay) {
        // Chercher la prochaine journée avec des matchs
        for (let day = currentPredictionMatchDay; day <= maxFutureMatchDay; day++) {
            if (futureMatches.filter(m => m.matchDay === day).length > 0) {
                currentPredictionMatchDay = day;
                break;
            }
        }
    }
    
    // Événements de navigation
    document.getElementById('prevMatchdayBtn')?.addEventListener('click', () => {
        navigatePredictionMatchDay(-1);
    });
    document.getElementById('nextMatchdayBtn')?.addEventListener('click', () => {
        navigatePredictionMatchDay(1);
    });
}

function displayPredictions() {
    const container = document.getElementById('predictionsContent');
    const title = document.getElementById('predictionsTitle');
    
    if (!container) return;
    
    // Initialiser si nécessaire
    if (currentPredictionMatchDay === null) {
        initPredictions();
    }
    
    // Mettre à jour le titre
    if (title) {
        title.textContent = `🎰 Pronostics - Journée ${currentPredictionMatchDay}`;
    }
    
    // Mettre à jour les boutons de navigation
    updatePredictionNavButtons();
    
    // Récupérer les matchs de cette journée
    let matches = futureMatches.filter(m => m.matchDay === currentPredictionMatchDay);
    
    // Si pas de matchs à venir, vérifier les matchs déjà joués
    const playedMatches = allMatches.filter(m => m.matchDay === currentPredictionMatchDay);
    
    if (matches.length === 0 && playedMatches.length === 0) {
        container.innerHTML = `
            <div class="predictions-end">
                <div class="icon">🏁</div>
                <h3>Pas de matchs pour cette journée</h3>
                <p>Utilisez les boutons de navigation pour voir d'autres journées.</p>
            </div>
        `;
        return;
    }
    
    // Si tous les matchs sont joués, afficher un message
    if (matches.length === 0 && playedMatches.length > 0) {
        container.innerHTML = `
            <div class="predictions-end">
                <div class="icon">✅</div>
                <h3>Journée ${currentPredictionMatchDay} terminée</h3>
                <p>Tous les matchs ont été joués. Naviguez vers une journée future pour voir les pronostics.</p>
            </div>
        `;
        return;
    }
    
    // Générer les pronostics pour chaque match
    const predictions = matches.map(match => generatePrediction(match));
    
    // Afficher les cartes
    container.innerHTML = predictions.map(pred => createPredictionCard(pred)).join('');
}

function updatePredictionNavButtons() {
    const prevBtn = document.getElementById('prevMatchdayBtn');
    const nextBtn = document.getElementById('nextMatchdayBtn');
    
    const maxMatchDay = Math.max(
        ...allMatches.map(m => m.matchDay || 0),
        ...futureMatches.map(m => m.matchDay || 0),
        0
    );
    
    if (prevBtn) {
        prevBtn.disabled = currentPredictionMatchDay <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPredictionMatchDay >= maxMatchDay;
    }
}

function generatePrediction(match) {
    const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
    
    // Récupérer les Elo
    const eloMap = {};
    teamsWithElo.forEach(t => eloMap[t.id] = t.eloRating || 1500);
    
    const homeElo = eloMap[match.homeTeamId] || 1500;
    const awayElo = eloMap[match.awayTeamId] || 1500;
    
    // Récupérer le classement actuel
    const ranking = generateRanking(null, currentSeason, null, false, 'all');
    const homeRank = ranking.findIndex(t => t.id == match.homeTeamId) + 1;
    const awayRank = ranking.findIndex(t => t.id == match.awayTeamId) + 1;
    const homeData = ranking.find(t => t.id == match.homeTeamId);
    const awayData = ranking.find(t => t.id == match.awayTeamId);
    
    // Configuration
    const config = getSeasonConfig();
    const totalTeams = allTeams.length;
    const relegationPosition = totalTeams - config.relegationPlaces;
    
    // Calculer les facteurs
    const factors = [];
    let homeBonus = 0;
    let awayBonus = 0;
    
    // 1. Avantage domicile (base)
    const homeAdvantage = 50;
    homeBonus += homeAdvantage;
    
    // 2. Forme récente (série en cours)
    const homeForm = getTeamRecentForm(match.homeTeamId);
    const awayForm = getTeamRecentForm(match.awayTeamId);

    if (homeForm.streak >= 3 && homeForm.type === 'W') {
        homeBonus += 30;
        factors.push({ text: `🔥 ${homeTeam.shortName}: ${homeForm.streak}V`, team: 'home', type: 'positive' });
    } else if (homeForm.streak >= 3 && homeForm.type === 'L') {
        homeBonus -= 20;
        factors.push({ text: `📉 ${homeTeam.shortName}: ${homeForm.streak}D`, team: 'home', type: 'negative' });
    }

    if (awayForm.streak >= 3 && awayForm.type === 'W') {
        awayBonus += 30;
        factors.push({ text: `🔥 ${awayTeam.shortName}: ${awayForm.streak}V`, team: 'away', type: 'positive' });
    } else if (awayForm.streak >= 3 && awayForm.type === 'L') {
        awayBonus -= 20;
        factors.push({ text: `📉 ${awayTeam.shortName}: ${awayForm.streak}D`, team: 'away', type: 'negative' });
    }

    
    // 3. Enjeux - Course au titre
    const homeInTitle = homeRank <= config.championPlaces + 2;
    const awayInTitle = awayRank <= config.championPlaces + 2;

    if (homeInTitle) {
        homeBonus += 25;
        factors.push({ text: `🏆 ${homeTeam.shortName}: Titre`, team: 'home', type: 'neutral' });
    }
    if (awayInTitle) {
        awayBonus += 25;
        factors.push({ text: `🏆 ${awayTeam.shortName}: Titre`, team: 'away', type: 'neutral' });
    }
    
    // 4. Enjeux - Course à l'Europe
    const homeInEurope = homeRank > config.championPlaces && homeRank <= config.europeanPlaces + 2;
    const awayInEurope = awayRank > config.championPlaces && awayRank <= config.europeanPlaces + 2;

    if (homeInEurope) {
        homeBonus += 15;
        factors.push({ text: `⭐ ${homeTeam.shortName}: Europe`, team: 'home', type: 'neutral' });
    }
    if (awayInEurope) {
        awayBonus += 15;
        factors.push({ text: `⭐ ${awayTeam.shortName}: Europe`, team: 'away', type: 'neutral' });
    }
    
    // 5. Enjeux - Lutte pour le maintien
    const homeInRelegation = homeRank > relegationPosition - 3;
    const awayInRelegation = awayRank > relegationPosition - 3;

    if (homeInRelegation) {
        homeBonus += 20;
        factors.push({ text: `🛡️ ${homeTeam.shortName}: Maintien`, team: 'home', type: 'neutral' });
    }
    if (awayInRelegation) {
        awayBonus += 20;
        factors.push({ text: `🛡️ ${awayTeam.shortName}: Maintien`, team: 'away', type: 'neutral' });
    }
        
    // 6. Adversaire direct
    const isDirectRival = Math.abs(homeRank - awayRank) <= 3;
    if (isDirectRival) {
        factors.push({ text: '⚔️ Duel direct', team: 'both', type: 'neutral' });
    }
    
    // Calculer les probabilités ajustées
    const adjustedHomeElo = homeElo + homeBonus;
    const adjustedAwayElo = awayElo + awayBonus;
    
    const homeExpectancy = 1 / (1 + Math.pow(10, (adjustedAwayElo - adjustedHomeElo) / 400));
    
    // Distribution avec match nul
    const eloDiff = Math.abs(adjustedHomeElo - adjustedAwayElo);
    let drawProb = Math.max(0.18, 0.32 - (eloDiff / 800));
    
    // Ajuster si duel direct (plus de chances de match nul)
    if (isDirectRival) {
        drawProb = Math.min(0.35, drawProb + 0.05);
    }
    
    let homeWinProb = homeExpectancy * (1 - drawProb);
    let awayWinProb = (1 - homeExpectancy) * (1 - drawProb);
    
    // 7. Part d'aléatoire (peut changer le résultat de ±5-10%)
    const randomFactor = (Math.random() - 0.5) * 0.1;
    homeWinProb = Math.max(0.05, Math.min(0.85, homeWinProb + randomFactor));
    awayWinProb = Math.max(0.05, Math.min(0.85, awayWinProb - randomFactor));
    
    // Normaliser
    const total = homeWinProb + drawProb + awayWinProb;
    homeWinProb = homeWinProb / total;
    drawProb = drawProb / total;
    awayWinProb = awayWinProb / total;
    
    // Générer le score prédit
    const predictedScore = generatePredictedScore(homeWinProb, drawProb, awayWinProb, adjustedHomeElo, adjustedAwayElo);
    
    // Déterminer le favori
    let favorite = 'draw';
    let favoriteProb = drawProb;
    if (homeWinProb > drawProb && homeWinProb > awayWinProb) {
        favorite = 'home';
        favoriteProb = homeWinProb;
    } else if (awayWinProb > drawProb && awayWinProb > homeWinProb) {
        favorite = 'away';
        favoriteProb = awayWinProb;
    }
    
    // Déterminer les enjeux du match
    const stakes = [];
    if (homeInTitle || awayInTitle) stakes.push('title');
    if (homeInEurope || awayInEurope) stakes.push('europe');
    if (homeInRelegation || awayInRelegation) stakes.push('relegation');
    if (isDirectRival) stakes.push('direct');
    if ((homeForm.streak >= 3) || (awayForm.streak >= 3)) stakes.push('streak');
    
    return {
        match,
        homeTeam,
        awayTeam,
        homeElo,
        awayElo,
        homeRank,
        awayRank,
        homeForm,
        awayForm,
        homeWinProb: Math.round(homeWinProb * 100),
        drawProb: Math.round(drawProb * 100),
        awayWinProb: Math.round(awayWinProb * 100),
        predictedScore,
        favorite,
        favoriteProb: Math.round(favoriteProb * 100),
        factors,
        stakes
    };
}

function getTeamRecentForm(teamId) {
    // Récupérer les 5 derniers matchs
    const teamMatches = allMatches
        .filter(m => m.homeTeamId == teamId || m.awayTeamId == teamId)
        .sort((a, b) => (b.matchDay || 0) - (a.matchDay || 0))
        .slice(0, 5);
    
    if (teamMatches.length === 0) {
        return { form: [], streak: 0, type: null };
    }
    
    const form = teamMatches.map(match => {
        const isHome = match.homeTeamId == teamId;
        const goalsFor = isHome ? match.finalScore.home : match.finalScore.away;
        const goalsAgainst = isHome ? match.finalScore.away : match.finalScore.home;
        
        if (goalsFor > goalsAgainst) return 'W';
        if (goalsFor < goalsAgainst) return 'L';
        return 'D';
    });
    
    // Calculer la série en cours
    let streak = 1;
    const currentType = form[0];
    for (let i = 1; i < form.length; i++) {
        if (form[i] === currentType) streak++;
        else break;
    }
    
    return { form, streak, type: currentType };
}

function generatePredictedScore(homeWinProb, drawProb, awayWinProb, homeElo, awayElo) {
    // Trier les résultats par probabilité
    const results = [
        { type: 'home', prob: homeWinProb },
        { type: 'draw', prob: drawProb },
        { type: 'away', prob: awayWinProb }
    ].sort((a, b) => b.prob - a.prob);
    
    const best = results[0];   // Favori
    const second = results[1]; // 2ème
    const third = results[2];  // Outsider
    
    // Calculer les écarts
    const gapFirstSecond = best.prob - second.prob;
    
    // Déterminer le résultat avec possibilité de surprise
    let result;
    const random = Math.random();
    
    // Chance pour l'outsider (3ème) - proportionnelle à sa probabilité
    // Minimum 3%, maximum basé sur sa vraie probabilité
    const thirdChance = Math.max(0.03, third.prob * 0.3);
    
    if (random < thirdChance && third.prob >= 0.10) {
        // Grosse surprise ! L'outsider gagne
        result = third.type;
    } else if (gapFirstSecond > 0.15) {
        // Écart > 15% → toujours le favori
        result = best.type;
    } else if (gapFirstSecond > 0.10) {
        // Écart 10-15% → 10% de chance pour le 2ème
        result = Math.random() < 0.10 ? second.type : best.type;
    } else if (gapFirstSecond > 0.05) {
        // Écart 5-10% → 20% de chance pour le 2ème
        result = Math.random() < 0.20 ? second.type : best.type;
    } else {
        // Écart < 5% → 35% de chance pour le 2ème (match très serré)
        result = Math.random() < 0.35 ? second.type : best.type;
    }
    
    // Générer un score réaliste basé sur le résultat
    let homeGoals, awayGoals;
    
    // Estimer la force offensive basée sur l'Elo
    const avgElo = 1500;
    const homeOffense = 1.3 + (homeElo - avgElo) / 500;
    const awayOffense = 1.0 + (awayElo - avgElo) / 500;
    
    if (result === 'home') {
        // Victoire domicile
        const dominance = homeWinProb - awayWinProb;
        let scoreDiff;
        if (dominance > 0.4) {
            scoreDiff = 3;
        } else if (dominance > 0.25) {
            scoreDiff = 2;
        } else {
            scoreDiff = 1;
        }
        
        homeGoals = Math.max(1, Math.round(homeOffense));
        awayGoals = Math.max(0, homeGoals - scoreDiff);
    } else if (result === 'away') {
        // Victoire extérieur
        const dominance = awayWinProb - homeWinProb;
        let scoreDiff;
        if (dominance > 0.4) {
            scoreDiff = 3;
        } else if (dominance > 0.25) {
            scoreDiff = 2;
        } else {
            scoreDiff = 1;
        }
        
        awayGoals = Math.max(1, Math.round(awayOffense));
        homeGoals = Math.max(0, awayGoals - scoreDiff);
    } else {
        // Match nul
        const avgOffense = (homeOffense + awayOffense) / 2;
        if (avgOffense < 1.1) {
            homeGoals = 0;
            awayGoals = 0;
        } else if (avgOffense < 1.4) {
            homeGoals = 1;
            awayGoals = 1;
        } else {
            homeGoals = 2;
            awayGoals = 2;
        }
    }
    
    return { home: homeGoals, away: awayGoals };
}

function createPredictionCard(pred) {
    // Badges d'enjeux
    const stakeBadges = pred.stakes.map(stake => {
        const labels = {
            'title': '🏆 Titre',
            'europe': '⭐ Europe',
            'relegation': '🛡️ Maintien',
            'direct': '⚔️ Duel direct',
            'streak': '🔥 Série'
        };
        return `<span class="stake-badge ${stake}">${labels[stake]}</span>`;
    }).join('');
    
    // Forme récente
    const homeFormDots = pred.homeForm.form.map(f => `<span class="form-dot ${f}"></span>`).join('');
    const awayFormDots = pred.awayForm.form.map(f => `<span class="form-dot ${f}"></span>`).join('');
    
    // Facteurs
    const factorTags = pred.factors.map(f => {
        let tagClass = f.type;
        return `<span class="factor-tag ${tagClass}">${f.text}</span>`;
    }).join('');
    
    // Texte du favori
    let favoriteText = '';
    let favoriteClass = '';
    if (pred.favorite === 'home') {
        favoriteText = `🏠 ${pred.homeTeam.shortName} (${pred.favoriteProb}%)`;
        favoriteClass = 'home';
    } else if (pred.favorite === 'away') {
        favoriteText = `✈️ ${pred.awayTeam.shortName} (${pred.favoriteProb}%)`;
        favoriteClass = 'away';
    } else {
        favoriteText = `🤝 Match nul (${pred.favoriteProb}%)`;
        favoriteClass = 'draw';
    }
    
    return `
        <div class="prediction-card">
            <div class="prediction-card-header">
                <span class="match-info">Match ${pred.homeRank}e vs ${pred.awayRank}e</span>
                <div class="match-stakes">${stakeBadges}</div>
            </div>
            <div class="prediction-card-body">
                <div class="prediction-teams">
                    <div class="prediction-team home">
                        <div class="team-name-pred">${pred.homeTeam.shortName}</div>
                        <div class="team-details">
                            <span class="team-elo">Elo: ${pred.homeElo}</span>
                            <span class="team-form">${homeFormDots}</span>
                            <span class="team-location">🏠 Domicile</span>
                        </div>
                    </div>
                    <div class="prediction-score">
                        <div class="score-display">${pred.predictedScore.home} - ${pred.predictedScore.away}</div>
                        <div class="score-label">Pronostic</div>
                    </div>
                    <div class="prediction-team away">
                        <div class="team-name-pred">${pred.awayTeam.shortName}</div>
                        <div class="team-details">
                            <span class="team-elo">Elo: ${pred.awayElo}</span>
                            <span class="team-form">${awayFormDots}</span>
                            <span class="team-location">✈️ Extérieur</span>
                        </div>
                    </div>
                </div>
                
                <div class="prediction-probabilities">
                    <div class="prob-bar-container">
                        <div class="prob-segment home-win" style="flex: ${pred.homeWinProb}">${pred.homeWinProb}%</div>
                        <div class="prob-segment draw" style="flex: ${pred.drawProb}">${pred.drawProb}%</div>
                        <div class="prob-segment away-win" style="flex: ${pred.awayWinProb}">${pred.awayWinProb}%</div>
                    </div>
                    <div class="prob-labels">
                        <span>Victoire ${pred.homeTeam.shortName}</span>
                        <span>Nul</span>
                        <span>Victoire ${pred.awayTeam.shortName}</span>
                    </div>
                </div>
                
                <div class="prediction-favorite">
                    <div class="favorite-label">⭐ Favori</div>
                    <div class="favorite-team ${favoriteClass}">${favoriteText}</div>
                </div>
                
                <div class="prediction-factors">
                    ${factorTags}
                </div>
            </div>
        </div>
    `;
}

function initPredictions() {
    // Charger les pronostics stockés
    loadStoredPredictions();
    
    // Trouver la prochaine journée à afficher
    const lastPlayedMatchDay = Math.max(...allMatches.map(m => m.matchDay || 0), 0);
    const maxFutureMatchDay = futureMatches.length > 0 
        ? Math.max(...futureMatches.map(m => m.matchDay || 0)) 
        : lastPlayedMatchDay;
    
    // Vérifier si la dernière journée jouée est complète
    const matchesInLastDay = allMatches.filter(m => m.matchDay === lastPlayedMatchDay).length;
    const expectedMatchesPerDay = Math.floor(allTeams.length / 2);
    
    if (matchesInLastDay < expectedMatchesPerDay && lastPlayedMatchDay > 0) {
        currentPredictionMatchDay = lastPlayedMatchDay;
    } else {
        currentPredictionMatchDay = lastPlayedMatchDay + 1;
    }
    
    // Vérifier qu'il y a des matchs à cette journée
    const matchesAtDay = futureMatches.filter(m => m.matchDay === currentPredictionMatchDay);
    if (matchesAtDay.length === 0 && currentPredictionMatchDay <= maxFutureMatchDay) {
        for (let day = currentPredictionMatchDay; day <= maxFutureMatchDay; day++) {
            if (futureMatches.filter(m => m.matchDay === day).length > 0) {
                currentPredictionMatchDay = day;
                break;
            }
        }
    }
    
    // Événements de navigation
    document.getElementById('prevMatchdayBtn')?.addEventListener('click', () => {
        navigatePredictionMatchDay(-1);
    });
    document.getElementById('nextMatchdayBtn')?.addEventListener('click', () => {
        navigatePredictionMatchDay(1);
    });
    
    // Événements des boutons
    document.getElementById('generateAllPredictionsBtn')?.addEventListener('click', generateAllPredictions);
    document.getElementById('recalculatePredictionsBtn')?.addEventListener('click', recalculatePredictions);
}

function loadStoredPredictions() {
    try {
        const stored = localStorage.getItem(`footballEloPredictions_${currentSeason}`);
        storedPredictions = stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.error('Erreur chargement pronostics:', e);
        storedPredictions = null;
    }
}

function saveStoredPredictions() {
    try {
        localStorage.setItem(`footballEloPredictions_${currentSeason}`, JSON.stringify(storedPredictions));
    } catch (e) {
        console.error('Erreur sauvegarde pronostics:', e);
    }
}

function navigatePredictionMatchDay(direction) {
    const maxMatchDay = Math.max(
        ...allMatches.map(m => m.matchDay || 0),
        ...futureMatches.map(m => m.matchDay || 0)
    );
    
    const newDay = currentPredictionMatchDay + direction;
    
    if (newDay >= 1 && newDay <= maxMatchDay) {
        currentPredictionMatchDay = newDay;
        displayPredictions();
    }
}

// Générer tous les pronostics pour la saison
function generateAllPredictions() {
    const lastPlayedMatchDay = Math.max(...allMatches.map(m => m.matchDay || 0), 0);
    const maxFutureMatchDay = futureMatches.length > 0 
        ? Math.max(...futureMatches.map(m => m.matchDay || 0)) 
        : lastPlayedMatchDay;
    
    if (futureMatches.length === 0) {
        alert('Aucun match à venir. Générez d\'abord le calendrier.');
        return;
    }
    
    // Initialiser l'Elo simulé avec l'Elo actuel (basé sur les matchs réels)
    let simulatedElo = {};
    teamsWithElo.forEach(t => {
        simulatedElo[t.id] = t.eloRating || 1500;
    });
    
    // Initialiser les stats simulées (basées sur le classement actuel)
    const currentRanking = generateRanking(null, currentSeason, null, false, 'all');
    let simulatedStats = {};
    allTeams.forEach(team => {
        const teamData = currentRanking.find(t => t.id == team.id);
        simulatedStats[team.id] = {
            played: teamData ? teamData.played : 0,
            won: teamData ? teamData.won : 0,
            drawn: teamData ? teamData.drawn : 0,
            lost: teamData ? teamData.lost : 0,
            goalsFor: teamData ? teamData.goalsFor : 0,
            goalsAgainst: teamData ? teamData.goalsAgainst : 0,
            points: teamData ? teamData.points : 0
        };
    });
    
    // Créer la structure de stockage
    storedPredictions = {
        generatedAt: new Date().toISOString(),
        season: currentSeason,
        matchDays: {}
    };
    
    // Parcourir chaque journée
    for (let day = lastPlayedMatchDay + 1; day <= maxFutureMatchDay; day++) {
        const matchesThisDay = futureMatches.filter(m => m.matchDay === day);
        
        if (matchesThisDay.length === 0) continue;
        
        // Vérifier si des matchs de cette journée sont déjà joués
        const playedMatchesThisDay = allMatches.filter(m => m.matchDay === day);
        
        // Calculer le classement simulé actuel
        const simulatedRanking = calculateSimulatedRanking(simulatedStats);
        
        const dayPredictions = {
            matches: [],
            simulatedEloAfter: {},
            simulatedRankingBefore: simulatedRanking.map(t => ({ id: t.id, rank: t.rank }))
        };
        
        matchesThisDay.forEach(match => {
            // Vérifier si ce match a été joué
            const playedMatch = playedMatchesThisDay.find(m => 
                m.homeTeamId == match.homeTeamId && m.awayTeamId == match.awayTeamId
            );
            
            // Récupérer les positions au classement simulé
            const homeRankData = simulatedRanking.find(t => t.id == match.homeTeamId);
            const awayRankData = simulatedRanking.find(t => t.id == match.awayTeamId);
            const homeRank = homeRankData ? homeRankData.rank : 0;
            const awayRank = awayRankData ? awayRankData.rank : 0;
            
            // Générer le pronostic avec l'Elo simulé et le classement simulé
            const prediction = generateSinglePredictionWithSimulated(match, simulatedElo, homeRank, awayRank, simulatedStats);
            
            // Ajouter le résultat réel si disponible
            if (playedMatch && playedMatch.finalScore) {
                prediction.actualScore = {
                    home: playedMatch.finalScore.home,
                    away: playedMatch.finalScore.away
                };
            }
            
            dayPredictions.matches.push(prediction);
        });
        
        // Mettre à jour l'Elo et les stats simulés pour la journée suivante
        dayPredictions.matches.forEach(pred => {
            // Utiliser le résultat réel si disponible, sinon le pronostic
            const homeScore = pred.actualScore ? pred.actualScore.home : pred.predictedScore.home;
            const awayScore = pred.actualScore ? pred.actualScore.away : pred.predictedScore.away;
            
            // Mettre à jour l'Elo
            const eloChange = calculateEloChange(
                simulatedElo[pred.homeTeamId],
                simulatedElo[pred.awayTeamId],
                homeScore,
                awayScore
            );
            
            simulatedElo[pred.homeTeamId] += eloChange.home;
            simulatedElo[pred.awayTeamId] += eloChange.away;
            
            // Mettre à jour les stats simulées
            simulatedStats[pred.homeTeamId].played++;
            simulatedStats[pred.awayTeamId].played++;
            simulatedStats[pred.homeTeamId].goalsFor += homeScore;
            simulatedStats[pred.homeTeamId].goalsAgainst += awayScore;
            simulatedStats[pred.awayTeamId].goalsFor += awayScore;
            simulatedStats[pred.awayTeamId].goalsAgainst += homeScore;
            
            if (homeScore > awayScore) {
                simulatedStats[pred.homeTeamId].won++;
                simulatedStats[pred.homeTeamId].points += 3;
                simulatedStats[pred.awayTeamId].lost++;
            } else if (homeScore < awayScore) {
                simulatedStats[pred.awayTeamId].won++;
                simulatedStats[pred.awayTeamId].points += 3;
                simulatedStats[pred.homeTeamId].lost++;
            } else {
                simulatedStats[pred.homeTeamId].drawn++;
                simulatedStats[pred.awayTeamId].drawn++;
                simulatedStats[pred.homeTeamId].points += 1;
                simulatedStats[pred.awayTeamId].points += 1;
            }
        });
        
        // Stocker l'Elo simulé après cette journée
        dayPredictions.simulatedEloAfter = { ...simulatedElo };
        
        storedPredictions.matchDays[day] = dayPredictions;
    }
    
    // Sauvegarder
    saveStoredPredictions();
    
    // Afficher
    displayPredictions();
    
    const numDays = Object.keys(storedPredictions.matchDays).length;
    const numMatches = Object.values(storedPredictions.matchDays).reduce((sum, day) => sum + day.matches.length, 0);
    
    alert(`✅ Pronostics générés !\n\n📊 ${numMatches} matchs sur ${numDays} journées\n\nLes pronostics prennent en compte l'évolution de l'Elo ET du classement simulé après chaque journée.`);
}

// Recalculer les pronostics (efface et regénère)
function recalculatePredictions() {
    if (!confirm('Recalculer tous les pronostics avec les derniers résultats réels ?')) {
        return;
    }
    
    // Effacer les anciens
    storedPredictions = null;
    localStorage.removeItem(`footballEloPredictions_${currentSeason}`);
    
    // Regénérer
    generateAllPredictions();
}

// Générer un pronostic avec les données simulées
function generateSinglePredictionWithSimulated(match, eloMap, homeRank, awayRank, simulatedStats) {
    const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
    
    const homeElo = eloMap[match.homeTeamId] || 1500;
    const awayElo = eloMap[match.awayTeamId] || 1500;
    
    // Configuration
    const config = getSeasonConfig();
    const totalTeams = allTeams.length;
    const relegationPosition = totalTeams - config.relegationPlaces;
    
    // Calculer les facteurs
    const factors = [];
    let homeBonus = 0;
    let awayBonus = 0;
    
    // 1. Avantage domicile (base)
    const homeAdvantage = 50;
    homeBonus += homeAdvantage;
    
    // 2. Forme récente (série en cours) - basée sur les matchs réels
    const homeForm = getTeamRecentForm(match.homeTeamId);
    const awayForm = getTeamRecentForm(match.awayTeamId);
    
    if (homeForm.streak >= 3 && homeForm.type === 'W') {
        homeBonus += 30;
        factors.push({ text: `🔥 ${homeTeam.shortName}: ${homeForm.streak}V`, team: 'home', type: 'positive' });
    } else if (homeForm.streak >= 3 && homeForm.type === 'L') {
        homeBonus -= 20;
        factors.push({ text: `📉 ${homeTeam.shortName}: ${homeForm.streak}D`, team: 'home', type: 'negative' });
    }
    
    if (awayForm.streak >= 3 && awayForm.type === 'W') {
        awayBonus += 30;
        factors.push({ text: `🔥 ${awayTeam.shortName}: ${awayForm.streak}V`, team: 'away', type: 'positive' });
    } else if (awayForm.streak >= 3 && awayForm.type === 'L') {
        awayBonus -= 20;
        factors.push({ text: `📉 ${awayTeam.shortName}: ${awayForm.streak}D`, team: 'away', type: 'negative' });
    }
    
    // 3. Enjeux - Course au titre (basé sur le classement simulé)
    const homeInTitle = homeRank <= config.championPlaces + 2;
    const awayInTitle = awayRank <= config.championPlaces + 2;
    
    if (homeInTitle) {
        homeBonus += 25;
        factors.push({ text: `🏆 ${homeTeam.shortName}: Titre`, team: 'home', type: 'neutral' });
    }
    if (awayInTitle) {
        awayBonus += 25;
        factors.push({ text: `🏆 ${awayTeam.shortName}: Titre`, team: 'away', type: 'neutral' });
    }
    
    // 4. Enjeux - Course à l'Europe
    const homeInEurope = homeRank > config.championPlaces && homeRank <= config.europeanPlaces + 2;
    const awayInEurope = awayRank > config.championPlaces && awayRank <= config.europeanPlaces + 2;
    
    if (homeInEurope) {
        homeBonus += 15;
        factors.push({ text: `⭐ ${homeTeam.shortName}: Europe`, team: 'home', type: 'neutral' });
    }
    if (awayInEurope) {
        awayBonus += 15;
        factors.push({ text: `⭐ ${awayTeam.shortName}: Europe`, team: 'away', type: 'neutral' });
    }
    
    // 5. Enjeux - Lutte pour le maintien
    const homeInRelegation = homeRank > relegationPosition - 3;
    const awayInRelegation = awayRank > relegationPosition - 3;
    
    if (homeInRelegation) {
        homeBonus += 20;
        factors.push({ text: `🛡️ ${homeTeam.shortName}: Maintien`, team: 'home', type: 'neutral' });
    }
    if (awayInRelegation) {
        awayBonus += 20;
        factors.push({ text: `🛡️ ${awayTeam.shortName}: Maintien`, team: 'away', type: 'neutral' });
    }
    
    // 6. Adversaire direct
    const isDirectRival = Math.abs(homeRank - awayRank) <= 3;
    if (isDirectRival) {
        factors.push({ text: '⚔️ Duel direct', team: 'both', type: 'neutral' });
    }
    
    // Calculer les probabilités ajustées
    const adjustedHomeElo = homeElo + homeBonus;
    const adjustedAwayElo = awayElo + awayBonus;
    
    const homeExpectancy = 1 / (1 + Math.pow(10, (adjustedAwayElo - adjustedHomeElo) / 400));
    
    // Distribution avec match nul
    const eloDiff = Math.abs(adjustedHomeElo - adjustedAwayElo);
    let drawProb = Math.max(0.18, 0.32 - (eloDiff / 800));
    
    if (isDirectRival) {
        drawProb = Math.min(0.35, drawProb + 0.05);
    }
    
    let homeWinProb = homeExpectancy * (1 - drawProb);
    let awayWinProb = (1 - homeExpectancy) * (1 - drawProb);
    
    // Normaliser
    const total = homeWinProb + drawProb + awayWinProb;
    homeWinProb = homeWinProb / total;
    drawProb = drawProb / total;
    awayWinProb = awayWinProb / total;
    
    // Générer le score prédit
    const predictedScore = generatePredictedScore(homeWinProb, drawProb, awayWinProb, adjustedHomeElo, adjustedAwayElo);
    
    // Déterminer le favori
    let favorite = 'draw';
    let favoriteProb = drawProb;
    if (homeWinProb > drawProb && homeWinProb > awayWinProb) {
        favorite = 'home';
        favoriteProb = homeWinProb;
    } else if (awayWinProb > drawProb && awayWinProb > homeWinProb) {
        favorite = 'away';
        favoriteProb = awayWinProb;
    }
    
    // Déterminer les enjeux du match
    const stakes = [];
    if (homeInTitle || awayInTitle) stakes.push('title');
    if (homeInEurope || awayInEurope) stakes.push('europe');
    if (homeInRelegation || awayInRelegation) stakes.push('relegation');
    if (isDirectRival) stakes.push('direct');
    if ((homeForm.streak >= 3) || (awayForm.streak >= 3)) stakes.push('streak');
    
    return {
        matchId: match.id,
        matchDay: match.matchDay,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeTeamName: homeTeam ? homeTeam.shortName : '?',
        awayTeamName: awayTeam ? awayTeam.shortName : '?',
        homeElo,
        awayElo,
        homeRank,
        awayRank,
        homeForm,
        awayForm,
        homeWinProb: Math.round(homeWinProb * 100),
        drawProb: Math.round(drawProb * 100),
        awayWinProb: Math.round(awayWinProb * 100),
        predictedScore,
        actualScore: null,
        favorite,
        favoriteProb: Math.round(favoriteProb * 100),
        factors,
        stakes
    };
}

// Calculer le changement d'Elo après un match
function calculateEloChange(homeElo, awayElo, homeScore, awayScore) {
    const K = 32;
    const homeAdvantage = 50;
    
    const adjustedHomeElo = homeElo + homeAdvantage;
    
    const expectedHome = 1 / (1 + Math.pow(10, (awayElo - adjustedHomeElo) / 400));
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
    
    return {
        home: Math.round(K * (actualHome - expectedHome)),
        away: Math.round(K * (actualAway - expectedAway))
    };
}

// Générer un pronostic pour un match avec un Elo donné
function generateSinglePrediction(match, eloMap) {
    const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
    
    const homeElo = eloMap[match.homeTeamId] || 1500;
    const awayElo = eloMap[match.awayTeamId] || 1500;
    
    // Récupérer le classement actuel
    const ranking = generateRanking(null, currentSeason, null, false, 'all');
    const homeRank = ranking.findIndex(t => t.id == match.homeTeamId) + 1;
    const awayRank = ranking.findIndex(t => t.id == match.awayTeamId) + 1;
    
    // Configuration
    const config = getSeasonConfig();
    const totalTeams = allTeams.length;
    const relegationPosition = totalTeams - config.relegationPlaces;
    
    // Calculer les facteurs
    const factors = [];
    let homeBonus = 0;
    let awayBonus = 0;
    
    // 1. Avantage domicile (base)
    const homeAdvantage = 50;
    homeBonus += homeAdvantage;
    
    // 2. Forme récente (série en cours)
    const homeForm = getTeamRecentForm(match.homeTeamId);
    const awayForm = getTeamRecentForm(match.awayTeamId);
    
    if (homeForm.streak >= 3 && homeForm.type === 'W') {
        homeBonus += 30;
        factors.push({ text: `🔥 ${homeTeam.shortName}: ${homeForm.streak}V`, team: 'home', type: 'positive' });
    } else if (homeForm.streak >= 3 && homeForm.type === 'L') {
        homeBonus -= 20;
        factors.push({ text: `📉 ${homeTeam.shortName}: ${homeForm.streak}D`, team: 'home', type: 'negative' });
    }
    
    if (awayForm.streak >= 3 && awayForm.type === 'W') {
        awayBonus += 30;
        factors.push({ text: `🔥 ${awayTeam.shortName}: ${awayForm.streak}V`, team: 'away', type: 'positive' });
    } else if (awayForm.streak >= 3 && awayForm.type === 'L') {
        awayBonus -= 20;
        factors.push({ text: `📉 ${awayTeam.shortName}: ${awayForm.streak}D`, team: 'away', type: 'negative' });
    }
    
    // 3. Enjeux - Course au titre
    const homeInTitle = homeRank <= config.championPlaces + 2;
    const awayInTitle = awayRank <= config.championPlaces + 2;
    
    if (homeInTitle) {
        homeBonus += 25;
        factors.push({ text: `🏆 ${homeTeam.shortName}: Titre`, team: 'home', type: 'neutral' });
    }
    if (awayInTitle) {
        awayBonus += 25;
        factors.push({ text: `🏆 ${awayTeam.shortName}: Titre`, team: 'away', type: 'neutral' });
    }
    
    // 4. Enjeux - Course à l'Europe
    const homeInEurope = homeRank > config.championPlaces && homeRank <= config.europeanPlaces + 2;
    const awayInEurope = awayRank > config.championPlaces && awayRank <= config.europeanPlaces + 2;
    
    if (homeInEurope) {
        homeBonus += 15;
        factors.push({ text: `⭐ ${homeTeam.shortName}: Europe`, team: 'home', type: 'neutral' });
    }
    if (awayInEurope) {
        awayBonus += 15;
        factors.push({ text: `⭐ ${awayTeam.shortName}: Europe`, team: 'away', type: 'neutral' });
    }
    
    // 5. Enjeux - Lutte pour le maintien
    const homeInRelegation = homeRank > relegationPosition - 3;
    const awayInRelegation = awayRank > relegationPosition - 3;
    
    if (homeInRelegation) {
        homeBonus += 20;
        factors.push({ text: `🛡️ ${homeTeam.shortName}: Maintien`, team: 'home', type: 'neutral' });
    }
    if (awayInRelegation) {
        awayBonus += 20;
        factors.push({ text: `🛡️ ${awayTeam.shortName}: Maintien`, team: 'away', type: 'neutral' });
    }
    
    // 6. Adversaire direct
    const isDirectRival = Math.abs(homeRank - awayRank) <= 3;
    if (isDirectRival) {
        factors.push({ text: '⚔️ Duel direct', team: 'both', type: 'neutral' });
    }
    
    // Calculer les probabilités ajustées
    const adjustedHomeElo = homeElo + homeBonus;
    const adjustedAwayElo = awayElo + awayBonus;
    
    const homeExpectancy = 1 / (1 + Math.pow(10, (adjustedAwayElo - adjustedHomeElo) / 400));
    
    // Distribution avec match nul
    const eloDiff = Math.abs(adjustedHomeElo - adjustedAwayElo);
    let drawProb = Math.max(0.18, 0.32 - (eloDiff / 800));
    
    if (isDirectRival) {
        drawProb = Math.min(0.35, drawProb + 0.05);
    }
    
    let homeWinProb = homeExpectancy * (1 - drawProb);
    let awayWinProb = (1 - homeExpectancy) * (1 - drawProb);
    
    // Normaliser
    const total = homeWinProb + drawProb + awayWinProb;
    homeWinProb = homeWinProb / total;
    drawProb = drawProb / total;
    awayWinProb = awayWinProb / total;
    
    // Générer le score prédit
    const predictedScore = generatePredictedScore(homeWinProb, drawProb, awayWinProb, adjustedHomeElo, adjustedAwayElo);
    
    // Déterminer le favori
    let favorite = 'draw';
    let favoriteProb = drawProb;
    if (homeWinProb > drawProb && homeWinProb > awayWinProb) {
        favorite = 'home';
        favoriteProb = homeWinProb;
    } else if (awayWinProb > drawProb && awayWinProb > homeWinProb) {
        favorite = 'away';
        favoriteProb = awayWinProb;
    }
    
    // Déterminer les enjeux du match
    const stakes = [];
    if (homeInTitle || awayInTitle) stakes.push('title');
    if (homeInEurope || awayInEurope) stakes.push('europe');
    if (homeInRelegation || awayInRelegation) stakes.push('relegation');
    if (isDirectRival) stakes.push('direct');
    if ((homeForm.streak >= 3) || (awayForm.streak >= 3)) stakes.push('streak');
    
    return {
        matchId: match.id,
        matchDay: match.matchDay,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeTeamName: homeTeam ? homeTeam.shortName : '?',
        awayTeamName: awayTeam ? awayTeam.shortName : '?',
        homeElo,
        awayElo,
        homeRank,
        awayRank,
        homeForm,
        awayForm,
        homeWinProb: Math.round(homeWinProb * 100),
        drawProb: Math.round(drawProb * 100),
        awayWinProb: Math.round(awayWinProb * 100),
        predictedScore,
        actualScore: null,
        favorite,
        favoriteProb: Math.round(favoriteProb * 100),
        factors,
        stakes
    };
}



function generatePredictedScore(homeWinProb, drawProb, awayWinProb, homeElo, awayElo) {
    // Trier les résultats par probabilité
    const results = [
        { type: 'home', prob: homeWinProb },
        { type: 'draw', prob: drawProb },
        { type: 'away', prob: awayWinProb }
    ].sort((a, b) => b.prob - a.prob);
    
    const best = results[0];
    const second = results[1];
    const third = results[2];
    
    const gapFirstSecond = best.prob - second.prob;
    
    let result;
    const random = Math.random();
    
    const thirdChance = Math.max(0.03, third.prob * 0.3);
    
    if (random < thirdChance && third.prob >= 0.10) {
        result = third.type;
    } else if (gapFirstSecond > 0.15) {
        result = best.type;
    } else if (gapFirstSecond > 0.10) {
        result = Math.random() < 0.10 ? second.type : best.type;
    } else if (gapFirstSecond > 0.05) {
        result = Math.random() < 0.20 ? second.type : best.type;
    } else {
        result = Math.random() < 0.35 ? second.type : best.type;
    }
    
    let homeGoals, awayGoals;
    
    const avgElo = 1500;
    const homeOffense = 1.3 + (homeElo - avgElo) / 500;
    const awayOffense = 1.0 + (awayElo - avgElo) / 500;
    
    if (result === 'home') {
        const dominance = homeWinProb - awayWinProb;
        let scoreDiff;
        if (dominance > 0.4) {
            scoreDiff = 3;
        } else if (dominance > 0.25) {
            scoreDiff = 2;
        } else {
            scoreDiff = 1;
        }
        
        homeGoals = Math.max(1, Math.round(homeOffense));
        awayGoals = Math.max(0, homeGoals - scoreDiff);
    } else if (result === 'away') {
        const dominance = awayWinProb - homeWinProb;
        let scoreDiff;
        if (dominance > 0.4) {
            scoreDiff = 3;
        } else if (dominance > 0.25) {
            scoreDiff = 2;
        } else {
            scoreDiff = 1;
        }
        
        awayGoals = Math.max(1, Math.round(awayOffense));
        homeGoals = Math.max(0, awayGoals - scoreDiff);
    } else {
        const avgOffense = (homeOffense + awayOffense) / 2;
        if (avgOffense < 1.1) {
            homeGoals = 0;
            awayGoals = 0;
        } else if (avgOffense < 1.4) {
            homeGoals = 1;
            awayGoals = 1;
        } else {
            homeGoals = 2;
            awayGoals = 2;
        }
    }
    
    return { home: homeGoals, away: awayGoals };
}

function getTeamRecentForm(teamId) {
    const teamMatches = allMatches
        .filter(m => m.homeTeamId == teamId || m.awayTeamId == teamId)
        .sort((a, b) => (b.matchDay || 0) - (a.matchDay || 0))
        .slice(0, 5);
    
    if (teamMatches.length === 0) {
        return { form: [], streak: 0, type: null };
    }
    
    const form = teamMatches.map(match => {
        const isHome = match.homeTeamId == teamId;
        const goalsFor = isHome ? match.finalScore.home : match.finalScore.away;
        const goalsAgainst = isHome ? match.finalScore.away : match.finalScore.home;
        
        if (goalsFor > goalsAgainst) return 'W';
        if (goalsFor < goalsAgainst) return 'L';
        return 'D';
    });
    
    let streak = 1;
    const currentType = form[0];
    for (let i = 1; i < form.length; i++) {
        if (form[i] === currentType) streak++;
        else break;
    }
    
    return { form, streak, type: currentType };
}

// Afficher les pronostics
function displayPredictions() {
    const container = document.getElementById('predictionsContent');
    const title = document.getElementById('predictionsTitle');
    
    if (!container) return;
    
    if (currentPredictionMatchDay === null) {
        initPredictions();
    }
    
    if (title) {
        title.textContent = `🎰 Pronostics - Journée ${currentPredictionMatchDay}`;
    }
    
    updatePredictionNavButtons();
    
    // Vérifier si des pronostics existent pour cette journée
    let predictions = null;
    
    if (storedPredictions && storedPredictions.matchDays && storedPredictions.matchDays[currentPredictionMatchDay]) {
        // Utiliser les pronostics stockés
        const dayData = storedPredictions.matchDays[currentPredictionMatchDay];
        
        // Mettre à jour avec les résultats réels si nouveaux matchs joués
        dayData.matches = dayData.matches.map(pred => {
            const playedMatch = allMatches.find(m => 
                m.matchDay === currentPredictionMatchDay &&
                m.homeTeamId == pred.homeTeamId && 
                m.awayTeamId == pred.awayTeamId
            );
            
            if (playedMatch && playedMatch.finalScore) {
                pred.actualScore = {
                    home: playedMatch.finalScore.home,
                    away: playedMatch.finalScore.away
                };
            }
            
            return pred;
        });
        
        predictions = dayData.matches;
    }
    
    // Si pas de pronostics stockés
    if (!predictions || predictions.length === 0) {
        // Vérifier s'il y a des matchs à venir pour cette journée
        const upcomingMatches = futureMatches.filter(m => m.matchDay === currentPredictionMatchDay);
        
        if (upcomingMatches.length === 0) {
            // Vérifier les matchs joués
            const playedMatches = allMatches.filter(m => m.matchDay === currentPredictionMatchDay);
            
            if (playedMatches.length > 0) {
                container.innerHTML = `
                    <div class="predictions-end">
                        <div class="icon">✅</div>
                        <h3>Journée ${currentPredictionMatchDay} terminée</h3>
                        <p>Tous les matchs ont été joués.</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="predictions-end">
                        <div class="icon">📅</div>
                        <h3>Pas de matchs pour cette journée</h3>
                        <p>Utilisez les boutons de navigation pour voir d'autres journées.</p>
                    </div>
                `;
            }
            return;
        }
        
        // Pas encore de pronostics générés
        container.innerHTML = `
            <div class="predictions-end">
                <div class="icon">🔮</div>
                <h3>Pronostics non générés</h3>
                <p>Cliquez sur "Générer tous les pronostics" pour calculer les prédictions de la saison.</p>
            </div>
        `;
        return;
    }
    
    // Afficher les cartes de pronostics
    container.innerHTML = predictions.map(pred => createPredictionCard(pred)).join('');
}

function updatePredictionNavButtons() {
    const prevBtn = document.getElementById('prevMatchdayBtn');
    const nextBtn = document.getElementById('nextMatchdayBtn');
    
    const maxMatchDay = Math.max(
        ...allMatches.map(m => m.matchDay || 0),
        ...futureMatches.map(m => m.matchDay || 0),
        0
    );
    
    if (prevBtn) {
        prevBtn.disabled = currentPredictionMatchDay <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPredictionMatchDay >= maxMatchDay;
    }
}

function createPredictionCard(pred) {
    const homeTeam = allTeams.find(t => t.id == pred.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == pred.awayTeamId);
    
    // Badges d'enjeux
    const stakeBadges = pred.stakes.map(stake => {
        const labels = {
            'title': '🏆 Titre',
            'europe': '⭐ Europe',
            'relegation': '🛡️ Maintien',
            'direct': '⚔️ Duel direct',
            'streak': '🔥 Série'
        };
        return `<span class="stake-badge ${stake}">${labels[stake]}</span>`;
    }).join('');
    
    // Forme récente
    const homeFormDots = pred.homeForm.form.map(f => `<span class="form-dot ${f}"></span>`).join('');
    const awayFormDots = pred.awayForm.form.map(f => `<span class="form-dot ${f}"></span>`).join('');
    
    // Facteurs
    const factorTags = pred.factors.map(f => {
        let tagClass = f.type;
        return `<span class="factor-tag ${tagClass}">${f.text}</span>`;
    }).join('');
    
    // Texte du favori
    let favoriteText = '';
    let favoriteClass = '';
    if (pred.favorite === 'home') {
        favoriteText = `🏠 ${pred.homeTeamName} (${pred.favoriteProb}%)`;
        favoriteClass = 'home';
    } else if (pred.favorite === 'away') {
        favoriteText = `✈️ ${pred.awayTeamName} (${pred.favoriteProb}%)`;
        favoriteClass = 'away';
    } else {
        favoriteText = `🤝 Match nul (${pred.favoriteProb}%)`;
        favoriteClass = 'draw';
    }
    
    // Section résultat réel si disponible
    let actualResultSection = '';
    if (pred.actualScore) {
        const predResult = getPredictionResult(pred.predictedScore);
        const actualResult = getPredictionResult(pred.actualScore);
        const isCorrect = predResult === actualResult;
        const isExact = pred.predictedScore.home === pred.actualScore.home && 
                        pred.predictedScore.away === pred.actualScore.away;
        
        let resultClass = 'wrong';
        let resultIcon = '❌';
        if (isExact) {
            resultClass = 'exact';
            resultIcon = '🎯';
        } else if (isCorrect) {
            resultClass = 'correct';
            resultIcon = '✅';
        }
        
        actualResultSection = `
            <div class="actual-result ${resultClass}">
                <div class="actual-result-header">
                    ${resultIcon} Résultat réel
                </div>
                <div class="actual-score">
                    ${pred.actualScore.home} - ${pred.actualScore.away}
                </div>
                <div class="prediction-comparison">
                    Pronostic: ${pred.predictedScore.home} - ${pred.predictedScore.away}
                    ${isExact ? '<span class="badge-exact">Score exact !</span>' : 
                      isCorrect ? '<span class="badge-correct">Bon résultat</span>' : 
                      '<span class="badge-wrong">Raté</span>'}
                </div>
            </div>
        `;
    }
    
    return `
        <div class="prediction-card ${pred.actualScore ? 'has-result' : ''}">
            <div class="prediction-card-header">
                <span class="match-info">Match ${pred.homeRank || '?'}e vs ${pred.awayRank || '?'}e</span>
                <div class="match-stakes">${stakeBadges}</div>
            </div>
            <div class="prediction-card-body">
                <div class="prediction-teams">
                    <div class="prediction-team home">
                        <div class="team-name-pred">${pred.homeTeamName}</div>
                        <div class="team-details">
                            <span class="team-elo">Elo: ${pred.homeElo}</span>
                            <span class="team-form">${homeFormDots}</span>
                            <span class="team-location">🏠 Domicile</span>
                        </div>
                    </div>
                    <div class="prediction-score">
                        <div class="score-display">${pred.predictedScore.home} - ${pred.predictedScore.away}</div>
                        <div class="score-label">Pronostic</div>
                    </div>
                    <div class="prediction-team away">
                        <div class="team-name-pred">${pred.awayTeamName}</div>
                        <div class="team-details">
                            <span class="team-elo">Elo: ${pred.awayElo}</span>
                            <span class="team-form">${awayFormDots}</span>
                            <span class="team-location">✈️ Extérieur</span>
                        </div>
                    </div>
                </div>
                
                ${actualResultSection}
                
                <div class="prediction-probabilities">
                    <div class="prob-bar-container">
                        <div class="prob-segment home-win" style="flex: ${pred.homeWinProb}">${pred.homeWinProb}%</div>
                        <div class="prob-segment draw" style="flex: ${pred.drawProb}">${pred.drawProb}%</div>
                        <div class="prob-segment away-win" style="flex: ${pred.awayWinProb}">${pred.awayWinProb}%</div>
                    </div>
                    <div class="prob-labels">
                        <span>Victoire ${pred.homeTeamName}</span>
                        <span>Nul</span>
                        <span>Victoire ${pred.awayTeamName}</span>
                    </div>
                </div>
                
                <div class="prediction-favorite">
                    <div class="favorite-label">⭐ Favori</div>
                    <div class="favorite-team ${favoriteClass}">${favoriteText}</div>
                </div>
                
                <div class="prediction-factors">
                    ${factorTags}
                </div>
            </div>
        </div>
    `;
}

function getPredictionResult(score) {
    if (score.home > score.away) return 'home';
    if (score.home < score.away) return 'away';
    return 'draw';
}