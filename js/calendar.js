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