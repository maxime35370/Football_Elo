// theme.js - Bascule clair/sombre pour tout le site
// Chargé dans le <head> de chaque page pour appliquer le thème AVANT le
// premier rendu (évite le flash blanc). Le choix est mémorisé en local.

(function() {
    const stored = localStorage.getItem('footballEloTheme');
    // Sombre par défaut (moins de fond blanc), sauf choix explicite
    const theme = stored === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
})();

function toggleTheme() {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('footballEloTheme', next);
    updateThemeToggleIcon();

    // Les graphiques Chart.js sont dessinés avec les couleurs du thème au
    // chargement : on recharge la page pour les redessiner correctement.
    if (window.Chart) {
        location.reload();
    }
}

function updateThemeToggleIcon() {
    const btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = dark ? '☀️' : '🌙';
    btn.title = dark ? 'Passer en mode clair' : 'Passer en mode sombre';
}

document.addEventListener('DOMContentLoaded', updateThemeToggleIcon);
