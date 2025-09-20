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

    // === GESTION DES MATCHS ===
    
    async saveMatch(match) {
        try {
            // Assurer que l'ID est une string
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
                // Nettoyer les timestamps Firebase
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

    // === SYNCHRONISATION ===
    
    async syncFromLocalToFirebase() {
        try {
            console.log('🔄 Début de synchronisation localStorage → Firebase');
            
            // Synchroniser les équipes
            const localTeams = JSON.parse(localStorage.getItem('footballEloTeams') || '[]');
            if (localTeams.length > 0) {
                await this.saveTeams(localTeams);
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
            // Test simple de connexion
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
            
            return {
                teams: teams,
                matches: matches,
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