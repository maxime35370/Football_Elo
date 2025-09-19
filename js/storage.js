// storage.js - Système de stockage des matchs en LocalStorage

const STORAGE_KEY = 'footballEloMatches';

// Sauvegarder un match
function saveMatch(matchData) {
    try {
        // Récupérer les matchs existants
        const existingMatches = getStoredMatches();
        
        // Ajouter un ID unique au match
        matchData.id = Date.now() + Math.random();
        matchData.createdAt = new Date().toISOString();
        
        // Ajouter le nouveau match
        existingMatches.push(matchData);
        
        // Sauvegarder dans le localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existingMatches));
        
        console.log('Match sauvegardé avec succès:', matchData);
        return true;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        return false;
    }
}

// Récupérer tous les matchs stockés
function getStoredMatches() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Erreur lors de la récupération des matchs:', error);
        return [];
    }
}

// Supprimer un match par ID
function deleteMatch(matchId) {
    try {
        const matches = getStoredMatches();
        const filteredMatches = matches.filter(match => match.id !== matchId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredMatches));
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        return false;
    }
}

// Effacer tous les matchs
function clearAllMatches() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'effacement:', error);
        return false;
    }
}

// Obtenir les statistiques
function getMatchesStats() {
    const matches = getStoredMatches();
    const totalGoals = matches.reduce((sum, match) => sum + match.goals.length, 0);
    
    return {
        totalMatches: matches.length,
        totalGoals: totalGoals,
        teams: [...new Set(matches.flatMap(match => [match.homeTeamId, match.awayTeamId]))]
    };
}

// Filtrer les matchs par équipe
function getMatchesByTeam(teamId) {
    const matches = getStoredMatches();
    return matches.filter(match => 
        match.homeTeamId == teamId || match.awayTeamId == teamId
    );
}

// Trier les matchs
function sortMatches(matches, sortBy = 'newest') {
    const sorted = [...matches];
    
    if (sortBy === 'newest') {
        return sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortBy === 'oldest') {
        return sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    return sorted;
}