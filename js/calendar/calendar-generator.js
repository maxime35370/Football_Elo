// calendar-generator.js - Génération automatique du calendrier (Round-Robin)

// ===============================
// GÉNÉRATION DU CALENDRIER
// ===============================

async function generateFullCalendar() {
    const teams = getTeamsBySeason(currentSeason);

    if (teams.length < 2) {
        alert('Il faut au moins 2 équipes pour générer un calendrier.');
        return;
    }

    // Relire l'état le plus récent du calendrier avant de calculer ce qui
    // manque et avant d'écrire, pour ne jamais se baser sur une copie
    // locale périmée (onglet resté ouvert depuis un moment).
    const latestFutureMatches = await fetchLatestFutureMatches(currentSeason);
    const futureMatchesBaseline = latestFutureMatches !== null ? latestFutureMatches : futureMatches;

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
    
    // Confrontations déjà couvertes : matchs déjà JOUÉS + affiches déjà
    // programmées au calendrier (saisies à la main, avec leurs dates).
    // On ne les régénère jamais — seules les confrontations manquantes
    // des deux côtés sont complétées, pour ne jamais écraser du travail
    // déjà fait (dates, affiches choisies manuellement).
    const coveredConfrontations = new Set();
    allMatches.forEach(match => {
        coveredConfrontations.add(`${match.homeTeamId}-${match.awayTeamId}`);
    });
    futureMatchesBaseline.forEach(match => {
        coveredConfrontations.add(`${match.homeTeamId}-${match.awayTeamId}`);
    });

    // Trouver les confrontations manquantes
    let missingConfrontations = allPossibleConfrontations.filter(conf =>
        !coveredConfrontations.has(`${conf.homeTeamId}-${conf.awayTeamId}`)
    );

    if (missingConfrontations.length === 0) {
        alert('✅ Tous les matchs sont déjà joués ou déjà programmés au calendrier !');
        return;
    }

    // Les nouvelles journées démarrent après la dernière déjà utilisée,
    // jouée OU déjà programmée au calendrier — jamais en écrasant une
    // journée existante.
    const lastPlayedMatchDay = Math.max(
        ...allMatches.map(m => m.matchDay || 0),
        ...futureMatchesBaseline.map(m => m.matchDay || 0),
        0
    );
    
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
    
    // On COMPLÈTE le calendrier existant, on ne le remplace jamais :
    // les affiches déjà programmées (et leurs dates) sont conservées telles
    // quelles, seules les confrontations manquantes sont ajoutées. On part
    // de la lecture fraîche (futureMatchesBaseline), pas de la copie locale.
    futureMatches = [...futureMatchesBaseline, ...generatedMatches];

    // Sauvegarder
    await saveFutureMatchesAsync(currentSeason, futureMatches);

    // Mettre à jour l'affichage
    updateCalendarStatus();
    displayActiveTab();

    const finalMatchDay = currentMatchDay - 1;
    const expectedMatchDays = totalMatchDays;

    let statusMsg = `✅ Calendrier complété !\n\n📊 Statistiques:\n- ${coveredConfrontations.size} confrontations déjà jouées ou déjà programmées\n- ${generatedMatches.length} matchs ajoutés\n- Journées ${lastPlayedMatchDay + 1} à ${finalMatchDay}`;
    
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