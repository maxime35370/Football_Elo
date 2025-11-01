// app.js - Logique principale du système de classement

// Calculer les statistiques d'une équipe jusqu'à une journée donnée
function calculateTeamStats(teamId, upToMatchDay, season) {
    season = season || getCurrentSeason();
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

// Générer le classement complet jusqu'à une journée donnée
function generateRanking(upToMatchDay, season) {
    season = season || getCurrentSeason();
    const teams = getStoredTeams();
    const ranking = [];
    
    teams.forEach(team => {
        const stats = calculateTeamStats(team.id, upToMatchDay, season);
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