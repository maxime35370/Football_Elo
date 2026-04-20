// calendar-schedule.js - Onglet Calendrier (affichage et filtres)

// ===============================
// FILTRES
// ===============================

function populateFilters() {
    // Filtre journées
    const matchdayFilter = document.getElementById('matchdayFilter');
    const allMatchDays = [...new Set([
        ...allMatches.map(m => m.matchDay),
        ...futureMatches.map(m => m.matchDay)
    ])].sort((a, b) => a - b);
    
    matchdayFilter.innerHTML = '<option value="all">Toutes</option>' +
        allMatchDays.map(d => `<option value="${d}">Journée ${d}</option>`).join('');
    
    // Filtre équipes
    const teamFilter = document.getElementById('teamFilter');
    teamFilter.innerHTML = '<option value="all">Toutes</option>' +
        allTeams.map(t => `<option value="${t.id}">${t.shortName}</option>`).join('');
}

function setupFilters() {
    ['matchdayFilter', 'teamFilter', 'statusFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', displaySchedule);
        }
    });
}

// ===============================
// AFFICHAGE DU CALENDRIER
// ===============================

function displaySchedule() {
    const container = document.getElementById('scheduleContent');
    if (!container) return;
    
    // Récupérer les filtres
    const matchdayFilter = document.getElementById('matchdayFilter').value;
    const teamFilter = document.getElementById('teamFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    // Combiner matchs joués et à venir
    const playedWithStatus = allMatches.map(m => ({ ...m, status: 'played' }));

    // Créer un Set des clés des matchs déjà joués (même journée, mêmes équipes)
    const playedKeys = new Set(
        allMatches.map(m => `${m.homeTeamId}-${m.awayTeamId}-${m.matchDay}`)
    );

    // Filtrer les matchs à venir qui n'ont pas encore été joués
    const upcomingWithStatus = futureMatches
        .filter(m => !playedKeys.has(`${m.homeTeamId}-${m.awayTeamId}-${m.matchDay}`))
        .map(m => ({ ...m, status: 'upcoming' }));

    let combinedMatches = [...playedWithStatus, ...upcomingWithStatus];
        
    // Appliquer les filtres
    if (matchdayFilter !== 'all') {
        combinedMatches = combinedMatches.filter(m => m.matchDay == matchdayFilter);
    }
    const isTeamFiltered = teamFilter !== 'all';
    if (isTeamFiltered) {
        combinedMatches = combinedMatches.filter(m =>
            m.homeTeamId == teamFilter || m.awayTeamId == teamFilter
        );
    }
    if (statusFilter !== 'all') {
        combinedMatches = combinedMatches.filter(m => m.status === statusFilter);
    }

    // Classe conditionnelle : quand une équipe est sélectionnée, on
    // compresse l'affichage (2 journées côte à côte sur mobile) et on
    // masque le compteur "X joués, Y à venir" puisqu'il ne reste qu'un
    // match par journée et la couleur du border-left indique le statut.
    container.classList.toggle('team-filtered', isTeamFiltered);
    
    // Grouper par journée
    const matchesByDay = {};
    combinedMatches.forEach(match => {
        const day = match.matchDay || 0;
        if (!matchesByDay[day]) matchesByDay[day] = [];
        matchesByDay[day].push(match);
    });
    
    // Générer le HTML
    const sortedDays = Object.keys(matchesByDay).sort((a, b) => a - b);
    
    if (sortedDays.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:2rem;">Aucun match trouvé</p>';
        return;
    }
    
    container.innerHTML = sortedDays.map(day => {
        const matches = matchesByDay[day];
        const playedCount = matches.filter(m => m.status === 'played').length;
        const upcomingCount = matches.filter(m => m.status === 'upcoming').length;

        // Quand une équipe est sélectionnée, on n'affiche pas le compteur
        // (1 seul match par journée et statut déjà indiqué par la couleur).
        const countHtml = isTeamFiltered
            ? ''
            : `<span class="match-count">${playedCount} joués, ${upcomingCount} à venir</span>`;

        return `
            <div class="matchday-section">
                <div class="matchday-header">
                    <span>Journée ${day}</span>
                    ${countHtml}
                </div>
                <div class="matchday-matches">
                    ${matches.map(match => createMatchCard(match, isTeamFiltered)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function createMatchCard(match, showMatchday = false) {
    const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == match.awayTeamId);

    const isPlayed = match.status === 'played';
    const score = isPlayed ? `${match.finalScore.home} - ${match.finalScore.away}` : 'À venir';

    // Badge "Jxx" affiché uniquement quand une équipe est filtrée,
    // pour voir la journée d'un coup d'œil dans chaque carte.
    const matchdayBadge = showMatchday && match.matchDay
        ? `<span class="match-matchday-badge">J${match.matchDay}</span>`
        : '';

    return `
        <div class="match-card ${match.status}">
            ${matchdayBadge}
            <div class="match-teams">
                <div class="match-team home">${homeTeam ? homeTeam.shortName : '?'}</div>
                <div class="match-team away">${awayTeam ? awayTeam.shortName : '?'}</div>
            </div>
            <div class="match-score ${match.status}">${score}</div>
            <span class="match-status ${match.status}">${isPlayed ? 'Joué' : 'À venir'}</span>
        </div>
    `;
}