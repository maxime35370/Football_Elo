// admin-teams.js - Logique d'administration des équipes

const TEAMS_STORAGE_KEY = 'footballEloTeams';
let currentEditingTeamId = null;

// Initialisation de la page
document.addEventListener('DOMContentLoaded', function() {
    loadAdminData();
    setupEventListeners();
    displayTeams();
});

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Boutons d'action
    document.getElementById('addTeamBtn').addEventListener('click', showAddTeamForm);
    document.getElementById('resetSeasonBtn').addEventListener('click', handleResetSeason);
    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    document.getElementById('importDataBtn').addEventListener('click', showImportSection);
    
    // Formulaire d'équipe
    document.getElementById('teamForm').addEventListener('submit', handleTeamSubmit);
    document.getElementById('cancelBtn').addEventListener('click', hideTeamForm);
    
    // Import
    document.getElementById('processImportBtn').addEventListener('click', processCSVImport);
    document.getElementById('cancelImportBtn').addEventListener('click', hideImportSection);
}

// Charger les données pour l'admin
function loadAdminData() {
    const teams = getStoredTeams();
    const matches = getStoredMatches();
    
    // Mettre à jour les statistiques
    document.getElementById('teamCount').textContent = `${teams.length} équipe${teams.length > 1 ? 's' : ''}`;
    document.getElementById('matchCount').textContent = `${matches.length} match${matches.length > 1 ? 's' : ''}`;
}

// Récupérer les équipes stockées
function getStoredTeams() {
    try {
        const stored = localStorage.getItem(TEAMS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : getDefaultTeams();
    } catch (error) {
        console.error('Erreur lors de la récupération des équipes:', error);
        return getDefaultTeams();
    }
}

// Équipes par défaut si aucune n'est stockée
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

// Sauvegarder les équipes
function saveTeams(teams) {
    try {
        localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
        // Mettre à jour aussi teamsData pour les autres scripts
        if (typeof window.teamsData !== 'undefined') {
            window.teamsData = teams;
        }
        return true;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        return false;
    }
}

// Afficher le formulaire d'ajout d'équipe
function showAddTeamForm() {
    currentEditingTeamId = null;
    document.getElementById('formTitle').textContent = '➕ Ajouter une nouvelle équipe';
    document.getElementById('submitBtn').textContent = '💾 Ajouter';
    document.getElementById('teamForm').reset();
    document.getElementById('teamElo').value = 1500; // Valeur par défaut
    document.getElementById('teamFormSection').style.display = 'block';
    document.getElementById('teamName').focus();
    
    // Masquer les autres sections
    hideImportSection();
}

// Afficher le formulaire de modification d'équipe
function showEditTeamForm(teamId) {
    const teams = getStoredTeams();
    const team = teams.find(t => t.id === teamId);
    
    if (!team) {
        showMessage('Équipe introuvable', 'error');
        return;
    }
    
    currentEditingTeamId = teamId;
    document.getElementById('formTitle').textContent = '✏️ Modifier l\'équipe';
    document.getElementById('submitBtn').textContent = '💾 Modifier';
    
    // Remplir le formulaire
    document.getElementById('teamId').value = team.id;
    document.getElementById('teamName').value = team.name;
    document.getElementById('teamShortName').value = team.shortName;
    document.getElementById('teamCity').value = team.city;
    document.getElementById('teamElo').value = team.eloRating;
    
    document.getElementById('teamFormSection').style.display = 'block';
    document.getElementById('teamName').focus();
    
    // Masquer les autres sections
    hideImportSection();
}

// Masquer le formulaire d'équipe
function hideTeamForm() {
    document.getElementById('teamFormSection').style.display = 'none';
    currentEditingTeamId = null;
}

// Gérer la soumission du formulaire d'équipe
function handleTeamSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const teamData = {
        name: formData.get('teamName').trim(),
        shortName: formData.get('teamShortName').trim().toUpperCase(),
        city: formData.get('teamCity').trim(),
        eloRating: parseInt(formData.get('teamElo'))
    };
    
    // Validation
    if (!validateTeamData(teamData)) {
        return;
    }
    
    const teams = getStoredTeams();
    
    if (currentEditingTeamId) {
        // Modification
        const teamIndex = teams.findIndex(t => t.id === currentEditingTeamId);
        if (teamIndex !== -1) {
            teams[teamIndex] = { ...teams[teamIndex], ...teamData };
            if (saveTeams(teams)) {
                showMessage('Équipe modifiée avec succès !', 'success');
                hideTeamForm();
                displayTeams();
                loadAdminData();
            }
        }
    } else {
        // Ajout
        const newId = Math.max(...teams.map(t => t.id), 0) + 1;
        teamData.id = newId;
        teams.push(teamData);
        
        if (saveTeams(teams)) {
            showMessage('Équipe ajoutée avec succès !', 'success');
            hideTeamForm();
            displayTeams();
            loadAdminData();
        }
    }
}

// Valider les données d'équipe
function validateTeamData(teamData) {
    const teams = getStoredTeams();
    
    // Vérifications de base
    if (!teamData.name || teamData.name.length < 2) {
        showMessage('Le nom de l\'équipe doit faire au moins 2 caractères', 'error');
        return false;
    }
    
    if (!teamData.shortName || teamData.shortName.length < 2) {
        showMessage('Le nom court doit faire au moins 2 caractères', 'error');
        return false;
    }
    
    if (!teamData.city || teamData.city.length < 2) {
        showMessage('La ville doit faire au moins 2 caractères', 'error');
        return false;
    }
    
    if (teamData.eloRating < 1000 || teamData.eloRating > 2500) {
        showMessage('Le rating Elo doit être entre 1000 et 2500', 'error');
        return false;
    }
    
    // Vérifier les doublons (sauf si on modifie)
    const existingTeam = teams.find(t => 
        t.id !== currentEditingTeamId && 
        (t.name.toLowerCase() === teamData.name.toLowerCase() || 
         t.shortName.toLowerCase() === teamData.shortName.toLowerCase())
    );
    
    if (existingTeam) {
        showMessage('Une équipe avec ce nom ou ce nom court existe déjà', 'error');
        return false;
    }
    
    return true;
}

// Afficher les équipes
function displayTeams() {
    const teams = getStoredTeams();
    const teamsList = document.getElementById('teamsList');
    const noTeamsMessage = document.getElementById('noTeamsMessage');
    
    if (teams.length === 0) {
        teamsList.style.display = 'none';
        noTeamsMessage.style.display = 'block';
        return;
    }
    
    teamsList.style.display = 'grid';
    noTeamsMessage.style.display = 'none';
    
    teamsList.innerHTML = '';
    
    teams.forEach(team => {
        const teamCard = createTeamCard(team);
        teamsList.appendChild(teamCard);
    });
}

// Créer une carte d'équipe
function createTeamCard(team) {
    const card = document.createElement('div');
    card.className = 'team-card';
    card.innerHTML = `
        <div class="team-header">
            <div class="team-name">${team.name}</div>
            <div class="team-short">${team.shortName}</div>
        </div>
        <div class="team-info">
            <div>📍 ${team.city}</div>
            <div>🎯 Elo: ${team.eloRating}</div>
        </div>
        <div class="team-actions">
            <button class="btn btn-info btn-small" onclick="showEditTeamForm(${team.id})">✏️ Modifier</button>
            <button class="btn btn-danger btn-small" onclick="deleteTeam(${team.id})">🗑️ Supprimer</button>
        </div>
    `;
    return card;
}

// Supprimer une équipe
function deleteTeam(teamId) {
    const teams = getStoredTeams();
    const team = teams.find(t => t.id === teamId);
    
    if (!team) {
        showMessage('Équipe introuvable', 'error');
        return;
    }
    
    // Vérifier si l'équipe a des matchs
    const matches = getStoredMatches();
    const hasMatches = matches.some(match => 
        match.homeTeamId == teamId || match.awayTeamId == teamId
    );
    
    let confirmMessage = `Êtes-vous sûr de vouloir supprimer "${team.name}" ?`;
    if (hasMatches) {
        confirmMessage += '\n\n⚠️ ATTENTION: Cette équipe a des matchs enregistrés. Les supprimer causera des erreurs dans l\'historique.';
    }
    
    if (confirm(confirmMessage)) {
        const filteredTeams = teams.filter(t => t.id !== teamId);
        if (saveTeams(filteredTeams)) {
            showMessage('Équipe supprimée avec succès', 'success');
            displayTeams();
            loadAdminData();
            
            if (hasMatches) {
                showMessage('⚠️ Attention: Cette équipe avait des matchs. Vérifiez l\'historique.', 'warning');
            }
        }
    }
}

// Réinitialiser la saison
function handleResetSeason() {
    const teams = getStoredTeams();
    const matches = getStoredMatches();
    
    let message = 'Êtes-vous sûr de vouloir démarrer une nouvelle saison ?\n\n';
    message += 'Cela va :\n';
    message += '• Remettre tous les ratings Elo à 1500\n';
    message += `• Supprimer les ${matches.length} matchs existants\n`;
    message += '• Conserver la liste des équipes\n\n';
    message += 'Cette action est irréversible !';
    
    if (confirm(message)) {
        // Reset des ratings Elo
        teams.forEach(team => {
            team.eloRating = 1500;
        });
        
        // Sauvegarder les équipes
        saveTeams(teams);
        
        // Vider les matchs
        clearAllMatches();
        
        // Recharger l'affichage
        displayTeams();
        loadAdminData();
        
        showMessage('🎉 Nouvelle saison démarrée ! Tous les ratings ont été remis à 1500.', 'success');
    }
}

// Exporter les données
function exportData() {
    const teams = getStoredTeams();
    const matches = getStoredMatches();
    
    const exportData = {
        teams: teams,
        matches: matches,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `football-elo-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showMessage('Données exportées avec succès !', 'success');
}

// Afficher la section d'import
function showImportSection() {
    document.getElementById('importSection').style.display = 'block';
    hideTeamForm();
}

// Masquer la section d'import
function hideImportSection() {
    document.getElementById('importSection').style.display = 'none';
    document.getElementById('csvFileInput').value = '';
    document.getElementById('importPreview').innerHTML = '';
}

// Traiter l'import CSV
function processCSVImport() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('Veuillez sélectionner un fichier CSV', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const csv = e.target.result;
        parseCSVAndImport(csv);
    };
    reader.readAsText(file);
}

// Parser le CSV et importer
function parseCSVAndImport(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const importedTeams = [];
    const errors = [];
    
    lines.forEach((line, index) => {
        const [name, shortName, city, eloRating] = line.split(',').map(item => item.trim());
        
        if (name && shortName && city) {
            importedTeams.push({
                name: name,
                shortName: shortName.toUpperCase(),
                city: city,
                eloRating: parseInt(eloRating) || 1500
            });
        } else {
            errors.push(`Ligne ${index + 1}: données incomplètes`);
        }
    });
    
    if (errors.length > 0) {
        showMessage(`Erreurs détectées :\n${errors.join('\n')}`, 'error');
        return;
    }
    
    if (importedTeams.length === 0) {
        showMessage('Aucune équipe valide trouvée dans le fichier', 'error');
        return;
    }
    
    // Prévisualisation
    let preview = `${importedTeams.length} équipes à importer :\n\n`;
    importedTeams.forEach(team => {
        preview += `• ${team.name} (${team.shortName}) - ${team.city} - Elo: ${team.eloRating}\n`;
    });
    
    if (confirm(preview + '\nConfirmer l\'import ?')) {
        // Remplacer toutes les équipes
        const newTeams = importedTeams.map((team, index) => ({
            id: index + 1,
            ...team
        }));
        
        if (saveTeams(newTeams)) {
            showMessage(`${newTeams.length} équipes importées avec succès !`, 'success');
            hideImportSection();
            displayTeams();
            loadAdminData();
        }
    }
}

// Afficher un message
function showMessage(text, type = 'info') {
    // Supprimer les messages existants
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    
    const container = document.querySelector('.admin-container');
    container.insertBefore(messageDiv, container.firstChild);
    
    // Scroll vers le haut pour voir le message
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Supprimer après 5 secondes
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}