import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth, db, googleProvider } from './firebase_config.js';
import {
  doc,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

function showNotice(notice, msg, type = 'error') {
  if (!notice) return;
  notice.textContent = msg;
  notice.style.display = 'block';
  notice.style.background = type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
  notice.style.borderColor = type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
  notice.style.color = type === 'success' ? '#10b981' : '#ef4444';
}

function mapAuthError(code) {
  const map = {
    'auth/invalid-email': 'Invalid email.',
    'auth/user-not-found': 'User not found.',
    'auth/wrong-password': 'Wrong password.',
    'auth/invalid-credential': 'Invalid credentials.',
    'auth/invalid-login-credentials': 'Invalid email or password.',
    'auth/email-already-in-use': 'Email already registered.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/popup-closed-by-user': 'Popup closed before sign in.',
    'auth/popup-blocked': 'Popup blocked by browser. Retrying with redirect...',
    'auth/cancelled-popup-request': 'Another popup request is already in progress.',
    'auth/unauthorized-domain': 'This domain is not authorized in Firebase. Add it in Authentication > Settings > Authorized domains.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/operation-not-allowed': 'Email/password sign-in is disabled in Firebase console.'
  };
  return map[code] || 'Authentication failed.';
}

async function upsertUserProfile(user, name = '') {
  await setDoc(
    doc(db, 'users', user.uid),
    {
      uid: user.uid,
      email: user.email || '',
      name: name || user.displayName || '',
      lastLoginAt: serverTimestamp(),
      createdAt: serverTimestamp()
    },
    { merge: true }
  );
}

async function tryUpsertUserProfile(user, name = '') {
  try {
    await upsertUserProfile(user, name);
    return null;
  } catch (error) {
    console.warn('Profile sync failed:', error);
    return 'Signed in, but profile sync failed. Check Firestore rules.';
  }
}

export function initFirebaseAuth({ switchTab, onLoginSuccess }) {
  const notice = document.getElementById('notice');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginIdInput = document.getElementById('loginId');
  const forgotLink = document.querySelector('.forgot-link a');
  const googleBtns = document.querySelectorAll('[data-provider="google"]');

  setPersistence(auth, browserLocalPersistence).catch(() => {});

  getRedirectResult(auth)
    .then(async (result) => {
      if (!result || !result.user) return;
      if (onLoginSuccess) onLoginSuccess();
      await tryUpsertUserProfile(result.user);
    })
    .catch((err) => {
      showNotice(notice, mapAuthError(err.code));
    });

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('regName')?.value.trim() || '';
      const email = document.getElementById('regEmail')?.value.trim() || '';
      const password = document.getElementById('regPassword')?.value.trim() || '';
      const confirm = document.getElementById('regConfirmPassword')?.value.trim() || '';

      if (!name || !email || !password || !confirm) {
        showNotice(notice, 'All fields are required.');
        return;
      }
      if (password !== confirm) {
        showNotice(notice, 'Passwords do not match.');
        return;
      }

      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await upsertUserProfile(cred.user, name);
        showNotice(notice, 'Registration successful. Please sign in.', 'success');
        if (switchTab) switchTab('login');
        if (loginIdInput) loginIdInput.value = email;
      } catch (err) {
        if (err && err.code === 'auth/email-already-in-use') {
          if (switchTab) switchTab('login');
          if (loginIdInput) loginIdInput.value = email;
          showNotice(notice, 'Email already registered. Please sign in instead.', 'error');
          return;
        }
        showNotice(notice, mapAuthError(err.code));
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginId')?.value.trim() || '';
      const password = document.getElementById('loginPassword')?.value.trim() || '';

      if (!email || !password) {
        showNotice(notice, 'Email and password are required.');
        return;
      }

      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        if (onLoginSuccess) onLoginSuccess();
        const profileWarning = await tryUpsertUserProfile(cred.user);
        if (profileWarning) {
          showNotice(notice, profileWarning, 'success');
        }
      } catch (err) {
        showNotice(notice, mapAuthError(err.code));
      }
    });
  }

  if (forgotLink) {
    forgotLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginId')?.value.trim() || '';
      if (!email) {
        showNotice(notice, 'Enter email first.');
        return;
      }
      try {
        await sendPasswordResetEmail(auth, email);
        showNotice(notice, 'Password reset email sent.', 'success');
      } catch (err) {
        showNotice(notice, mapAuthError(err.code));
      }
    });
  }

  googleBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        if (onLoginSuccess) onLoginSuccess();
        const profileWarning = await tryUpsertUserProfile(result.user);
        if (profileWarning) {
          showNotice(notice, profileWarning, 'success');
        }
      } catch (err) {
        if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/unauthorized-domain')) {
          showNotice(notice, mapAuthError(err.code));
          try {
            await signInWithRedirect(auth, googleProvider);
            return;
          } catch (redirectErr) {
            showNotice(notice, mapAuthError(redirectErr.code));
            return;
          }
        }
        showNotice(notice, mapAuthError(err.code));
      }
    });
  });
}