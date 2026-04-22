// Import Firebase core
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";

// (Optional) Analytics
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-analytics.js";

// Your config (PASTE EXACTLY WHAT YOU SENT)
const firebaseConfig = {
  apiKey: "AIzaSyBrSiXsvkhNFoQ75Sx0XcLDZIg6-RTGqks",
  authDomain: "agentverse-acd19.firebaseapp.com",
  projectId: "agentverse-acd19",
  storageBucket: "agentverse-acd19.firebasestorage.app",
  messagingSenderId: "25556544017",
  appId: "1:25556544017:web:4604bfab5ac383da3c1fb0",
  measurementId: "G-QQ07JDVJ4N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export app
export default app;