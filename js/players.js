// players.js - Référentiel des joueurs (buteurs)
//
// Les buts d'un match ne stockent qu'un nom de buteur en texte libre + le
// teamId du club au moment du but. Ce module ajoute une couche "joueur" :
//   - fusion des orthographes différentes d'un même joueur (alias),
//   - historique de clubs (stints) pour suivre les transferts au mercato,
//   - labels d'affichage désambiguïsés quand deux joueurs partagent le même
//     nom de famille (préfixe du prénom : "Traoré Ham" / "Traoré Har").
//
// Un joueur du référentiel :
// {
//   id: 'pl_...',
//   lastName: 'Traoré',        // nom affiché de base
//   firstName: 'Hamari',       // optionnel, sert à la désambiguïsation
//   customLabel: '',           // optionnel, remplace lastName (homonymes)
//   aliases: ['traore'],       // orthographes normalisées reconnues
//   stints: [                  // clubs successifs, le dernier = club actuel
//     { teamId: '7', season: '2025-2026', phase: 'start' },
//     { teamId: '3', season: '2025-2026', phase: 'mercato' }
//   ]
// }

const PLAYERS_STORAGE_KEY = 'footballEloPlayers';

let playersRegistry = [];

// ===============================
// NORMALISATION DES NOMS
// ===============================

// Clé de comparaison : minuscules, sans accents, tirets/apostrophes → espace.
// "Traoré" et "Traore" produisent la même clé (les fautes d'accent sont
// automatiquement rapprochées) ; le reste passe par les alias du référentiel.
function plNormalizeName(name) {
    if (!name) return '';
    return String(name)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[-']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

// ===============================
// CHARGEMENT / SAUVEGARDE
// ===============================

function getStoredPlayers() {
    try {
        const raw = localStorage.getItem(PLAYERS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Erreur lecture référentiel joueurs:', e);
        return [];
    }
}

// Accès sûr à firebaseService : si firebase-service.js a échoué à s'exécuter
// (hors-ligne, CDN bloqué), son `const` reste en zone morte temporelle et
// même `typeof` lève une ReferenceError — d'où le try/catch.
function plFirebaseService() {
    try {
        return typeof firebaseService !== 'undefined' ? firebaseService : null;
    } catch (e) {
        return null;
    }
}

// Charge le référentiel (Firebase prioritaire, localStorage en secours)
// et le garde en mémoire dans playersRegistry.
async function loadPlayersRegistry() {
    let players = getStoredPlayers();

    const fb = plFirebaseService();
    if (fb && navigator.onLine) {
        try {
            const remote = await fb.getPlayers();
            if (remote && remote.length > 0) {
                players = remote;
                localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players));
            }
        } catch (e) {
            console.warn('Référentiel joueurs : Firebase indisponible, localStorage utilisé', e);
        }
    }

    playersRegistry = players;
    return playersRegistry;
}

async function savePlayersRegistry() {
    localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(playersRegistry));

    const fb = plFirebaseService();
    if (fb && navigator.onLine) {
        try {
            await fb.savePlayers(playersRegistry);
        } catch (e) {
            console.error('Erreur sauvegarde Firebase du référentiel joueurs:', e);
        }
    }
}

// ===============================
// RÉSOLUTION BUT → JOUEUR
// ===============================

// Retrouve le joueur du référentiel correspondant à un nom de buteur et au
// club pour lequel le but a été marqué. null si inconnu du référentiel.
// fullName (goal.scorerFull, quand il existe) est testé en premier : c'est
// lui qui permet de départager deux homonymes du même club.
function plResolvePlayer(scorerName, teamId, fullName) {
    const keys = [];
    if (fullName) keys.push(plNormalizeName(fullName));
    const shortKey = plNormalizeName(scorerName);
    if (shortKey && !keys.includes(shortKey)) keys.push(shortKey);

    for (const key of keys) {
        if (!key) continue;
        const found = playersRegistry.find(p =>
            (p.aliases || []).includes(key) &&
            (p.stints || []).some(s => String(s.teamId) === String(teamId))
        );
        if (found) return found;
    }
    return null;
}

// Club actuel d'un joueur = dernier stint enregistré.
function plCurrentTeamId(player) {
    const stints = player.stints || [];
    return stints.length > 0 ? String(stints[stints.length - 1].teamId) : null;
}

// ===============================
// AGRÉGATION DES BUTEURS
// ===============================

// Agrège les buts d'une liste de matchs (déjà filtrée par saison) en lignes
// de classement. Les buts d'un joueur du référentiel sont fusionnés entre
// ses clubs ; les buteurs inconnus sont regroupés par (nom normalisé, club).
//
// Retour : [{ playerId|null, name, firstName, customLabel,
//             clubs: [{teamId, goals}], goals, matchGoals: {matchId: n} }]
function plComputeScorerRows(matches) {
    const rows = {};

    matches.forEach(match => {
        (match.goals || []).forEach(goal => {
            if (!goal.scorer) return;
            const teamId = String(goal.teamId);
            const player = plResolvePlayer(goal.scorer, teamId, goal.scorerFull);

            const bucketKey = player
                ? `pl_${player.id}`
                : `k_${plNormalizeName(goal.scorerFull || goal.scorer)}_${teamId}`;

            if (!rows[bucketKey]) {
                rows[bucketKey] = {
                    playerId: player ? player.id : null,
                    name: player ? (player.lastName || goal.scorer) : goal.scorer,
                    // Clé de regroupement des lignes hors référentiel (sert à
                    // retrouver les buts du joueur dans la modale des matchs)
                    nameKey: player ? null : plNormalizeName(goal.scorerFull || goal.scorer),
                    firstName: player ? (player.firstName || '') : '',
                    customLabel: player ? (player.customLabel || '') : '',
                    clubs: {},
                    goals: 0,
                    matchGoals: {}
                };
            }

            const row = rows[bucketKey];
            row.goals++;
            if (!row.clubs[teamId]) {
                // firstDay mémorise la 1re journée avec but pour ce club :
                // les clubs s'affichent en ordre chronologique (avant/après
                // mercato), pas dans l'ordre numérique des ids
                row.clubs[teamId] = { goals: 0, firstDay: match.matchDay || 0 };
            }
            row.clubs[teamId].goals++;
            row.clubs[teamId].firstDay = Math.min(row.clubs[teamId].firstDay, match.matchDay || 0);
            if (match.id != null) {
                row.matchGoals[match.id] = (row.matchGoals[match.id] || 0) + 1;
            }
        });
    });

    return Object.values(rows)
        .map(r => ({
            ...r,
            clubs: Object.entries(r.clubs)
                .map(([teamId, c]) => ({ teamId, goals: c.goals, firstDay: c.firstDay }))
                .sort((a, b) => a.firstDay - b.firstDay)
        }))
        .sort((a, b) => b.goals - a.goals);
}

// ===============================
// LABELS DÉSAMBIGUÏSÉS
// ===============================

// Plus petit préfixe du prénom qui distingue firstName des autres prénoms
// du groupe : "Hamari" vs "Harnold" → "Ham" / "Har".
function plDistinguishingPrefix(firstName, otherFirstNames) {
    let len = 1;
    while (len < firstName.length &&
           otherFirstNames.some(o =>
               o.slice(0, len).toLowerCase() === firstName.slice(0, len).toLowerCase())) {
        len++;
    }
    return firstName.slice(0, len);
}

// Attribue à chaque ligne un label d'affichage unique dans le listing :
//   1. surnom (customLabel) s'il est défini,
//   2. nom seul si personne d'autre ne le porte,
//   3. nom + préfixe du prénom ("Traoré Ham") si les prénoms sont connus,
//   4. nom + club ("Martin (SRFC)") sinon,
//   5. nom + numéro en dernier recours (homonymes du même club sans prénom).
// teams est optionnel (sert au fallback par club).
function plBuildLabels(rows, teams) {
    const byBase = {};
    rows.forEach(row => {
        const base = row.customLabel || row.name;
        const k = plNormalizeName(base);
        if (!byBase[k]) byBase[k] = [];
        byBase[k].push(row);
    });

    rows.forEach(row => {
        const base = row.customLabel || row.name;
        const group = byBase[plNormalizeName(base)];

        if (group.length === 1 || row.customLabel) {
            row.label = base;
            return;
        }

        const others = group.filter(r => r !== row);

        if (row.firstName && others.every(r => r.firstName)) {
            const prefix = plDistinguishingPrefix(row.firstName, others.map(r => r.firstName));
            row.label = `${base} ${prefix}`;
            return;
        }

        // Prénoms inconnus : on distingue par le club (si différent)
        const myClub = row.clubs.length > 0 ? row.clubs[row.clubs.length - 1].teamId : null;
        const sameClubClash = others.some(r => {
            const oClub = r.clubs.length > 0 ? r.clubs[r.clubs.length - 1].teamId : null;
            return String(oClub) === String(myClub);
        });

        if (!sameClubClash && myClub && teams) {
            const team = teams.find(t => String(t.id) === String(myClub));
            row.label = team ? `${base} (${team.shortName})` : base;
            return;
        }

        row.label = `${base} (${group.indexOf(row) + 1})`;
    });

    return rows;
}

// ===============================
// AIDES DIVERSES
// ===============================

// Icônes ballon pour n buts dans un match : ⚽, ⚽⚽, ⚽⚽⚽…
function plGoalBalls(n) {
    return '⚽'.repeat(Math.max(0, n));
}

// Total saison d'un joueur du référentiel, tous clubs confondus, à partir
// d'une liste de matchs déjà filtrée par saison.
function plSeasonGoals(player, matches) {
    let total = 0;
    matches.forEach(match => {
        (match.goals || []).forEach(goal => {
            if (plResolvePlayer(goal.scorer, String(goal.teamId), goal.scorerFull) === player) total++;
        });
    });
    return total;
}

// ===============================
// MODALE "MATCHS DU JOUEUR"
// ===============================
//
// Les tableaux de buteurs enregistrent leurs lignes ici, puis chaque ligne
// est cliquable via plOpenScorerModal(listId, index) — les attributs onclick
// ne peuvent pas transporter d'objets.

const plScorerLists = {};

function plRegisterScorerRows(listId, rows, matches, teams) {
    plScorerLists[listId] = { rows, matches, teams };
}

function plOpenScorerModal(listId, index) {
    const list = plScorerLists[listId];
    if (!list || !list.rows[index]) return;
    const row = list.rows[index];
    const { matches, teams } = list;

    const teamShort = id => {
        const t = teams.find(tm => String(tm.id) === String(id));
        return t ? t.shortName : `#${id}`;
    };

    // Une section par club (dans l'ordre des stints/buts) : tous les matchs
    // du club sur la saison, ballon(s) sur ceux où le joueur a marqué.
    const sections = row.clubs.map(club => {
        const clubMatches = matches
            .filter(m => String(m.homeTeamId) === String(club.teamId) ||
                         String(m.awayTeamId) === String(club.teamId))
            .sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));

        const lines = clubMatches.map(m => {
            // Buts du joueur dans CE match pour CE club
            let goalsInMatch = 0;
            (m.goals || []).forEach(g => {
                if (String(g.teamId) !== String(club.teamId)) return;
                const p = row.playerId
                    ? plResolvePlayer(g.scorer, String(g.teamId), g.scorerFull)
                    : null;
                if (row.playerId) {
                    if (p && p.id === row.playerId) goalsInMatch++;
                } else if (plNormalizeName(g.scorerFull || g.scorer) === row.nameKey) {
                    goalsInMatch++;
                }
            });

            let dateText = '';
            const raw = m.scheduledAt || m.date;
            if (raw) {
                const d = new Date(raw);
                if (!isNaN(d.getTime())) {
                    dateText = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                }
            }

            const score = m.finalScore ? `${m.finalScore.home}-${m.finalScore.away}` : '?';

            return `
                <div class="pm-match${goalsInMatch > 0 ? ' pm-scored' : ''}">
                    <span class="pm-day">J${m.matchDay || '?'}</span>
                    <span class="pm-date">${dateText}</span>
                    <span class="pm-teams">${teamShort(m.homeTeamId)} ${score} ${teamShort(m.awayTeamId)}</span>
                    <span class="pm-balls">${plGoalBalls(goalsInMatch)}</span>
                </div>`;
        }).join('');

        return `
            <div class="pm-club-section">
                <h4>${teamShort(club.teamId)} <span class="pm-club-goals">⚽ ${club.goals} but${club.goals > 1 ? 's' : ''}</span></h4>
                ${lines || '<p class="pm-empty">Aucun match joué</p>'}
            </div>`;
    }).join('');

    const label = row.label || row.name;
    const fullName = row.firstName ? `${row.firstName} ${row.name}` : label;

    let overlay = document.getElementById('playerMatchesModal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'playerMatchesModal';
        overlay.className = 'pm-overlay';
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closePlayerMatchesModal();
        });
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="pm-box">
            <button class="pm-close" onclick="closePlayerMatchesModal()">✖</button>
            <h3>⚽ ${fullName}</h3>
            <p class="pm-total">${row.goals} but${row.goals > 1 ? 's' : ''} cette saison${row.clubs.length > 1 ? ` (${row.clubs.map(c => `${teamShort(c.teamId)} ${c.goals}`).join(' + ')})` : ''}</p>
            ${sections}
        </div>`;
    overlay.style.display = 'flex';
}

function closePlayerMatchesModal() {
    const overlay = document.getElementById('playerMatchesModal');
    if (overlay) overlay.style.display = 'none';
}
