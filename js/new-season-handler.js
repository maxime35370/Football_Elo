// new-season-handler.js - Gestion améliorée de la nouvelle saison

// Fonction principale pour démarrer une nouvelle saison
function handleResetSeason() {
    const currentSeason = getCurrentSeason();
    const teams = getStoredTeams();
    const matches = getStoredMatches();
    const currentSeasonMatches = getMatchesBySeason(currentSeason);
    
    // Créer une popup personnalisée
    showNewSeasonDialog(currentSeason, teams.length, currentSeasonMatches.length);
}

// Afficher la popup de nouvelle saison
function showNewSeasonDialog(currentSeason, teamCount, matchCount) {
    // Créer l'overlay
    const overlay = document.createElement('div');
    overlay.id = 'newSeasonOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    // Créer la popup
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 2rem;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `;
    
    // Suggérer automatiquement la prochaine saison
    const nextSeasonName = generateNextSeasonName(currentSeason);
    
    popup.innerHTML = `
        <h2 style="color: #2c3e50; margin-bottom: 1.5rem; text-align: center;">
            🆕 Démarrer une nouvelle saison
        </h2>
        
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <p style="margin: 0.5rem 0; color: #2c3e50;">
                <strong>📅 Saison actuelle :</strong> ${currentSeason}
            </p>
            <p style="margin: 0.5rem 0; color: #2c3e50;">
                <strong>👥 Équipes :</strong> ${teamCount}
            </p>
            <p style="margin: 0.5rem 0; color: #2c3e50;">
                <strong>⚽ Matchs de la saison :</strong> ${matchCount}
            </p>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; color: #2c3e50; font-weight: 600;">
                Nom de la nouvelle saison :
            </label>
            <input 
                type="text" 
                id="newSeasonName" 
                value="${nextSeasonName}"
                placeholder="ex: 2026-2027"
                style="width: 100%; padding: 0.8rem; border: 2px solid #e9ecef; border-radius: 5px; font-size: 1rem;"
            >
            <small style="color: #6c757d; display: block; margin-top: 0.25rem;">
                Format recommandé : YYYY-YYYY
            </small>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 1rem; color: #2c3e50; font-weight: 600;">
                Gestion des ratings Elo :
            </label>
            
            <div style="margin-bottom: 0.8rem;">
                <label style="display: flex; align-items: center; padding: 0.8rem; background: #e8f5e8; border: 2px solid #27ae60; border-radius: 8px; cursor: pointer;">
                    <input 
                        type="radio" 
                        name="eloChoice" 
                        value="keep" 
                        checked
                        style="margin-right: 0.8rem; width: 20px; height: 20px; cursor: pointer;"
                    >
                    <div>
                        <strong style="color: #27ae60;">✅ Conserver les Elo actuels</strong>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #555;">
                            Recommandé : l'Elo de fin de saison devient l'Elo de départ
                            de la nouvelle saison (les promus démarrent à 1500)
                        </p>
                    </div>
                </label>
            </div>
            
            <div>
                <label style="display: flex; align-items: center; padding: 0.8rem; background: #fff3cd; border: 2px solid #f39c12; border-radius: 8px; cursor: pointer;">
                    <input 
                        type="radio" 
                        name="eloChoice" 
                        value="reset"
                        style="margin-right: 0.8rem; width: 20px; height: 20px; cursor: pointer;"
                    >
                    <div>
                        <strong style="color: #f39c12;">🔄 Réinitialiser à 1500</strong>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #555;">
                            Toutes les équipes repartent à zéro
                        </p>
                    </div>
                </label>
            </div>
        </div>
        
        <div style="background: #d1ecf1; padding: 1rem; border-radius: 8px; border-left: 4px solid #0c5460; margin-bottom: 1.5rem;">
            <p style="margin: 0; color: #0c5460; font-size: 0.9rem;">
                ℹ️ <strong>Important :</strong> Les matchs de la saison ${currentSeason} seront archivés et consultables dans l'historique. Aucune donnée ne sera supprimée.
            </p>
        </div>
        
        <div style="display: flex; gap: 1rem; justify-content: center;">
            <button 
                id="cancelNewSeason"
                style="padding: 0.8rem 1.5rem; background: #95a5a6; color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: 600; font-size: 1rem;"
            >
                ❌ Annuler
            </button>
            <button 
                id="confirmNewSeason"
                style="padding: 0.8rem 1.5rem; background: linear-gradient(45deg, #27ae60, #2ecc71); color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: 600; font-size: 1rem;"
            >
                🚀 Démarrer la nouvelle saison
            </button>
        </div>
    `;
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Focus sur l'input
    setTimeout(() => {
        document.getElementById('newSeasonName').focus();
        document.getElementById('newSeasonName').select();
    }, 100);
    
    // Gérer les événements
    document.getElementById('cancelNewSeason').addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    document.getElementById('confirmNewSeason').addEventListener('click', () => {
        processNewSeason(overlay);
    });
    
    // Permettre Enter pour valider
    document.getElementById('newSeasonName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            processNewSeason(overlay);
        }
    });
}

// Générer automatiquement le nom de la prochaine saison
function generateNextSeasonName(currentSeason) {
    // Format attendu : "2025-2026"
    const match = currentSeason.match(/(\d{4})-(\d{4})/);
    if (match) {
        const year1 = parseInt(match[1]) + 1;
        const year2 = parseInt(match[2]) + 1;
        return `${year1}-${year2}`;
    }
    return "2026-2027"; // Fallback
}

// Traiter la création de la nouvelle saison
async function processNewSeason(overlay) {
    const newSeasonName = document.getElementById('newSeasonName').value.trim();
    const eloChoice = document.querySelector('input[name="eloChoice"]:checked').value;
    const resetElo = (eloChoice === 'reset');
    
    // Validation
    if (!newSeasonName) {
        alert('⚠️ Veuillez saisir un nom de saison');
        return;
    }
    
    // Vérifier si la saison existe déjà
    const seasons = getStoredSeasons();
    if (seasons.some(s => s.name === newSeasonName)) {
        alert(`⚠️ La saison "${newSeasonName}" existe déjà !`);
        return;
    }
    
    // Valider le format (optionnel)
    if (!newSeasonName.match(/^\d{4}-\d{4}$/)) {
        if (!confirm(`Le format "${newSeasonName}" ne correspond pas au format recommandé (YYYY-YYYY).\n\nContinuer quand même ?`)) {
            return;
        }
    }
    
    // Conserver les Elo : garantir que les matchs de la saison écoulée sont
    // bien chargés AVANT de figer le report d'Elo. La page admin ne charge pas
    // forcément les matchs au démarrage ; sans cette étape, le report se
    // calculerait sur 0 match et toutes les équipes repartiraient à 1500.
    if (!resetElo) {
        const confirmBtn = document.getElementById('confirmNewSeason');
        const previousLabel = confirmBtn ? confirmBtn.textContent : '';
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = '⏳ Chargement des matchs...';
        }

        try {
            if (typeof getStoredMatchesAsync === 'function') {
                await getStoredMatchesAsync();
            }
        } catch (e) {
            console.warn('Chargement des matchs avant report Elo échoué:', e);
        }

        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = previousLabel;
        }

        // Garde-fou : sans match joué chargé pour la saison écoulée, le report
        // repartirait à 1500. On prévient au lieu de figer des Elo erronés.
        const currentSeason = getCurrentSeason();
        const playedMatches = getMatchesBySeason(currentSeason).filter(m => m.finalScore);
        if (playedMatches.length === 0) {
            if (!confirm(`⚠️ Aucun match joué n'est chargé pour la saison "${currentSeason}".\n\nLe report d'Elo repartirait de 1500 pour toutes les équipes.\nVérifie ta connexion (et désactive un éventuel bloqueur de pub), puis réessaie.\n\nCréer quand même la saison avec des Elo à 1500 ?`)) {
                return;
            }
        }
    }

    // Créer la nouvelle saison
    const success = createNewSeason(newSeasonName, resetElo);
    
    if (success) {
        // Fermer la popup
        document.body.removeChild(overlay);
        
        // Message de succès
        const eloMessage = resetElo
            ? 'Tous les ratings Elo ont été remis à 1500.'
            : 'Les Elo de fin de saison ont été reportés comme Elo de départ de la nouvelle saison.';
        
        showMessage(`🎉 Nouvelle saison "${newSeasonName}" créée avec succès !\n\n${eloMessage}`, 'success');
        
        // Recharger les données affichées
        if (typeof displayTeams === 'function') {
            displayTeams();
        }
        if (typeof loadAdminData === 'function') {
            loadAdminData();
        }
        
        console.log(`✅ Nouvelle saison : ${newSeasonName}`);
        console.log(`📊 Elo ${resetElo ? 'réinitialisés' : 'conservés'}`);
    } else {
        alert('❌ Erreur lors de la création de la nouvelle saison');
    }
}