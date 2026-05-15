// elo-system.js - Système de calcul du rating Elo pour le football
// Version améliorée avec prise en compte de l'écart de buts (comme FIFA)
if (typeof window.EloSystem !== 'undefined') { console.log('⚠️ EloSystem déjà chargé, skip'); } else {

    // Configuration du système Elo
    const ELO_CONFIG = {
        K_FACTOR: 32,              // Facteur K standard
        INITIAL_RATING: 1500,      // Rating initial pour toutes les équipes
        HOME_ADVANTAGE: 100,       // Avantage domicile en points Elo
        
        // Multiplicateurs d'écart de buts (style FIFA)
        GOAL_DIFF_MULTIPLIERS: {
            0: 1,      // Match nul
            1: 1,      // Victoire 1 but d'écart
            2: 1.5,    // Victoire 2 buts d'écart
            3: 1.75,   // Victoire 3 buts d'écart
            // 4+ : 1.75 + (diff - 3) * 0.125
        }
    };

    /**
     * Calculer la probabilité de victoire attendue
     * Formule standard Elo : E = 1 / (1 + 10^((Rb - Ra) / 400))
     * 
     * @param {number} ratingA - Rating Elo de l'équipe A
     * @param {number} ratingB - Rating Elo de l'équipe B
     * @returns {number} - Probabilité de victoire (0 à 1)
     */
    function calculateExpectedScore(ratingA, ratingB) {
        return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    }

    /**
     * Calculer le score réel du match
     * Victoire = 1, Nul = 0.5, Défaite = 0
     * 
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
     * Plus l'écart est grand, plus l'impact sur l'Elo est important
     * 
     * Écart | Multiplicateur
     * ------|---------------
     * 0-1   | 1.00
     * 2     | 1.50
     * 3     | 1.75
     * 4     | 1.875
     * 5+    | ~2.0
     * 
     * @param {number} goalDifference - Différence de buts absolue
     * @returns {number} - Multiplicateur (1 à ~2.0)
     */
    function getGoalDifferenceMultiplier(goalDifference) {
        const absDiff = Math.abs(goalDifference);
        
        if (absDiff === 0 || absDiff === 1) return 1;
        if (absDiff === 2) return 1.5;
        if (absDiff === 3) return 1.75;
        
        // Pour 4+ buts d'écart : progression plus lente pour éviter les valeurs extrêmes
        return Math.min(2.0, 1.75 + (absDiff - 3) * 0.125);
    }

    /**
     * Calculer les nouveaux ratings Elo après un match
     * Formule : New Rating = Old Rating + K × Multiplier × (Actual - Expected)
     * 
     * @param {Object} match - Objet match avec homeTeamId, awayTeamId, finalScore
     * @param {Array} teams - Tableau des équipes avec leurs ratings
     * @returns {Object} - Nouveaux ratings et changements détaillés
     */
    function calculateEloChange(match, teams) {
        // Trouver les équipes
        const homeTeam = teams.find(t => t.id == match.homeTeamId);
        const awayTeam = teams.find(t => t.id == match.awayTeamId);
        
        if (!homeTeam || !awayTeam) {
            console.error('Équipes introuvables pour le calcul Elo:', match.homeTeamId, match.awayTeamId);
            return null;
        }
        
        if (!match.finalScore) {
            console.error('Score final manquant pour le calcul Elo');
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
        
        // Scores réels (1 = victoire, 0.5 = nul, 0 = défaite)
        const homeActual = getActualScore(match.finalScore.home, match.finalScore.away);
        const awayActual = 1 - homeActual;
        
        // Multiplicateur de différence de buts (NOUVEAU)
        const goalDiff = Math.abs(match.finalScore.home - match.finalScore.away);
        const multiplier = getGoalDifferenceMultiplier(goalDiff);
        
        // Calculer les changements de rating avec le multiplicateur
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
                expected: homeExpected,
                actual: homeActual
            },
            awayTeam: {
                id: awayTeam.id,
                name: awayTeam.name,
                oldRating: awayRating,
                newRating: newAwayRating,
                change: awayChange,
                expected: awayExpected,
                actual: awayActual
            },
            goalDifference: goalDiff,
            multiplier: multiplier,
            score: `${match.finalScore.home}-${match.finalScore.away}`
        };
    }

    /**
     * Initialiser les équipes avec le rating Elo initial
     * @param {Array} teams - Tableau des équipes
     * @returns {Array} - Équipes avec ratings initialisés
     */
    function initializeTeamsElo(teams) {
        return teams.map(team => ({
            ...team,
            eloRating: team.eloRating || ELO_CONFIG.INITIAL_RATING,
            eloHistory: []
        }));
    }

    /**
     * Traiter un match et mettre à jour les ratings
     * @param {Object} match - Objet match
     * @param {Array} teams - Tableau des équipes (muté)
     */
    function processMatch(match, teams) {
        const eloChange = calculateEloChange(match, teams);
        
        if (eloChange) {
            const homeTeam = teams.find(t => t.id == eloChange.homeTeam.id);
            const awayTeam = teams.find(t => t.id == eloChange.awayTeam.id);
            
            if (homeTeam) {
                homeTeam.eloRating = eloChange.homeTeam.newRating;
                if (!homeTeam.eloHistory) homeTeam.eloHistory = [];
                homeTeam.eloHistory.push({
                    matchDay: match.matchDay || 1,
                    rating: eloChange.homeTeam.newRating,
                    change: eloChange.homeTeam.change,
                    opponent: awayTeam?.name || 'Unknown',
                    result: getMatchResult(match, true),
                    goalsFor: match.finalScore.home,
                    goalsAgainst: match.finalScore.away,
                    multiplier: eloChange.multiplier
                });
            }
            
            if (awayTeam) {
                awayTeam.eloRating = eloChange.awayTeam.newRating;
                if (!awayTeam.eloHistory) awayTeam.eloHistory = [];
                awayTeam.eloHistory.push({
                    matchDay: match.matchDay || 1,
                    rating: eloChange.awayTeam.newRating,
                    change: eloChange.awayTeam.change,
                    opponent: homeTeam?.name || 'Unknown',
                    result: getMatchResult(match, false),
                    goalsFor: match.finalScore.away,
                    goalsAgainst: match.finalScore.home,
                    multiplier: eloChange.multiplier
                });
            }
        }
    }

    /**
     * Recalculer tous les ratings Elo depuis le début de la saison
     * Cette fonction est appelée à chaque chargement de page pour s'assurer
     * que tous les matchs sont pris en compte avec la bonne formule
     * 
     * @param {Array} teams - Tableau des équipes
     * @param {Array} matches - Tableau des matchs (triés par date/journée)
     * @returns {Array} - Équipes avec ratings mis à jour
     */
    function recalculateAllEloRatings(teams, matches, startingElo = {}) {
        // startingElo : { idÉquipe: ratingDeDépart }. Permet de reporter les Elo
        // de fin de saison précédente comme point de départ de la saison en cours.
        // Une équipe absente de cette table démarre à INITIAL_RATING (1500) :
        // c'est le cas des promus et de la toute première saison.
        const updatedTeams = teams.map(team => ({
            ...team,
            eloRating: (startingElo && startingElo[team.id] != null)
                ? startingElo[team.id]
                : ELO_CONFIG.INITIAL_RATING,
            eloHistory: []
        }));
        
        // Trier les matchs par journée puis par date
        const sortedMatches = [...matches].sort((a, b) => {
            if ((a.matchDay || 0) !== (b.matchDay || 0)) {
                return (a.matchDay || 0) - (b.matchDay || 0);
            }
            return new Date(a.date || 0) - new Date(b.date || 0);
        });
        
        // Appliquer chaque match
        sortedMatches.forEach(match => {
            if (match.finalScore) {
                processMatch(match, updatedTeams);
            }
        });
        
        // Log pour debug
        console.log(`📊 Elo recalculé pour ${updatedTeams.length} équipes sur ${sortedMatches.length} matchs`);
        
        return updatedTeams;
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
            .filter(team => team.eloRating)
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
        
        // Probabilité brute de victoire domicile
        const homeWinProb = calculateExpectedScore(adjustedHomeRating, awayRating);
        
        // Estimation du nul basée sur la différence de rating
        // Plus les équipes sont proches, plus le nul est probable
        const ratingDiff = Math.abs(adjustedHomeRating - awayRating);
        const drawProb = Math.max(0.15, 0.35 - ratingDiff / 1000);
        
        // Ajuster les probabilités
        const adjustedHomeWin = homeWinProb * (1 - drawProb);
        const adjustedAwayWin = (1 - homeWinProb) * (1 - drawProb);
        
        return {
            homeTeam: {
                name: homeTeam.name,
                shortName: homeTeam.shortName,
                rating: homeRating,
                winProbability: Math.round(adjustedHomeWin * 100)
            },
            awayTeam: {
                name: awayTeam.name,
                shortName: awayTeam.shortName,
                rating: awayRating,
                winProbability: Math.round(adjustedAwayWin * 100)
            },
            drawProbability: Math.round(drawProb * 100)
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
        
        // Calculer le plus gros gain et la plus grosse perte
        const biggestGain = Math.max(...history.map(h => h.change));
        const biggestLoss = Math.min(...history.map(h => h.change));
        
        return {
            currentRating,
            totalChange,
            maxRating,
            minRating,
            matchesPlayed: history.length,
            victories,
            draws,
            defeats,
            biggestGain,
            biggestLoss,
            form: history.slice(-5) // Derniers 5 matchs
        };
    }

    /**
     * Simuler un match et retourner le changement Elo potentiel
     * Utile pour prévisualiser l'impact d'un résultat
     * 
     * @param {number} homeElo - Rating Elo domicile
     * @param {number} awayElo - Rating Elo extérieur  
     * @param {number} homeGoals - Buts domicile
     * @param {number} awayGoals - Buts extérieur
     * @returns {Object} - Changements Elo simulés
     */
    function simulateEloChange(homeElo, awayElo, homeGoals, awayGoals) {
        const adjustedHomeElo = homeElo + ELO_CONFIG.HOME_ADVANTAGE;
        
        const homeExpected = calculateExpectedScore(adjustedHomeElo, awayElo);
        const awayExpected = 1 - homeExpected;
        
        const homeActual = getActualScore(homeGoals, awayGoals);
        const awayActual = 1 - homeActual;
        
        const goalDiff = Math.abs(homeGoals - awayGoals);
        const multiplier = getGoalDifferenceMultiplier(goalDiff);
        
        const homeChange = Math.round(ELO_CONFIG.K_FACTOR * multiplier * (homeActual - homeExpected));
        const awayChange = Math.round(ELO_CONFIG.K_FACTOR * multiplier * (awayActual - awayExpected));
        
        return {
            homeChange,
            awayChange,
            multiplier,
            homeExpected: Math.round(homeExpected * 100),
            awayExpected: Math.round(awayExpected * 100)
        };
    }

    // Export des fonctions pour utilisation globale
    if (typeof window !== 'undefined') {
        window.EloSystem = {
            // Configuration
            ELO_CONFIG,
            
            // Fonctions de calcul
            calculateExpectedScore,
            getActualScore,
            getGoalDifferenceMultiplier,
            calculateEloChange,
            simulateEloChange,
            
            // Gestion des équipes
            initializeTeamsElo,
            processMatch,
            recalculateAllEloRatings,
            
            // Classements
            generateEloRanking,
            compareRankings,
            
            // Prédictions et stats
            predictMatch,
            getTeamEloStats,
            getMatchResult
        };
        
        console.log('✅ EloSystem chargé (avec multiplicateur d\'écart de buts)');
    }

    // Export pour Node.js (si utilisé côté serveur)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            ELO_CONFIG,
            calculateExpectedScore,
            getActualScore,
            getGoalDifferenceMultiplier,
            calculateEloChange,
            simulateEloChange,
            initializeTeamsElo,
            processMatch,
            recalculateAllEloRatings,
            generateEloRanking,
            compareRankings,
            predictMatch,
            getTeamEloStats,
            getMatchResult
        };
    }
}