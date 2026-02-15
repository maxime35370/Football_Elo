// app.js - Logique principale du système de classement

// Calculer les statistiques d'une équipe jusqu'à une journée donnée
function calculateTeamStats(teamId, upToMatchDay, season, fromMatchDay, locationFilter) {
    season = season || getCurrentSeason();
    fromMatchDay = fromMatchDay || 1;
    const matches = getStoredMatches().filter(m => m.season === season);
    const stats = {
        teamId: teamId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0
    };
    
    matches.forEach(match => {
        // Filtrer par journée si spécifié
        if (upToMatchDay && match.matchDay > upToMatchDay) {
            return;
        }
        if (fromMatchDay && match.matchDay < fromMatchDay) {
            return;
        }
        if (locationFilter === 'home' && match.homeTeamId != teamId) {
            return;
        }
        if (locationFilter === 'away' && match.awayTeamId != teamId) {
            return;
        }
        // Vérifier si l'équipe a joué ce match
        const isHome = match.homeTeamId == teamId;
        const isAway = match.awayTeamId == teamId;
        
        if (!isHome && !isAway) return;
        
        stats.played++;
        
        const homeScore = match.finalScore.home;
        const awayScore = match.finalScore.away;
        
        if (isHome) {
            stats.goalsFor += homeScore;
            stats.goalsAgainst += awayScore;
            
            if (homeScore > awayScore) {
                stats.won++;
                stats.points += 3;
            } else if (homeScore === awayScore) {
                stats.drawn++;
                stats.points += 1;
            } else {
                stats.lost++;
            }
        } else { // isAway
            stats.goalsFor += awayScore;
            stats.goalsAgainst += homeScore;
            
            if (awayScore > homeScore) {
                stats.won++;
                stats.points += 3;
            } else if (awayScore === homeScore) {
                stats.drawn++;
                stats.points += 1;
            } else {
                stats.lost++;
            }
        }
    });
    
    stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
    return stats;
}

// Calculer les stats basées sur le score à la mi-temps
function calculateTeamStatsHalftime(teamId, upToMatchDay, season, fromMatchDay, locationFilter) {
    season = season || getCurrentSeason();
    fromMatchDay = fromMatchDay || 1;
    
    const matches = getStoredMatches().filter(m => m.season === season);
    const stats = {
        teamId: teamId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0
    };
    
    matches.forEach(match => {
        if (upToMatchDay && match.matchDay > upToMatchDay) return;
        if (fromMatchDay && match.matchDay < fromMatchDay) return;
        // Filtrer par domicile/extérieur
        if (locationFilter === 'home' && match.homeTeamId != teamId) {
            return;
        }
        if (locationFilter === 'away' && match.awayTeamId != teamId) {
            return;
        }
        
        const isHome = match.homeTeamId == teamId;
        const isAway = match.awayTeamId == teamId;
        
        if (!isHome && !isAway) return;
        
        // Calculer le score mi-temps depuis les buts (minute <= 45 inclut 45+X)
        let homeHT = 0, awayHT = 0;
        
        if (match.goals && match.goals.length > 0) {
            match.goals.forEach(goal => {
                const minute = parseInt(goal.minute);
                if (minute <= 45) {
                    if (goal.teamId == match.homeTeamId) {
                        homeHT++;
                    } else {
                        awayHT++;
                    }
                }
            });
        }
        
        stats.played++;
        
        if (isHome) {
            stats.goalsFor += homeHT;
            stats.goalsAgainst += awayHT;
            
            if (homeHT > awayHT) {
                stats.won++;
                stats.points += 3;
            } else if (homeHT === awayHT) {
                stats.drawn++;
                stats.points += 1;
            } else {
                stats.lost++;
            }
        } else {
            stats.goalsFor += awayHT;
            stats.goalsAgainst += homeHT;
            
            if (awayHT > homeHT) {
                stats.won++;
                stats.points += 3;
            } else if (awayHT === homeHT) {
                stats.drawn++;
                stats.points += 1;
            } else {
                stats.lost++;
            }
        }
    });
    
    stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
    return stats;
}

function calculateTeamStatsSecondHalf(teamId, upToMatchDay, season, fromMatchDay, locationFilter) {
    season = season || getCurrentSeason();
    fromMatchDay = fromMatchDay || 1;
    
    const matches = getStoredMatches().filter(m => m.season === season);
    const stats = {
        teamId: teamId,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
    };
    
    matches.forEach(match => {
        if (upToMatchDay && match.matchDay > upToMatchDay) return;
        if (fromMatchDay && match.matchDay < fromMatchDay) return;
        if (locationFilter === 'home' && match.homeTeamId != teamId) return;
        if (locationFilter === 'away' && match.awayTeamId != teamId) return;
        
        const isHome = match.homeTeamId == teamId;
        const isAway = match.awayTeamId == teamId;
        if (!isHome && !isAway) return;
        
        // Calculer le score de la 2ème mi-temps (buts minute > 45)
        let home2H = 0, away2H = 0;
        
        if (match.goals && match.goals.length > 0) {
            match.goals.forEach(goal => {
                const minute = parseInt(goal.minute);
                if (minute > 45) { // 46+ = 2ème mi-temps (inclut 90+X)
                    if (goal.teamId == match.homeTeamId) {
                        home2H++;
                    } else {
                        away2H++;
                    }
                }
            });
        }
        
        stats.played++;
        
        if (isHome) {
            stats.goalsFor += home2H;
            stats.goalsAgainst += away2H;
            if (home2H > away2H) { stats.won++; stats.points += 3; }
            else if (home2H === away2H) { stats.drawn++; stats.points += 1; }
            else { stats.lost++; }
        } else {
            stats.goalsFor += away2H;
            stats.goalsAgainst += home2H;
            if (away2H > home2H) { stats.won++; stats.points += 3; }
            else if (away2H === home2H) { stats.drawn++; stats.points += 1; }
            else { stats.lost++; }
        }
    });
    
    stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
    return stats;
}

// Calculer les stats sans les buts en temps additionnel (sans 45+X ni 90+X)
function calculateTeamStatsNoExtraTime(teamId, upToMatchDay, season, fromMatchDay, locationFilter) {
    season = season || getCurrentSeason();
    fromMatchDay = fromMatchDay || 1;
    
    const matches = getStoredMatches().filter(m => m.season === season);
    const stats = {
        teamId: teamId,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
    };
    
    matches.forEach(match => {
        if (upToMatchDay && match.matchDay > upToMatchDay) return;
        if (fromMatchDay && match.matchDay < fromMatchDay) return;
        if (locationFilter === 'home' && match.homeTeamId != teamId) return;
        if (locationFilter === 'away' && match.awayTeamId != teamId) return;
        
        const isHome = match.homeTeamId == teamId;
        const isAway = match.awayTeamId == teamId;
        if (!isHome && !isAway) return;
        
        // Calculer le score SANS temps additionnel de fin de match (90+X)
        // On garde les buts en 45+X (fin de 1ère mi-temps)
        let homeGoals = 0, awayGoals = 0;
        
        if (match.goals && match.goals.length > 0) {
            match.goals.forEach(goal => {
                const minute = parseInt(goal.minute);
                const extraTime = parseInt(goal.extraTime) || 0;
                // Exclure uniquement les buts en 90+X (fin de match)
                const isEndGameExtraTime = (minute >= 90 && extraTime > 0);
                if (!isEndGameExtraTime) {
                    if (goal.teamId == match.homeTeamId) {
                        homeGoals++;
                    } else {
                        awayGoals++;
                    }
                }
            });
        } else {
            // Pas de détail des buts → utiliser le score final (fallback)
            homeGoals = match.finalScore.home;
            awayGoals = match.finalScore.away;
        }
        
        stats.played++;
        
        if (isHome) {
            stats.goalsFor += homeGoals;
            stats.goalsAgainst += awayGoals;
            if (homeGoals > awayGoals) { stats.won++; stats.points += 3; }
            else if (homeGoals === awayGoals) { stats.drawn++; stats.points += 1; }
            else { stats.lost++; }
        } else {
            stats.goalsFor += awayGoals;
            stats.goalsAgainst += homeGoals;
            if (awayGoals > homeGoals) { stats.won++; stats.points += 3; }
            else if (awayGoals === homeGoals) { stats.drawn++; stats.points += 1; }
            else { stats.lost++; }
        }
    });
    
    stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
    return stats;
}


// Générer le classement complet jusqu'à une journée donnée
function generateRanking(upToMatchDay, season, fromMatchDay, rankingMode, locationFilter) {
    season = season || getCurrentSeason();
    const teams = getStoredTeams();
    const ranking = [];
    
    teams.forEach(team => {
        let stats;
        switch (rankingMode) {
            case 'firstHalf':
                stats = calculateTeamStatsHalftime(team.id, upToMatchDay, season, fromMatchDay, locationFilter);
                break;
            case 'secondHalf':
                stats = calculateTeamStatsSecondHalf(team.id, upToMatchDay, season, fromMatchDay, locationFilter);
                break;
            case 'noExtraTime':
                stats = calculateTeamStatsNoExtraTime(team.id, upToMatchDay, season, fromMatchDay, locationFilter);
                break;
            default:
                stats = calculateTeamStats(team.id, upToMatchDay, season, fromMatchDay, locationFilter);
                break;
        }
        ranking.push({
            ...team,
            ...stats
        });
    });
    
    // Trier par points, puis différence de buts, puis buts marqués
    ranking.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });
    
    return ranking;
}

// Obtenir la dernière journée jouée
function getLastPlayedMatchDay(season) {
    season = season || getCurrentSeason();
    const matches = getStoredMatches().filter(m => m.season === season);
    if (matches.length === 0) return 0;
    
    return Math.max(...matches.map(match => match.matchDay || 1));
}

// Calculer la forme récente d'une équipe (5 derniers matchs)
function getTeamForm(teamId, upToMatchDay, season, limit = 5, locationFilter = 'all') {
    season = season || getCurrentSeason();
    let matches = getStoredMatches()
        .filter(m => m.season === season);
    
    // Filtrer par domicile/extérieur
    if (locationFilter === 'home') {
        matches = matches.filter(m => m.homeTeamId == teamId);
    } else if (locationFilter === 'away') {
        matches = matches.filter(m => m.awayTeamId == teamId);
    } else {
        matches = matches.filter(m => m.homeTeamId == teamId || m.awayTeamId == teamId);
    }
    
    // Filtrer par journée si spécifié
    let filteredMatches = matches;
    if (upToMatchDay) {
        filteredMatches = matches.filter(m => m.matchDay <= upToMatchDay);
    }
    
    // Trier par journée décroissante (plus récent d'abord)
    filteredMatches.sort((a, b) => (b.matchDay || 0) - (a.matchDay || 0));
    
    // Prendre les X derniers matchs
    const recentMatches = filteredMatches.slice(0, limit);
    
    // Calculer le résultat pour chaque match
    const form = recentMatches.map(match => {
        const isHome = match.homeTeamId == teamId;
        const goalsFor = isHome ? match.finalScore.home : match.finalScore.away;
        const goalsAgainst = isHome ? match.finalScore.away : match.finalScore.home;
        
        if (goalsFor > goalsAgainst) return 'V';
        if (goalsFor < goalsAgainst) return 'D';
        return 'N';
    });
    
    // Inverser pour avoir du plus ancien au plus récent (lecture gauche à droite)
    return form.reverse();
}

// Calculer la série en cours d'une équipe
function getTeamStreak(teamId, upToMatchDay, season, locationFilter = 'all') {
    season = season || getCurrentSeason();
    let matches = getStoredMatches()
        .filter(m => m.season === season);
    
    // Filtrer par domicile/extérieur
    if (locationFilter === 'home') {
        matches = matches.filter(m => m.homeTeamId == teamId);
    } else if (locationFilter === 'away') {
        matches = matches.filter(m => m.awayTeamId == teamId);
    } else {
        matches = matches.filter(m => m.homeTeamId == teamId || m.awayTeamId == teamId);
    }
    
    // Filtrer par journée si spécifié
    let filteredMatches = matches;
    if (upToMatchDay) {
        filteredMatches = matches.filter(m => m.matchDay <= upToMatchDay);
    }
    
    // Trier par journée décroissante (plus récent d'abord)
    filteredMatches.sort((a, b) => (b.matchDay || 0) - (a.matchDay || 0));
    
    if (filteredMatches.length === 0) {
        return { type: null, count: 0, text: '-' };
    }
    
    // Déterminer le résultat du dernier match
    const getResult = (match) => {
        const isHome = match.homeTeamId == teamId;
        const goalsFor = isHome ? match.finalScore.home : match.finalScore.away;
        const goalsAgainst = isHome ? match.finalScore.away : match.finalScore.home;
        
        if (goalsFor > goalsAgainst) return 'V';
        if (goalsFor < goalsAgainst) return 'D';
        return 'N';
    };
    
    const firstResult = getResult(filteredMatches[0]);
    let count = 0;
    
    // Compter la série
    for (const match of filteredMatches) {
        if (getResult(match) === firstResult) {
            count++;
        } else {
            break;
        }
    }
    
    // Générer le texte
    let text = '';
    let type = firstResult;
    
    if (firstResult === 'V') {
        text = `${count} victoire${count > 1 ? 's' : ''}`;
    } else if (firstResult === 'D') {
        text = `${count} défaite${count > 1 ? 's' : ''}`;
    } else {
        text = `${count} nul${count > 1 ? 's' : ''}`;
    }
    
    return { type, count, text };
}