// match-form.js - Logique du formulaire de match avec calcul automatique du score

let goals = []; // Array pour stocker tous les buts
let homeTeamId = null;
let awayTeamId = null;

// Initialisation du formulaire
document.addEventListener('DOMContentLoaded', function() {
    setupFormListeners();
    setTodayDate();
});

// Configuration des écouteurs d'événements
function setupFormListeners() {
    // Écouteurs pour les sélections d'équipes
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    
    if (homeTeamSelect) {
        homeTeamSelect.addEventListener('change', updateTeamNames);
    }
    if (awayTeamSelect) {
        awayTeamSelect.addEventListener('change', updateTeamNames);
    }

    // Bouton pour ajouter un but
    const addGoalBtn = document.getElementById('addGoalBtn');
    if (addGoalBtn) {
        addGoalBtn.addEventListener('click', addGoalForm);
    }

    // Soumission du formulaire
    const matchForm = document.getElementById('matchForm');
    if (matchForm) {
        matchForm.addEventListener('submit', handleFormSubmit);
    }
}

// Mettre la date d'aujourd'hui par défaut
function setTodayDate() {
    const dateInput = document.getElementById('matchDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
}

// Mettre à jour les noms des équipes dans l'affichage du score
function updateTeamNames() {
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    const homeTeamNameSpan = document.getElementById('homeTeamName');
    const awayTeamNameSpan = document.getElementById('awayTeamName');

    if (homeTeamSelect && homeTeamNameSpan) {
        const homeTeam = getTeamById(homeTeamSelect.value);
        homeTeamNameSpan.textContent = homeTeam ? homeTeam.shortName : 'Équipe domicile';
        homeTeamId = homeTeamSelect.value;
    }

    if (awayTeamSelect && awayTeamNameSpan) {
        const awayTeam = getTeamById(awayTeamSelect.value);
        awayTeamNameSpan.textContent = awayTeam ? awayTeam.shortName : 'Équipe extérieur';
        awayTeamId = awayTeamSelect.value;
    }

    updateGoalFormOptions();
}

// Ajouter un formulaire de but
function addGoalForm() {
    if (!homeTeamId || !awayTeamId) {
        showError('Veuillez d\'abord sélectionner les deux équipes');
        return;
    }

    const goalId = Date.now(); // ID unique basé sur le timestamp
    const goalsContainer = document.getElementById('goalsContainer');
    
    const goalDiv = document.createElement('div');
    goalDiv.className = 'goal-form';
    goalDiv.setAttribute('data-goal-id', goalId);
    
    goalDiv.innerHTML = `
        <div class="goal-header">
            <h4>But #${goals.length + 1}</h4>
            <button type="button" class="remove-goal-btn" onclick="removeGoal(${goalId})">🗑️</button>
        </div>
        <div class="goal-details">
            <div class="form-group">
                <label>Équipe :</label>
                <select name="goalTeam" required>
                    <option value="">Sélectionner l'équipe</option>
                    <option value="${homeTeamId}">${getTeamById(homeTeamId).shortName} (Domicile)</option>
                    <option value="${awayTeamId}">${getTeamById(awayTeamId).shortName} (Extérieur)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Buteur :</label>
                <input type="text" name="goalScorer" placeholder="Nom du buteur" required>
            </div>
            <div class="form-group">
                <label>Minute :</label>
                <input type="number" name="goalMinute" min="1" max="120" placeholder="ex: 67" required>
                <small>Inclure le temps additionnel (ex: 90+3 = 93)</small>
            </div>
        </div>
    `;
    
    goalsContainer.appendChild(goalDiv);
    
    // Ajouter l'écouteur pour le calcul du score
    const goalTeamSelect = goalDiv.querySelector('select[name="goalTeam"]');
    goalTeamSelect.addEventListener('change', calculateScore);
}

// Supprimer un but
function removeGoal(goalId) {
    const goalDiv = document.querySelector(`[data-goal-id="${goalId}"]`);
    if (goalDiv) {
        goalDiv.remove();
        calculateScore();
        renumberGoals();
    }
}

// Renuméroter les buts après suppression
function renumberGoals() {
    const goalForms = document.querySelectorAll('.goal-form');
    goalForms.forEach((goalForm, index) => {
        const header = goalForm.querySelector('.goal-header h4');
        if (header) {
            header.textContent = `But #${index + 1}`;
        }
    });
}

// Calculer et afficher le score actuel
function calculateScore() {
    let homeScore = 0;
    let awayScore = 0;
    let halftimeHomeScore = 0;
    let halftimeAwayScore = 0;

    const goalForms = document.querySelectorAll('.goal-form');
    
    goalForms.forEach(goalForm => {
        const teamSelect = goalForm.querySelector('select[name="goalTeam"]');
        const minuteInput = goalForm.querySelector('input[name="goalMinute"]');
        
        if (teamSelect.value && minuteInput.value) {
            const minute = parseInt(minuteInput.value);
            
            // Compter pour le score final
            if (teamSelect.value === homeTeamId) {
                homeScore++;
                // Compter pour le score à la mi-temps (avant 46e minute)
                if (minute <= 45) {
                    halftimeHomeScore++;
                }
            } else if (teamSelect.value === awayTeamId) {
                awayScore++;
                if (minute <= 45) {
                    halftimeAwayScore++;
                }
            }
        }
    });

    // Mettre à jour l'affichage du score
    const homeScoreSpan = document.getElementById('currentHomeScore');
    const awayScoreSpan = document.getElementById('currentAwayScore');
    const halftimeScoreSpan = document.getElementById('halftimeScore');

    if (homeScoreSpan) homeScoreSpan.textContent = homeScore;
    if (awayScoreSpan) awayScoreSpan.textContent = awayScore;
    if (halftimeScoreSpan) {
        halftimeScoreSpan.textContent = `${halftimeHomeScore} - ${halftimeAwayScore}`;
    }
}

// Mettre à jour les options des formulaires de but existants
function updateGoalFormOptions() {
    const goalForms = document.querySelectorAll('.goal-form');
    
    goalForms.forEach(goalForm => {
        const teamSelect = goalForm.querySelector('select[name="goalTeam"]');
        if (teamSelect && homeTeamId && awayTeamId) {
            teamSelect.innerHTML = `
                <option value="">Sélectionner l'équipe</option>
                <option value="${homeTeamId}">${getTeamById(homeTeamId).shortName} (Domicile)</option>
                <option value="${awayTeamId}">${getTeamById(awayTeamId).shortName} (Extérieur)</option>
            `;
        }
    });
}

// Gérer la soumission du formulaire
function handleFormSubmit(event) {
    event.preventDefault();
    
    // Valider le formulaire
    if (!validateMatch()) {
        return;
    }
    
    // Collecter toutes les données du match
    const matchData = collectMatchData();
    
    // Sauvegarder le match (à implémenter plus tard)
    console.log('Données du match à sauvegarder:', matchData);
    
    // Afficher un message de succès
    showSuccess('Match enregistré avec succès !');
    
    // Optionnel : réinitialiser le formulaire
    // resetForm();
}

// Valider les données du match
function validateMatch() {
    const homeTeam = document.getElementById('homeTeam').value;
    const awayTeam = document.getElementById('awayTeam').value;
    const matchDate = document.getElementById('matchDate').value;
    
    if (!homeTeam || !awayTeam) {
        showError('Veuillez sélectionner les deux équipes');
        return false;
    }
    
    if (!matchDate) {
        showError('Veuillez saisir la date du match');
        return false;
    }
    
    // Vérifier que tous les buts sont complets
    const goalForms = document.querySelectorAll('.goal-form');
    for (let goalForm of goalForms) {
        const team = goalForm.querySelector('select[name="goalTeam"]').value;
        const scorer = goalForm.querySelector('input[name="goalScorer"]').value;
        const minute = goalForm.querySelector('input[name="goalMinute"]').value;
        
        if (!team || !scorer || !minute) {
            showError('Veuillez remplir tous les détails des buts ou les supprimer');
            return false;
        }
    }
    
    return true;
}

// Collecter toutes les données du match
function collectMatchData() {
    const goalForms = document.querySelectorAll('.goal-form');
    const goalsData = [];
    
    goalForms.forEach(goalForm => {
        const team = goalForm.querySelector('select[name="goalTeam"]').value;
        const scorer = goalForm.querySelector('input[name="goalScorer"]').value;
        const minute = parseInt(goalForm.querySelector('input[name="goalMinute"]').value);
        
        goalsData.push({
            teamId: team,
            scorer: scorer,
            minute: minute
        });
    });
    
    // Trier les buts par minute
    goalsData.sort((a, b) => a.minute - b.minute);
    
    return {
        date: document.getElementById('matchDate').value,
        homeTeamId: homeTeamId,
        awayTeamId: awayTeamId,
        goals: goalsData,
        finalScore: {
            home: parseInt(document.getElementById('currentHomeScore').textContent),
            away: parseInt(document.getElementById('currentAwayScore').textContent)
        },
        halftimeScore: document.getElementById('halftimeScore').textContent
    };
}

// Afficher un message de succès
function showSuccess(message) {
    let successDiv = document.getElementById('successMessage');
    if (!successDiv) {
        successDiv = document.createElement('div');
        successDiv.id = 'successMessage';
        successDiv.className = 'success-message';
        successDiv.style.cssText = `
            background: #51cf66;
            color: white;
            padding: 1rem;
            border-radius: 5px;
            margin: 1rem 0;
            display: block;
        `;
        
        const formContainer = document.querySelector('.form-container');
        if (formContainer) {
            formContainer.insertBefore(successDiv, formContainer.firstChild);
        }
    }
    
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    
    // Masquer le message après 5 secondes
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}