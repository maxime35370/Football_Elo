// teams-loader.js - Charge les équipes depuis le système d'administration

let teamsData = [];
//const TEAMS_STORAGE_KEY = 'footballEloTeams';

// Fonction pour charger les équipes depuis le stockage admin
function loadTeams() {
    try {
        teamsData = getCurrentSeasonTeams(); // ← MODIFIER CETTE LIGNE
        populateTeamSelects();
        console.log('Équipes chargées avec succès:', teamsData.length, 'équipes');
    } catch (error) {
        console.error('Erreur lors du chargement des équipes:', error);
        teamsData = getDefaultTeams();
        populateTeamSelects();
        updateMatchDayLimits(); // Ajouter cette ligne
        showError('Erreur lors du chargement des équipes');
    }
}
// Équipes par défaut (compatibilité)
function getDefaultTeams() {
    return [
        { id: 1, name: "Paris Saint-Germain", shortName: "PSG", city: "Paris", eloRating: 1500 },
        { id: 2, name: "AS Monaco", shortName: "ASM", city: "Monaco", eloRating: 1500 },
        { id: 3, name: "Olympique Lyonnais", shortName: "OL", city: "Lyon", eloRating: 1500 },
        { id: 4, name: "RC Strasbourg", shortName: "RCS", city: "Strasbourg", eloRating: 1500 },
        { id: 5, name: "Lille OSC", shortName: "LOSC", city: "Lille", eloRating: 1500 },
        { id: 6, name: "RC Lens", shortName: "RCL", city: "Lens", eloRating: 1500 },
        { id: 7, name: "Stade Rennais", shortName: "SRFC", city: "Rennes", eloRating: 1500 },
        { id: 8, name: "Olympique de Marseille", shortName: "OM", city: "Marseille", eloRating: 1500 },
        { id: 9, name: "Toulouse FC", shortName: "TFC", city: "Toulouse", eloRating: 1500 },
        { id: 10, name: "AJ Auxerre", shortName: "AJA", city: "Auxerre", eloRating: 1500 },
        { id: 11, name: "Paris FC", shortName: "PFC", city: "Paris", eloRating: 1500 },
        { id: 12, name: "OGC Nice", shortName: "OGCN", city: "Nice", eloRating: 1500 },
        { id: 13, name: "Angers SCO", shortName: "SCO", city: "Angers", eloRating: 1500 },
        { id: 14, name: "Stade Brestois 29", shortName: "SB29", city: "Brest", eloRating: 1500 },
        { id: 15, name: "Havre AC", shortName: "HAC", city: "Havre", eloRating: 1500 },
        { id: 16, name: "FC Nantes", shortName: "FCN", city: "Nantes", eloRating: 1500 },
        { id: 17, name: "FC Lorient", shortName: "FCL", city: "Lorient", eloRating: 1500 },
        { id: 18, name: "FC Metz", shortName: "FCM", city: "Metz", eloRating: 1500 }
    ];
}

// Fonction pour remplir les selects avec les équipes
function populateTeamSelects() {
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    
    // AJOUTE CETTE VÉRIFICATION :
    if (!homeTeamSelect || !awayTeamSelect) {
        console.log('Éléments select non trouvés - probablement pas sur la page de match');
        return; // Sortir de la fonction si les éléments n'existent pas
    }

    // Vider les selects d'abord
    homeTeamSelect.innerHTML = '<option value="">Sélectionner une équipe</option>';
    awayTeamSelect.innerHTML = '<option value="">Sélectionner une équipe</option>';

    // Ajouter chaque équipe aux deux selects
    teamsData.forEach(team => {
        const homeOption = document.createElement('option');
        homeOption.value = team.id;
        homeOption.textContent = `${team.name} (${team.shortName})`;
        homeTeamSelect.appendChild(homeOption);

        const awayOption = document.createElement('option');
        awayOption.value = team.id;
        awayOption.textContent = `${team.name} (${team.shortName})`;
        awayTeamSelect.appendChild(awayOption);
    });
}

// Mettre à jour les limites de journée selon le nombre d'équipes
function updateMatchDayLimits() {
    const matchDayInput = document.getElementById('matchDay');
    const matchDayHelper = document.getElementById('matchDayHelper');
    
    if (matchDayInput && teamsData.length > 0) {
        const maxMatchDays = (teamsData.length * 2) - 2;
        matchDayInput.max = maxMatchDays;
        
        if (matchDayHelper) {
            matchDayHelper.textContent = `Numéro de la journée de championnat (1 à ${maxMatchDays})`;
        }
    }
}

// Fonction pour éviter qu'une équipe joue contre elle-même
function setupTeamValidation() {
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    
    if (!homeTeamSelect || !awayTeamSelect) return; // AJOUTE CETTE LIGNE
    
    homeTeamSelect.addEventListener('change', function() {
        validateTeamSelection();
    });

    awayTeamSelect.addEventListener('change', function() {
        validateTeamSelection();
    });
}

// Fonction pour valider que les équipes sont différentes
function validateTeamSelection() {
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    
    const homeTeamId = homeTeamSelect.value;
    const awayTeamId = awayTeamSelect.value;
    
    if (homeTeamId && awayTeamId && homeTeamId === awayTeamId) {
        showError('Une équipe ne peut pas jouer contre elle-même !');
        awayTeamSelect.value = '';
    }
}

// Fonction pour afficher les erreurs
function showError(message) {
    // Créer ou mettre à jour le message d'erreur
    let errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'errorMessage';
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            background: #ff6b6b;
            color: white;
            padding: 1rem;
            border-radius: 5px;
            margin: 1rem 0;
            display: block;
        `;
        
        const formContainer = document.querySelector('.form-container');
        if (formContainer) {
            formContainer.insertBefore(errorDiv, formContainer.firstChild);
        }
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Masquer le message après 5 secondes
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Fonction pour obtenir une équipe par son ID
function getTeamById(teamId) {
    return teamsData.find(team => team.id == teamId);
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initialisation du chargeur d\'équipes...');
    loadTeams();
    setupTeamValidation();
});

function getStoredTeams() {
    try {
        const stored = localStorage.getItem(TEAMS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : []; // Changer ici aussi
    } catch (error) {
        console.error('Erreur lors de la récupération des équipes:', error);
        return []; // Et ici
    }
}