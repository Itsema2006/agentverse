import { auth } from './js/firebase_config.js';
import { syncNav } from './js/firebase-auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

const SETTINGS_KEYS = {
  docs: 'agentverseDocsConfig',
  adminCredentials: 'agentverseAdminCredentials',
  adminSession: 'agentverseAdminSession',
  userCredentials: 'agentverseUserCredentials',
  userSession: 'agentverseUserSession',
  activeUser: 'agentverseActiveUser',
  configVersion: 'agentverseConfigVersion'
};

const applyDocsLink = function () {
  const docsLink = document.getElementById('docsLink');
  if (!docsLink) return;

  try {
    const raw = localStorage.getItem(SETTINGS_KEYS.docs);
    if (!raw) return;
    const config = JSON.parse(raw);
    if (config && typeof config.label === 'string' && config.label.trim() !== '') {
      docsLink.textContent = config.label.trim();
    }
  } catch (error) {
    console.warn('Unable to apply docs link config.', error);
  }
};

applyDocsLink();

onAuthStateChanged(auth, (user) => {
  syncNav(user);
});

window.addEventListener('storage', function (event) {
  if (event.key === SETTINGS_KEYS.configVersion) {
    applyDocsLink();
  }
});

document.addEventListener('visibilitychange', function () {
  if (!document.hidden) {
    applyDocsLink();
  }
});
