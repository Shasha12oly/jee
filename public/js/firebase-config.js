// Check if Firebase is already initialized
if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
    console.log('Firebase already initialized, skipping...');
    // Dispatch event anyway for scripts that depend on it
    const db = window.firebase.firestore();
    const auth = window.firebase.auth();
    window.dispatchEvent(new CustomEvent('firebaseLoaded', { detail: { firebase: window.firebase, db, auth } }));
} else {
    // Your web app's Firebase configuration
    const firebaseConfig = {
      apiKey: "AIzaSyDrORq3mZHx1tf5qbH-fdt0ScysupK10e0",
      authDomain: "gorwth.firebaseapp.com",
      projectId: "gorwth",
      storageBucket: "gorwth.firebasestorage.app",
      messagingSenderId: "36209213488",
      appId: "1:36209213488:web:a0441fe55e2c771aaaedf5",
      measurementId: "G-ZE7SY6VLVD"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);

    // Initialize services
    const db = firebase.firestore();
    const auth = firebase.auth();

    // Make services available globally for other scripts
    window.db = db;
    window.firebase = firebase;
    window.auth = auth;

    // Dispatch event to notify that Firebase is loaded
    console.log('Dispatching firebaseLoaded event...');
    window.dispatchEvent(new CustomEvent('firebaseLoaded', { detail: { firebase, db, auth } }));
    console.log('firebaseLoaded event dispatched');

    console.log('Firebase initialized successfully for JEE Growth Tracker');
}
