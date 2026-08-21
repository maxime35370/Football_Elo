// match-form.js - Logique du formulaire de match avec calcul automatique du score et mode édition

let goals = []; // Array pour stocker tous les buts
let homeTeamId = null;
let awayTeamId = null;
let editingMatchId = null; // ID du match en cours d'édition

// Afficher la saison en cours
function displayCurrentSeason() {
    const currentSeason = getCurrentSeason();
    const displayElement = document.getElementById('currentSeasonDisplay');
    if (displayElement) {
        displayElement.textContent = currentSeason;
    }
}

// Initialisation du formulaire
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM chargé, initialisation du formulaire...');

    displayCurrentSeason(); // ← AJOUTER CETTE LIGNE

    setupFormListeners();
    setTodayDate();

    // Référentiel joueurs pour l'autocomplétion des buteurs
    if (typeof loadPlayersRegistry === 'function') {
        loadPlayersRegistry();
    }
    
    // Attendre un peu que tout soit prêt avant de vérifier le mode édition
    setTimeout(() => {
        console.log('Vérification du mode édition...');
        checkForEditMode();
    }, 200);
});

// Double vérification après chargement complet
window.addEventListener('load', function() {
    console.log('Page entièrement chargée');
    // Si le mode édition n'a pas été détecté, réessayer
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('edit') && !editingMatchId) {
        console.log('Mode édition détecté en second appel');
        setTimeout(checkForEditMode, 100);
    }
});

// Vérifier si on est en mode édition
function checkForEditMode() {
    if (editingMatchId) return;
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    
    console.log('Vérification mode édition, editId:', editId);
    
    if (editId) {
        editingMatchId = editId;
        console.log('Mode édition activé pour le match:', editingMatchId);
        
        // Afficher l'indicateur de mode édition
        const editIndicator = document.getElementById('editModeIndicator');
        console.log('Élément editModeIndicator trouvé:', editIndicator);
        
        if (editIndicator) {
            editIndicator.style.display = 'block';
            console.log('Bandeau d\'édition affiché');
        } else {
            console.error('Élément editModeIndicator introuvable');
        }
        
        // Changer les textes
        const headerP = document.querySelector('header p');
        const h2 = document.querySelector('h2');
        const submitBtn = document.querySelector('#matchForm button[type="submit"]');
        
        if (headerP) headerP.textContent = 'Modifier un match';
        if (h2) h2.textContent = '✏️ Modifier le match';
        if (submitBtn) submitBtn.innerHTML = '💾 Modifier le match';
        
        console.log('Textes mis à jour pour le mode édition');
        
        // Charger les données du match
        loadMatchForEditing(editId);
    } else {
        console.log('Pas de paramètre edit détecté, mode création');
    }
}

// Charger un match pour édition
function loadMatchForEditing(matchId) {
    console.log('Chargement du match pour édition:', matchId);
    
    const matches = getStoredMatches();
    const match = matches.find(m => m.id == matchId);
    
    if (!match) {
        console.error('Match introuvable avec l\'ID:', matchId);
        showError('Match introuvable');
        return;
    }
    
    console.log('Match trouvé pour édition:', match);
    
    // ✅ FIX: Compteur de tentatives pour éviter la boucle infinie
    let retryCount = 0;
    const MAX_RETRIES = 50;
    
    const loadMatchData = () => {
        // ✅ FIX: Abandon après trop de tentatives
        if (retryCount++ > MAX_RETRIES) {
            console.error('Abandon: formulaire non prêt après', MAX_RETRIES, 'tentatives');
            showError('Erreur de chargement du formulaire. Rechargez la page.');
            return;
        }
        
        const homeSelect = document.getElementById('homeTeam');
        const awaySelect = document.getElementById('awayTeam');
        // ✅ FIX: Le champ s'appelle matchDateTime, pas matchDate
        const dateInput = document.getElementById('matchDateTime');
        const matchDayInput = document.getElementById('matchDay');
        if (matchDayInput) {
            const journee = match.matchDay || 1; // Valeur par défaut si pas de journée
            matchDayInput.value = journee;
            console.log('Journée chargée:', journee);
        }
        
        if (!homeSelect || !awaySelect || !dateInput) {
            console.log('Éléments du formulaire pas encore prêts, nouvelle tentative...');
            setTimeout(loadMatchData, 100);
            return;
        }
        
        // Attendre que les équipes soient chargées dans les selects
        if (homeSelect.options.length <= 1) {
            console.log('Équipes pas encore chargées, nouvelle tentative...');
            setTimeout(loadMatchData, 100);
            return;
        }
        
        try {
            console.log('Chargement des données du match...');
            
            // ✅ FIX: Charger la date au format datetime-local (YYYY-MM-DDTHH:MM)
            if (match.scheduledAt) {
                dateInput.value = toDatetimeLocalValue(match.scheduledAt);
            } else if (match.date) {
                dateInput.value = match.date.includes('T') ? match.date.slice(0, 16) : match.date + 'T15:00';
            }
            console.log('Date chargée:', dateInput.value);
            
            // 2. Forcer la sélection des équipes
            homeSelect.value = match.homeTeamId;
            awaySelect.value = match.awayTeamId;
            
            console.log('Équipe domicile sélectionnée:', homeSelect.value);
            console.log('Équipe extérieur sélectionnée:', awaySelect.value);
            
            // 3. Si la sélection automatique n'a pas fonctionné, forcer manuellement
            if (homeSelect.value === "" || awaySelect.value === "") {
                console.log('Sélection automatique échouée, force manuelle...');
                
                // Chercher les bonnes options par valeur
                for (let option of homeSelect.options) {
                    if (option.value == match.homeTeamId) {
                        option.selected = true;
                        homeSelect.value = option.value;
                        break;
                    }
                }
                for (let option of awaySelect.options) {
                    if (option.value == match.awayTeamId) {
                        option.selected = true;
                        awaySelect.value = option.value;
                        break;
                    }
                }
            }
            
            // 4. Déclencher manuellement les événements de changement
            const changeEvent = new Event('change');
            homeSelect.dispatchEvent(changeEvent);
            awaySelect.dispatchEvent(changeEvent);
            
            console.log('Événements de changement déclenchés');
            
            // 5. Charger les buts après un délai pour laisser l'interface se mettre à jour
            setTimeout(() => {
                if (match.goals && match.goals.length > 0) {
                    console.log('Chargement des buts:', match.goals.length, 'buts');
                    loadExistingGoals(match.goals);
                } else {
                    console.log('Aucun but à charger');
                }
                showSuccess('Match chargé pour modification');
            }, 500);
            
        } catch (error) {
            console.error('Erreur lors du chargement des données:', error);
            showError('Erreur lors du chargement des données du match');
        }
    };
    
    // Commencer le chargement
    loadMatchData();
}

// Obtenir les équipes qui ont déjà joué dans une journée donnée
function getTeamsAlreadyPlayedInMatchDay(matchDay, season) {
    if (!matchDay || matchDay < 1) return [];
    
    season = season || getCurrentSeason();
    const matches = getStoredMatches().filter(m => 
        m.season === season && m.matchDay == matchDay
    );
    
    // Extraire tous les IDs d'équipes ayant joué
    const playedTeamIds = new Set();
    matches.forEach(match => {
        playedTeamIds.add(match.homeTeamId.toString());
        playedTeamIds.add(match.awayTeamId.toString());
    });
    
    return Array.from(playedTeamIds);
}

// Filtrer les équipes disponibles selon la journée
function filterTeamsByMatchDay() {
    const matchDayInput = document.getElementById('matchDay');
    if (!matchDayInput || !matchDayInput.value) return;
    
    const matchDay = parseInt(matchDayInput.value);
    const season = getCurrentSeason();
    
    // Si on est en mode édition, ne pas filtrer
    if (editingMatchId) {
        return;
    }
    
    // Obtenir les équipes qui ont déjà joué
    const playedTeamIds = getTeamsAlreadyPlayedInMatchDay(matchDay, season);
    
    console.log(`Journée ${matchDay} : ${playedTeamIds.length} équipes ont déjà joué`);
    
    // Filtrer les selects
    updateTeamSelectsWithFilter(playedTeamIds);
}

// Mettre à jour les selects en filtrant les équipes
function updateTeamSelectsWithFilter(playedTeamIds) {
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    
    if (!homeTeamSelect || !awayTeamSelect) return;
    
    // Sauvegarder les sélections actuelles
    const currentHomeTeam = homeTeamSelect.value;
    const currentAwayTeam = awayTeamSelect.value;
    
    // Vider et remplir les selects (ordre alphabétique)
    homeTeamSelect.innerHTML = '<option value="">Sélectionner une équipe</option>';
    awayTeamSelect.innerHTML = '<option value="">Sélectionner une équipe</option>';

    sortedTeamsAlpha().forEach(team => {
        // Exclure les équipes qui ont déjà joué
        if (playedTeamIds.includes(team.id.toString())) {
            return; // Skip cette équipe
        }
        
        const homeOption = document.createElement('option');
        homeOption.value = team.id;
        homeOption.textContent = `${team.name} (${team.shortName})`;
        homeTeamSelect.appendChild(homeOption);
        
        const awayOption = document.createElement('option');
        awayOption.value = team.id;
        awayOption.textContent = `${team.name} (${team.shortName})`;
        awayTeamSelect.appendChild(awayOption);
    });
    
    // Restaurer les sélections si elles sont toujours valides
    if (currentHomeTeam && !playedTeamIds.includes(currentHomeTeam)) {
        homeTeamSelect.value = currentHomeTeam;
    }
    if (currentAwayTeam && !playedTeamIds.includes(currentAwayTeam)) {
        awayTeamSelect.value = currentAwayTeam;
    }
}

// Charger les buts existants dans le formulaire
function loadExistingGoals(matchGoals) {
    if (!matchGoals || matchGoals.length === 0) {
        console.log('Aucun but à charger');
        return;
    }
    
    console.log('Chargement des buts existants:', matchGoals);
    
    // IMPORTANT : Vider complètement le conteneur d'abord
    const goalsContainer = document.getElementById('goalsContainer');
    if (goalsContainer) {
        goalsContainer.innerHTML = '';
        console.log('Conteneur de buts vidé');
    }
    
    // Attendre un peu que le vidage soit effectif
    setTimeout(() => {
        // Trier les buts par minute
        const sortedGoals = matchGoals.sort((a, b) => {
            if (a.minute !== b.minute) return a.minute - b.minute;
            return (a.extraTime || 0) - (b.extraTime || 0);
        });
        
        // Ajouter chaque but de façon synchrone
        sortedGoals.forEach((goal, index) => {
            console.log(`Ajout du but ${index + 1}:`, goal);
            addGoalForm();
            
            // Remplir immédiatement le formulaire qui vient d'être créé
            const goalForms = document.querySelectorAll('.goal-form');
            const lastForm = goalForms[goalForms.length - 1];
            
            if (lastForm) {
                const teamSelect = lastForm.querySelector('select[name="goalTeam"]');
                const scorerInput = lastForm.querySelector('input[name="goalScorer"]');
                const minuteInput = lastForm.querySelector('input[name="goalMinute"]');
                const extraTimeInput = lastForm.querySelector('input[name="goalExtraTime"]');
                
                if (teamSelect) teamSelect.value = goal.teamId;
                if (scorerInput) scorerInput.value = goal.scorer;
                if (minuteInput) minuteInput.value = goal.minute;
                if (extraTimeInput) extraTimeInput.value = goal.extraTime || 0;
                
                // Mettre à jour l'indicateur de mi-temps
                updateHalfTimeIndicator(lastForm);
            }
        });
        
        // Recalculer le score une seule fois à la fin
        setTimeout(() => {
            calculateScore();
            console.log('Score recalculé après chargement de tous les buts');
        }, 100);
        
    }, 100);
}

// Configuration des écouteurs d'événements
function setupFormListeners() {
    console.log('Configuration des écouteurs d\'événements...');
    
    // Écouteurs pour les sélections d'équipes
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    
    if (homeTeamSelect) {
        homeTeamSelect.addEventListener('change', updateTeamNames);
    }
    if (awayTeamSelect) {
        awayTeamSelect.addEventListener('change', updateTeamNames);
    }

    // AJOUTER CET ÉCOUTEUR pour la journée
    const matchDayInput = document.getElementById('matchDay');
    if (matchDayInput) {
        matchDayInput.addEventListener('change', function() {
            // Réappliquer le filtre quand la journée change
            filterAvailableTeams();
        });
        // Proposer les matchs du calendrier pour la journée saisie
        matchDayInput.addEventListener('input', renderMatchdayFixtures);
        matchDayInput.addEventListener('change', renderMatchdayFixtures);
    }

    // Clic sur une affiche proposée → pré-remplit équipes + horaire
    const fixturesContainer = document.getElementById('matchdayFixtures');
    if (fixturesContainer) {
        fixturesContainer.addEventListener('click', function(e) {
            const btn = e.target.closest('.fixture-chip[data-home]');
            if (btn) selectMatchdayFixture(btn.dataset.home, btn.dataset.away, btn.dataset.scheduled);
        });
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

// Mettre la date d'aujourd'hui par défaut (seulement en mode création)
function setTodayDate() {
    const dateTimeInput = document.getElementById('matchDateTime');
    if (dateTimeInput && !editingMatchId) {
        // Format: YYYY-MM-DDTHH:MM
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        dateTimeInput.value = toDatetimeLocalValue(now);
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

    // Filtrer les équipes seulement si on n'est pas en mode édition
    if (!editingMatchId) {
        filterAvailableTeams();
    }
    
    updateGoalFormOptions();
    updateEloPrediction();
}

function debugCleanSheets(team) {
    console.log('=== DEBUG CLEAN SHEETS pour', team.name, '===');
    
    if (!team.eloHistory || team.eloHistory.length === 0) {
        console.log('Pas d\'historique');
        return;
    }
    
    const last5 = team.eloHistory.slice(-5);
    
    last5.forEach((match, index) => {
        console.log(`Match ${index + 1}:`, {
            opponent: match.opponent,
            result: match.result,
            goalsFor: match.goalsFor,
            goalsAgainst: match.goalsAgainst,
            isCleanSheet: match.goalsAgainst === 0 ? '✅ OUI' : '❌ NON'
        });
    });
    
    const cleanSheetCount = last5.filter(m => m.goalsAgainst === 0).length;
    console.log('Total clean sheets comptés:', cleanSheetCount);
    console.log('========================');
}

// Calculer et afficher la prédiction Elo avec modificateur de forme
function updateEloPrediction() {
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    const eloPredictionSection = document.getElementById('eloPredictionSection');
    
    if (!homeTeamSelect.value || !awayTeamSelect.value || 
        typeof EloSystem === 'undefined' || typeof FormModifier === 'undefined') {
        if (eloPredictionSection) eloPredictionSection.style.display = 'none';
        return;
    }
    
    // Récupérer les équipes avec leurs ratings Elo actuels.
    // On se limite aux matchs de la saison en cours et on repart de l'Elo
    // de fin de saison précédente, comme le classement et les pronostics.
    const teams = getStoredTeams();
    const currentSeason = (typeof getCurrentSeason === 'function') ? getCurrentSeason() : null;
    const matches = (currentSeason && typeof getMatchesBySeason === 'function')
        ? getMatchesBySeason(currentSeason)
        : getStoredMatches();
    const startingElo = (currentSeason && typeof getSeasonStartingElo === 'function')
        ? getSeasonStartingElo(currentSeason)
        : {};
    const teamsWithElo = EloSystem.recalculateAllEloRatings(teams, matches, startingElo);
    
    const homeTeam = teamsWithElo.find(t => t.id == homeTeamSelect.value);
    const awayTeam = teamsWithElo.find(t => t.id == awayTeamSelect.value);
    
    if (!homeTeam || !awayTeam) return;

    debugCleanSheets(homeTeam);
    debugCleanSheets(awayTeam);
    
    // Calculer les ratings ajustés avec la forme
    const homeAdjusted = FormModifier.getAdjustedEloRating(homeTeam);
    const awayAdjusted = FormModifier.getAdjustedEloRating(awayTeam);
    
    // Calculer l'avantage domicile ajusté selon la forme
    let homeAdvantageBonus = EloSystem.ELO_CONFIG.HOME_ADVANTAGE;

    // Réduire l'avantage domicile si l'équipe est en crise
    if (homeAdjusted.formModifier < -50) {
        homeAdvantageBonus = 50; // Divisé par 2 si très mauvaise forme
        console.log('🏠 Avantage domicile réduit à 50 (crise)');
    } else if (homeAdjusted.formModifier < -30) {
        homeAdvantageBonus = 75; // Réduit à 75 si forme difficile
        console.log('🏠 Avantage domicile réduit à 75 (difficulté)');
    }

    const homeAdvDisplay = document.getElementById('homeAdvantageDisplay');
    if (homeAdvDisplay) {
        homeAdvDisplay.textContent = `+${homeAdvantageBonus} 🏠`;
        if (homeAdvantageBonus < 100) {
            homeAdvDisplay.classList.add('reduced');
            homeAdvDisplay.title = 'Avantage domicile réduit (mauvaise forme)';
        } else {
            homeAdvDisplay.classList.remove('reduced');
            homeAdvDisplay.title = 'Avantage domicile complet';
        }
    }
    // Calculer les probabilités avec l'avantage domicile ajusté ET la forme
    const finalHomeRating = homeAdjusted.adjustedRating + homeAdvantageBonus;
    const finalAwayRating = awayAdjusted.adjustedRating;

    console.log('Ratings finaux:', {
        home: finalHomeRating,
        away: finalAwayRating,
        homeAdvantage: homeAdvantageBonus
    });
    
    const homeWinProb = EloSystem.calculateExpectedScore(finalHomeRating, finalAwayRating);
    const awayWinProb = 1 - homeWinProb;
    
    // Simuler les différents résultats pour les changements Elo (avec avantage domicile)
    const winChanges = calculateEloChangesForResult(homeTeam, awayTeam, 1, 0, homeAdvantageBonus);
    const drawChanges = calculateEloChangesForResult(homeTeam, awayTeam, 0, 0, homeAdvantageBonus);
    const lossChanges = calculateEloChangesForResult(homeTeam, awayTeam, 0, 1, homeAdvantageBonus);
    
    // === AFFICHAGE ÉQUIPE DOMICILE ===
    document.getElementById('homeTeamEloName').textContent = homeTeam.shortName;
    document.getElementById('homeTeamEloBase').textContent = Math.round(homeAdjusted.baseRating);

    // Le rating final affiché doit inclure l'avantage domicile
    const finalHomeDisplayRating = Math.round(homeAdjusted.adjustedRating + homeAdvantageBonus);
    document.getElementById('homeTeamEloRating').textContent = finalHomeDisplayRating;
    
    // Modificateur de forme
    const homeFormModEl = document.getElementById('homeTeamFormMod');
    homeFormModEl.textContent = formatEloChange(homeAdjusted.formModifier);
    homeFormModEl.className = 'elo-form-mod ' + 
        (homeAdjusted.formModifier > 0 ? 'positive' : 
         homeAdjusted.formModifier < 0 ? 'negative' : 'neutral');
    
    // Forme récente
    if (homeAdjusted.recentForm && homeAdjusted.recentForm.length > 0) {
        document.getElementById('homeTeamForm').textContent = 
            FormModifier.formatRecentForm(homeAdjusted.recentForm);
    }
    
    // Statut de forme
    const homeFormStatusEl = document.getElementById('homeTeamFormStatus');
    homeFormStatusEl.textContent = `${homeAdjusted.formStatus.icon} ${homeAdjusted.formStatus.text}`;
    homeFormStatusEl.className = 'form-status ' + homeAdjusted.formStatus.class;
    
    // Détails de la forme
    displayFormDetails('homeTeamFormDetails', homeAdjusted.formDetails);
    
    // Probabilités et changements
    document.getElementById('homeWinProbability').textContent = (homeWinProb * 100).toFixed(1) + '%';
    document.getElementById('homeWinGain').textContent = formatEloChange(winChanges.homeChange);
    document.getElementById('homeDrawChange').textContent = formatEloChange(drawChanges.homeChange);
    document.getElementById('homeLossChange').textContent = formatEloChange(lossChanges.homeChange);
    
    // === AFFICHAGE ÉQUIPE EXTÉRIEUR ===
    document.getElementById('awayTeamEloName').textContent = awayTeam.shortName;
    document.getElementById('awayTeamEloBase').textContent = Math.round(awayAdjusted.baseRating);
    document.getElementById('awayTeamEloRating').textContent = Math.round(awayAdjusted.adjustedRating);
    
    // Modificateur de forme
    const awayFormModEl = document.getElementById('awayTeamFormMod');
    awayFormModEl.textContent = formatEloChange(awayAdjusted.formModifier);
    awayFormModEl.className = 'elo-form-mod ' + 
        (awayAdjusted.formModifier > 0 ? 'positive' : 
         awayAdjusted.formModifier < 0 ? 'negative' : 'neutral');
    
    // Forme récente
    if (awayAdjusted.recentForm && awayAdjusted.recentForm.length > 0) {
        document.getElementById('awayTeamForm').textContent = 
            FormModifier.formatRecentForm(awayAdjusted.recentForm);
    }
    
    // Statut de forme
    const awayFormStatusEl = document.getElementById('awayTeamFormStatus');
    awayFormStatusEl.textContent = `${awayAdjusted.formStatus.icon} ${awayAdjusted.formStatus.text}`;
    awayFormStatusEl.className = 'form-status ' + awayAdjusted.formStatus.class;
    
    // Détails de la forme
    displayFormDetails('awayTeamFormDetails', awayAdjusted.formDetails);
    
    // Probabilités et changements
    document.getElementById('awayWinProbability').textContent = (awayWinProb * 100).toFixed(1) + '%';
    document.getElementById('awayWinGain').textContent = formatEloChange(lossChanges.awayChange);
    document.getElementById('awayDrawChange').textContent = formatEloChange(drawChanges.awayChange);
    document.getElementById('awayLossChange').textContent = formatEloChange(winChanges.awayChange);
    
    eloPredictionSection.style.display = 'block';
}

// Afficher les détails de la forme
function displayFormDetails(elementId, details) {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    if (!details || details.length === 0) {
        container.innerHTML = '<div class="form-detail-item">Aucun historique de forme</div>';
        return;
    }
    
    container.innerHTML = details.map(detail => 
        `<div class="form-detail-item">${detail}</div>`
    ).join('');
}

// Calculer les changements Elo pour un résultat donné
function calculateEloChangesForResult(homeTeam, awayTeam, homeGoals, awayGoals, homeAdvantageBonus) {
    // Créer des copies des équipes avec les ratings ajustés
    const homeAdjusted = FormModifier.getAdjustedEloRating(homeTeam);
    const awayAdjusted = FormModifier.getAdjustedEloRating(awayTeam);
    
    // Rating final pour le calcul (avec avantage domicile)
    const finalHomeRating = homeAdjusted.adjustedRating + homeAdvantageBonus;
    const finalAwayRating = awayAdjusted.adjustedRating;
    
    // Calculer les probabilités attendues
    const homeExpected = EloSystem.calculateExpectedScore(finalHomeRating, finalAwayRating);
    const awayExpected = 1 - homeExpected;
    
    // Déterminer le score réel
    let homeActual, awayActual;
    if (homeGoals > awayGoals) {
        homeActual = 1;
        awayActual = 0;
    } else if (homeGoals < awayGoals) {
        homeActual = 0;
        awayActual = 1;
    } else {
        homeActual = 0.5;
        awayActual = 0.5;
    }
    
    // Calculer la différence de buts pour le multiplicateur
    const goalDiff = Math.abs(homeGoals - awayGoals);
    let multiplier = 1;
    if (goalDiff === 0 || goalDiff === 1) multiplier = 1;
    else if (goalDiff === 2) multiplier = 1.5;
    else if (goalDiff === 3) multiplier = 1.75;
    else multiplier = 1.75 + (goalDiff - 3) * 0.125;
    
    // Calculer les changements Elo
    const K = EloSystem.ELO_CONFIG.K_FACTOR;
    const homeChange = Math.round(K * multiplier * (homeActual - homeExpected));
    const awayChange = Math.round(K * multiplier * (awayActual - awayExpected));
    
    return {
        homeChange: homeChange,
        awayChange: awayChange
    };
}

// Formater l'affichage du changement Elo
function formatEloChange(change) {
    if (change > 0) return `+${change}`;
    return change.toString();
}

// Équipes triées par nom pour l'affichage des selects
function sortedTeamsAlpha() {
    return [...teamsData].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
}

// Filtrer les équipes disponibles selon les matchs existants
function filterAvailableTeams() {
    // NE PAS filtrer en mode édition
    if (editingMatchId) {
        return;
    }
    
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    const matchDayInput = document.getElementById('matchDay');

    if (!homeTeamSelect || !awayTeamSelect) return;

    // Uniquement les matchs de la saison en cours : sans ce filtre, les
    // journées et les affiches de la saison précédente bloquaient la saisie
    const currentSeasonName = getCurrentSeason();
    const matches = getStoredMatches().filter(m => m.season === currentSeasonName);
    const selectedHomeTeam = homeTeamSelect.value;
    const selectedAwayTeam = awayTeamSelect.value;
    const currentMatchDay = matchDayInput ? parseInt(matchDayInput.value) : null;
    
    // === FILTRAGE DES ÉQUIPES EXTÉRIEURES ===
    if (selectedHomeTeam) {
        // 1. Équipes qui ont déjà joué CONTRE cette équipe à domicile
        const playedAgainstHome = matches.filter(match => 
            match.homeTeamId == selectedHomeTeam
        ).map(match => match.awayTeamId);
        
        // 2. Équipes qui ont DÉJÀ un match lors de cette journée
        let teamsPlayingThisMatchDay = [];
        if (currentMatchDay) {
            teamsPlayingThisMatchDay = matches
                .filter(match => match.matchDay === currentMatchDay)
                .flatMap(match => [match.homeTeamId.toString(), match.awayTeamId.toString()]);
        }
        
        // Reconstruire la liste des équipes extérieures (ordre alphabétique)
        awayTeamSelect.innerHTML = '<option value="">Sélectionner une équipe</option>';

        sortedTeamsAlpha().forEach(team => {
            const teamIdStr = team.id.toString();
            
            // Exclure :
            // - L'équipe elle-même
            // - Les équipes qui ont déjà joué contre elle à domicile
            // - Les équipes qui ont déjà un match cette journée
            if (team.id != selectedHomeTeam && 
                !playedAgainstHome.includes(teamIdStr) &&
                !teamsPlayingThisMatchDay.includes(teamIdStr)) {
                
                const option = document.createElement('option');
                option.value = team.id;
                option.textContent = `${team.name} (${team.shortName})`;
                awayTeamSelect.appendChild(option);
            }
        });
        
        // Rétablir la sélection si elle est encore valide
        if (selectedAwayTeam && 
            !playedAgainstHome.includes(selectedAwayTeam) &&
            !teamsPlayingThisMatchDay.includes(selectedAwayTeam)) {
            awayTeamSelect.value = selectedAwayTeam;
        }
    }
    
    // === FILTRAGE DES ÉQUIPES DOMICILE ===
    if (selectedAwayTeam) {
        // 1. Équipes qui ont déjà joué À DOMICILE contre cette équipe
        const playedAtHome = matches.filter(match => 
            match.awayTeamId == selectedAwayTeam
        ).map(match => match.homeTeamId);
        
        // 2. Équipes qui ont DÉJÀ un match lors de cette journée
        let teamsPlayingThisMatchDay = [];
        if (currentMatchDay) {
            teamsPlayingThisMatchDay = matches
                .filter(match => match.matchDay === currentMatchDay)
                .flatMap(match => [match.homeTeamId.toString(), match.awayTeamId.toString()]);
        }
        
        // Reconstruire la liste des équipes domicile (ordre alphabétique)
        homeTeamSelect.innerHTML = '<option value="">Sélectionner une équipe</option>';

        sortedTeamsAlpha().forEach(team => {
            const teamIdStr = team.id.toString();
            
            // Exclure :
            // - L'équipe elle-même
            // - Les équipes qui ont déjà joué à domicile contre elle
            // - Les équipes qui ont déjà un match cette journée
            if (team.id != selectedAwayTeam && 
                !playedAtHome.includes(teamIdStr) &&
                !teamsPlayingThisMatchDay.includes(teamIdStr)) {
                
                const option = document.createElement('option');
                option.value = team.id;
                option.textContent = `${team.name} (${team.shortName})`;
                homeTeamSelect.appendChild(option);
            }
        });
        
        // Rétablir la sélection si elle est encore valide
        if (selectedHomeTeam && 
            !playedAtHome.includes(selectedHomeTeam) &&
            !teamsPlayingThisMatchDay.includes(selectedHomeTeam)) {
            homeTeamSelect.value = selectedHomeTeam;
        }
    }
    
    // Si aucune équipe n'est sélectionnée, remettre toutes les équipes
    if (!selectedHomeTeam && !selectedAwayTeam) {
        populateTeamSelects();
        
        // Mais filtrer quand même par journée si une journée est sélectionnée
        if (currentMatchDay) {
            filterByMatchDay(currentMatchDay);
        }
    }
}

// Filtrer les équipes qui ont déjà un match lors de la journée sélectionnée
function filterByMatchDay(matchDay) {
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    // Saison en cours uniquement (les J1..J34 des saisons passées ne doivent
    // pas marquer les équipes comme « déjà un match »)
    const matches = getStoredMatches().filter(m => m.season === getCurrentSeason());
    
    // Trouver les équipes qui jouent déjà cette journée
    const teamsPlayingThisMatchDay = matches
        .filter(match => match.matchDay === matchDay)
        .flatMap(match => [match.homeTeamId.toString(), match.awayTeamId.toString()]);
    
    // Désactiver les options des équipes qui jouent déjà
    [homeTeamSelect, awayTeamSelect].forEach(select => {
        Array.from(select.options).forEach(option => {
            if (option.value && teamsPlayingThisMatchDay.includes(option.value)) {
                option.disabled = true;
                option.textContent += ' (déjà un match J' + matchDay + ')';
            }
        });
    });
}

// Fonction pour remplir les selects avec les équipes
function populateTeamSelects() {
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    
    if (!homeTeamSelect || !awayTeamSelect) {
        console.log('Éléments select non trouvés - probablement pas sur la page de match');
        return;
    }

    // Mémoriser la sélection en cours pour ne pas la perdre au re-remplissage
    // (rechargement des équipes après synchro Firebase, notamment en édition)
    const previousHome = homeTeamSelect.value;
    const previousAway = awayTeamSelect.value;

    // Vider les selects d'abord
    homeTeamSelect.innerHTML = '<option value="">Sélectionner une équipe</option>';
    awayTeamSelect.innerHTML = '<option value="">Sélectionner une équipe</option>';

    // Ajouter chaque équipe aux deux selects (ordre alphabétique)
    sortedTeamsAlpha().forEach(team => {
        const homeOption = document.createElement('option');
        homeOption.value = team.id;
        homeOption.textContent = `${team.name} (${team.shortName})`;
        homeTeamSelect.appendChild(homeOption);

        const awayOption = document.createElement('option');
        awayOption.value = team.id;
        awayOption.textContent = `${team.name} (${team.shortName})`;
        awayTeamSelect.appendChild(awayOption);
    });

    // Restaurer la sélection si toujours valable
    if (previousHome && [...homeTeamSelect.options].some(o => o.value == previousHome)) {
        homeTeamSelect.value = previousHome;
    }
    if (previousAway && [...awayTeamSelect.options].some(o => o.value == previousAway)) {
        awayTeamSelect.value = previousAway;
    }

    // ← AJOUTER : Filtrer selon la journée si une journée est déjà saisie
    const matchDayInput = document.getElementById('matchDay');
    if (matchDayInput && matchDayInput.value) {
        filterTeamsByMatchDay();
    }
}

// Ajouter un formulaire de but
function addGoalForm() {
    if (!homeTeamId || !awayTeamId) {
        showError('Veuillez d\'abord sélectionner les deux équipes');
        return;
    }

    const goalId = Date.now() + Math.random(); // ID unique
    const goalsContainer = document.getElementById('goalsContainer');
    
    // Compter les buts existants pour la numérotation
    const existingGoals = goalsContainer.querySelectorAll('.goal-form').length;
    const goalNumber = existingGoals + 1;
    
    const goalDiv = document.createElement('div');
    goalDiv.className = 'goal-form';
    goalDiv.setAttribute('data-goal-id', goalId);
    
    goalDiv.innerHTML = `
        <div class="goal-header">
            <h4>But #${goalNumber}</h4>
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
                <input type="text" name="goalScorer" placeholder="Nom du buteur" required
                       list="scorerSuggestions" autocomplete="off">
            </div>
            <div class="form-group minute-group">
                <label>Minute :</label>
                <div class="minute-inputs">
                    <input type="number" name="goalMinute" min="1" max="90" placeholder="45" required>
                    <span class="plus-sign">+</span>
                    <input type="number" name="goalExtraTime" min="0" max="15" value="0" placeholder="0">
                    <span class="minute-indicator" name="halfIndicator"></span>
                </div>
                <small>Minute principale (1-90) + temps additionnel (0-15)</small>
            </div>
        </div>
    `;
    
    goalsContainer.appendChild(goalDiv);
    
    // Ajouter l'écouteur pour le calcul du score et l'indicateur de mi-temps
    const goalTeamSelect = goalDiv.querySelector('select[name="goalTeam"]');
    const minuteInput = goalDiv.querySelector('input[name="goalMinute"]');
    const extraTimeInput = goalDiv.querySelector('input[name="goalExtraTime"]');
    
    goalTeamSelect.addEventListener('change', calculateScore);
    minuteInput.addEventListener('input', function() {
        updateHalfTimeIndicator(goalDiv);
        calculateScore();
    });
    extraTimeInput.addEventListener('input', calculateScore);

    // Autocomplétion du buteur : suggestions filtrées sur l'équipe du but
    // (noms déjà rencontrés + référentiel joueurs). Texte libre autorisé
    // pour un nouveau joueur.
    const scorerInput = goalDiv.querySelector('input[name="goalScorer"]');
    scorerInput.addEventListener('focus', function() {
        updateScorerSuggestions(goalTeamSelect.value);
    });
    goalTeamSelect.addEventListener('change', function() {
        updateScorerSuggestions(goalTeamSelect.value);
    });
}

// Remplit le datalist partagé #scorerSuggestions avec les buteurs connus de
// l'équipe : orthographes déjà saisies dans les matchs (triées par fréquence)
// et joueurs du référentiel passés par ce club.
function updateScorerSuggestions(teamId) {
    let datalist = document.getElementById('scorerSuggestions');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'scorerSuggestions';
        document.body.appendChild(datalist);
    }

    if (!teamId) {
        datalist.innerHTML = '';
        return;
    }

    // Buteurs de la saison EN COURS uniquement : les effectifs changent d'une
    // saison à l'autre, on ne propose pas les buteurs de l'an passé
    const counts = {};
    const seasonName = typeof getCurrentSeason === 'function' ? getCurrentSeason() : null;
    const matches = typeof getStoredMatches === 'function' ? getStoredMatches() : [];
    matches.forEach(m => {
        if (seasonName && m.season !== seasonName) return;
        (m.goals || []).forEach(g => {
            if (String(g.teamId) !== String(teamId) || !g.scorer) return;
            counts[g.scorer] = (counts[g.scorer] || 0) + 1;
        });
    });

    // Joueurs du référentiel dont le club ACTUEL est celui du but (même sans
    // but cette saison — un transféré vers ce club est proposé, un parti non)
    if (typeof playersRegistry !== 'undefined' && typeof plCurrentTeamId === 'function') {
        playersRegistry.forEach(p => {
            if (plCurrentTeamId(p) === String(teamId)) {
                if (!(p.lastName in counts)) counts[p.lastName] = 0;
            }
        });
    }

    datalist.innerHTML = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => `<option value="${name.replace(/"/g, '&quot;')}"></option>`)
        .join('');
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

// Mettre à jour l'indicateur de mi-temps
function updateHalfTimeIndicator(goalDiv) {
    const minuteInput = goalDiv.querySelector('input[name="goalMinute"]');
    const indicator = goalDiv.querySelector('.minute-indicator');
    
    if (minuteInput && indicator) {
        const minute = parseInt(minuteInput.value);
        if (minute >= 1 && minute <= 45) {
            indicator.textContent = '(1ère mi-temps)';
            indicator.className = 'minute-indicator first-half';
        } else if (minute >= 46 && minute <= 90) {
            indicator.textContent = '(2ème mi-temps)';
            indicator.className = 'minute-indicator second-half';
        } else {
            indicator.textContent = '';
            indicator.className = 'minute-indicator';
        }
    }
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
        const extraTimeInput = goalForm.querySelector('input[name="goalExtraTime"]');
        
        if (teamSelect.value && minuteInput.value) {
            const minute = parseInt(minuteInput.value);
            const extraTime = parseInt(extraTimeInput.value) || 0;
            
            // Compter pour le score final
            if (teamSelect.value === homeTeamId) {
                homeScore++;
                // Pour la mi-temps : seulement les buts de la 1ère mi-temps (1-45)
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
            const currentValue = teamSelect.value;
            teamSelect.innerHTML = `
                <option value="">Sélectionner l'équipe</option>
                <option value="${homeTeamId}">${getTeamById(homeTeamId).shortName} (Domicile)</option>
                <option value="${awayTeamId}">${getTeamById(awayTeamId).shortName} (Extérieur)</option>
            `;
            teamSelect.value = currentValue; // Restaurer la sélection
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
    
    if (editingMatchId) {
        // Mode édition - mettre à jour le match existant
        console.log('Modification du match:', editingMatchId);
        if (updateMatch(editingMatchId, matchData)) {
            showSuccess('Match modifié avec succès !');
            
            setTimeout(() => {
                if (confirm('Voulez-vous retourner à l\'historique des matchs ?')) {
                    window.location.href = 'matches.html';
                }
            }, 2000);
        } else {
            showError('Erreur lors de la modification du match');
        }
    } else {
        // Mode création - sauvegarder un nouveau match
        console.log('Création d\'un nouveau match');
        if (saveMatch(matchData)) {
            showSuccess('Match enregistré avec succès !');
            
            setTimeout(() => {
                if (confirm('Voulez-vous voir le tableau des résultats mis à jour ?')) {
                    window.location.href = 'results-table.html';
                }
            }, 2000);
        } else {
            showError('Erreur lors de l\'enregistrement du match');
        }
    }
}

// Valider les données du match
function validateMatch() {
    const homeTeam = document.getElementById('homeTeam').value;
    const awayTeam = document.getElementById('awayTeam').value;
    const matchDateTime = document.getElementById('matchDateTime').value;  // ← Changé
    const matchDay = document.getElementById('matchDay').value;
    
    if (!homeTeam || !awayTeam) {
        showError('Veuillez sélectionner les deux équipes');
        return false;
    }
    
    if (!matchDateTime) {  // ← Changé
        showError('Veuillez saisir la date et heure du match');
        return false;
    }

    const maxMatchDays = (teamsData.length * 2) - 2;
    if (!matchDay || matchDay < 1 || matchDay > maxMatchDays) {
        showError(`Veuillez saisir une journée valide (1 à ${maxMatchDays})`);
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
        const extraTime = parseInt(goalForm.querySelector('input[name="goalExtraTime"]').value) || 0;
        
        goalsData.push({
            teamId: team,
            scorer: scorer,
            minute: minute,
            extraTime: extraTime,
            displayTime: extraTime > 0 ? `${minute}+${extraTime}` : `${minute}'`
        });
    });
    
    // Trier les buts par minute
    goalsData.sort((a, b) => {
        if (a.minute !== b.minute) return a.minute - b.minute;
        return a.extraTime - b.extraTime;
    });
    
    // Récupérer la date/heure du match
    const matchDateTimeInput = document.getElementById('matchDateTime');
    const matchDateTimeValue = matchDateTimeInput ? matchDateTimeInput.value : null;
    const scheduledAt = matchDateTimeValue 
        ? new Date(matchDateTimeValue).toISOString() 
        : null;
    
    // Extraire juste la date (YYYY-MM-DD) pour compatibilité avec l'ancien champ
    const dateOnly = matchDateTimeValue 
        ? matchDateTimeValue.split('T')[0] 
        : new Date().toISOString().split('T')[0];
    
    return {
        date: dateOnly,
        matchDay: parseInt(document.getElementById('matchDay').value),
        homeTeamId: homeTeamId,
        awayTeamId: awayTeamId,
        goals: goalsData,
        finalScore: {
            home: parseInt(document.getElementById('currentHomeScore').textContent),
            away: parseInt(document.getElementById('currentAwayScore').textContent)
        },
        halftimeScore: document.getElementById('halftimeScore').textContent,
        scheduledAt: scheduledAt,
        playedAt: new Date().toISOString()
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

// Afficher un message d'erreur
function showError(message) {
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
// ===============================
// MATCHS DE LA JOURNÉE (depuis le calendrier)
// ===============================
//
// Quand une journée est saisie, on propose directement les affiches prévues
// au calendrier : celles restant à saisir sont cliquables (pré-remplissage
// équipes + horaire), celles déjà enregistrées s'affichent avec leur score
// (modifiables depuis la page Historique).

function renderMatchdayFixtures() {
    const container = document.getElementById('matchdayFixtures');
    if (!container) return;

    const dayValue = parseInt(document.getElementById('matchDay')?.value);

    // Masqué en mode édition ou sans journée valide
    if (!dayValue || dayValue < 1 || editingMatchId) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    const season = typeof getCurrentSeason === 'function' ? getCurrentSeason() : null;
    const future = (typeof loadFutureMatches === 'function' && season)
        ? (loadFutureMatches(season) || [])
        : [];
    const played = getStoredMatches().filter(m =>
        (!season || m.season === season) && m.matchDay == dayValue);

    const playedKeys = new Set(played.map(m => `${m.homeTeamId}-${m.awayTeamId}`));
    const toEnter = future.filter(f =>
        f.matchDay == dayValue && !playedKeys.has(`${f.homeTeamId}-${f.awayTeamId}`));

    if (toEnter.length === 0 && played.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    const short = id => {
        const t = teamsData.find(tm => tm.id == id);
        return t ? t.shortName : '?';
    };

    const timeText = f => {
        if (!f.scheduledAt) return '';
        const d = new Date(f.scheduledAt);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' +
               d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    // Ordre chronologique, puis alphabétique de l'équipe à domicile à heure
    // égale (comme l'onglet Calendrier)
    toEnter.sort((a, b) => {
        const rawA = a.scheduledAt || '';
        const rawB = b.scheduledAt || '';
        if (rawA !== rawB) {
            if (!rawA) return 1;
            if (!rawB) return -1;
            const diff = new Date(rawA) - new Date(rawB);
            if (diff !== 0) return diff;
        }
        return short(a.homeTeamId).localeCompare(short(b.homeTeamId), 'fr');
    });

    let html = `<div class="fixtures-title">📋 Matchs de la journée ${dayValue}</div>`;

    if (toEnter.length > 0) {
        html += '<div class="fixtures-row">' + toEnter.map(f => `
            <button type="button" class="fixture-chip"
                    data-home="${f.homeTeamId}" data-away="${f.awayTeamId}"
                    data-scheduled="${f.scheduledAt || ''}"
                    title="Cliquer pour pré-remplir le formulaire">
                ${short(f.homeTeamId)} – ${short(f.awayTeamId)}
                ${timeText(f) ? `<small>${timeText(f)}</small>` : ''}
            </button>`).join('') + '</div>';
    } else {
        html += '<div class="fixtures-done">✅ Tous les matchs de cette journée sont saisis.</div>';
    }

    if (played.length > 0) {
        html += '<div class="fixtures-row">' + played.map(m => `
            <span class="fixture-chip fixture-played"
                  title="Déjà enregistré — modifiable depuis la page Historique">
                ${short(m.homeTeamId)} ${m.finalScore ? m.finalScore.home + '-' + m.finalScore.away : ''} ${short(m.awayTeamId)}
            </span>`).join('') + '</div>';
    }

    // Ne pas re-rendre un contenu identique : l'événement change (blur du
    // champ Journée) partait juste avant le clic sur une affiche et le clic
    // atterrissait sur un chip détaché du DOM — premier clic perdu
    if (container._lastFixturesHtml === html) {
        container.style.display = 'block';
        return;
    }
    container._lastFixturesHtml = html;
    container.innerHTML = html;
    container.style.display = 'block';
}

// Pré-remplit le formulaire avec une affiche du calendrier
function selectMatchdayFixture(homeId, awayId, scheduledAt) {
    const homeSelect = document.getElementById('homeTeam');
    const awaySelect = document.getElementById('awayTeam');
    if (!homeSelect || !awaySelect) return;

    homeSelect.value = homeId;
    homeSelect.dispatchEvent(new Event('change'));
    // Le change du domicile peut reconstruire la liste extérieure : on
    // sélectionne l'adversaire après coup
    awaySelect.value = awayId;
    awaySelect.dispatchEvent(new Event('change'));

    // Horaire du calendrier s'il est renseigné
    if (scheduledAt && typeof toDatetimeLocalValue === 'function') {
        const input = document.getElementById('matchDateTime');
        if (input) {
            const local = toDatetimeLocalValue(scheduledAt);
            if (local) input.value = local;
        }
    }
}
