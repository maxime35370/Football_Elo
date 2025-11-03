// elo.js - Système de calcul du rating Elo pour le football

// Configuration du système Elo
const ELO_CONFIG = {
    K_FACTOR: 32,              // Facteur K standard (peut être ajusté)
    INITIAL_RATING: 1500,      // Rating initial pour toutes les équipes
    HOME_ADVANTAGE: 100,       // Avantage domicile en points Elo
    GOAL_DIFF_MULTIPLIER: 1.5  // Multiplicateur pour la différence de buts
};

/**
 * Calculer la probabilité de victoire attendue
 * @param {number} ratingA - Rating Elo de l'équipe A
 * @param {number} ratingB - Rating Elo de l'équipe B
 * @returns {number} - Probabilité de victoire (0 à 1)
 */
function calculateExpectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculer le score réel du match (1 = victoire, 0.5 = nul, 0 = défaite)
 * @param {number} goalsFor - Buts marqués
 * @param {number} goalsAgainst - Buts encaissés
 * @returns {number} - Score réel (0, 0.5 ou 1)
 */
function getActualScore(goalsFor, goalsAgainst) {
    if (goalsFor > goalsAgainst) return 1;
    if (goalsFor === goalsAgainst) return 0.5;
    return 0;
}

/**
 * Calculer le multiplicateur basé sur la différence de buts
 * @param {number} goalDifference - Différence de buts absolue
 * @returns {number} - Multiplicateur (1 à 2.5)
 */
function getGoalDifferenceMultiplier(goalDifference) {
    const absDiff = Math.abs(goalDifference);
    
    if (absDiff === 0 || absDiff === 1) return 1;
    if (absDiff === 2) return 1.5;
    if (absDiff === 3) return 1.75;
    return 1.75 + (absDiff - 3) * 0.125; // Max ~2.5
}

/**
 * Calculer les nouveaux ratings Elo après un match
 * @param {Object} match - Objet match avec homeTeamId, awayTeamId, finalScore
 * @param {Array} teams - Tableau des équipes avec leurs ratings
 * @returns {Object} - Nouveaux ratings et changements
 */
function calculateEloChange(match, teams) {
    // Trouver les équipes
    const homeTeam = teams.find(t => t.id == match.homeTeamId);
    const awayTeam = teams.find(t => t.id == match.awayTeamId);
    
    if (!homeTeam || !awayTeam) {
        console.error('Équipes introuvables pour le calcul Elo');
        return null;
    }
    
    // Ratings actuels
    const homeRating = homeTeam.eloRating || ELO_CONFIG.INITIAL_RATING;
    const awayRating = awayTeam.eloRating || ELO_CONFIG.INITIAL_RATING;
    
    // Ajuster pour l'avantage domicile
    const adjustedHomeRating = homeRating + ELO_CONFIG.HOME_ADVANTAGE;
    
    // Calculer les probabilités attendues
    const homeExpected = calculateExpectedScore(adjustedHomeRating, awayRating);
    const awayExpected = 1 - homeExpected;
    
    // Scores réels
    const homeActual = getActualScore(match.finalScore.home, match.finalScore.away);
    const awayActual = 1 - homeActual;
    
    // Multiplicateur de différence de buts
    const goalDiff = Math.abs(match.finalScore.home - match.finalScore.away);
    const multiplier = getGoalDifferenceMultiplier(goalDiff);
    
    // Calculer les changements de rating
    const homeChange = Math.round(ELO_CONFIG.K_FACTOR * multiplier * (homeActual - homeExpected));
    const awayChange = Math.round(ELO_CONFIG.K_FACTOR * multiplier * (awayActual - awayExpected));
    
    // Nouveaux ratings
    const newHomeRating = homeRating + homeChange;
    const newAwayRating = awayRating + awayChange;
    
    return {
        homeTeam: {
            id: homeTeam.id,
            name: homeTeam.name,
            oldRating: homeRating,
            newRating: newHomeRating,
            change: homeChange,
            expected: homeExpected
        },
        awayTeam: {
            id: awayTeam.id,
            name: awayTeam.name,
            oldRating: awayRating,
            newRating: newAwayRating,
            change: awayChange,
            expected: awayExpected
        }
    };
}

/**
 * Recalculer tous les ratings Elo depuis le début de la saison
 * @param {Array} teams - Tableau des équipes
 * @param {Array} matches - Tableau des matchs (triés par date/journée)
 * @returns {Array} - Équipes avec ratings mis à jour
 */
function recalculateAllEloRatings(teams, matches) {
    // Réinitialiser tous les ratings à la valeur initiale
    const updatedTeams = teams.map(team => ({
        ...team,
        eloRating: ELO_CONFIG.INITIAL_RATING,
        eloHistory: [{ matchDay: 0, rating: ELO_CONFIG.INITIAL_RATING }]
    }));
    
    // Trier les matchs par journée puis par date
    const sortedMatches = [...matches].sort((a, b) => {
        if (a.matchDay !== b.matchDay) return a.matchDay - b.matchDay;
        return new Date(a.date) - new Date(b.date);
    });
    
    // Appliquer chaque match
    sortedMatches.forEach(match => {
        const eloChange = calculateEloChange(match, updatedTeams);
        
        if (eloChange) {
            // Mettre à jour les ratings
            const homeTeam = updatedTeams.find(t => t.id == eloChange.homeTeam.id);
            const awayTeam = updatedTeams.find(t => t.id == eloChange.awayTeam.id);
            
            if (homeTeam) {
                homeTeam.eloRating = eloChange.homeTeam.newRating;
                if (!homeTeam.eloHistory) homeTeam.eloHistory = [];
                homeTeam.eloHistory.push({
                    matchDay: match.matchDay || 1,
                    rating: eloChange.homeTeam.newRating,
                    change: eloChange.homeTeam.change,
                    opponent: awayTeam.name,
                    result: getMatchResult(match, true),
                    goalsFor: match.finalScore.home,        // ← AJOUTER
                    goalsAgainst: match.finalScore.away     // ← AJOUTER
                });
            }
            
            if (awayTeam) {
                awayTeam.eloRating = eloChange.awayTeam.newRating;
                if (!awayTeam.eloHistory) awayTeam.eloHistory = [];
                awayTeam.eloHistory.push({
                    matchDay: match.matchDay || 1,
                    rating: eloChange.awayTeam.newRating,
                    change: eloChange.awayTeam.change,
                    opponent: homeTeam.name,
                    result: getMatchResult(match, false),
                    goalsFor: match.finalScore.away,        // ← AJOUTER
                    goalsAgainst: match.finalScore.home     // ← AJOUTER
                });
            }
        }
    });
    
    return updatedTeams;
}

// Ajouter les stats de buts dans l'historique
function addGoalStatsToHistory(match, homeTeam, awayTeam) {
    return {
        goalsFor: match.finalScore.home,
        goalsAgainst: match.finalScore.away
    };
}

/**
 * Obtenir le résultat d'un match (V/N/D)
 * @param {Object} match - Objet match
 * @param {boolean} isHome - true si on veut le résultat pour l'équipe domicile
 * @returns {string} - 'V', 'N' ou 'D'
 */
function getMatchResult(match, isHome) {
    const homeScore = match.finalScore.home;
    const awayScore = match.finalScore.away;
    
    if (homeScore === awayScore) return 'N';
    
    if (isHome) {
        return homeScore > awayScore ? 'V' : 'D';
    } else {
        return awayScore > homeScore ? 'V' : 'D';
    }
}

/**
 * Générer le classement Elo
 * @param {Array} teams - Tableau des équipes avec ratings
 * @returns {Array} - Équipes triées par rating Elo
 */
function generateEloRanking(teams) {
    return [...teams]
        .filter(team => team.eloRating) // Seulement les équipes avec un rating
        .sort((a, b) => b.eloRating - a.eloRating);
}

/**
 * Comparer le classement traditionnel avec le classement Elo
 * @param {Array} traditionalRanking - Classement par points
 * @param {Array} eloRanking - Classement par Elo
 * @returns {Array} - Équipes avec différence de position
 */
function compareRankings(traditionalRanking, eloRanking) {
    const comparison = [];
    
    traditionalRanking.forEach((team, tradIndex) => {
        const eloIndex = eloRanking.findIndex(t => t.id === team.id);
        const difference = eloIndex !== -1 ? tradIndex - eloIndex : 0;
        
        comparison.push({
            ...team,
            traditionalPosition: tradIndex + 1,
            eloPosition: eloIndex + 1,
            positionDifference: difference
        });
    });
    
    return comparison;
}

/**
 * Prédire le résultat d'un match futur
 * @param {number} homeTeamId - ID équipe domicile
 * @param {number} awayTeamId - ID équipe extérieur
 * @param {Array} teams - Tableau des équipes
 * @returns {Object} - Probabilités de victoire
 */
function predictMatch(homeTeamId, awayTeamId, teams) {
    const homeTeam = teams.find(t => t.id == homeTeamId);
    const awayTeam = teams.find(t => t.id == awayTeamId);
    
    if (!homeTeam || !awayTeam) return null;
    
    const homeRating = homeTeam.eloRating || ELO_CONFIG.INITIAL_RATING;
    const awayRating = awayTeam.eloRating || ELO_CONFIG.INITIAL_RATING;
    
    // Avec avantage domicile
    const adjustedHomeRating = homeRating + ELO_CONFIG.HOME_ADVANTAGE;
    
    const homeWinProb = calculateExpectedScore(adjustedHomeRating, awayRating);
    const drawProb = 0.25; // Approximation simplifiée
    const awayWinProb = 1 - homeWinProb;
    
    return {
        homeTeam: {
            name: homeTeam.name,
            rating: homeRating,
            winProbability: (homeWinProb * 100).toFixed(1)
        },
        awayTeam: {
            name: awayTeam.name,
            rating: awayRating,
            winProbability: (awayWinProb * 100).toFixed(1)
        },
        drawProbability: (drawProb * 100).toFixed(1)
    };
}

/**
 * Obtenir les statistiques Elo d'une équipe
 * @param {Object} team - Équipe avec historique Elo
 * @returns {Object} - Statistiques complètes
 */
function getTeamEloStats(team) {
    if (!team.eloHistory || team.eloHistory.length === 0) {
        return null;
    }
    
    const history = team.eloHistory;
    const currentRating = team.eloRating || ELO_CONFIG.INITIAL_RATING;
    const initialRating = ELO_CONFIG.INITIAL_RATING;
    const totalChange = currentRating - initialRating;
    
    const maxRating = Math.max(...history.map(h => h.rating));
    const minRating = Math.min(...history.map(h => h.rating));
    
    const victories = history.filter(h => h.result === 'V').length;
    const draws = history.filter(h => h.result === 'N').length;
    const defeats = history.filter(h => h.result === 'D').length;
    
    return {
        currentRating,
        totalChange,
        maxRating,
        minRating,
        matchesPlayed: history.length,
        victories,
        draws,
        defeats,
        form: history.slice(-5) // Derniers 5 matchs
    };
}

// Export des fonctions
if (typeof window !== 'undefined') {
    window.EloSystem = {
        calculateEloChange,
        recalculateAllEloRatings,
        generateEloRanking,
        compareRankings,
        predictMatch,
        getTeamEloStats,
        calculateExpectedScore,
        ELO_CONFIG
    };
}