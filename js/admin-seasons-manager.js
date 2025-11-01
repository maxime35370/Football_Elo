// admin-seasons-manager.js - Gestion des saisons dans l'admin

// Afficher la liste des saisons
function displaySeasonsList() {
    const seasons = getSeasonsOrderedByDate();
    const seasonsList = document.getElementById('seasonsListAdmin');
    
    if (!seasonsList) return;
    
    if (seasons.length === 0) {
        seasonsList.innerHTML = '<p style="text-align: center; color: #7f8c8d;">Aucune saison créée</p>';
        return;
    }
    
    seasonsList.innerHTML = '';
    
    seasons.forEach(season => {
        const seasonCard = createSeasonAdminCard(season);
        seasonsList.appendChild(seasonCard);
    });
}

// Créer une carte de saison pour l'admin
function createSeasonAdminCard(season) {
    const card = document.createElement('div');
    card.className = 'season-admin-card';
    card.style.cssText = `
        background: white;
        border: 2px solid ${season.isActive ? '#27ae60' : '#e9ecef'};
        border-radius: 10px;
        padding: 1.5rem;
        margin-bottom: 1rem;
        transition: all 0.3s ease;
    `;
    
    const teams = getTeamsBySeason(season.name);
    const matches = getMatchesBySeason(season.name);
    
    const startDate = new Date(season.startDate).toLocaleDateString('fr-FR');
    const endDate = season.endDate ? new Date(season.endDate).toLocaleDateString('fr-FR') : 'En cours';
    
    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
            <div>
                <h4 style="margin: 0; color: #2c3e50; font-size: 1.3rem;">
                    ${season.name}
                    ${season.isActive ? '<span style="background: #27ae60; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.8rem; margin-left: 0.5rem;">ACTIVE</span>' : ''}
                </h4>
                <p style="margin: 0.5rem 0 0 0; color: #7f8c8d; font-size: 0.9rem;">
                    ${startDate} → ${endDate}
                </p>
            </div>
            ${!season.isActive ? `
            <button 
                onclick="activateSeason('${season.name}')"
                style="background: #3498db; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer; font-weight: 600;"
            >
                🟢 Activer
            </button>
            ` : '<span style="color: #27ae60; font-weight: 600;">● Saison en cours</span>'}
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 1rem 0; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
            <div style="text-align: center;">
                <div style="font-size: 1.5rem; color: #3498db; font-weight: bold;">${teams.length}</div>
                <div style="color: #7f8c8d; font-size: 0.85rem;">Équipes</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 1.5rem; color: #e74c3c; font-weight: bold;">${matches.length}</div>
                <div style="color: #7f8c8d; font-size: 0.85rem;">Matchs</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 1.5rem; color: #9b59b6; font-weight: bold;">${season.teamIds ? season.teamIds.length : 0}</div>
                <div style="color: #7f8c8d; font-size: 0.85rem;">Participants</div>
            </div>
        </div>
        
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button 
                onclick="showEditSeasonDialog('${season.name}')"
                style="background: #f39c12; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer; font-weight: 600; flex: 1; min-width: 120px;"
            >
                ✏️ Modifier
            </button>
            ${!season.isActive ? `
            <button 
                onclick="confirmDeleteSeason('${season.name}')"
                style="background: #e74c3c; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer; font-weight: 600; flex: 1; min-width: 120px;"
            >
                🗑️ Supprimer
            </button>
            ` : `
            <button 
                disabled
                style="background: #bdc3c7; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: not-allowed; flex: 1; min-width: 120px;"
                title="Impossible de supprimer la saison active"
            >
                🗑️ Supprimer
            </button>
            `}
        </div>
    `;
    
    return card;
}

// Activer une saison
function activateSeason(seasonName) {
    if (confirm(`Voulez-vous activer la saison "${seasonName}" ?\n\nCela désactivera la saison actuelle et permettra d'ajouter des matchs dans cette saison.`)) {
        if (setCurrentSeason(seasonName)) {
            showMessage(`Saison "${seasonName}" activée !`, 'success');
            displaySeasonsList();
            if (typeof loadAdminData === 'function') {
                loadAdminData();
            }
        } else {
            showMessage('Erreur lors de l\'activation', 'error');
        }
    }
}

// Confirmer la suppression d'une saison
function confirmDeleteSeason(seasonName) {
    const matches = getMatchesBySeason(seasonName);
    
    let message = `⚠️ ATTENTION ⚠️\n\n`;
    message += `Voulez-vous supprimer la saison "${seasonName}" ?\n\n`;
    message += `Cela supprimera :\n`;
    message += `• ${matches.length} match(s) de cette saison\n\n`;
    message += `Les équipes seront conservées.\n\n`;
    message += `Cette action est IRRÉVERSIBLE !`;
    
    if (confirm(message)) {
        if (deleteSeason(seasonName)) {
            showMessage(`Saison "${seasonName}" supprimée avec succès`, 'success');
            displaySeasonsList();
            if (typeof loadAdminData === 'function') {
                loadAdminData();
            }
        } else {
            showMessage('Erreur lors de la suppression', 'error');
        }
    }
}

// Afficher le dialog d'édition de saison
function showEditSeasonDialog(seasonName) {
    const seasons = getStoredSeasons();
    const season = seasons.find(s => s.name === seasonName);
    
    if (!season) {
        showMessage('Saison introuvable', 'error');
        return;
    }
    
    const allTeams = getStoredTeams();
    const seasonTeamIds = season.teamIds || [];
    
    // Créer l'overlay
    const overlay = document.createElement('div');
    overlay.id = 'editSeasonOverlay';
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
        overflow-y: auto;
        padding: 2rem;
    `;
    
    // Créer la popup
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 2rem;
        max-width: 600px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `;
    
    // Liste des équipes avec checkboxes
    let teamsCheckboxes = '';
    allTeams.forEach(team => {
        const isChecked = seasonTeamIds.includes(team.id);
        teamsCheckboxes += `
            <label style="display: flex; align-items: center; padding: 0.8rem; background: ${isChecked ? '#e8f5e8' : '#f8f9fa'}; border: 2px solid ${isChecked ? '#27ae60' : '#e9ecef'}; border-radius: 8px; cursor: pointer; margin-bottom: 0.5rem;">
                <input 
                    type="checkbox" 
                    name="teamSelect" 
                    value="${team.id}"
                    ${isChecked ? 'checked' : ''}
                    style="margin-right: 0.8rem; width: 20px; height: 20px; cursor: pointer;"
                    onchange="this.parentElement.style.background = this.checked ? '#e8f5e8' : '#f8f9fa'; this.parentElement.style.borderColor = this.checked ? '#27ae60' : '#e9ecef';"
                >
                <div style="flex: 1;">
                    <strong>${team.shortName}</strong> - ${team.name}
                </div>
            </label>
        `;
    });
    
    popup.innerHTML = `
        <h2 style="color: #2c3e50; margin-bottom: 1.5rem; text-align: center;">
            ✏️ Modifier la saison ${seasonName}
        </h2>
        
        <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; color: #2c3e50; font-weight: 600;">
                Nom de la saison :
            </label>
            <input 
                type="text" 
                id="editSeasonName" 
                value="${seasonName}"
                style="width: 100%; padding: 0.8rem; border: 2px solid #e9ecef; border-radius: 5px; font-size: 1rem;"
            >
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label style="color: #2c3e50; font-weight: 600;">
                    Équipes participantes :
                </label>
                <div>
                    <button onclick="selectAllTeams()" type="button" style="background: #3498db; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 3px; cursor: pointer; font-size: 0.8rem; margin-right: 0.25rem;">Tout sélectionner</button>
                    <button onclick="deselectAllTeams()" type="button" style="background: #95a5a6; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 3px; cursor: pointer; font-size: 0.8rem;">Tout désélectionner</button>
                </div>
            </div>
            <div id="teamsCheckboxContainer" style="max-height: 300px; overflow-y: auto; border: 2px solid #e9ecef; border-radius: 8px; padding: 1rem;">
                ${teamsCheckboxes}
            </div>
            <small style="color: #6c757d; display: block; margin-top: 0.5rem;">
                Sélectionnez les équipes qui participeront à cette saison
            </small>
        </div>
        
        <div style="display: flex; gap: 1rem; justify-content: center;">
            <button 
                onclick="document.body.removeChild(document.getElementById('editSeasonOverlay'))"
                style="padding: 0.8rem 1.5rem; background: #95a5a6; color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: 600; font-size: 1rem;"
            >
                ❌ Annuler
            </button>
            <button 
                onclick="saveSeasonEdition('${seasonName}')"
                style="padding: 0.8rem 1.5rem; background: linear-gradient(45deg, #27ae60, #2ecc71); color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: 600; font-size: 1rem;"
            >
                💾 Enregistrer
            </button>
        </div>
    `;
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

// Sélectionner toutes les équipes
function selectAllTeams() {
    const checkboxes = document.querySelectorAll('input[name="teamSelect"]');
    checkboxes.forEach(cb => {
        cb.checked = true;
        cb.parentElement.style.background = '#e8f5e8';
        cb.parentElement.style.borderColor = '#27ae60';
    });
}

// Désélectionner toutes les équipes
function deselectAllTeams() {
    const checkboxes = document.querySelectorAll('input[name="teamSelect"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
        cb.parentElement.style.background = '#f8f9fa';
        cb.parentElement.style.borderColor = '#e9ecef';
    });
}

// Sauvegarder l'édition de saison
function saveSeasonEdition(oldSeasonName) {
    const newSeasonName = document.getElementById('editSeasonName').value.trim();
    const checkboxes = document.querySelectorAll('input[name="teamSelect"]:checked');
    const selectedTeamIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    // Validation
    if (!newSeasonName) {
        alert('⚠️ Le nom de saison est obligatoire');
        return;
    }
    
    if (selectedTeamIds.length === 0) {
        alert('⚠️ Vous devez sélectionner au moins une équipe');
        return;
    }
    
    // Vérifier si le nom a changé et qu'il n'existe pas déjà
    if (newSeasonName !== oldSeasonName) {
        const seasons = getStoredSeasons();
        if (seasons.some(s => s.name === newSeasonName)) {
            alert('⚠️ Une saison avec ce nom existe déjà');
            return;
        }
    }
    
    // Mettre à jour
    const updates = {
        name: newSeasonName,
        teamIds: selectedTeamIds
    };
    
    // Si le nom change, il faut aussi mettre à jour les matchs
    if (newSeasonName !== oldSeasonName) {
        const matches = getStoredMatches();
        matches.forEach(match => {
            if (match.season === oldSeasonName) {
                match.season = newSeasonName;
            }
        });
        localStorage.setItem('footballEloMatches', JSON.stringify(matches));
    }
    
    if (updateSeason(oldSeasonName, updates)) {
        // Si c'était la saison active, mettre à jour
        if (getCurrentSeason() === oldSeasonName) {
            setCurrentSeason(newSeasonName);
        }
        
        showMessage('Saison modifiée avec succès !', 'success');
        document.body.removeChild(document.getElementById('editSeasonOverlay'));
        displaySeasonsList();
    } else {
        showMessage('Erreur lors de la modification', 'error');
    }
}