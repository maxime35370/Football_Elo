const firebaseConfig = {
    apiKey: "AIzaSyBcXDqGJt9emsix6b4YGmNcvDzzo1oqsQ8",
    authDomain: "football-elo-f0043.firebaseapp.com",
    projectId: "football-elo-f0043",
    storageBucket: "football-elo-f0043.firebasestorage.app",
    messagingSenderId: "912086420317",
    appId: "1:912086420317:web:40d221ad0328344592f6b4",
    measurementId: "G-S4MFXEF809"
  };

  // Initialiser Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

console.log('Firebase initialisé avec succès');