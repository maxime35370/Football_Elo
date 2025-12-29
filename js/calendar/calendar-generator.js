// calendar-generator.js - Génération automatique du calendrier (Round-Robin)

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
    const totalMatchDays = (numTeams - 1) * 2;
    
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
    
    let remainingConfrontations = [...missingConfrontations];
    
    while (remainingConfrontations.length > 0 && currentMatchDay <= totalMatchDays) {
        const teamsPlayingThisDay = new Set();
        const matchesThisDay = [];
        
        sortByPriority(remainingConfrontations);
        
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
                
                teamRemainingMatches[conf.homeTeamId]--;
                teamRemainingMatches[conf.awayTeamId]--;
                
                if (matchesThisDay.length >= matchesPerDay) {
                    break;
                }
            }
        }
        
        for (let i = toRemove.length - 1; i >= 0; i--) {
            remainingConfrontations.splice(toRemove[i], 1);
        }
        
        generatedMatches.push(...matchesThisDay);
        currentMatchDay++;
    }
    
    // S'il reste des matchs
    if (remainingConfrontations.length > 0) {
        console.warn(`⚠️ ${remainingConfrontations.length} matchs n'ont pas pu être assignés dans les ${totalMatchDays} journées`);
        
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