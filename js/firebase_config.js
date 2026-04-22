import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import { 
  getAuth, 
  GoogleAuthProvider 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { 
  getFirestore 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// YOUR CONFIG (use your real one)
const firebaseConfig = {
  apiKey: "AIzaSyBrSiXsvkhNFoQ75Sx0XcLDZIg6-RTGqks",
  authDomain: "agentverse-acd19.firebaseapp.com",
  projectId: "agentverse-acd19",
  storageBucket: "agentverse-acd19.firebasestorage.app",
  messagingSenderId: "25556544017",
  appId: "1:25556544017:web:4604bfab5ac383da3c1fb0"
};

// Initialize
const app = initializeApp(firebaseConfig);

// Services
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Export
export { auth, db, googleProvider };