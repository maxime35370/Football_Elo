// =====================================================
// CARTE DE RÉSULTAT PARTAGEABLE
// Utilisable depuis statistics.js ET pronostics pages
// Ajouter ce fichier en tant que script séparé : shareable-card.js
// =====================================================

/**
 * Génère une image Canvas partageable
 * @param {string} mode - 'results' ou 'pronostics'
 * @param {Object} data - Données de la journée
 * @returns {Promise<string>} - Data URL de l'image
 */
async function generateShareableCard(mode, data) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Dimensions (format story 1080x1920 réduit pour perf)
    const W = 540;
    const matchCount = data.matches?.length || 0;
    // Calcul hauteur bonus
    let bonusHeight = 0;
    if (data.superJokerBonus > 0) bonusHeight += 40;
    if (data.scorerBonus > 0) {
        const scorerMatches = (data.matches || []).filter(m => m.scorerInfo && m.scorerInfo.result !== 'pending');
        bonusHeight += 35 + scorerMatches.length * 24;
    }
    if (data.combineInfo) bonusHeight += 50;
    if (data.isMVP) bonusHeight += 35;
    
    const H = mode === 'pronostics' 
        ? 380 + matchCount * 52 + bonusHeight + 120
        : 350 + matchCount * 48 + 100;
    
    canvas.width = W;
    canvas.height = H;
    
    // --- FOND ---
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    
    // Cercles décoratifs subtils
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.arc(W - 50, 80, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(50, H - 100, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    let y = 30;
    
    // --- HEADER ---
    // Logo / titre
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('⚽ FOOTBALL ELO', W / 2, y);
    y += 30;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`JOURNÉE ${data.matchDay}`, W / 2, y);
    y += 22;
    
    // Sous-titre selon le mode
    ctx.fillStyle = '#8899aa';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    if (mode === 'pronostics') {
        ctx.fillText(`Pronostics de ${data.playerName}`, W / 2, y);
    } else {
        ctx.fillText(`${matchCount} matchs · ${data.totalGoals || 0} buts`, W / 2, y);
    }
    y += 35;
    
    // Ligne séparatrice
    const lineGrad = ctx.createLinearGradient(40, y, W - 40, y);
    lineGrad.addColorStop(0, 'transparent');
    lineGrad.addColorStop(0.5, '#e94560');
    lineGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(W - 40, y);
    ctx.stroke();
    y += 20;
    
    // --- MATCHS ---
    if (mode === 'results') {
        y = drawResultsMode(ctx, data, W, y);
    } else {
        y = drawPronosticsMode(ctx, data, W, y);
    }
    
    // --- FOOTER ---
    y += 15;
    const footerGrad = ctx.createLinearGradient(40, y, W - 40, y);
    footerGrad.addColorStop(0, 'transparent');
    footerGrad.addColorStop(0.5, '#333');
    footerGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = footerGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(W - 40, y);
    ctx.stroke();
    y += 20;
    
    ctx.textAlign = 'center';
    ctx.fillStyle = '#556677';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    const now = new Date();
    ctx.fillText(`Football Elo · ${now.toLocaleDateString('fr-FR')}`, W / 2, y);
    
    return canvas.toDataURL('image/png');
}

function drawResultsMode(ctx, data, W, y) {
    const matches = data.matches || [];
    
    matches.forEach(match => {
        const isHomeWin = match.homeScore > match.awayScore;
        const isAwayWin = match.awayScore > match.homeScore;
        
        // Fond du match
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        roundRect(ctx, 20, y - 8, W - 40, 40, 8);
        ctx.fill();
        
        // Équipe dom
        ctx.textAlign = 'right';
        ctx.fillStyle = isHomeWin ? '#ffffff' : '#8899aa';
        ctx.font = `${isHomeWin ? 'bold ' : ''}14px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillText(match.homeTeam, W / 2 - 55, y + 12);
        
        // Score
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(`${match.homeScore} - ${match.awayScore}`, W / 2, y + 14);
        
        // Équipe ext
        ctx.textAlign = 'left';
        ctx.fillStyle = isAwayWin ? '#ffffff' : '#8899aa';
        ctx.font = `${isAwayWin ? 'bold ' : ''}14px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillText(match.awayTeam, W / 2 + 55, y + 12);
        
        y += 48;
    });
    
    // Stats résumé
    y += 10;
    if (data.stats) {
        ctx.fillStyle = 'rgba(233, 69, 96, 0.15)';
        roundRect(ctx, 20, y - 5, W - 40, 60, 10);
        ctx.fill();
        
        const stats = [
            { label: 'Buts', value: data.totalGoals || 0, emoji: '⚽' },
            { label: 'Moy/match', value: data.avgGoals || '0', emoji: '📊' },
            { label: 'Dom', value: data.stats.homeWins || 0, emoji: '🏠' },
            { label: 'Ext', value: data.stats.awayWins || 0, emoji: '✈️' },
            { label: 'Nuls', value: data.stats.draws || 0, emoji: '🤝' }
        ];
        
        const colW = (W - 60) / stats.length;
        stats.forEach((stat, i) => {
            const x = 30 + colW * i + colW / 2;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillText(`${stat.emoji} ${stat.value}`, x, y + 20);
            ctx.fillStyle = '#8899aa';
            ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillText(stat.label, x, y + 38);
        });
        
        y += 65;
    }
    
    return y;
}

function drawPronosticsMode(ctx, data, W, y) {
    const matches = data.matches || [];
    const hasBonuses = data.superJokerBonus > 0 || data.scorerBonus > 0 || data.combineInfo || data.isMVP;
    
    // Score total en haut
    ctx.fillStyle = 'rgba(233, 69, 96, 0.2)';
    roundRect(ctx, 40, y - 5, W - 80, hasBonuses ? 70 : 55, 12);
    ctx.fill();
    
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`${data.totalPoints} pts`, W / 2, y + 25);
    ctx.fillStyle = '#8899aa';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`${data.exactScores || 0} score(s) exact(s) · ${data.correctResults || 0} bon(s) résultat(s)`, W / 2, y + 43);
    
    // Détail base + bonus si applicable
    if (hasBonuses) {
        ctx.fillStyle = '#667788';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        const parts = [`Base: ${data.basePoints}`];
        if (data.superJokerBonus > 0) parts.push(`SJ: +${data.superJokerBonus}`);
        if (data.scorerBonus > 0) parts.push(`Buteur: +${data.scorerBonus}`);
        if (data.combineInfo?.points > 0) parts.push(`Combiné: +${data.combineInfo.points}`);
        if (data.mvpBonus > 0) parts.push(`MVP: +${data.mvpBonus}`);
        ctx.fillText(parts.join(' · '), W / 2, y + 58);
        y += 85;
    } else {
        y += 70;
    }
    
    // --- Super Joker bannière ---
    if (data.superJokerBonus > 0) {
        ctx.fillStyle = 'rgba(155, 89, 182, 0.2)';
        roundRect(ctx, 30, y - 5, W - 60, 30, 8);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(`🃏✨ Super Joker activé (×1.5) → +${data.superJokerBonus} pts`, W / 2, y + 14);
        y += 40;
    }
    
    // Header colonnes
    ctx.fillStyle = '#556677';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MATCH', 130, y);
    ctx.fillText('PRONO', W / 2 + 30, y);
    ctx.fillText('RÉEL', W / 2 + 100, y);
    ctx.fillText('PTS', W - 40, y);
    y += 18;
    
    matches.forEach(match => {
        // Couleur de fond selon résultat
        let bgColor;
        if (match.class === 'exact') bgColor = 'rgba(46, 204, 113, 0.15)';
        else if (match.class === 'close') bgColor = 'rgba(52, 152, 219, 0.12)';
        else if (match.class === 'correct' || match.class === 'good') bgColor = 'rgba(241, 196, 15, 0.1)';
        else bgColor = 'rgba(231, 76, 60, 0.08)';
        
        ctx.fillStyle = bgColor;
        roundRect(ctx, 15, y - 8, W - 30, 42, 6);
        ctx.fill();
        
        // Équipes + joker badge
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ccddee';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        const jokerBadge = match.joker ? ' 🃏' : '';
        ctx.fillText(`${match.homeTeam} - ${match.awayTeam}${jokerBadge}`, 25, y + 12);
        
        // Scorer info sous le nom du match
        if (match.scorerInfo) {
            ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
            if (match.scorerInfo.result === 'first') {
                ctx.fillStyle = '#2ecc71';
                ctx.fillText(`⚽🎯 ${match.scorerInfo.name} (+${match.scorerInfo.points})`, 25, y + 28);
            } else if (match.scorerInfo.result === 'scored') {
                ctx.fillStyle = '#3498db';
                ctx.fillText(`⚽✅ ${match.scorerInfo.name} (+${match.scorerInfo.points})`, 25, y + 28);
            } else if (match.scorerInfo.result === 'missed' || match.scorerInfo.result === 'nogoal') {
                ctx.fillStyle = '#7f8c8d';
                ctx.fillText(`⚽❌ ${match.scorerInfo.name}`, 25, y + 28);
            }
        }
        
        // Prono
        ctx.textAlign = 'center';
        ctx.fillStyle = '#8899aa';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(match.prediction, W / 2 + 30, y + 13);
        
        // Score réel
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(match.actual, W / 2 + 100, y + 13);
        
        // Points
        const pts = match.points || 0;
        ctx.fillStyle = pts >= 9 ? '#2ecc71' : pts >= 6 ? '#3498db' : pts > 0 ? '#f1c40f' : '#e74c3c';
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(`${pts}`, W - 40, y + 13);
        
        // Badge score exact
        if (match.class === 'exact') {
            ctx.fillStyle = '#2ecc71';
            ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('🎯', W - 60, y + 13);
        }
        
        y += 52;
    });
    
    // --- Section Combiné ---
    if (data.combineInfo) {
        y += 5;
        const combBg = data.combineInfo.success ? 'rgba(46, 204, 113, 0.12)' : 'rgba(231, 76, 60, 0.08)';
        ctx.fillStyle = combBg;
        roundRect(ctx, 20, y - 5, W - 40, 40, 8);
        ctx.fill();
        
        ctx.textAlign = 'left';
        ctx.fillStyle = data.combineInfo.success ? '#2ecc71' : '#e74c3c';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
        const combLabel = data.combineInfo.success 
            ? `🎲 Combiné réussi ! +${data.combineInfo.points} pts` 
            : '🎲 Combiné raté';
        ctx.fillText(combLabel, 30, y + 12);
        
        ctx.fillStyle = '#8899aa';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(data.combineInfo.matches.join(' · '), 30, y + 27);
        y += 45;
    }
    
    // --- MVP Badge ---
    if (data.isMVP) {
        ctx.fillStyle = 'rgba(243, 156, 18, 0.15)';
        roundRect(ctx, 30, y - 5, W - 60, 28, 8);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f39c12';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(`🏆 MVP de la journée ! +${data.mvpBonus} pts`, W / 2, y + 13);
        y += 35;
    }
    
    // Résumé visuel
    y += 5;
    const resultTypes = [
        { emoji: '🎯', count: data.exactScores || 0, label: 'Exact', color: '#2ecc71' },
        { emoji: '✅', count: data.closeScores || 0, label: 'Proche', color: '#3498db' },
        { emoji: '👍', count: data.correctResults || 0, label: 'Bon', color: '#f1c40f' },
        { emoji: '❌', count: data.wrongResults || 0, label: 'Raté', color: '#e74c3c' }
    ];
    
    const colW = (W - 60) / resultTypes.length;
    resultTypes.forEach((type, i) => {
        const x = 30 + colW * i + colW / 2;
        ctx.textAlign = 'center';
        ctx.fillStyle = type.color;
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(`${type.emoji} ${type.count}`, x, y + 15);
        ctx.fillStyle = '#8899aa';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(type.label, x, y + 32);
    });
    y += 40;
    
    return y;
}

// Helper : rectangle arrondi
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/**
 * Télécharge la carte en tant qu'image PNG
 */
function downloadShareableCard(dataUrl, filename) {
    const link = document.createElement('a');
    link.download = filename || 'football-elo-card.png';
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Partage natif (mobile) ou fallback téléchargement
 */
async function shareCard(dataUrl, title) {
    // Convertir dataURL en blob pour le partage
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'football-elo.png', { type: 'image/png' });
    
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: title || 'Football Elo',
                files: [file]
            });
            return true;
        } catch (e) {
            if (e.name !== 'AbortError') {
                downloadShareableCard(dataUrl, 'football-elo.png');
            }
            return false;
        }
    } else {
        downloadShareableCard(dataUrl, 'football-elo.png');
        return true;
    }
}


// =====================================================
// BOUTON POUR LA PAGE STATISTIQUES (Résumé de journée)
// Ajouter dans statistics.js après initMatchdaySummary
// =====================================================

async function shareMatchdayResults() {
    const matchDay = parseInt(document.getElementById('summaryMatchday')?.value);
    if (!matchDay) return;
    
    const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay);
    if (matchesThisDay.length === 0) return;
    
    const totalGoals = matchesThisDay.reduce((s, m) => s + m.finalScore.home + m.finalScore.away, 0);
    
    const cardData = {
        matchDay,
        totalGoals,
        avgGoals: (totalGoals / matchesThisDay.length).toFixed(1),
        matches: matchesThisDay.map(m => {
            const home = allTeams.find(t => t.id == m.homeTeamId);
            const away = allTeams.find(t => t.id == m.awayTeamId);
            return {
                homeTeam: home?.shortName || '?',
                awayTeam: away?.shortName || '?',
                homeScore: m.finalScore.home,
                awayScore: m.finalScore.away
            };
        }),
        stats: {
            homeWins: matchesThisDay.filter(m => m.finalScore.home > m.finalScore.away).length,
            awayWins: matchesThisDay.filter(m => m.finalScore.away > m.finalScore.home).length,
            draws: matchesThisDay.filter(m => m.finalScore.home === m.finalScore.away).length
        }
    };
    
    const dataUrl = await generateShareableCard('results', cardData);
    await shareCard(dataUrl, `Journée ${matchDay} - Football Elo`);
}


// =====================================================
// BOUTON POUR LA PAGE PRONOSTICS
// Appeler sharePronosticsCard(playerId, pseudo, matchDay)
// =====================================================

async function sharePronosticsCard(playerId, playerName, matchDay) {
    if (typeof getPlayerPredictions !== 'function') {
        console.warn('getPlayerPredictions non disponible');
        return;
    }
    
    const predictions = await getPlayerPredictions(playerId, currentSeason, matchDay);
    if (!predictions || !predictions.predictions) {
        alert('Aucun pronostic trouvé pour cette journée');
        return;
    }
    
    const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay && m.finalScore);
    
    let basePoints = 0;
    let exactScores = 0, closeScores = 0, correctResults = 0, wrongResults = 0;
    const matchResults = [];
    
    for (const pred of predictions.predictions) {
        const match = matchesThisDay.find(m => 
            m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
        );
        
        if (!match) continue;
        
        const result = calculatePredictionResult(
            pred.homeScore, pred.awayScore,
            match.finalScore.home, match.finalScore.away,
            pred.savedAt, match, pred.odds, pred.joker || false
        );
        
        const pts = result.finalPoints || result.points;
        basePoints += pts;
        
        if (result.points === 9) exactScores++;
        else if (result.points === 6) closeScores++;
        else if (result.points > 0) correctResults++;
        else wrongResults++;
        
        const homeTeam = allTeams.find(t => t.id == pred.homeTeamId);
        const awayTeam = allTeams.find(t => t.id == pred.awayTeamId);
        
        // --- Scorer pick pour ce match ---
        let scorerInfo = null;
        if (pred.scorerPick && match.goals && match.goals.length > 0) {
            const sortedGoals = [...match.goals].sort((a, b) => (a.minute || 0) - (b.minute || 0));
            const firstGoal = sortedGoals[0];
            const matchFunc = typeof matchScorerNames === 'function' ? matchScorerNames : 
                (a, b) => a.toLowerCase().trim() === b.toLowerCase().trim();
            
            if (matchFunc(pred.scorerPick, firstGoal.scorer || '')) {
                scorerInfo = { name: pred.scorerPick, result: 'first', points: typeof SCORER_FIRST_EXACT !== 'undefined' ? SCORER_FIRST_EXACT : 4 };
            } else if (sortedGoals.some(g => matchFunc(pred.scorerPick, g.scorer || ''))) {
                scorerInfo = { name: pred.scorerPick, result: 'scored', points: typeof SCORER_SCORED !== 'undefined' ? SCORER_SCORED : 1 };
            } else {
                scorerInfo = { name: pred.scorerPick, result: 'missed', points: 0 };
            }
        } else if (pred.scorerPick && match.goals?.length === 0) {
            scorerInfo = { name: pred.scorerPick, result: 'nogoal', points: 0 };
        } else if (pred.scorerPick) {
            scorerInfo = { name: pred.scorerPick, result: 'pending', points: 0 };
        }
        
        matchResults.push({
            homeTeam: homeTeam?.shortName || '?',
            awayTeam: awayTeam?.shortName || '?',
            prediction: `${pred.homeScore}-${pred.awayScore}`,
            actual: `${match.finalScore.home}-${match.finalScore.away}`,
            points: pts,
            class: result.class,
            joker: pred.joker || false,
            scorerInfo
        });
    }
    
    // --- Bonus : Super Joker ---
    let superJokerBonus = 0;
    if (typeof getSuperJoker === 'function') {
        try {
            const sj = await getSuperJoker(playerId, currentSeason);
            if (sj && sj.used && sj.matchDay === matchDay) {
                superJokerBonus = Math.round(basePoints * 0.5 * 10) / 10;
            }
        } catch (e) {}
    }
    
    // --- Bonus : Scorer total ---
    let scorerBonus = 0;
    if (typeof calculateScorerPointsForMatchDay === 'function') {
        try {
            const scorerResult = calculateScorerPointsForMatchDay(predictions.predictions, matchDay);
            scorerBonus = scorerResult?.totalPoints || 0;
        } catch (e) {}
    }
    
    // --- Bonus : Combiné ---
    let combineInfo = null;
    if (typeof getPlayerCombine === 'function' && typeof calculateCombineResult === 'function') {
        try {
            const combine = await getPlayerCombine(playerId, currentSeason, matchDay);
            if (combine && combine.matches && combine.matches.length > 0) {
                const combineResult = calculateCombineResult(combine, predictions.predictions, matchesThisDay);
                const combineMatchNames = combine.matches.map(cm => {
                    const h = allTeams.find(t => t.id == cm.homeTeamId)?.shortName || '?';
                    const a = allTeams.find(t => t.id == cm.awayTeamId)?.shortName || '?';
                    return `${h}-${a}`;
                });
                combineInfo = {
                    matches: combineMatchNames,
                    success: combineResult?.success || false,
                    points: combineResult?.bonusPoints || 0
                };
            }
        } catch (e) {}
    }
    
    // --- Bonus : MVP ---
    let mvpBonus = 0;
    let isMVP = false;
    if (typeof getMVPBonusForPlayer === 'function') {
        try {
            mvpBonus = await getMVPBonusForPlayer(playerId, currentSeason, matchDay);
            isMVP = mvpBonus > 0;
        } catch (e) {}
    }
    
    const totalPoints = Math.round((basePoints + superJokerBonus + scorerBonus + (combineInfo?.points || 0) + mvpBonus) * 10) / 10;
    
    const cardData = {
        matchDay,
        playerName,
        basePoints: Math.round(basePoints * 10) / 10,
        totalPoints,
        exactScores,
        closeScores,
        correctResults,
        wrongResults,
        matches: matchResults,
        // Bonus
        superJokerBonus,
        scorerBonus,
        combineInfo,
        mvpBonus,
        isMVP
    };
    
    const dataUrl = await generateShareableCard('pronostics', cardData);
    await shareCard(dataUrl, `Mes pronos J${matchDay} - ${playerName}`);
}