// =====================================================
// ⚽ AUTO-UPDATE & IMPORT DES RÉSULTATS DE MATCHS
// match-auto-update.js
// Module console — Source : API publique ESPN (gratuit)
//
// Usage console :
//   await testESPN();
//   await fetchLigue1Matches('2026-02-22');
//   await previewMatchUpdates(23);
//   await applyMatchUpdates(23);
//   await importESPNDate('2026-02-22');      ← NOUVEAU
//   await importESPNDate('2026-02-22', 23);  ← avec journée forcée
//   matchUpdateHelp();
// =====================================================

const ESPN_API = {
    scoreboardUrl: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard',
    summaryUrl: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/summary',
    corsProxy: '' // Si CORS bloqué : ESPN_API.corsProxy = 'https://corsproxy.io/?';
};


// ===============================
// 1. TEAM MAPPING
// ===============================

const TEAM_MAPPING = {
    'Paris Saint-Germain': { id: 1, short: 'PSG' },
    'PSG':                 { id: 1, short: 'PSG' },
    'Olympique Lyonnais':  { id: 3, short: 'OL' },
    'Lyon':                { id: 3, short: 'OL' },
    'AS Monaco':           { id: 4, short: 'ASM' },
    'Monaco':              { id: 4, short: 'ASM' },
    'LOSC Lille':          { id: 5, short: 'LOSC' },
    'Lille':               { id: 5, short: 'LOSC' },
    'RC Strasbourg':       { id: 8, short: 'RCSA' },
    'Strasbourg':          { id: 8, short: 'RCSA' },
    'RC Strasbourg Alsace':{ id: 8, short: 'RCSA' },
    'Olympique de Marseille': { id: 9, short: 'OM' },
    'Marseille':           { id: 9, short: 'OM' },
    'Angers SCO':          { id: 10, short: 'SCO' },
    'Angers':              { id: 10, short: 'SCO' },
    'OGC Nice':            { id: 11, short: 'OGCN' },
    'Nice':                { id: 11, short: 'OGCN' },
    'Stade Rennais':       { id: 12, short: 'SRFC' },
    'Rennes':              { id: 12, short: 'SRFC' },
    'Stade Rennais FC':    { id: 12, short: 'SRFC' },
    'RC Lens':             { id: 13, short: 'RCL' },
    'Lens':                { id: 13, short: 'RCL' },
    'Toulouse FC':         { id: 14, short: 'TFC' },
    'Toulouse':            { id: 14, short: 'TFC' },
    'Le Havre AC':         { id: 15, short: 'HAC' },
    'Le Havre':            { id: 15, short: 'HAC' },
    'Paris FC':            { id: 16, short: 'PFC' },
    'Stade Brestois 29':   { id: 17, short: 'SB29' },
    'Brest':               { id: 17, short: 'SB29' },
    'FC Nantes':           { id: 18, short: 'FCN' },
    'Nantes':              { id: 18, short: 'FCN' },
    'FC Lorient':          { id: 19, short: 'FCL' },
    'Lorient':             { id: 19, short: 'FCL' },
    'AJ Auxerre':          { id: 20, short: 'AJA' },
    'Auxerre':             { id: 20, short: 'AJA' },
    'Montpellier HSC':     { id: 21, short: 'FCM' },
    'Montpellier':         { id: 21, short: 'FCM' },
    'AS Saint-Étienne':    { id: null, short: 'ASSE' },
    'Saint-Étienne':       { id: null, short: 'ASSE' },
    'Stade de Reims':      { id: null, short: 'SDR' },
    'Reims':               { id: null, short: 'SDR' },
};

function findLocalTeamId(espnName) {
    if (!espnName) return null;
    
    if (TEAM_MAPPING[espnName]) return TEAM_MAPPING[espnName];
    
    const lower = espnName.toLowerCase();
    for (const [name, data] of Object.entries(TEAM_MAPPING)) {
        if (name.toLowerCase() === lower) return data;
    }
    for (const [name, data] of Object.entries(TEAM_MAPPING)) {
        if (name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase())) {
            return data;
        }
    }
    
    if (typeof allTeams !== 'undefined') {
        const team = allTeams.find(t => {
            const tName = (t.name || t.fullName || '').toLowerCase();
            const tShort = (t.shortName || '').toLowerCase();
            return tName.includes(lower) || lower.includes(tName) || tShort === lower;
        });
        if (team) return { id: team.id, short: team.shortName };
    }
    
    return null;
}


// ===============================
// 2. APPELS ESPN
// ===============================

async function espnFetch(url) {
    const fullUrl = ESPN_API.corsProxy + url;
    const response = await fetch(fullUrl);
    if (!response.ok) throw new Error(`ESPN Error: ${response.status} ${response.statusText}`);
    return await response.json();
}

function extractLastName(fullName) {
    if (!fullName || fullName === 'Inconnu') return fullName;
    const parts = fullName.trim().split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

function convertGoalsToLocalFormat(espnGoals, espnMatch) {
    return espnGoals.map(goal => {
        const teamLocal = findLocalTeamId(goal.team);
        let teamId = null;
        if (teamLocal?.id) {
            teamId = String(teamLocal.id);
        } else if (espnMatch) {
            const homeName = espnMatch.homeApi?.toLowerCase() || '';
            const goalTeam = (goal.team || '').toLowerCase();
            teamId = goalTeam.includes(homeName) || homeName.includes(goalTeam)
                ? String(espnMatch.homeTeamId)
                : String(espnMatch.awayTeamId);
        }

        const extra = goal.extraTime || 0;
        const displayTime = extra > 0 ? `${goal.minute}+${extra}'` : `${goal.minute}'`;

        return {
            scorer: extractLastName(goal.scorer),
            // Nom complet ESPN conservé : permet de différencier deux joueurs
            // du même nom de famille dans le même club (référentiel joueurs)
            scorerFull: goal.scorer && goal.scorer !== 'Inconnu' ? goal.scorer : null,
            minute: goal.minute,
            extraTime: extra,
            teamId: teamId,
            displayTime: displayTime
        };
    });
}


// ===============================
// 3. DÉTECTION AUTO DE LA JOURNÉE
// ===============================

/**
 * Détecte la journée à partir d'une date ESPN
 * en cherchant dans futureMatches et allMatches les matchs
 * proches de cette date (±3 jours)
 */
function detectMatchDay(espnDate) {
    const target = new Date(espnDate);
    const targetTime = target.getTime();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    
    // Collecter tous les matchs avec une date et une journée
    const allWithDates = [];
    
    // Depuis allMatches
    if (typeof allMatches !== 'undefined') {
        allMatches.forEach(m => {
            const d = m.scheduledAt || m.date || m.playedAt;
            if (d && m.matchDay) {
                allWithDates.push({ date: new Date(d), matchDay: m.matchDay });
            }
        });
    }
    
    // Depuis futureMatches
    if (typeof futureMatches !== 'undefined') {
        futureMatches.forEach(m => {
            const d = m.scheduledAt || m.date;
            if (d && m.matchDay) {
                allWithDates.push({ date: new Date(d), matchDay: m.matchDay });
            }
        });
    }
    
    if (allWithDates.length === 0) {
        console.warn('⚠️ Aucun match avec date trouvé pour détecter la journée');
        return null;
    }
    
    // Trouver les matchs dans la fenêtre ±3 jours
    const nearby = allWithDates.filter(m => 
        Math.abs(m.date.getTime() - targetTime) <= THREE_DAYS
    );
    
    if (nearby.length === 0) {
        // Fallback : trouver le match le plus proche
        allWithDates.sort((a, b) => 
            Math.abs(a.date.getTime() - targetTime) - Math.abs(b.date.getTime() - targetTime)
        );
        const closest = allWithDates[0];
        const daysDiff = Math.round(Math.abs(closest.date.getTime() - targetTime) / (24*60*60*1000));
        console.warn(`⚠️ Aucun match dans ±3 jours. Le plus proche : J${closest.matchDay} (${daysDiff} jours d'écart)`);
        return null;
    }
    
    // Compter les occurrences par journée
    const counts = {};
    nearby.forEach(m => {
        counts[m.matchDay] = (counts[m.matchDay] || 0) + 1;
    });
    
    // Retourner la journée la plus fréquente
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const matchDay = parseInt(best[0]);
    
    console.log(`🔍 Journée détectée : J${matchDay} (${best[1]} match(s) proches du ${espnDate.split('T')[0]})`);
    return matchDay;
}


// ===============================
// 4. CALCUL MI-TEMPS
// ===============================

function calculateHalftimeScore(goals, homeTeamId) {
    let homeHT = 0, awayHT = 0;
    
    if (goals && goals.length > 0) {
        goals.forEach(goal => {
            const minute = parseInt(goal.minute);
            if (minute <= 45) {
                if (String(goal.teamId) === String(homeTeamId)) {
                    homeHT++;
                } else {
                    awayHT++;
                }
            }
        });
    }
    
    return `${homeHT} - ${awayHT}`;
}


// ===============================
// 5. TEST DE CONNEXION
// ===============================

async function testESPN() {
    try {
        console.log('🔍 Test de connexion ESPN...');
        const data = await espnFetch(ESPN_API.scoreboardUrl);
        
        const events = data.events || [];
        const league = data.leagues?.[0];
        
        console.log('✅ Connexion ESPN réussie !');
        console.log(`📋 Ligue: ${league?.name || 'Ligue 1'} — Saison ${league?.season?.year || '?'}`);
        console.log(`📅 ${events.length} match(s) affichés`);
        
        events.forEach(e => {
            const home = e.competitions[0]?.competitors?.find(c => c.homeAway === 'home');
            const away = e.competitions[0]?.competitors?.find(c => c.homeAway === 'away');
            const status = e.status?.type?.description || '?';
            console.log(`  ${home?.team?.displayName || '?'} ${home?.score || '?'}-${away?.score || '?'} ${away?.team?.displayName || '?'} [${status}]`);
        });
        
        return data;
    } catch (e) {
        console.error('❌ Erreur ESPN:', e.message);
        if (e.message.includes('CORS') || e.message.includes('Failed to fetch')) {
            console.log("💡 CORS bloqué ! Tape :");
            console.log("   ESPN_API.corsProxy = 'https://corsproxy.io/?';");
            console.log('   puis réessaie: await testESPN()');
        }
        return null;
    }
}


// ===============================
// 6. RÉCUPÉRATION DES MATCHS
// ===============================

async function fetchLigue1Matches(date) {
    const dateFormatted = date.replace(/-/g, '');
    console.log(`🔍 Matchs Ligue 1 du ${date}...`);
    
    const data = await espnFetch(`${ESPN_API.scoreboardUrl}?dates=${dateFormatted}`);
    const events = data.events || [];
    
    console.log(`📋 ${events.length} match(s) trouvé(s)`);
    
    const parsed = events.map(e => parseESPNEvent(e));
    parsed.forEach(m => {
        const score = m.finalScore ? `${m.finalScore.home}-${m.finalScore.away}` : 'à venir';
        const mapping = m.homeTeamId && m.awayTeamId ? '✅' : '⚠️';
        console.log(`  ${mapping} ${m.homeShort} ${score} ${m.awayShort} [${m.status}]`);
    });
    
    return parsed;
}

async function fetchMatchDayFromESPN(matchDay) {
    console.log(`🔍 Recherche des matchs de la Journée ${matchDay}...`);
    
    const localMatches = [
        ...allMatches.filter(m => m.matchDay === matchDay),
        ...(typeof futureMatches !== 'undefined' ? futureMatches.filter(m => m.matchDay === matchDay) : [])
    ];
    
    const seen = new Set();
    const uniqueLocal = localMatches.filter(m => {
        const key = `${m.homeTeamId}-${m.awayTeamId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    
    if (uniqueLocal.length === 0) {
        console.log('❌ Aucun match local pour cette journée');
        return { localMatches: [], espnMatches: [] };
    }
    
    const dates = new Set();
    uniqueLocal.forEach(m => {
        if (m.scheduledAt) {
            const d = new Date(m.scheduledAt).toISOString().split('T')[0];
            dates.add(d);
        }
    });
    
    if (dates.size === 0) {
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            dates.add(d.toISOString().split('T')[0]);
        }
    }
    
    console.log(`📅 Dates à vérifier: ${[...dates].join(', ')}`);
    
    const allESPNEvents = [];
    for (const date of dates) {
        try {
            const dateFormatted = date.replace(/-/g, '');
            const data = await espnFetch(`${ESPN_API.scoreboardUrl}?dates=${dateFormatted}`);
            allESPNEvents.push(...(data.events || []));
        } catch (e) {
            console.warn(`⚠️ Erreur pour ${date}:`, e.message);
        }
    }
    
    console.log(`📋 ${allESPNEvents.length} match(s) ESPN récupérés`);
    
    return { localMatches: uniqueLocal, espnMatches: allESPNEvents.map(e => parseESPNEvent(e)) };
}


// ===============================
// 7. PARSING ESPN
// ===============================

function parseESPNEvent(event) {
    const competition = event.competitions?.[0];
    if (!competition) return null;
    
    const homeComp = competition.competitors?.find(c => c.homeAway === 'home');
    const awayComp = competition.competitors?.find(c => c.homeAway === 'away');
    
    const homeApiName = homeComp?.team?.displayName || '?';
    const awayApiName = awayComp?.team?.displayName || '?';
    const homeLocal = findLocalTeamId(homeApiName);
    const awayLocal = findLocalTeamId(awayApiName);
    
    const statusType = event.status?.type?.name;
    const isFinished = statusType === 'STATUS_FULL_TIME' || statusType === 'STATUS_FINAL';
    
    return {
        espnId: event.id,
        date: event.date,
        status: event.status?.type?.description || '?',
        statusType,
        isFinished,
        homeApi: homeApiName,
        awayApi: awayApiName,
        homeTeamId: homeLocal?.id || null,
        awayTeamId: awayLocal?.id || null,
        homeShort: homeLocal?.short || homeApiName,
        awayShort: awayLocal?.short || awayApiName,
        finalScore: isFinished ? {
            home: parseInt(homeComp?.score) || 0,
            away: parseInt(awayComp?.score) || 0
        } : null,
        _raw: event
    };
}


// ===============================
// 8. DÉTAILS (buteurs, cartons, stats)
// ===============================

// L'horloge ESPN inclut le temps additionnel : "90'+6'" → minute 90, +6.
// parseInt seul s'arrêtait à 90 et perdait le temps additionnel.
function parseEspnClock(displayValue) {
    const m = String(displayValue || '').match(/(\d+)\s*'?\s*(?:\+\s*(\d+))?/);
    if (!m) return { minute: 0, extraTime: 0 };
    return { minute: parseInt(m[1]) || 0, extraTime: parseInt(m[2]) || 0 };
}

async function fetchMatchDetail(espnId) {
    const data = await espnFetch(`${ESPN_API.summaryUrl}?event=${espnId}`);
    
    const result = { goals: [], cards: [], stats: null };
    
    // --- Méthode 1: keyEvents ---
    const keyEvents = data.keyEvents || [];
    keyEvents.forEach(ke => {
        const play = ke.play || ke;
        const type = play.type?.text || '';
        const clock = parseEspnClock(play.clock?.displayValue);
        const minute = clock.minute;

        if (type.includes('Goal') || play.scoringPlay) {
            const scorer = (play.participants || []).find(p => p.type === 'scorer' || p.athlete);
            result.goals.push({
                scorer: scorer?.athlete?.displayName || 'Inconnu',
                minute,
                extraTime: clock.extraTime,
                team: play.team?.displayName || '?',
                type: type.includes('Penalty') ? 'Penalty' : type.includes('Own') ? 'Own Goal' : 'Normal Goal',
                assist: null
            });
        }
        
        if (type.includes('Card') || type.includes('Yellow') || type.includes('Red')) {
            const player = (play.participants || [])[0];
            result.cards.push({
                player: player?.athlete?.displayName || 'Inconnu',
                minute,
                team: play.team?.displayName || '?',
                type: type.includes('Red') ? 'Red Card' : type.includes('Second') ? 'Second Yellow card' : 'Yellow Card'
            });
        }
    });
    
    // --- Méthode 2: header details (fallback) ---
    if (result.goals.length === 0) {
        const details = data.header?.competitions?.[0]?.details || [];
        details.forEach(d => {
            const athletes = d.athletesInvolved || [];
            const name = athletes[0]?.displayName || 'Inconnu';
            const clock = parseEspnClock(d.clock?.displayValue);
            const minute = clock.minute;

            if (d.redCard || d.yellowCard) {
                result.cards.push({
                    player: name,
                    minute,
                    team: d.team?.displayName || '?',
                    type: d.redCard ? 'Red Card' : 'Yellow Card'
                });
            } else {
                result.goals.push({
                    scorer: name,
                    minute,
                    extraTime: clock.extraTime,
                    team: d.team?.displayName || '?',
                    type: d.penaltyKick ? 'Penalty' : d.ownGoal ? 'Own Goal' : 'Normal Goal',
                    assist: athletes[1]?.displayName || null
                });
            }
        });
    }
    
    // --- STATS ---
    const statsBoxscore = data.boxscore?.teams || [];
    if (statsBoxscore.length >= 2) {
        const extract = (teamStats, names) => {
            for (const n of names) {
                const s = teamStats.find(s => (s.label || s.name || '').toLowerCase().includes(n));
                if (s) return s.displayValue || s.value;
            }
            return null;
        };
        
        const hStats = statsBoxscore[0]?.statistics || [];
        const aStats = statsBoxscore[1]?.statistics || [];
        
        result.stats = {
            home: {
                possession: extract(hStats, ['possession']),
                totalShots: extract(hStats, ['shots', 'total shots']),
                shotsOnTarget: extract(hStats, ['on target', 'shots on goal']),
                corners: extract(hStats, ['corner']),
                fouls: extract(hStats, ['foul']),
                offsides: extract(hStats, ['offside']),
            },
            away: {
                possession: extract(aStats, ['possession']),
                totalShots: extract(aStats, ['shots', 'total shots']),
                shotsOnTarget: extract(aStats, ['on target', 'shots on goal']),
                corners: extract(aStats, ['corner']),
                fouls: extract(aStats, ['foul']),
                offsides: extract(aStats, ['offside']),
            }
        };
    }
    
    result.goals.sort((a, b) => a.minute - b.minute);
    result.cards.sort((a, b) => a.minute - b.minute);
    
    return result;
}


// ===============================
// 9. PREVIEW (dry run) — ORIGINAL
// ===============================

async function previewMatchUpdates(matchDay) {
    console.log(`\n📋 === PREVIEW Journée ${matchDay} ===\n`);
    
    const { localMatches, espnMatches } = await fetchMatchDayFromESPN(matchDay);
    
    if (espnMatches.length === 0) {
        console.log('❌ Aucun match ESPN trouvé');
        return null;
    }
    
    const updates = [];
    const alreadyDone = [];
    const notFinished = [];
    const unmapped = [];
    
    for (const espnMatch of espnMatches) {
        if (!espnMatch.homeTeamId || !espnMatch.awayTeamId) {
            unmapped.push(`${espnMatch.homeApi} vs ${espnMatch.awayApi} → IDs non trouvés`);
            continue;
        }
        
        const localMatch = localMatches.find(m =>
            m.homeTeamId == espnMatch.homeTeamId && m.awayTeamId == espnMatch.awayTeamId
        );
        
        if (!localMatch) continue;
        
        if (localMatch.finalScore) {
            alreadyDone.push(`${espnMatch.homeShort} ${localMatch.finalScore.home}-${localMatch.finalScore.away} ${espnMatch.awayShort} ✅`);
            continue;
        }
        
        if (!espnMatch.isFinished) {
            notFinished.push(`${espnMatch.homeShort} vs ${espnMatch.awayShort} [${espnMatch.status}]`);
            continue;
        }
        
        let detail = { goals: [], cards: [], stats: null };
        try {
            console.log(`  🔍 Détails ${espnMatch.homeShort}-${espnMatch.awayShort}...`);
            detail = await fetchMatchDetail(espnMatch.espnId);
        } catch (e) {
            console.warn(`  ⚠️ Détails indisponibles: ${e.message}`);
        }
        
        updates.push({
            localMatch,
            espnMatch,
            detail,
            updateData: {
                finalScore: espnMatch.finalScore,
                goals: convertGoalsToLocalFormat(detail.goals, espnMatch),
                cards: detail.cards,
                matchStats: detail.stats
            }
        });
    }
    
    if (alreadyDone.length > 0) {
        console.log(`✅ Déjà enregistrés (${alreadyDone.length}):`);
        alreadyDone.forEach(m => console.log(`  ${m}`));
    }
    if (notFinished.length > 0) {
        console.log(`\n⏳ Pas encore terminés (${notFinished.length}):`);
        notFinished.forEach(m => console.log(`  ${m}`));
    }
    if (unmapped.length > 0) {
        console.log(`\n⚠️ Non mappés (${unmapped.length}):`);
        unmapped.forEach(m => console.log(`  ${m}`));
    }
    if (updates.length > 0) {
        console.log(`\n🔄 À mettre à jour (${updates.length}):`);
        updates.forEach(u => {
            const s = u.espnMatch;
            console.log(`\n  ${s.homeShort} ${s.finalScore.home}-${s.finalScore.away} ${s.awayShort}`);
            
            const goals = u.updateData.goals;
            if (goals.length > 0) {
                console.log(`  ⚽ Buts:`);
                goals.forEach(g => console.log(`     ${g.displayTime} ${g.scorer} (teamId: ${g.teamId})`));
            }
            
            if (u.detail.cards.length > 0) {
                console.log(`  🟨 Cartons:`);
                u.detail.cards.forEach(c => {
                    const emoji = c.type.includes('Red') ? '🟥' : '🟨';
                    console.log(`     ${c.minute}' ${emoji} ${c.player}`);
                });
            }
            
            if (u.detail.stats) {
                console.log(`  📊 Possession: ${u.detail.stats.home.possession || '?'} - ${u.detail.stats.away.possession || '?'}`);
            }
        });
    }
    
    console.log(`\n📊 Résumé: ${alreadyDone.length} déjà faits, ${updates.length} à mettre à jour, ${notFinished.length} en cours, ${unmapped.length} non mappés`);
    
    return { updates, unmapped, alreadyDone, notFinished };
}


// ===============================
// 10. APPLICATION — ORIGINAL
// ===============================

async function applyMatchUpdates(matchDay) {
    const preview = await previewMatchUpdates(matchDay);
    
    if (!preview || preview.updates.length === 0) {
        console.log('\n✅ Rien à mettre à jour !');
        return;
    }
    
    console.log(`\n🚀 Application de ${preview.updates.length} mise(s) à jour...`);
    
    let success = 0, errors = 0;
    
    for (const update of preview.updates) {
        const local = update.localMatch;
        const data = update.updateData;
        const label = `${update.espnMatch.homeShort} ${data.finalScore.home}-${data.finalScore.away} ${update.espnMatch.awayShort}`;
        
        try {
            const updateObj = { finalScore: data.finalScore };
            if (data.goals?.length > 0) updateObj.goals = data.goals;
            if (data.cards?.length > 0) updateObj.cards = data.cards;
            if (data.matchStats) updateObj.matchStats = data.matchStats;
            
            if (typeof db !== 'undefined' && local.id) {
                await db.collection('matches').doc(String(local.id)).update(updateObj);
                Object.assign(local, updateObj);
                console.log(`  ✅ ${label} → Firebase OK`);
                success++;
            } else {
                Object.assign(local, updateObj);
                console.log(`  ⚠️ ${label} → Mémoire uniquement`);
                success++;
            }
        } catch (e) {
            console.error(`  ❌ ${label} → Erreur:`, e.message);
            errors++;
        }
    }
    
    console.log(`\n📊 Terminé: ${success} succès, ${errors} erreur(s)`);
    if (success > 0) console.log('💡 Recharge la page (F5) pour voir les résultats');
    
    return { success, errors };
}


// ===============================
// 11. IMPORT PAR DATE — NOUVEAU
//     Crée les matchs manquants
//     + met à jour les existants
// ===============================

/**
 * Importe TOUS les matchs ESPN d'une date donnée.
 * - Matchs existants localement → mise à jour du score/buteurs
 * - Matchs inexistants → CRÉATION complète dans Firebase + localStorage
 * 
 * @param {string} date  - Format 'YYYY-MM-DD'
 * @param {number} [forceMatchDay] - Numéro de journée forcé (sinon auto-détecté)
 * @param {boolean} [dryRun=false] - Si true, preview seulement
 */
async function importESPNDate(date, forceMatchDay, dryRun) {
    // Par défaut dryRun = false
    if (typeof dryRun === 'undefined') dryRun = false;
    
    const prefix = dryRun ? '👁️ PREVIEW' : '🚀 IMPORT';
    console.log(`\n${prefix} ESPN — ${date}\n${'='.repeat(40)}`);
    
    // 1. Fetch ESPN
    const espnMatches = await fetchLigue1Matches(date);
    
    if (espnMatches.length === 0) {
        console.log('❌ Aucun match Ligue 1 trouvé sur ESPN pour cette date');
        return null;
    }
    
    // 2. Détecter la journée
    let matchDay = forceMatchDay || null;
    
    if (!matchDay) {
        matchDay = detectMatchDay(date);
        if (!matchDay) {
            console.error('❌ Impossible de détecter la journée automatiquement.');
            console.log('💡 Réessaie avec : await importESPNDate(\'' + date + '\', NUMERO_JOURNEE)');
            return null;
        }
    } else {
        console.log(`📅 Journée forcée : J${matchDay}`);
    }
    
    // 3. Récupérer les matchs locaux de cette journée
    const localPlayed = (typeof allMatches !== 'undefined' ? allMatches : [])
        .filter(m => m.matchDay === matchDay);
    const localFuture = (typeof futureMatches !== 'undefined' ? futureMatches : [])
        .filter(m => m.matchDay === matchDay);
    
    // Dédupliquer
    const localAll = new Map();
    [...localPlayed, ...localFuture].forEach(m => {
        const key = `${m.homeTeamId}-${m.awayTeamId}`;
        if (!localAll.has(key)) localAll.set(key, m);
    });
    
    const season = typeof getCurrentSeason === 'function' ? getCurrentSeason() : '2025-2026';
    
    // 4. Classer chaque match ESPN
    const toUpdate = [];
    const toCreate = [];
    const alreadyDone = [];
    const notFinished = [];
    const unmapped = [];
    
    for (const espnMatch of espnMatches) {
        // Vérifier le mapping
        if (!espnMatch.homeTeamId || !espnMatch.awayTeamId) {
            unmapped.push(espnMatch);
            continue;
        }
        
        const key = `${espnMatch.homeTeamId}-${espnMatch.awayTeamId}`;
        const localMatch = localAll.get(key);
        
        if (localMatch && localMatch.finalScore) {
            // Déjà enregistré avec un score
            alreadyDone.push({ espnMatch, localMatch });
            continue;
        }
        
        if (!espnMatch.isFinished) {
            notFinished.push(espnMatch);
            continue;
        }
        
        // Récupérer les détails (buteurs, cartons, stats)
        let detail = { goals: [], cards: [], stats: null };
        try {
            console.log(`  🔍 Détails ${espnMatch.homeShort}-${espnMatch.awayShort}...`);
            detail = await fetchMatchDetail(espnMatch.espnId);
        } catch (e) {
            console.warn(`  ⚠️ Détails indisponibles: ${e.message}`);
        }
        
        const goals = convertGoalsToLocalFormat(detail.goals, espnMatch);
        const halftimeScore = calculateHalftimeScore(goals, espnMatch.homeTeamId);
        
        if (localMatch) {
            // Existe localement mais pas de score → MISE À JOUR
            toUpdate.push({
                localMatch,
                espnMatch,
                detail,
                goals,
                halftimeScore
            });
        } else {
            // N'existe PAS localement → CRÉATION
            toCreate.push({
                espnMatch,
                detail,
                goals,
                halftimeScore,
                matchDay,
                season
            });
        }
    }
    
    // 5. Affichage du résumé
    console.log(`\n${'─'.repeat(40)}`);
    
    if (alreadyDone.length > 0) {
        console.log(`\n✅ Déjà enregistrés (${alreadyDone.length}) :`);
        alreadyDone.forEach(({ espnMatch: m, localMatch: l }) => {
            console.log(`   ${m.homeShort} ${l.finalScore.home}-${l.finalScore.away} ${m.awayShort}`);
        });
    }
    
    if (notFinished.length > 0) {
        console.log(`\n⏳ Pas terminés (${notFinished.length}) :`);
        notFinished.forEach(m => {
            console.log(`   ${m.homeShort} vs ${m.awayShort} [${m.status}]`);
        });
    }
    
    if (unmapped.length > 0) {
        console.log(`\n⚠️ Équipes non mappées (${unmapped.length}) :`);
        unmapped.forEach(m => {
            console.log(`   "${m.homeApi}" vs "${m.awayApi}" → IDs introuvables`);
        });
    }
    
    if (toUpdate.length > 0) {
        console.log(`\n🔄 À mettre à jour (${toUpdate.length}) :`);
        toUpdate.forEach(u => {
            const s = u.espnMatch;
            console.log(`   ${s.homeShort} ${s.finalScore.home}-${s.finalScore.away} ${s.awayShort}`);
            u.goals.forEach(g => console.log(`      ⚽ ${g.displayTime} ${g.scorer} (teamId: ${g.teamId})`));
        });
    }
    
    if (toCreate.length > 0) {
        console.log(`\n🆕 À CRÉER (${toCreate.length}) :`);
        toCreate.forEach(c => {
            const s = c.espnMatch;
            console.log(`   ${s.homeShort} ${s.finalScore.home}-${s.finalScore.away} ${s.awayShort}  [J${c.matchDay}]`);
            c.goals.forEach(g => console.log(`      ⚽ ${g.displayTime} ${g.scorer} (teamId: ${g.teamId})`));
        });
    }
    
    const total = alreadyDone.length + notFinished.length + unmapped.length + toUpdate.length + toCreate.length;
    console.log(`\n📊 Résumé J${matchDay} : ${total} matchs ESPN`);
    console.log(`   ✅ ${alreadyDone.length} déjà faits | 🔄 ${toUpdate.length} à maj | 🆕 ${toCreate.length} à créer | ⏳ ${notFinished.length} en cours | ⚠️ ${unmapped.length} non mappés`);
    
    if (dryRun) {
        console.log(`\n👁️ C'était un preview. Pour appliquer :\n   await importESPNDate('${date}'${forceMatchDay ? ', ' + forceMatchDay : ''})`);
        return { toUpdate, toCreate, alreadyDone, notFinished, unmapped, matchDay };
    }
    
    if (toUpdate.length === 0 && toCreate.length === 0) {
        console.log('\n✅ Rien à faire !');
        return { toUpdate: [], toCreate: [], alreadyDone, notFinished, unmapped, matchDay };
    }
    
    // 6. APPLICATION
    console.log(`\n🚀 Application...`);
    
    let updated = 0, created = 0, errors = 0;
    
    // 6a. Mises à jour
    for (const u of toUpdate) {
        const label = `${u.espnMatch.homeShort} ${u.espnMatch.finalScore.home}-${u.espnMatch.finalScore.away} ${u.espnMatch.awayShort}`;
        try {
            const updateObj = {
                finalScore: u.espnMatch.finalScore,
                halftimeScore: u.halftimeScore,
                playedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            if (u.goals.length > 0) updateObj.goals = u.goals;
            if (u.detail.cards?.length > 0) updateObj.cards = u.detail.cards;
            if (u.detail.stats) updateObj.matchStats = u.detail.stats;
            
            // Firebase
            if (typeof db !== 'undefined' && u.localMatch.id) {
                await db.collection('matches').doc(String(u.localMatch.id)).update(updateObj);
            }
            
            // Mémoire locale
            Object.assign(u.localMatch, updateObj);
            
            // localStorage
            _syncLocalStorage();
            
            console.log(`   ✅ MAJ  ${label}`);
            updated++;
        } catch (e) {
            console.error(`   ❌ MAJ  ${label} →`, e.message);
            errors++;
        }
    }
    
    // 6b. Créations
    for (const c of toCreate) {
        const s = c.espnMatch;
        const label = `${s.homeShort} ${s.finalScore.home}-${s.finalScore.away} ${s.awayShort}`;
        
        try {
            const now = new Date().toISOString();
            const espnDate = new Date(s.date).toISOString();
            
            const newMatch = {
                id: Date.now() + Math.random(),
                homeTeamId: String(s.homeTeamId),
                awayTeamId: String(s.awayTeamId),
                matchDay: c.matchDay,
                date: espnDate.split('T')[0],
                scheduledAt: espnDate,
                playedAt: espnDate,
                createdAt: now,
                updatedAt: now,
                season: c.season,
                finalScore: s.finalScore,
                halftimeScore: c.halftimeScore,
                goals: c.goals,
            };
            
            if (c.detail.cards?.length > 0) newMatch.cards = c.detail.cards;
            if (c.detail.stats) newMatch.matchStats = c.detail.stats;
            
            // Firebase
            if (typeof db !== 'undefined') {
                await db.collection('matches').doc(String(newMatch.id)).set({
                    ...newMatch,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            // Mémoire locale (allMatches)
            if (typeof allMatches !== 'undefined') {
                allMatches.push(newMatch);
            }
            
            // localStorage
            _syncLocalStorage();
            
            // Retirer du futureMatches si présent (le match est maintenant joué)
            _removeFutureMatch(s.homeTeamId, s.awayTeamId, c.matchDay, c.season);
            
            console.log(`   ✅ CRÉÉ ${label} (ID: ${Math.round(newMatch.id)})`);
            created++;
        } catch (e) {
            console.error(`   ❌ CRÉÉ ${label} →`, e.message);
            errors++;
        }
    }
    
    console.log(`\n${'═'.repeat(40)}`);
    console.log(`📊 Terminé : ${updated} mis à jour, ${created} créés, ${errors} erreur(s)`);
    if (updated + created > 0) {
        console.log('💡 Recharge la page (F5) pour voir les résultats');
    }
    
    return { updated, created, errors, matchDay, toUpdate, toCreate, alreadyDone, notFinished, unmapped };
}

/**
 * Version preview (dry run) de importESPNDate
 */
async function previewESPNDate(date, forceMatchDay) {
    return importESPNDate(date, forceMatchDay, true);
}


// ===============================
// 12. HELPERS INTERNES
// ===============================

/** Synchroniser allMatches → localStorage */
function _syncLocalStorage() {
    try {
        if (typeof allMatches !== 'undefined') {
            localStorage.setItem('footballEloMatches', JSON.stringify(allMatches));
        }
    } catch (e) {
        console.warn('⚠️ Sync localStorage:', e.message);
    }
}

/** Retirer un match de la liste EN MÉMOIRE des futureMatches après création.
 *  Le calendrier stocké n'est PAS modifié : les affiches jouées sont
 *  filtrées à l'affichage, et rester en base permet de les retrouver si le
 *  match importé est supprimé plus tard. */
function _removeFutureMatch(homeTeamId, awayTeamId, matchDay, season) {
    try {
        if (typeof futureMatches === 'undefined') return;

        const idx = futureMatches.findIndex(m =>
            m.homeTeamId == homeTeamId &&
            m.awayTeamId == awayTeamId &&
            m.matchDay === matchDay
        );

        if (idx !== -1) {
            futureMatches.splice(idx, 1);
        }
    } catch (e) {
        console.warn('⚠️ Retrait futureMatches:', e.message);
    }
}


// ===============================
// 13. IMPORT MULTI-DATES
// ===============================

/**
 * Importe plusieurs dates d'un coup
 * @param {string[]} dates - ['2026-02-22', '2026-02-23', ...]
 * @param {number} [forceMatchDay]
 */
async function importESPNDates(dates, forceMatchDay) {
    console.log(`\n🚀 IMPORT ESPN — ${dates.length} date(s)\n${'═'.repeat(40)}`);
    
    let totalUpdated = 0, totalCreated = 0, totalErrors = 0;
    
    for (const date of dates) {
        const result = await importESPNDate(date, forceMatchDay);
        if (result) {
            totalUpdated += result.updated || 0;
            totalCreated += result.created || 0;
            totalErrors += result.errors || 0;
        }
    }
    
    console.log(`\n${'═'.repeat(40)}`);
    console.log(`📊 TOTAL : ${totalUpdated} mis à jour, ${totalCreated} créés, ${totalErrors} erreur(s)`);
    
    return { updated: totalUpdated, created: totalCreated, errors: totalErrors };
}

/**
 * Importe une plage de dates (ex: du vendredi au lundi d'une journée)
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate   - 'YYYY-MM-DD'
 * @param {number} [forceMatchDay]
 */
async function importESPNRange(startDate, endDate, forceMatchDay) {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
    }
    
    console.log(`📅 Plage : ${startDate} → ${endDate} (${dates.length} jours)`);
    return importESPNDates(dates, forceMatchDay);
}


// ===============================
// 14. UTILITAIRES
// ===============================

function checkTeamMapping() {
    if (typeof allTeams === 'undefined') { console.error('❌ allTeams non disponible'); return; }
    console.log('📋 Mapping des équipes :\n');
    allTeams.forEach(team => {
        const found = Object.entries(TEAM_MAPPING).find(([, data]) => data.id === team.id);
        console.log(`  ${found ? '✅' : '❌'} ${team.shortName} (ID ${team.id}) ${found ? `→ "${found[0]}"` : 'PAS DE MAPPING'}`);
    });
}

function listMatchDayStatus() {
    if (typeof allMatches === 'undefined') { console.error('❌ allMatches non disponible'); return; }
    const days = {};
    allMatches.forEach(m => {
        const d = m.matchDay;
        if (!days[d]) days[d] = { total: 0, played: 0 };
        days[d].total++;
        if (m.finalScore) days[d].played++;
    });
    if (typeof futureMatches !== 'undefined') {
        futureMatches.forEach(m => {
            const d = m.matchDay;
            if (!days[d]) days[d] = { total: 0, played: 0 };
            if (!allMatches.some(am => am.matchDay === d && am.homeTeamId == m.homeTeamId && am.awayTeamId == m.awayTeamId)) {
                days[d].total++;
            }
        });
    }
    console.log('📅 État des journées :');
    Object.entries(days).sort((a, b) => a[0] - b[0]).forEach(([day, info]) => {
        const pending = info.total - info.played;
        const emoji = pending === 0 ? '✅' : info.played > 0 ? '🔄' : '⏳';
        console.log(`  J${day}: ${emoji} ${info.played}/${info.total} joués`);
    });
}

function debugMatchStructure(matchDay) {
    const matches = allMatches.filter(m => m.matchDay === matchDay);
    console.log(`🔍 J${matchDay}: ${matches.length} match(s) dans allMatches`);
    if (matches.length > 0) {
        const s = matches[0];
        console.log('  Clés:', Object.keys(s).join(', '));
        console.log('  id:', s.id, '| homeTeamId:', s.homeTeamId, '| awayTeamId:', s.awayTeamId);
        console.log('  finalScore:', JSON.stringify(s.finalScore));
        console.log('  goals:', s.goals ? `${s.goals.length} buts` : 'null');
    }
    
    if (typeof futureMatches !== 'undefined') {
        const fm = futureMatches.filter(m => m.matchDay === matchDay);
        console.log(`  + ${fm.length} dans futureMatches`);
    }
}

async function discoverESPNTeams() {
    console.log('🔍 Récupération des équipes ESPN...');
    const data = await espnFetch(ESPN_API.scoreboardUrl);
    const teams = new Set();
    (data.events || []).forEach(e => {
        e.competitions?.[0]?.competitors?.forEach(c => {
            if (c.team?.displayName) teams.add(c.team.displayName);
        });
    });
    if (teams.size === 0) {
        console.log("⚠️ Pas de matchs actuellement. Essaie : await fetchLigue1Matches('2026-02-22')");
        return;
    }
    console.log(`\n📋 ${teams.size} équipes :\n`);
    [...teams].sort().forEach(name => {
        const local = findLocalTeamId(name);
        console.log(`  ${local ? '✅' : '❌'} "${name}" ${local ? `→ ${local.short} (ID ${local.id})` : 'PAS DE MAPPING'}`);
    });
}

function matchUpdateHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║       ⚽ MATCH AUTO-UPDATE & IMPORT — ESPN (gratuit)    ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  1. TESTER LA CONNEXION                                  ║
║     await testESPN()                                     ║
║                                                          ║
║  2. SI CORS BLOQUÉ                                       ║
║     ESPN_API.corsProxy = 'https://corsproxy.io/?';       ║
║     await testESPN()                                     ║
║                                                          ║
║  3. VÉRIFIER MAPPING                                     ║
║     checkTeamMapping()                                   ║
║     await discoverESPNTeams()                            ║
║                                                          ║
║  ─── IMPORT PAR DATE (NOUVEAU) ───────────────────────── ║
║                                                          ║
║  4. PREVIEW (dry run)                                    ║
║     await previewESPNDate('2026-02-22')                  ║
║     await previewESPNDate('2026-02-22', 23)   ← J forcée║
║                                                          ║
║  5. IMPORTER (crée les manquants + maj les existants)    ║
║     await importESPNDate('2026-02-22')                   ║
║     await importESPNDate('2026-02-22', 23)    ← J forcée║
║                                                          ║
║  6. IMPORTER PLUSIEURS DATES                             ║
║     await importESPNDates(['2026-02-21','2026-02-22'])   ║
║     await importESPNRange('2026-02-21','2026-02-23')     ║
║     await importESPNRange('2026-02-21','2026-02-23', 23) ║
║                                                          ║
║  ─── MISE À JOUR CLASSIQUE (par journée) ─────────────── ║
║                                                          ║
║  7. PREVIEW PAR JOURNÉE                                  ║
║     await previewMatchUpdates(23)                        ║
║                                                          ║
║  8. APPLIQUER PAR JOURNÉE                                ║
║     await applyMatchUpdates(23)                          ║
║                                                          ║
║  ─── DEBUG ───────────────────────────────────────────── ║
║                                                          ║
║  9. EXPLORER                                             ║
║     await fetchLigue1Matches('2026-02-22')               ║
║     debugMatchStructure(23)                              ║
║     listMatchDayStatus()                                 ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);
}


console.log('⚽ Module match-auto-update v2 chargé (ESPN — gratuit, sans clé)');
console.log('   Tape matchUpdateHelp() pour les commandes');
console.log('   🆕 Nouveau : await importESPNDate(\'2026-02-22\') pour créer les matchs manquants');