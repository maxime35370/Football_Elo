// storage.js - Stockage hybride Firebase + localStorage avec compatibilité sync/async

// NOTE: Les constantes STORAGE_KEY, TEAMS_STORAGE_KEY, SEASONS_STORAGE_KEY 
// sont définies dans d'autres fichiers (seasons.js, admin-teams.js)
// On utilise directement les strings ici pour éviter les conflits

// === FONCTIONS SYNCHRONES (pour compatibilité avec l'ancien code) ===

// Récupérer les matchs de façon synchrone (localStorage uniquement)
function getStoredMatches() {
    try {
        const stored = localStorage.getItem('footballEloMatches');
        const matches = stored ? JSON.parse(stored) : [];
        
        // Assurer la compatibilité : ajouter matchDay = 1 si manquant
        return matches.map(match => ({
            ...match,
            matchDay: match.matchDay || 1
        }));
    } catch (error) {
        console.error('Erreur récupération synchrone matchs:', error);
        return [];
    }
}

// Sauvegarder un match de façon synchrone + Firebase en arrière-plan
function saveMatch(matchData) {
    try {
        // Générer un ID unique et ajouter les métadonnées
        matchData.id = Date.now() + Math.random();
        matchData.createdAt = new Date().toISOString();
        matchData.season = getCurrentSeason();
        
        // Sauvegarder en local immédiatement
        const existingMatches = getStoredMatches();
        existingMatches.push(matchData);
        localStorage.setItem('footballEloMatches', JSON.stringify(existingMatches));
        
        // Sauvegarder sur Firebase en arrière-plan (sans attendre)
        if (typeof firebaseService !== 'undefined') {
            firebaseService.saveMatch(matchData).then(success => {
                if (success) {
                    console.log('Match sauvegardé sur Firebase');
                } else {
                    console.log('Erreur Firebase, match conservé en local');
                }
            }).catch(error => {
                console.log('Erreur Firebase:', error);
            });
        }
        
        console.log('Match sauvegardé avec succès');
        return true;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        return false;
    }
}

// Mettre à jour un match existant (synchrone + Firebase en arrière-plan)
function updateMatch(matchId, newMatchData) {
    try {
        const matches = getStoredMatches();
        const matchIndex = matches.findIndex(m => m.id == matchId);
        
        if (matchIndex === -1) {
            console.error('Match introuvable pour modification');
            return false;
        }
        
        // Conserver l'ID et les métadonnées existantes
        const existingMatch = matches[matchIndex];
        const updatedMatch = {
            ...newMatchData,
            id: existingMatch.id,
            createdAt: existingMatch.createdAt,
            season: existingMatch.season || getCurrentSeason(),
            updatedAt: new Date().toISOString()
        };
        
        // Remplacer le match dans la liste locale
        matches[matchIndex] = updatedMatch;
        localStorage.setItem('footballEloMatches', JSON.stringify(matches));
        
        // Mettre à jour sur Firebase en arrière-plan
        if (typeof firebaseService !== 'undefined') {
            firebaseService.updateMatch(matchId, updatedMatch).then(success => {
                if (success) {
                    console.log('Match mis à jour sur Firebase');
                }
            }).catch(error => {
                console.log('Erreur Firebase mise à jour:', error);
            });
        }
        
        console.log('Match modifié avec succès');
        return true;
    } catch (error) {
        console.error('Erreur lors de la modification:', error);
        return false;
    }
}

// ===============================
// MATCHS FUTURS (CALENDRIER PRONOSTICS)
// ===============================

// Charger les matchs futurs (synchrone - localStorage)
function loadFutureMatches(season) {
    try {
        const key = `footballEloFutureMatches_${season}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Erreur loadFutureMatches:', error);
        return [];
    }
}

// Charger les matchs futurs (async - Firebase prioritaire)
async function loadFutureMatchesAsync(season) {
    try {
        // Essayer Firebase d'abord si disponible et en ligne
        if (typeof firebaseService !== 'undefined' && navigator.onLine) {
            const firebaseMatches = await firebaseService.getFutureMatches(season);
            if (firebaseMatches && firebaseMatches.length > 0) {
                // Synchroniser avec localStorage
                const key = `footballEloFutureMatches_${season}`;
                localStorage.setItem(key, JSON.stringify(firebaseMatches));
                console.log(`📥 ${firebaseMatches.length} matchs futurs chargés depuis Firebase`);
                return firebaseMatches;
            }
        }
        
        // Fallback vers localStorage
        return loadFutureMatches(season);
    } catch (error) {
        console.error('Erreur loadFutureMatchesAsync:', error);
        return loadFutureMatches(season);
    }
}

// Sauvegarder les matchs futurs (synchrone + Firebase en arrière-plan)
function saveFutureMatches(season, matches) {
    try {
        // Sauvegarder en local immédiatement
        const key = `footballEloFutureMatches_${season}`;
        localStorage.setItem(key, JSON.stringify(matches));
        
        // Sauvegarder sur Firebase en arrière-plan
        if (typeof firebaseService !== 'undefined') {
            firebaseService.saveFutureMatches(season, matches).then(success => {
                if (success) {
                    console.log('📤 Matchs futurs synchronisés sur Firebase');
                }
            }).catch(error => {
                console.log('Erreur Firebase matchs futurs:', error);
            });
        }
        
        console.log(`💾 ${matches.length} matchs futurs sauvegardés`);
        return true;
    } catch (error) {
        console.error('Erreur saveFutureMatches:', error);
        return false;
    }
}

// Supprimer les matchs futurs
function clearFutureMatches(season) {
    try {
        const key = `footballEloFutureMatches_${season}`;
        localStorage.removeItem(key);
        
        // Supprimer sur Firebase en arrière-plan
        if (typeof firebaseService !== 'undefined') {
            firebaseService.deleteFutureMatches(season).catch(error => {
                console.log('Erreur Firebase suppression matchs futurs:', error);
            });
        }
        
        return true;
    } catch (error) {
        console.error('Erreur clearFutureMatches:', error);
        return false;
    }
}

// ===============================
// SUPPRESSION DE MATCHS
// ===============================

// Supprimer un match par ID (synchrone + Firebase en arrière-plan)
function deleteMatch(matchId) {
    try {
        const matches = getStoredMatches();
        const filteredMatches = matches.filter(match => match.id != matchId);
        localStorage.setItem('footballEloMatches', JSON.stringify(filteredMatches));
        
        // Supprimer sur Firebase en arrière-plan
        if (typeof firebaseService !== 'undefined') {
            firebaseService.deleteMatch(matchId).then(success => {
                if (success) {
                    console.log('Match supprimé de Firebase');
                }
            }).catch(error => {
                console.log('Erreur Firebase suppression:', error);
            });
        }
        
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        return false;
    }
}

// Effacer tous les matchs (synchrone + Firebase en arrière-plan)
function clearAllMatches() {
    try {
        localStorage.removeItem('footballEloMatches');
        
        // Effacer sur Firebase en arrière-plan
        if (typeof firebaseService !== 'undefined') {
            firebaseService.clearAllMatches().then(success => {
                if (success) {
                    console.log('Tous les matchs supprimés de Firebase');
                }
            }).catch(error => {
                console.log('Erreur Firebase effacement total:', error);
            });
        }
        
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'effacement:', error);
        return false;
    }
}

// Sauvegarder des matchs filtrés (utilisé après suppression)
function saveFilteredMatches(matches) {
    try {
        localStorage.setItem('footballEloMatches', JSON.stringify(matches));
        return true;
    } catch (error) {
        console.error('Erreur saveFilteredMatches:', error);
        return false;
    }
}

// === GESTION DES ÉQUIPES (synchrone) ===

// Récupérer les équipes stockées (synchrone)
function getStoredTeams() {
    try {
        const stored = localStorage.getItem('footballEloTeams');
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Erreur lors de la récupération des équipes:', error);
        return [];
    }
}

// Sauvegarder les équipes (synchrone + Firebase en arrière-plan)
function saveTeams(teams) {
    try {
        // Sauvegarder localement
        localStorage.setItem('footballEloTeams', JSON.stringify(teams));
        
        // Sauvegarder sur Firebase en arrière-plan
        if (typeof firebaseService !== 'undefined') {
            firebaseService.saveTeams(teams).then(success => {
                if (success) {
                    console.log('Équipes sauvegardées sur Firebase');
                }
            }).catch(error => {
                console.log('Erreur Firebase équipes:', error);
            });
        }
        
        return true;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des équipes:', error);
        return false;
    }
}

// Équipes par défaut
function getDefaultTeams() {
    return [
        { id: 1, name: "Paris Saint-Germain", shortName: "PSG", city: "Paris", eloRating: 1500 },
        { id: 2, name: "Olympique de Marseille", shortName: "OM", city: "Marseille", eloRating: 1500 },
        { id: 3, name: "Olympique Lyonnais", shortName: "OL", city: "Lyon", eloRating: 1500 },
        { id: 4, name: "AS Monaco", shortName: "ASM", city: "Monaco", eloRating: 1500 },
        { id: 5, name: "Lille OSC", shortName: "LOSC", city: "Lille", eloRating: 1500 },
        { id: 6, name: "Stade Rennais", shortName: "SRFC", city: "Rennes", eloRating: 1500 },
        { id: 7, name: "OGC Nice", shortName: "OGCN", city: "Nice", eloRating: 1500 },
        { id: 8, name: "RC Strasbourg", shortName: "RCS", city: "Strasbourg", eloRating: 1500 }
    ];
}

// === STATISTIQUES ===

// Obtenir les statistiques (synchrone)
function getMatchesStats() {
    const matches = getStoredMatches();
    const totalGoals = matches.reduce((sum, match) => sum + (match.goals ? match.goals.length : 0), 0);
    
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

// === FONCTIONS ASYNCHRONES (pour utilisation avancée avec Firebase) ===

// Récupérer tous les matchs avec priorité Firebase
async function getStoredMatchesAsync() {
    try {
        // Essayer Firebase d'abord si disponible et en ligne
        if (typeof firebaseService !== 'undefined' && navigator.onLine) {
            const firebaseMatches = await firebaseService.getMatches();
            if (firebaseMatches && firebaseMatches.length >= 0) {
                // Synchroniser avec le localStorage
                localStorage.setItem('footballEloMatches', JSON.stringify(firebaseMatches));
                return firebaseMatches;
            }
        }
        
        // Fallback vers localStorage
        return getStoredMatches();
        
    } catch (error) {
        console.error('Erreur récupération async:', error);
        return getStoredMatches();
    }
}

// Récupérer les équipes avec priorité Firebase
async function getStoredTeamsAsync() {
    try {
        // Essayer Firebase d'abord si disponible et en ligne
        if (typeof firebaseService !== 'undefined' && navigator.onLine) {
            const firebaseTeams = await firebaseService.getTeams();
            if (firebaseTeams && firebaseTeams.length >= 0) {
                // Synchroniser avec le localStorage
                localStorage.setItem('footballEloTeams', JSON.stringify(firebaseTeams));
                return firebaseTeams;
            }
        }
        
        // Fallback vers localStorage
        return getStoredTeams();
        
    } catch (error) {
        console.error('Erreur récupération async équipes:', error);
        return getStoredTeams();
    }
}

// Récupérer les saisons avec priorité Firebase
async function getStoredSeasonsAsync() {
    try {
        // Essayer Firebase d'abord si disponible et en ligne
        if (typeof firebaseService !== 'undefined' && navigator.onLine) {
            const firebaseSeasons = await firebaseService.getSeasons();
            if (firebaseSeasons && firebaseSeasons.length >= 0) {
                // Synchroniser avec le localStorage
                localStorage.setItem('footballEloSeasons', JSON.stringify(firebaseSeasons));
                return firebaseSeasons;
            }
        }
        
        // Fallback vers localStorage
        return typeof getStoredSeasons === 'function' ? getStoredSeasons() : [];
        
    } catch (error) {
        console.error('Erreur récupération async saisons:', error);
        return typeof getStoredSeasons === 'function' ? getStoredSeasons() : [];
    }
}

// === SYNCHRONISATION ===

// Synchroniser les données locales vers Firebase
async function syncToFirebase() {
    try {
        if (typeof firebaseService === 'undefined') {
            console.log('Firebase Service non disponible');
            return false;
        }
        
        console.log('Début de synchronisation vers Firebase...');
        
        // Synchroniser les équipes
        const localTeams = getStoredTeams();
        if (localTeams.length > 0) {
            await firebaseService.saveTeams(localTeams);
        }
        
        // Synchroniser les saisons
        const localSeasons = JSON.parse(localStorage.getItem('footballEloSeasons') || '[]');
        if (localSeasons.length > 0) {
            await firebaseService.saveSeasons(localSeasons);
        }
        
        // Synchroniser les matchs
        const localMatches = getStoredMatches();
        for (const match of localMatches) {
            await firebaseService.saveMatch(match);
        }
        
        console.log('Synchronisation terminée avec succès');
        showSyncMessage('Données synchronisées avec Firebase', 'success');
        return true;
    } catch (error) {
        console.error('Erreur de synchronisation:', error);
        showSyncMessage('Erreur de synchronisation', 'error');
        return false;
    }
}

// Synchroniser Firebase vers local
async function syncFromFirebase() {
    try {
        if (typeof firebaseService === 'undefined') {
            console.log('Firebase Service non disponible');
            return false;
        }
        
        console.log('Synchronisation depuis Firebase...');
        
        // Récupérer et sauvegarder les saisons EN PREMIER (important !)
        const firebaseSeasons = await firebaseService.getSeasons();
        if (firebaseSeasons && firebaseSeasons.length > 0) {
            localStorage.setItem('footballEloSeasons', JSON.stringify(firebaseSeasons));
            console.log(`📥 ${firebaseSeasons.length} saison(s) synchronisée(s)`);
        }
        
        // Récupérer et sauvegarder les équipes
        const firebaseTeams = await firebaseService.getTeams();
        if (firebaseTeams && firebaseTeams.length > 0) {
            localStorage.setItem('footballEloTeams', JSON.stringify(firebaseTeams));
        }
        
        // Récupérer et sauvegarder les matchs
        const firebaseMatches = await firebaseService.getMatches();
        if (firebaseMatches && firebaseMatches.length > 0) {
            localStorage.setItem('footballEloMatches', JSON.stringify(firebaseMatches));
        }
        
        // Récupérer et sauvegarder les matchs futurs pour la saison en cours
        if (typeof getCurrentSeason === 'function') {
            const currentSeason = getCurrentSeason();
            if (currentSeason) {
                const firebaseFutureMatches = await firebaseService.getFutureMatches(currentSeason);
                if (firebaseFutureMatches && firebaseFutureMatches.length > 0) {
                    const key = `footballEloFutureMatches_${currentSeason}`;
                    localStorage.setItem(key, JSON.stringify(firebaseFutureMatches));
                    console.log(`📥 ${firebaseFutureMatches.length} matchs futurs synchronisés`);
                }
            }
        }
        
        console.log('Synchronisation depuis Firebase terminée');
        showSyncMessage('Données récupérées depuis Firebase', 'success');
        return true;
    } catch (error) {
        console.error('Erreur synchronisation depuis Firebase:', error);
        showSyncMessage('Erreur de récupération', 'error');
        return false;
    }
}

// Afficher un message de synchronisation
function showSyncMessage(message, type) {
    // Créer un message temporaire
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        ${type === 'success' ? 'background: #27ae60;' : 'background: #e74c3c;'}
    `;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // Supprimer après 3 secondes
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// === INITIALISATION ===

// Auto-synchronisation au chargement de la page
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        // Petit délai pour laisser Firebase s'initialiser
        setTimeout(() => {
            if (typeof firebaseService !== 'undefined' && navigator.onLine) {
                console.log('Firebase disponible - synchronisation automatique');
                // Synchroniser depuis Firebase au démarrage
                syncFromFirebase().catch(error => {
                    console.log('Sync automatique échouée, utilisation des données locales');
                });
            }
        }, 2000);
    });
}

// Synchronisation périodique (toutes les 5 minutes si en ligne)
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        if (typeof firebaseService !== 'undefined' && navigator.onLine) {
            syncFromFirebase().catch(error => {
                console.log('Sync périodique échouée');
            });
        }
    }, 5 * 60 * 1000); // 5 minutes
}