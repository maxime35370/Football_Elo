// firebase-service.js - Service de gestion des données Firebase

class FirebaseService {
    constructor() {
        this.db = firebase.firestore();
        this.isOnline = navigator.onLine;
        
        // Écouter les changements de connexion
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🟢 Connexion rétablie - synchronisation possible');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('🔴 Hors ligne - utilisation du cache local');
        });
        
        // Activer la persistance hors ligne
        this.db.enablePersistence().catch((err) => {
            if (err.code == 'failed-precondition') {
                console.log('Persistance désactivée : plusieurs onglets ouverts');
            } else if (err.code == 'unimplemented') {
                console.log('Persistance non supportée par ce navigateur');
            }
        });
    }

    // === GESTION DES ÉQUIPES ===
    
    async saveTeams(teams) {
        try {
            const teamsDoc = {
                teams: teams,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                version: Date.now()
            };
            
            await this.db.collection('data').doc('teams').set(teamsDoc);
            console.log('✅ Équipes sauvegardées sur Firebase');
            return true;
        } catch (error) {
            console.error('❌ Erreur Firebase saveTeams:', error);
            return false;
        }
    }

    async getTeams() {
        try {
            const doc = await this.db.collection('data').doc('teams').get();
            if (doc.exists) {
                const data = doc.data();
                console.log('📥 Équipes récupérées depuis Firebase');
                return data.teams || [];
            }
            console.log('📭 Aucune équipe trouvée sur Firebase');
            return [];
        } catch (error) {
            console.error('❌ Erreur récupération teams:', error);
            return [];
        }
    }

    // === GESTION DES JOUEURS (référentiel buteurs) ===

    async savePlayers(players) {
        try {
            const playersDoc = {
                players: players,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                version: Date.now()
            };

            await this.db.collection('data').doc('players').set(playersDoc);
            console.log('✅ Référentiel joueurs sauvegardé sur Firebase');
            return true;
        } catch (error) {
            console.error('❌ Erreur Firebase savePlayers:', error);
            return false;
        }
    }

    async getPlayers() {
        try {
            const doc = await this.db.collection('data').doc('players').get();
            if (doc.exists) {
                const data = doc.data();
                console.log('📥 Référentiel joueurs récupéré depuis Firebase');
                return data.players || [];
            }
            return [];
        } catch (error) {
            console.error('❌ Erreur récupération players:', error);
            return [];
        }
    }

    // === GESTION DES SAISONS ===
    // Utilise la collection /seasons/list (selon les règles Firebase)
    
    async saveSeasons(seasons) {
        try {
            const seasonsDoc = {
                seasons: seasons,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                version: Date.now()
            };
            
            await this.db.collection('seasons').doc('list').set(seasonsDoc);
            console.log('✅ Saisons sauvegardées sur Firebase');
            return true;
        } catch (error) {
            console.error('❌ Erreur Firebase saveSeasons:', error);
            return false;
        }
    }

    async getSeasons() {
        try {
            const doc = await this.db.collection('seasons').doc('list').get();
            if (doc.exists) {
                const data = doc.data();
                console.log('📥 Saisons récupérées depuis Firebase');
                return data.seasons || [];
            }
            console.log('📭 Aucune saison trouvée sur Firebase');
            return [];
        } catch (error) {
            console.error('❌ Erreur récupération seasons:', error);
            return [];
        }
    }

    // === GESTION DES MATCHS ===
    
    async saveMatch(match) {
        try {
            const matchId = match.id.toString();
            
            await this.db.collection('matches').doc(matchId).set({
                ...match,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ Match sauvegardé sur Firebase:', matchId);
            return true;
        } catch (error) {
            console.error('❌ Erreur Firebase saveMatch:', error);
            return false;
        }
    }

    async updateMatch(matchId, matchData) {
        try {
            const docId = matchId.toString();
            
            await this.db.collection('matches').doc(docId).set({
                ...matchData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ Match mis à jour sur Firebase:', docId);
            return true;
        } catch (error) {
            console.error('❌ Erreur Firebase updateMatch:', error);
            return false;
        }
    }

    async getMatches() {
        try {
            const snapshot = await this.db.collection('matches').orderBy('date', 'desc').get();
            const matches = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.updatedAt && data.updatedAt.toDate) {
                    data.updatedAt = data.updatedAt.toDate().toISOString();
                }
                matches.push(data);
            });
            
            console.log(`📥 ${matches.length} matchs récupérés depuis Firebase`);
            return matches;
        } catch (error) {
            console.error('❌ Erreur récupération matches:', error);
            return [];
        }
    }

    async deleteMatch(matchId) {
        try {
            const docId = matchId.toString();
            await this.db.collection('matches').doc(docId).delete();
            console.log('🗑️ Match supprimé de Firebase:', docId);
            return true;
        } catch (error) {
            console.error('❌ Erreur suppression match:', error);
            return false;
        }
    }

    async clearAllMatches() {
        try {
            const batch = this.db.batch();
            const snapshot = await this.db.collection('matches').get();
            
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('🗑️ Tous les matchs supprimés de Firebase');
            return true;
        } catch (error) {
            console.error('❌ Erreur suppression totale:', error);
            return false;
        }
    }

    // === GESTION DES MATCHS FUTURS (CALENDRIER PRONOSTICS) ===
    
    async saveFutureMatches(season, matches) {
        try {
            await this.db.collection('futureMatches').doc(season).set({
                season: season,
                matches: matches,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Matchs futurs sauvegardés sur Firebase pour', season);
            return true;
        } catch (error) {
            console.error('❌ Erreur Firebase saveFutureMatches:', error);
            return false;
        }
    }

    async getFutureMatches(season) {
        try {
            const doc = await this.db.collection('futureMatches').doc(season).get();
            if (doc.exists) {
                const data = doc.data();
                console.log('📥 Matchs futurs récupérés depuis Firebase pour', season);
                return data.matches || [];
            }
            console.log('📭 Aucun match futur trouvé sur Firebase pour', season);
            return [];
        } catch (error) {
            console.error('❌ Erreur getFutureMatches:', error);
            return [];
        }
    }

    async deleteFutureMatches(season) {
        try {
            await this.db.collection('futureMatches').doc(season).delete();
            console.log('🗑️ Matchs futurs supprimés de Firebase pour', season);
            return true;
        } catch (error) {
            console.error('❌ Erreur suppression matchs futurs:', error);
            return false;
        }
    }

    // === SYNCHRONISATION ===
    
    async syncFromLocalToFirebase() {
        try {
            console.log('🔄 Début de synchronisation localStorage → Firebase');
            
            // Synchroniser les équipes
            const localTeams = JSON.parse(localStorage.getItem('footballEloTeams') || '[]');
            if (localTeams.length > 0) {
                await this.saveTeams(localTeams);
            }
            
            // Synchroniser les saisons
            const localSeasons = JSON.parse(localStorage.getItem('footballEloSeasons') || '[]');
            if (localSeasons.length > 0) {
                await this.saveSeasons(localSeasons);
            }
            
            // Synchroniser les matchs
            const localMatches = JSON.parse(localStorage.getItem('footballEloMatches') || '[]');
            for (const match of localMatches) {
                await this.saveMatch(match);
            }
            
            console.log('✅ Synchronisation terminée');
            return true;
        } catch (error) {
            console.error('❌ Erreur synchronisation:', error);
            return false;
        }
    }

    // === UTILITAIRES ===
    
    async getConnectionStatus() {
        try {
            await this.db.collection('_test').doc('ping').set({
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async exportAllData() {
        try {
            const teams = await this.getTeams();
            const matches = await this.getMatches();
            const seasons = await this.getSeasons();
            
            return {
                teams: teams,
                matches: matches,
                seasons: seasons,
                exportedAt: new Date().toISOString(),
                source: 'firebase'
            };
        } catch (error) {
            console.error('Erreur export:', error);
            return null;
        }
    }
}

// Instance globale
const firebaseService = new FirebaseService();

// Export pour compatibilité
if (typeof window !== 'undefined') {
    window.firebaseService = firebaseService;
}