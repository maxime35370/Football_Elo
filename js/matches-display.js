// matches-display.js - Logique d'affichage de l'historique des matchs

let allMatches = [];
let filteredMatches = [];

// Initialisation de la page
document.addEventListener('DOMContentLoaded', function() {
    loadAndDisplayMatches();
    setupFilters();
    setupEventListeners();
});

// Charger et afficher tous les matchs
function loadAndDisplayMatches() {
    allMatches = getStoredMatches();
    filteredMatches = [...allMatches];
    
    updateStats();
    populateSeasonFilter();
    populateTeamFilter();
    // Appliquer les filtres dès le chargement : populateSeasonFilter
    // présélectionne la saison active, displayMatches() l'ignorait et
    // affichait aussi les saisons passées.
    applyFilters();
}

// Afficher les statistiques
function updateStats() {
    const stats = getMatchesStats();
    
    const matchCountEl = document.getElementById('matchCount');
    const goalCountEl = document.getElementById('goalCount');
    
    if (matchCountEl) {
        matchCountEl.textContent = `${stats.totalMatches} match${stats.totalMatches > 1 ? 's' : ''}`;
    }
    
    if (goalCountEl) {
        goalCountEl.textContent = `${stats.totalGoals} but${stats.totalGoals > 1 ? 's' : ''}`;
    }
}

// Remplir le filtre des équipes
function populateTeamFilter() {
    const teamFilter = document.getElementById('teamFilter');
    if (!teamFilter || !teamsData) return;
    
    // Garder l'option "Toutes les équipes"
    teamFilter.innerHTML = '<option value="">Toutes les équipes</option>';
    
    // Ajouter les équipes qui ont joué au moins un match (ordre alphabétique)
    const stats = getMatchesStats();
    stats.teams
        .map(teamId => getTeamById(teamId))
        .filter(Boolean)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'))
        .forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            teamFilter.appendChild(option);
        });
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', handleClearAll);
    }
}

// Configuration des filtres
function setupFilters() {
    const seasonFilter = document.getElementById('seasonFilter'); // ← AJOUTER
    const teamFilter = document.getElementById('teamFilter');
    const dateFilter = document.getElementById('dateFilter');
    
    // ← AJOUTER CE BLOC
    if (seasonFilter) {
        seasonFilter.addEventListener('change', applyFilters);
    }
    
    if (teamFilter) {
        teamFilter.addEventListener('change', applyFilters);
    }
    
    if (dateFilter) {
        dateFilter.addEventListener('change', applyFilters);
    }
}

// Appliquer les filtres
function applyFilters() {
    const seasonFilter = document.getElementById('seasonFilter'); // ← AJOUTER
    const teamFilter = document.getElementById('teamFilter');
    const dateFilter = document.getElementById('dateFilter');
    
    let filtered = [...allMatches];
    
    // ← AJOUTER CE BLOC : Filtrer par saison
    if (seasonFilter && seasonFilter.value) {
        filtered = filtered.filter(match => match.season === seasonFilter.value);
    }
    
    // Filtrer par équipe (en respectant le filtre saison déjà appliqué)
    if (teamFilter && teamFilter.value) {
        const teamId = teamFilter.value;
        filtered = filtered.filter(match =>
            match.homeTeamId == teamId || match.awayTeamId == teamId
        );
    }
    
    // Trier par date
    if (dateFilter && dateFilter.value) {
        filtered = sortMatches(filtered, dateFilter.value);
    }
    
    filteredMatches = filtered;
    displayMatches();
}

// Afficher les matchs
function displayMatches() {
    const matchesList = document.getElementById('matchesList');
    const noMatchesMessage = document.getElementById('noMatchesMessage');
    
    if (!matchesList || !noMatchesMessage) return;
    
    if (filteredMatches.length === 0) {
        matchesList.style.display = 'none';
        noMatchesMessage.style.display = 'block';
        return;
    }
    
    // Laisser le CSS décider (grille multi-colonnes) plutôt que 'block'
    matchesList.style.display = '';
    noMatchesMessage.style.display = 'none';
    
    matchesList.innerHTML = '';
    
    filteredMatches.forEach(match => {
        const matchElement = createMatchElement(match);
        matchesList.appendChild(matchElement);
    });
}

// Créer l'élément HTML d'un match
function createMatchElement(match) {
    const matchDiv = document.createElement('div');
    matchDiv.className = 'match-card';
    matchDiv.setAttribute('data-match-id', match.id);
    
    const homeTeam = getTeamById(match.homeTeamId) || { shortName: 'SUPP', name: 'Équipe supprimée' };
    const awayTeam = getTeamById(match.awayTeamId) || { shortName: 'SUPP', name: 'Équipe supprimée' };
    
    const matchDate = new Date(match.date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    matchDiv.innerHTML = `
        <div class="match-header">
            <div class="match-date">${matchDate}</div>
            <div class="match-actions">
                ${window.isAdmin ? `
                    <button class="edit-match-btn" onclick="editMatch('${match.id}')">✏️</button>
                    <button class="delete-match-btn" onclick="deleteMatchWithConfirm('${match.id}')">🗑️</button>
                ` : ''}
            </div>
        </div>
        
        <div class="match-score">
            <div class="team home-team">
                <span class="team-name">${homeTeam ? homeTeam.shortName : 'Équipe 1'}</span>
                <span class="score">${match.finalScore.home}</span>
            </div>
            <div class="score-separator">-</div>
            <div class="team away-team">
                <span class="score">${match.finalScore.away}</span>
                <span class="team-name">${awayTeam ? awayTeam.shortName : 'Équipe 2'}</span>
            </div>
        </div>
        
        <div class="match-halftime">
            Mi-temps : ${match.halftimeScore}
        </div>
        
        ${match.goals.length > 0 ? createGoalsHTML(match.goals) : '<div class="no-goals">Match sans but</div>'}
    `;

    // Carte cliquable : ouvre la modale de détails du match (contexte
    // avant-match, impact Elo, courbe Elo, confrontations directes).
    // Les clics sur les boutons admin (éditer/supprimer) sont ignorés.
    if (typeof showCalendarMatchDetails === 'function') {
        matchDiv.classList.add('clickable');
        matchDiv.addEventListener('click', function(e) {
            if (e.target.closest('button')) return;
            showCalendarMatchDetails(match.homeTeamId, match.awayTeamId, match.matchDay || 0, 'played', match.season);
        });
    }

    return matchDiv;
}

// Créer le HTML des buts
function createGoalsHTML(goals) {
    if (goals.length === 0) return '';
    
    const sortedGoals = goals.sort((a, b) => {
        // Trier par minute puis par temps additionnel
        if (a.minute !== b.minute) {
            return a.minute - b.minute;
        }
        return (a.extraTime || 0) - (b.extraTime || 0);
    });
    
    let goalsHTML = '<div class="goals-list"><h4>⚽ Buts du match :</h4>';
    
    sortedGoals.forEach(goal => {
        const team = getTeamById(goal.teamId);
        const timeDisplay = goal.extraTime > 0 ? `${goal.minute}+${goal.extraTime}'` : `${goal.minute}'`;
        
        goalsHTML += `
            <div class="goal-item">
                <span class="goal-time">${timeDisplay}</span>
                <span class="goal-scorer">${goal.scorer}</span>
                <span class="goal-team">(${team ? team.shortName : 'Équipe'})</span>
            </div>
        `;
    });
    
    goalsHTML += '</div>';
    return goalsHTML;
}

// Supprimer un match avec confirmation
function deleteMatchWithConfirm(matchId) {
    const match = allMatches.find(m => m.id == matchId);
    if (!match) {
        showMessage('Match introuvable', 'error');
        return;
    }
    
    // Récupérer les noms d'équipes avec gestion des équipes supprimées
    const homeTeam = getTeamById(match.homeTeamId);
    const awayTeam = getTeamById(match.awayTeamId);
    
    const homeTeamName = homeTeam ? homeTeam.shortName : 'Équipe supprimée';
    const awayTeamName = awayTeam ? awayTeam.shortName : 'Équipe supprimée';
    
    const message = `Êtes-vous sûr de vouloir supprimer ce match ?\n\n${homeTeamName} vs ${awayTeamName}\n\nCette action est irréversible.`;
    
    if (confirm(message)) {
        if (deleteMatch(matchId)) {
            loadAndDisplayMatches(); // Recharger l'affichage
            showMessage('Match supprimé avec succès', 'success');
        } else {
            showMessage('Erreur lors de la suppression', 'error');
        }
    }
}

// Effacer tous les matchs avec confirmation
function handleClearAll() {
    if (allMatches.length === 0) {
        showMessage('Aucun match à supprimer', 'info');
        return;
    }
    
    if (confirm(`Êtes-vous sûr de vouloir supprimer TOUS les ${allMatches.length} matchs ? Cette action est irréversible.`)) {
        if (clearAllMatches()) {
            loadAndDisplayMatches();
            showMessage('Tous les matchs ont été supprimés', 'success');
        } else {
            showMessage('Erreur lors de la suppression', 'error');
        }
    }
}
// Remplir le filtre des saisons
function populateSeasonFilter() {
    const seasonFilter = document.getElementById('seasonFilter');
    if (!seasonFilter) return;
    
    // Garder l'option "Toutes les saisons"
    seasonFilter.innerHTML = '<option value="">Toutes les saisons</option>';
    
    // Récupérer toutes les saisons triées
    const seasons = getSeasonsOrderedByDate();
    
    // Ajouter chaque saison
    seasons.forEach(season => {
        const option = document.createElement('option');
        option.value = season.name;
        option.textContent = season.name;
        
        // Sélectionner la saison active par défaut
        if (season.isActive) {
            option.selected = true;
        }
        
        seasonFilter.appendChild(option);
    });
}

// Éditer un match
function editMatch(matchId) {
    const match = allMatches.find(m => m.id == matchId);
    if (!match) {
        showMessage('Match introuvable', 'error');
        return;
    }
    
    console.log('Redirection vers édition du match:', matchId);
    
    // Construire l'URL avec le paramètre edit
    const editUrl = `add-match.html?edit=${matchId}`;
    console.log('URL de redirection:', editUrl);
    
    // Rediriger vers le formulaire d'édition
    window.location.href = editUrl;
}
function showMessage(text, type = 'info') {
    // Supprimer le message existant s'il y en a un
    const existingMessage = document.getElementById('tempMessage');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.id = 'tempMessage';
    messageDiv.className = `temp-message ${type}`;
    messageDiv.textContent = text;
    
    const container = document.querySelector('.matches-container');
    if (container) {
        container.insertBefore(messageDiv, container.firstChild);
        
        // Supprimer après 3 secondes
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }
}