// seasons.js - Gestion des saisons

const SEASONS_STORAGE_KEY = 'footballEloSeasons';
const CURRENT_SEASON_KEY = 'footballEloCurrentSeason';

// Structure d'une saison
// {
//     name: "2024-2025",
//     startDate: "2024-08-01",
//     endDate: null, // null si en cours
//     isActive: true,
//     createdAt: "2024-08-01T00:00:00Z"
// }

// Initialiser le système de saisons
function initializeSeasons() {
    const seasons = getStoredSeasons();
    
    // Si aucune saison n'existe, créer la saison actuelle par défaut
    if (seasons.length === 0) {
        const defaultSeason = {
            name: "2025-2026",
            startDate: new Date().toISOString().split('T')[0],
            endDate: null,
            isActive: true,
            createdAt: new Date().toISOString()
        };
        
        saveSeasons([defaultSeason]);
        setCurrentSeason("2025-2026");
        console.log('✅ Saison par défaut créée : 2025-2026');
    }
}

// Récupérer toutes les saisons
function getStoredSeasons() {
    try {
        const stored = localStorage.getItem(SEASONS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Erreur récupération saisons:', error);
        return [];
    }
}

// Sauvegarder les saisons
function saveSeasons(seasons) {
    try {
        localStorage.setItem(SEASONS_STORAGE_KEY, JSON.stringify(seasons));
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde saisons:', error);
        return false;
    }
}

// Obtenir la saison en cours
function getCurrentSeason() {
    try {
        const current = localStorage.getItem(CURRENT_SEASON_KEY);
        if (current) {
            return current;
        }
        
        // Fallback : chercher la saison active
        const seasons = getStoredSeasons();
        const activeSeason = seasons.find(s => s.isActive);
        
        if (activeSeason) {
            setCurrentSeason(activeSeason.name);
            return activeSeason.name;
        }
        
        // Si aucune saison active, initialiser
        initializeSeasons();
        return "2025-2026";
        
    } catch (error) {
        console.error('Erreur getCurrentSeason:', error);
        return "2025-2026";
    }
}

// Définir la saison en cours
function setCurrentSeason(seasonName) {
    try {
        localStorage.setItem(CURRENT_SEASON_KEY, seasonName);
        
        // Mettre à jour le statut isActive de toutes les saisons
        const seasons = getStoredSeasons();
        seasons.forEach(season => {
            season.isActive = (season.name === seasonName);
        });
        saveSeasons(seasons);
        
        return true;
    } catch (error) {
        console.error('Erreur setCurrentSeason:', error);
        return false;
    }
}

// Créer une nouvelle saison
function createNewSeason(seasonName, resetElo = false) {
    try {
        const seasons = getStoredSeasons();
        
        // Vérifier si la saison existe déjà
        if (seasons.some(s => s.name === seasonName)) {
            console.error('Cette saison existe déjà');
            return false;
        }
        
        // Archiver la saison actuelle
        const currentSeasonName = getCurrentSeason();
        const currentSeason = seasons.find(s => s.name === currentSeasonName);
        if (currentSeason) {
            currentSeason.isActive = false;
            currentSeason.endDate = new Date().toISOString().split('T')[0];
        }
        
        // Créer la nouvelle saison
        const newSeason = {
            name: seasonName,
            startDate: new Date().toISOString().split('T')[0],
            endDate: null,
            isActive: true,
            createdAt: new Date().toISOString()
        };
        
        seasons.push(newSeason);
        saveSeasons(seasons);
        setCurrentSeason(seasonName);
        
        // Gérer le reset Elo si demandé
        if (resetElo) {
            resetTeamsElo();
        }
        
        console.log(`✅ Nouvelle saison créée : ${seasonName}`);
        return true;
        
    } catch (error) {
        console.error('Erreur createNewSeason:', error);
        return false;
    }
}

// Reset les Elo de toutes les équipes à 1500
function resetTeamsElo() {
    try {
        const teams = getStoredTeams();
        teams.forEach(team => {
            team.eloRating = 1500;
        });
        saveTeams(teams);
        console.log('✅ Ratings Elo remis à 1500');
        return true;
    } catch (error) {
        console.error('Erreur resetTeamsElo:', error);
        return false;
    }
}

// Obtenir les matchs d'une saison spécifique
function getMatchesBySeason(seasonName) {
    const allMatches = getStoredMatches();
    return allMatches.filter(match => match.season === seasonName);
}

// Obtenir toutes les saisons triées (plus récente en premier)
function getSeasonsOrderedByDate() {
    const seasons = getStoredSeasons();
    return seasons.sort((a, b) => {
        return new Date(b.startDate) - new Date(a.startDate);
    });
}

// Obtenir les saisons archivées (non actives)
function getArchivedSeasons() {
    const seasons = getStoredSeasons();
    return seasons.filter(s => !s.isActive).sort((a, b) => {
        return new Date(b.startDate) - new Date(a.startDate);
    });
}

// Obtenir des statistiques pour une saison
function getSeasonStats(seasonName) {
    const matches = getMatchesBySeason(seasonName);
    
    const totalGoals = matches.reduce((sum, match) => {
        return sum + match.finalScore.home + match.finalScore.away;
    }, 0);
    
    const avgGoalsPerMatch = matches.length > 0 
        ? (totalGoals / matches.length).toFixed(2) 
        : 0;
    
    return {
        totalMatches: matches.length,
        totalGoals: totalGoals,
        avgGoalsPerMatch: avgGoalsPerMatch
    };
}

// Vérifier si un match appartient à la saison en cours
function isMatchInCurrentSeason(match) {
    return match.season === getCurrentSeason();
}

// Initialiser automatiquement au chargement
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        initializeSeasons();
        console.log('🗓️ Système de saisons initialisé');
        console.log('📅 Saison en cours :', getCurrentSeason());
    });
}