// calendar-manual.js - Mode création manuelle des matchs

// ===============================
// MODE CRÉATION MANUELLE
// ===============================

function setupManualMode() {
    document.getElementById('manualModeBtn')?.addEventListener('click', openManualMode);
    document.getElementById('closeManualMode')?.addEventListener('click', closeManualMode);
    document.getElementById('manualMatchDay')?.addEventListener('change', onManualMatchDayChange);
    document.getElementById('saveManualMatches')?.addEventListener('click', saveManualMatches);
    document.getElementById('clearManualMatches')?.addEventListener('click', clearManualMatches);
}

function openManualMode() {
    manualModeActive = true;
    document.getElementById('manualCreationSection').style.display = 'block';
    
    // Trouver la prochaine journée à créer
    const lastPlayedMatchDay = Math.max(...allMatches.map(m => m.matchDay || 0), 0);
    const lastFutureMatchDay = futureMatches.length > 0 
        ? Math.max(...futureMatches.map(m => m.matchDay || 0), 0) 
        : lastPlayedMatchDay;
    
    const maxDay = Math.max((allTeams.length - 1) * 2, 1);
    manualMatchDay = Math.min(Math.max(lastPlayedMatchDay, lastFutureMatchDay) + 1, maxDay);
    
    // Peupler le sélecteur de journées
    populateManualMatchDaySelector();
    
    // Initialiser
    selectedHomeTeam = null;
    createdManualMatches = [];
    
    // Afficher les équipes
    renderAvailableTeams();
    renderCreatedMatches();
    updateMatchCounter();
}

function closeManualMode() {
    manualModeActive = false;
    document.getElementById('manualCreationSection').style.display = 'none';
    selectedHomeTeam = null;
    createdManualMatches = [];
    updateCalendarStatus();
    populateFilters();
    displayActiveTab();
}

function populateManualMatchDaySelector() {
    const select = document.getElementById('manualMatchDay');
    if (!select) return;
    
    const numTeams = allTeams.length;
    // 18 équipes -> 17 adversaires x2 (aller/retour) = 34 journées
    const totalMatchDays = Math.max((numTeams - 1) * 2, 1);

    // Trouver les journées qui ont déjà des matchs
    const existingMatchDays = new Set([
        ...allMatches.map(m => m.matchDay),
        ...futureMatches.map(m => m.matchDay)
    ]);

    // Ne proposer que les journées du championnat — sauf si des matchs
    // existent déjà au-delà (pour pouvoir les rouvrir et les corriger)
    const maxExisting = Math.max(0, ...[...existingMatchDays].filter(d => d));
    const lastDay = Math.max(totalMatchDays, maxExisting);

    let options = '';
    for (let day = 1; day <= lastDay; day++) {
        const hasMatches = existingMatchDays.has(day);
        const label = hasMatches ? `Journée ${day} (existante)` : `Journée ${day}`;
        const selected = day === manualMatchDay ? 'selected' : '';
        options += `<option value="${day}" ${selected}>${label}</option>`;
    }
    
    select.innerHTML = options;
}

function onManualMatchDayChange(event) {
    manualMatchDay = parseInt(event.target.value);
    
    // Charger les matchs existants pour cette journée
    createdManualMatches = futureMatches
        .filter(m => m.matchDay === manualMatchDay)
        .map(m => ({
            id: m.id,
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            scheduledAt: m.scheduledAt || null
        }));
    
    selectedHomeTeam = null;
    renderAvailableTeams();
    renderCreatedMatches();
    updateMatchCounter();
}

function renderAvailableTeams() {
    const container = document.getElementById('availableTeams');
    if (!container) return;
    
    // Trouver les équipes déjà utilisées dans cette journée
    const usedTeamIds = new Set();
    createdManualMatches.forEach(match => {
        usedTeamIds.add(match.homeTeamId);
        usedTeamIds.add(match.awayTeamId);
    });
    
    // Vérifier aussi les matchs déjà joués cette journée
    allMatches.filter(m => m.matchDay === manualMatchDay).forEach(match => {
        usedTeamIds.add(match.homeTeamId);
        usedTeamIds.add(match.awayTeamId);
    });
    
    // Créer un set des confrontations déjà existantes
    const existingConfrontations = new Set();
    allMatches.forEach(match => {
        existingConfrontations.add(`${match.homeTeamId}-${match.awayTeamId}`);
    });
    futureMatches.forEach(match => {
        existingConfrontations.add(`${match.homeTeamId}-${match.awayTeamId}`);
    });
    createdManualMatches.forEach(match => {
        existingConfrontations.add(`${match.homeTeamId}-${match.awayTeamId}`);
    });
    
    // Générer les boutons
    container.innerHTML = allTeams.map(team => {
        const isUsed = usedTeamIds.has(team.id);
        const isSelected = selectedHomeTeam && selectedHomeTeam.id === team.id;
        
        let isAlreadyPlayed = false;
        if (selectedHomeTeam && !isSelected) {
            const confrontationKey = `${selectedHomeTeam.id}-${team.id}`;
            isAlreadyPlayed = existingConfrontations.has(confrontationKey);
        }
        
        const isDisabled = isUsed || isAlreadyPlayed;
        
        let className = 'team-btn';
        if (isDisabled) className += ' disabled';
        if (isSelected) className += ' selected home';
        if (isAlreadyPlayed) className += ' already-played';
        
        let title = '';
        if (isUsed) {
            title = 'Équipe déjà assignée à cette journée';
        } else if (isAlreadyPlayed) {
            title = `${selectedHomeTeam.shortName} a déjà reçu ${team.shortName} cette saison`;
        }
        
        return `
            <button class="${className}" 
                    data-team-id="${team.id}" 
                    ${isDisabled ? 'disabled' : ''}
                    ${title ? `title="${title}"` : ''}
                    onclick="onTeamClick(${team.id})">
                <span class="team-icon">${isSelected ? '🏠' : isAlreadyPlayed ? '🚫' : '⚽'}</span>
                ${team.shortName}
            </button>
        `;
    }).join('');
    
    // Mettre à jour l'indice
    const hint = document.getElementById('selectionHint');
    if (hint) {
        if (selectedHomeTeam) {
            hint.innerHTML = `<strong>${selectedHomeTeam.shortName}</strong> à domicile - Cliquez sur l'équipe <strong>extérieur</strong>`;
            hint.classList.add('away');
        } else {
            hint.innerHTML = `Cliquez sur l'équipe à <strong>domicile</strong>`;
            hint.classList.remove('away');
        }
    }
}

function onTeamClick(teamId) {
    const team = allTeams.find(t => t.id === teamId);
    if (!team) return;
    
    if (!selectedHomeTeam) {
        selectedHomeTeam = team;
    } else {
        if (teamId === selectedHomeTeam.id) {
            selectedHomeTeam = null;
        } else {
            createdManualMatches.push({
                id: Date.now(),
                homeTeamId: selectedHomeTeam.id,
                awayTeamId: teamId,
                scheduledAt: null
            });
            selectedHomeTeam = null;
            renderCreatedMatches();
            updateMatchCounter();
        }
    }
    
    renderAvailableTeams();
}

function renderCreatedMatches() {
    const container = document.getElementById('createdMatchesList');
    if (!container) return;
    
    if (createdManualMatches.length === 0) {
        container.innerHTML = '<div class="empty-matches">Aucun match créé pour cette journée</div>';
        return;
    }
    
    container.innerHTML = createdManualMatches.map((match, index) => {
        const homeTeam = allTeams.find(t => t.id === match.homeTeamId);
        const awayTeam = allTeams.find(t => t.id === match.awayTeamId);
        
        const scheduledValue = match.scheduledAt
            ? toDatetimeLocalValue(match.scheduledAt)
            : '';
        
        return `
            <div class="created-match-item">
                <span class="match-number">#${index + 1}</span>
                <div class="match-teams">
                    <span class="home-team">🏠 ${homeTeam ? homeTeam.shortName : '?'}</span>
                    <span class="vs">vs</span>
                    <span class="away-team">✈️ ${awayTeam ? awayTeam.shortName : '?'}</span>
                </div>
                <div class="match-datetime">
                    <input type="datetime-local" 
                           class="match-scheduled-input"
                           data-index="${index}"
                           value="${scheduledValue}"
                           onchange="updateMatchScheduledAt(${index}, this.value)"
                           title="Date et heure du match">
                </div>
                <button class="swap-match" onclick="swapCreatedMatch(${index})" title="Inverser domicile / extérieur">🔄</button>
                <button class="delete-match" onclick="deleteManualMatch(${index})" title="Supprimer cette affiche">🗑️</button>
            </div>
        `;
    }).join('');
}

function updateMatchScheduledAt(index, value) {
    if (createdManualMatches[index]) {
        createdManualMatches[index].scheduledAt = value 
            ? new Date(value).toISOString() 
            : null;
    }
}

// Inverser domicile / extérieur d'une affiche (ex. la ligue a inversé la
// rencontre) — refusé si le sens inverse existe déjà ailleurs dans la saison
function swapCreatedMatch(index) {
    const match = createdManualMatches[index];
    if (!match) return;

    const reversedKey = `${match.awayTeamId}-${match.homeTeamId}`;
    const existsInPlayed = allMatches.some(m => `${m.homeTeamId}-${m.awayTeamId}` === reversedKey);
    const existsInFuture = futureMatches.some(m =>
        `${m.homeTeamId}-${m.awayTeamId}` === reversedKey && m.matchDay !== manualMatchDay);
    const existsInCreated = createdManualMatches.some((m, i) =>
        i !== index && `${m.homeTeamId}-${m.awayTeamId}` === reversedKey);

    if (existsInPlayed || existsInFuture || existsInCreated) {
        const home = allTeams.find(t => t.id === match.awayTeamId);
        const away = allTeams.find(t => t.id === match.homeTeamId);
        alert(`⚠️ Impossible d'inverser : ${home ? home.shortName : '?'} - ${away ? away.shortName : '?'} existe déjà cette saison (match joué ou affiche du calendrier).`);
        return;
    }

    const previousHome = match.homeTeamId;
    match.homeTeamId = match.awayTeamId;
    match.awayTeamId = previousHome;

    renderAvailableTeams();
    renderCreatedMatches();
}

function deleteManualMatch(index) {
    createdManualMatches.splice(index, 1);
    renderAvailableTeams();
    renderCreatedMatches();
    updateMatchCounter();
}

function updateMatchCounter() {
    const counter = document.getElementById('matchCounter');
    const max = document.getElementById('maxMatches');
    
    if (counter) counter.textContent = createdManualMatches.length;
    if (max) max.textContent = Math.floor(allTeams.length / 2);
}

function applyBulkDatetime() {
    const input = document.getElementById('bulkDatetime');
    if (!input || !input.value) {
        alert('Sélectionnez d\'abord une date/heure');
        return;
    }
    
    const scheduledAt = new Date(input.value).toISOString();
    
    createdManualMatches.forEach(match => {
        match.scheduledAt = scheduledAt;
    });
    
    renderCreatedMatches();
    alert(`✅ Date appliquée à ${createdManualMatches.length} match(s)`);
}

function saveManualMatches() {
    // Journée vidée : autoriser la sauvegarde pour supprimer les affiches
    // restantes (ex. affiche inversée par la ligue à recréer ailleurs)
    if (createdManualMatches.length === 0) {
        const existing = futureMatches.filter(m => m.matchDay === manualMatchDay);
        if (existing.length === 0) {
            alert('Aucun match à sauvegarder !');
            return;
        }
        if (!confirm(`Aucun match dans la liste : sauvegarder supprimera ${existing.length > 1 ? `les ${existing.length} affiches restantes` : `l'affiche restante`} de la journée ${manualMatchDay} du calendrier. Continuer ?`)) {
            return;
        }
    }


    // Supprimer les anciens matchs de cette journée
    futureMatches = futureMatches.filter(m => m.matchDay !== manualMatchDay);
    
    // Ajouter les nouveaux matchs
    createdManualMatches.forEach(match => {
        futureMatches.push({
            id: match.id,
            season: currentSeason,
            matchDay: manualMatchDay,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            status: 'upcoming',
            scheduledAt: match.scheduledAt || null
        });
    });
    
    // Sauvegarder (en réinjectant les affiches déjà jouées, écartées de
    // futureMatches en mémoire, pour ne pas les effacer du calendrier)
    saveFutureMatches(currentSeason, [...futureMatches, ...(typeof playedFixturesAside !== 'undefined' ? playedFixturesAside : [])]);

    // Mettre à jour l'affichage
    updateCalendarStatus();
    populateManualMatchDaySelector();
    
    if (createdManualMatches.length === 0) {
        alert(`✅ Affiches supprimées : la journée ${manualMatchDay} ne contient plus de match à venir.`);
        // Rester sur la journée pour vérifier le résultat
        onManualMatchDayChange({ target: { value: manualMatchDay } });
        return;
    }

    alert(`✅ ${createdManualMatches.length} matchs sauvegardés pour la journée ${manualMatchDay} !`);

    // Passer à la journée suivante
    manualMatchDay++;
    document.getElementById('manualMatchDay').value = manualMatchDay;
    onManualMatchDayChange({ target: { value: manualMatchDay } });
}

function clearManualMatches() {
    if (createdManualMatches.length === 0) return;
    
    if (!confirm('Réinitialiser tous les matchs de cette journée ?')) return;
    
    // Supprimer aussi de futureMatches si déjà sauvegardés
    futureMatches = futureMatches.filter(m => m.matchDay !== manualMatchDay);
    saveFutureMatches(currentSeason, [...futureMatches, ...(typeof playedFixturesAside !== 'undefined' ? playedFixturesAside : [])]);
    
    createdManualMatches = [];
    selectedHomeTeam = null;
    renderAvailableTeams();
    renderCreatedMatches();
    updateMatchCounter();
    updateCalendarStatus();
}