// ===============================
// PRONOSTICS - SCRIPT LOADER
// ===============================
// Charge tous les modules JS dans le bon ordre
// Téléchargement parallèle + exécution séquentielle
// Pour ajouter/supprimer un module, modifie uniquement ce fichier

(function() {
    const basePath = '../js/';

    // ========== CONFIGURATION ==========
    // Ordre d'exécution (les dépendances d'abord)
    const scripts = [
        // --- Core (Firebase + données) ---
        'firebase-config.js',
        'firebase-service.js',
        'seasons.js',
        'teams-loader.js',
        'storage.js',
        'elo.js',
        'elo-system.js',

        // --- Pronostics : utilitaires ---
        'pronostics-toast.js',

        // --- Pronostics : module principal ---
        'pronostics-game.js',

        // --- Pronostics : features ---
        'pronostics-chat.js',
        'pronostics-stats.js',
        'pronostics-ia.js',
        'pronostics-badges.js',
        'pronostics-odds.js',
        'pronostics-matchday-ranking.js',
        'pronostics-consensus.js',
        'pronostics-analysis.js',
        'pronostics-gamification.js',
        'pronostics-gameplay.js',
        'shareable-card.js',
        'pronostics-mvp.js',
        'pronostics-scorer.js',
        'pronostics-super-joker.js',
        'pronostics-combine.js',
        'pronostics-ranking-bet.js',
        'pronostics-challenges.js',

        // --- Auto-update (en dernier) ---
        'match-auto-update.js',
    ];

    // ========== LOADER OPTIMISÉ ==========
    const total = scripts.length;

    // Phase 1 : Pré-télécharger TOUS les scripts en parallèle (cache navigateur)
    function preloadAll() {
        scripts.forEach(src => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'script';
            link.href = basePath + src;
            document.head.appendChild(link);
        });
    }

    // Phase 2 : Exécuter dans l'ordre (les fichiers sont déjà en cache)
    function execScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = basePath + src;
            script.onload = resolve;
            script.onerror = () => {
                console.warn(`[Loader] ⚠️ Échec: ${src}`);
                resolve(); // Ne pas bloquer les autres
            };
            document.body.appendChild(script);
        });
    }

    async function loadAllScripts() {
        const startTime = performance.now();
        console.log(`[Loader] 🚀 Chargement de ${total} scripts...`);

        // Lancer le pré-téléchargement parallèle
        preloadAll();

        // Petit délai pour laisser le preload démarrer
        await new Promise(r => setTimeout(r, 50));

        // Exécuter séquentiellement (les fichiers sont déjà en cache)
        for (let i = 0; i < scripts.length; i++) {
            await execScript(scripts[i]);
        }

        const duration = Math.round(performance.now() - startTime);
        console.log(`[Loader] ✅ ${total}/${total} scripts chargés en ${duration}ms`);

        // Déclencher l'initialisation
        document.dispatchEvent(new CustomEvent('pronostics:ready'));
    }

    // Démarrer
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAllScripts);
    } else {
        loadAllScripts();
    }
})();