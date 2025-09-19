// teams-loader.js - Charge les équipes depuis le système d'administration

let teamsData = [];
const TEAMS_STORAGE_KEY = 'footballEloTeams';

// Fonction pour charger les équipes depuis le stockage admin
async function loadTeams() {
    try {
        // Charger depuis le localStorage (système admin)
        const stored = localStorage.getItem(TEAMS_STORAGE_KEY);
        if (stored) {
            teamsData = JSON.parse(stored);
        } else {
            // Si aucune équipe en admin, utiliser les équipes par défaut
            teamsData = getDefaultTeams();
            // Sauvegarder les équipes par défaut pour l'admin
            localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teamsData));
        }
        
        populateTeamSelects();
        console.log('Équipes chargées avec succès:', teamsData.length, 'équipes');
    } catch (error) {
        console.error('Erreur lors du chargement des équipes:', error);
        // En cas d'erreur, utiliser les équipes par défaut
        teamsData = getDefaultTeams();
        populateTeamSelects();
        showError('Erreur lors du chargement des équipes, utilisation des équipes par défaut');
    }
}

// Équipes par défaut (compatibilité)
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

// Fonction pour remplir les selects avec les équipes
function populateTeamSelects() {
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    
    if (!homeTeamSelect || !awayTeamSelect) {
        console.error('Les éléments select pour les équipes sont introuvables');
        return;
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

// Fonction pour éviter qu'une équipe joue contre elle-même
function setupTeamValidation() {
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    
    if (!homeTeamSelect || !awayTeamSelect) return;

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