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
    if (teamFilter !== 'all') {
        combinedMatches = combinedMatches.filter(m => 
            m.homeTeamId == teamFilter || m.awayTeamId == teamFilter
        );
    }
    if (statusFilter !== 'all') {
        combinedMatches = combinedMatches.filter(m => m.status === statusFilter);
    }
    
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
        
        return `
            <div class="matchday-section">
                <div class="matchday-header">
                    <span>Journée ${day}</span>
                    <span class="match-count">${playedCount} joués, ${upcomingCount} à venir</span>
                </div>
                <div class="matchday-matches">
                    ${matches.map(match => createMatchCard(match)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function createMatchCard(match) {
    const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
    
    const isPlayed = match.status === 'played';
    const score = isPlayed ? `${match.finalScore.home} - ${match.finalScore.away}` : 'À venir';
    
    return `
        <div class="match-card ${match.status}">
            <div class="match-teams">
                <div class="match-team home">${homeTeam ? homeTeam.shortName : '?'}</div>
                <div class="match-team away">${awayTeam ? awayTeam.shortName : '?'}</div>
            </div>
            <div class="match-score ${match.status}">${score}</div>
            <span class="match-status ${match.status}">${isPlayed ? 'Joué' : 'À venir'}</span>
        </div>
    `;
}