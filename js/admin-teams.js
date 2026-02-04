// admin-teams.js - Logique d'administration des équipes
//const TEAMS_STORAGE_KEY = 'footballEloTeams'; // AJOUTE CETTE LIGNE
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

    // Configuration de saison
    document.getElementById('configSeasonBtn').addEventListener('click', showSeasonConfigSection);
    document.getElementById('seasonConfigForm').addEventListener('submit', handleSeasonConfigSubmit);
    document.getElementById('cancelSeasonBtn').addEventListener('click', hideSeasonConfigSection);
}

// Charger les données pour l'admin
function loadAdminData() {
    const teams = getStoredTeams();
    const matches = getStoredMatches();
    
    // Mettre à jour les statistiques
    document.getElementById('teamCount').textContent = `${teams.length} équipe${teams.length > 1 ? 's' : ''}`;
    document.getElementById('matchCount').textContent = `${matches.length} match${matches.length > 1 ? 's' : ''}`;

    // Afficher les saisons
    if (typeof displaySeasonsList === 'function') {
        displaySeasonsList();
    }
}

// Récupérer les équipes stockées
function getStoredTeams() {
    try {
        const stored = localStorage.getItem('footballEloTeams');
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Erreur lors de la récupération des équipes:', error);
        return [];
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
        if (typeof firebaseService !== 'undefined') {
            firebaseService.saveTeams(teams);
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
    // Enlève cette ligne si elle existe : hideSeasonConfigSection();
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
    const teamMatches = matches.filter(match => 
        match.homeTeamId == teamId || match.awayTeamId == teamId
    );
    
    if (teamMatches.length > 0) {
        let confirmMessage = `L'équipe "${team.name}" a ${teamMatches.length} match(s) en historique.\n\n`;
        confirmMessage += 'Que voulez-vous faire ?\n\n';
        confirmMessage += 'OK = Supprimer l\'équipe ET tous ses matchs\n';
        confirmMessage += 'Annuler = Garder l\'équipe';
        
        if (confirm(confirmMessage)) {
            // Supprimer l'équipe ET ses matchs
            const filteredTeams = teams.filter(t => t.id !== teamId);
            const filteredMatches = matches.filter(match => 
                match.homeTeamId != teamId && match.awayTeamId != teamId
            );
            
            // Sauvegarder les deux
            if (saveTeams(filteredTeams) && saveFilteredMatches(filteredMatches)) {
                showMessage(`Équipe et ses ${teamMatches.length} matchs supprimés`, 'success');
                displayTeams();
                loadAdminData();
            }
        }
    } else {
        // Pas de matchs, suppression simple
        if (confirm(`Supprimer "${team.name}" ?`)) {
            const filteredTeams = teams.filter(t => t.id !== teamId);
            if (saveTeams(filteredTeams)) {
                showMessage('Équipe supprimée avec succès', 'success');
                displayTeams();
                loadAdminData();
            }
        }
    }
}

// Réinitialiser la saison
function handleResetSeason() {
    // La nouvelle logique est maintenant dans new-season-handler.js
    // Cette fonction appelle directement la nouvelle popup
    const currentSeason = getCurrentSeason();
    const teams = getStoredTeams();
    const matches = getStoredMatches();
    const currentSeasonMatches = getMatchesBySeason(currentSeason);
    
    showNewSeasonDialog(currentSeason, teams.length, currentSeasonMatches.length);
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
    hideSeasonConfigSection();
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

// Fonction helper pour sauvegarder les matchs filtrés
function saveFilteredMatches(matches) {
    try {
        localStorage.setItem('footballEloMatches', JSON.stringify(matches));
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde matchs:', error);
        return false;
    }
}

// === GESTION DE LA CONFIGURATION DE SAISON ===

// Configuration par défaut
function getDefaultSeasonConfig() {
    return {
        championPlaces: 1,
        europeanPlaces: 3,
        relegationPlaces: 2,
        seasonName: "2024-2025"
    };
}

// Vérifier si l'utilisateur est admin
async function checkIfUserIsAdmin(email) {
    // Liste des emails admin (à adapter selon ton système)
    const adminEmails = [
        'maxime.theard@gmail.com' // Ton email admin
        // Ajouter d'autres admins si nécessaire
    ];
    
    // Vérification simple par email
    if (adminEmails.includes(email)) {
        return true;
    }
    
    // Optionnel: vérifier dans Firebase si tu as une collection 'admins'
    try {
        const adminDoc = await db.collection('admins').doc(email).get();
        return adminDoc.exists;
    } catch (error) {
        // Si la collection n'existe pas, utiliser seulement la liste
        return false;
    }
}

// =====================================================
// SAUVEGARDER LA CONFIG DANS FIREBASE (admin only)
// =====================================================
async function saveSeasonConfigToFirebase(config) {
    try {
        // Vérifier que l'utilisateur est admin
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('Vous devez être connecté');
        }
        
        // Vérifier le statut admin
        const isAdmin = await checkIfUserIsAdmin(user.email);
        if (!isAdmin) {
            throw new Error('Seuls les administrateurs peuvent modifier la configuration');
        }
        
        // Ajouter des métadonnées
        const configWithMeta = {
            ...config,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: user.email
        };
        
        // Sauvegarder dans Firebase
        await db.collection('settings').doc('seasonConfig').set(configWithMeta);
        
        // Mettre à jour le cache local
        localStorage.setItem('footballEloSeasonConfig', JSON.stringify(config));
        
        console.log('✅ Config saison sauvegardée dans Firebase');
        return true;
    } catch (error) {
        console.error('❌ Erreur sauvegarde config Firebase:', error);
        throw error;
    }
}

// Charger la config depuis Firebase et mettre en cache local
async function loadSeasonConfigFromFirebase() {
    try {
        const config = await getSeasonConfigFromFirebase();
        // Mettre en cache local pour les accès synchrones
        localStorage.setItem('footballEloSeasonConfig', JSON.stringify(config));
        console.log('✅ Config saison chargée depuis Firebase:', config);
        return config;
    } catch (error) {
        console.error('Erreur chargement config Firebase:', error);
        return getSeasonConfig(); // Fallback sur le cache local
    }
}

async function getSeasonConfigFromFirebase() {
    try {
        const doc = await db.collection('settings').doc('seasonConfig').get();
        if (doc.exists) {
            return doc.data();
        }
        return getDefaultSeasonConfig();
    } catch (error) {
        console.error('Erreur récupération config Firebase:', error);
        return getDefaultSeasonConfig();
    }
}

// Version synchrone qui utilise le cache local (pour compatibilité)
function getSeasonConfig() {
    try {
        // D'abord essayer le cache local
        const cached = localStorage.getItem('footballEloSeasonConfig');
        if (cached) {
            return JSON.parse(cached);
        }
        return getDefaultSeasonConfig();
    } catch (error) {
        console.error('Erreur récupération config saison:', error);
        return getDefaultSeasonConfig();
    }
}

// Sauvegarder la configuration de saison
function saveSeasonConfig(config) {
    try {
        localStorage.setItem('footballEloSeasonConfig', JSON.stringify(config));
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde config saison:', error);
        return false;
    }
}

// Afficher la section de configuration
async function showSeasonConfigSection() {
    console.log('showSeasonConfigSection appelée');
    
    // Vérifier que l'utilisateur est admin
    const user = firebase.auth().currentUser;
    if (!user) {
        showMessage('Vous devez être connecté pour accéder à cette section', 'error');
        return;
    }
    
    const isAdmin = await checkIfUserIsAdmin(user.email);
    if (!isAdmin) {
        showMessage('⛔ Accès réservé aux administrateurs', 'error');
        return;
    }
    
    document.getElementById('seasonConfigSection').style.display = 'block';
    hideTeamForm();
    hideImportSection();
    
    // Charger la configuration depuis Firebase
    try {
        const config = await loadSeasonConfigFromFirebase();
        document.getElementById('championPlaces').value = config.championPlaces;
        document.getElementById('europeanPlaces').value = config.europeanPlaces;
        document.getElementById('relegationPlaces').value = config.relegationPlaces;
        document.getElementById('seasonName').value = config.seasonName;
    } catch (error) {
        console.error('Erreur chargement config:', error);
        // Utiliser les valeurs par défaut
        const config = getDefaultSeasonConfig();
        document.getElementById('championPlaces').value = config.championPlaces;
        document.getElementById('europeanPlaces').value = config.europeanPlaces;
        document.getElementById('relegationPlaces').value = config.relegationPlaces;
        document.getElementById('seasonName').value = config.seasonName;
    }
}

function hideSeasonConfigSection() {
    document.getElementById('seasonConfigSection').style.display = 'none';
}

// Gérer la soumission de la configuration
async function handleSeasonConfigSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const config = {
        championPlaces: parseInt(formData.get('championPlaces')),
        europeanPlaces: parseInt(formData.get('europeanPlaces')),
        relegationPlaces: parseInt(formData.get('relegationPlaces')),
        seasonName: formData.get('seasonName').trim()
    };
    
    // Validation
    if (!validateSeasonConfig(config)) {
        return;
    }
    
    // Désactiver le bouton pendant la sauvegarde
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Sauvegarde...';
    
    try {
        await saveSeasonConfigToFirebase(config);
        showMessage('✅ Configuration de saison sauvegardée pour tous les utilisateurs !', 'success');
        hideSeasonConfigSection();
    } catch (error) {
        showMessage(`❌ Erreur: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Valider la configuration de saison
function validateSeasonConfig(config) {
    // Récupérer les équipes depuis localStorage avec la bonne clé
    let teams = [];
    try {
        const stored = localStorage.getItem('footballEloTeams');
        teams = stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Erreur récupération équipes:', error);
    }
    
    const totalTeams = teams.length;
    
    // Si aucune équipe n'est trouvée, utiliser un minimum raisonnable
    const effectiveTeams = totalTeams > 0 ? totalTeams : 18;
    
    if (config.championPlaces < 1) {
        showMessage('Il doit y avoir au moins 1 place de champion', 'error');
        return false;
    }
    
    if (config.europeanPlaces < config.championPlaces) {
        showMessage('Les places européennes doivent inclure le champion', 'error');
        return false;
    }
    
    if (config.europeanPlaces + config.relegationPlaces >= effectiveTeams) {
        showMessage(`Trop de places spéciales (${config.europeanPlaces} + ${config.relegationPlaces} = ${config.europeanPlaces + config.relegationPlaces}) pour ${effectiveTeams} équipes`, 'error');
        return false;
    }
    
    if (!config.seasonName || config.seasonName.length < 2) {
        showMessage('Le nom de saison doit faire au moins 2 caractères', 'error');
        return false;
    }
    
    return true;
}

// Appeler cette fonction au chargement de la page
async function initSeasonConfig() {
    try {
        await loadSeasonConfigFromFirebase();
        console.log('✅ Configuration de saison initialisée');
    } catch (error) {
        console.warn('⚠️ Utilisation de la config locale:', error);
    }
}
