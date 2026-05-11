  <script type="module">
    import { auth, db } from './js/firebase_config.js';
    import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
    import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, serverTimestamp, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

    var SETTINGS_KEYS = {
      pricing: 'agentversePricingConfig',
      docs: 'agentverseDocsConfig',
      apiKeys: 'agentverseApiKeys',
      adminCredentials: 'agentverseAdminCredentials',
      adminSession: 'agentverseAdminSession',
      configVersion: 'agentverseConfigVersion'
    };

    var DEFAULT_PRICING = {
      starter: { month: 29, year: 23 },
      growth: { month: 99, year: 79 },
      enterprise: { month: 299, year: 239 }
    };

    // Initial check from localStorage for speed
    const hasAdminSession = localStorage.getItem(SETTINGS_KEYS.adminSession) === 'true';
    console.log('[Admin] Local session check:', hasAdminSession);

    // Verify with Firebase
    onAuthStateChanged(auth, (user) => {
      console.log('[Admin] Auth state changed:', user ? user.email : 'No user');
      
      if (user) {
        const isAdmin = user.email && user.email.toLowerCase() === 'admin@gmail.com';
        if (isAdmin) {
          console.log('[Admin] Admin verified.');
          localStorage.setItem(SETTINGS_KEYS.adminSession, 'true');
        } else {
          console.warn('[Admin] User is not an admin:', user.email);
          localStorage.removeItem(SETTINGS_KEYS.adminSession);
          window.location.href = 'index.html?error=unauthorized';
        }
      } else {
        // If no user and no local session, redirect
        if (!hasAdminSession) {
          console.warn('[Admin] No session found, redirecting...');
          window.location.href = 'login.html?tab=login&redirect=admin.html';
        }
      }
    });

      function showStatus(id, text, type) {
        var el = document.getElementById(id);
        if (!el) {
          return;
        }
        el.textContent = text;
        el.className = 'status ' + (type || 'ok');
      }

      function bumpConfigVersion() {
        localStorage.setItem(SETTINGS_KEYS.configVersion, String(Date.now()));
      }

      var successToast = document.getElementById('successToast');
      var toastTimer = null;

      function showSuccessToast(message) {
        if (!successToast) {
          return;
        }

        successToast.textContent = message || 'Changes added successfully.';
        successToast.classList.add('show');

        if (toastTimer) {
          clearTimeout(toastTimer);
        }

        toastTimer = setTimeout(function () {
          successToast.classList.remove('show');
        }, 2200);
      }

      async function fetchPricing() {
        try {
          const d = await getDoc(doc(db, 'config', 'pricing'));
          if (d.exists()) {
             return d.data();
          }
        } catch (e) {
          console.warn("Could not fetch pricing from Firebase", e);
        }
        return DEFAULT_PRICING;
      }

      function setPricingFields(pricing) {
        document.getElementById('starterMonth').value = pricing.starter.month;
        document.getElementById('starterYear').value = pricing.starter.year;
        document.getElementById('growthMonth').value = pricing.growth.month;
        document.getElementById('growthYear').value = pricing.growth.year;
        document.getElementById('enterpriseMonth').value = pricing.enterprise.month;
        document.getElementById('enterpriseYear').value = pricing.enterprise.year;
      }

      function readNumber(id) {
        var value = Number(document.getElementById(id).value);
        return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
      }

      function getDocsConfig() {
        try {
          var raw = localStorage.getItem(SETTINGS_KEYS.docs);
          if (!raw) {
            return { label: 'Docs', url: 'docs.html' };
          }
          var parsed = JSON.parse(raw);
          return {
            label: parsed && parsed.label ? String(parsed.label) : 'Docs',
            url: parsed && parsed.url ? String(parsed.url) : 'docs.html'
          };
        } catch (error) {
          return { label: 'Docs', url: 'docs.html' };
        }
      }

      // getApiKeys/setApiKeys replaced by fetchFirebaseKeys
      let firebaseApiKeys = [];

      async function fetchFirebaseKeys() {
        try {
          const q = query(collection(db, 'apiKeys'), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          firebaseApiKeys = [];
          snap.forEach(d => {
            firebaseApiKeys.push({ id: d.id, ...d.data() });
          });
          return firebaseApiKeys;
        } catch (error) {
          console.error("Error fetching keys:", error);
          return [];
        }
      }

      async function renderKeys() {
        var keysList = document.getElementById('keysList');
        if (!keysList) {
          return;
        }

        var keys = await fetchFirebaseKeys();

        keysList.innerHTML = '';

        if (keys.length === 0) {
          var empty = document.createElement('div');
          empty.className = 'empty';
          empty.textContent = 'No key links available. Add the first key entry.';
          keysList.appendChild(empty);
          return;
        }

        keys.forEach(function (item, index) {
          var li = document.createElement('li');

          var left = document.createElement('div');
          left.style.display = 'grid';
          left.style.gap = '4px';

          var key = document.createElement('div');
          key.className = 'key-val';
          key.textContent = item.keyUrl || item.key || 'No key URL';

          var time = document.createElement('div');
          time.className = 'key-time';
          var keyName = item.keyName || item.label || 'Unnamed Key';
          var dateText = 'Unknown';
          if (item.createdAt && typeof item.createdAt.toDate === 'function') {
            dateText = item.createdAt.toDate().toLocaleString();
          } else if (item.createdAt) {
            dateText = new Date(item.createdAt).toLocaleString();
          }
          time.textContent = dateText + ' · ' + keyName;

          var meta = document.createElement('div');
          meta.className = 'key-meta';

          var keyFunction = document.createElement('span');
          keyFunction.textContent = 'Function: ' + (item.keyFunction || 'N/A');

          var agentKind = document.createElement('span');
          agentKind.textContent = 'Agent kind: ' + (item.agentKind || 'General');

          var category = document.createElement('span');
          category.textContent = 'Category: ' + (item.category || 'General');

          var price = document.createElement('span');
          price.textContent = 'Price: $' + (item.price || 0);

          var payment = document.createElement('span');
          payment.textContent = 'Payment: ' + (item.paymentMethod || 'N/A');

          if (item.keyUrl) {
            var keyUrl = document.createElement('a');
            keyUrl.className = 'key-url';
            keyUrl.href = item.keyUrl;
            keyUrl.target = '_blank';
            keyUrl.rel = 'noopener noreferrer';
            keyUrl.textContent = 'Key URL';
            meta.appendChild(keyUrl);
          }

          meta.appendChild(keyFunction);
          meta.appendChild(agentKind);
          meta.appendChild(category);
          meta.appendChild(price);
          meta.appendChild(payment);

          left.appendChild(key);
          left.appendChild(time);
          left.appendChild(meta);

          var remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'btn alt';
          remove.textContent = 'Revoke';
          remove.style.padding = '6px 10px';
          remove.style.fontSize = '12px';
          remove.addEventListener('click', async function () {
            try {
              if (item.id) {
                await deleteDoc(doc(db, 'apiKeys', item.id));
              }
              await renderKeys();
              showStatus('keysStatus', 'API key revoked.', 'warn');
            } catch (error) {
              console.error("Error revoking key", error);
              showStatus('keysStatus', 'Failed to revoke API key.', 'warn');
            }
          });

          li.appendChild(left);
          li.appendChild(remove);
          keysList.appendChild(li);
        });
      }

      fetchPricing().then(pricing => {
        setPricingFields(pricing);
      });

      var docs = getDocsConfig();
      document.getElementById('docsLabel').value = docs.label;
      document.getElementById('docsUrl').value = docs.url;
      renderKeys();

      document.getElementById('savePricingBtn').addEventListener('click', async function () {
        var pricing = {
          starter: { month: readNumber('starterMonth'), year: readNumber('starterYear') },
          growth: { month: readNumber('growthMonth'), year: readNumber('growthYear') },
          enterprise: { month: readNumber('enterpriseMonth'), year: readNumber('enterpriseYear') }
        };

        if (!pricing.starter.month || !pricing.starter.year || !pricing.growth.month || !pricing.growth.year || !pricing.enterprise.month || !pricing.enterprise.year) {
          showStatus('pricingStatus', 'All pricing values must be valid numbers greater than 0.', 'warn');
          return;
        }

        try {
          await setDoc(doc(db, 'config', 'pricing'), pricing);
          localStorage.setItem(SETTINGS_KEYS.pricing, JSON.stringify(pricing));
          bumpConfigVersion();
          showStatus('pricingStatus', 'Pricing settings saved to cloud.', 'ok');
          showSuccessToast('Changes added successfully.');
        } catch (e) {
          console.error("Failed to save pricing", e);
          showStatus('pricingStatus', 'Failed to save pricing to cloud.', 'error');
        }
      });

      document.getElementById('saveDocsBtn').addEventListener('click', function () {
        var label = document.getElementById('docsLabel').value.trim() || 'Docs';
        var url = document.getElementById('docsUrl').value.trim() || 'docs.html';

        localStorage.setItem(SETTINGS_KEYS.docs, JSON.stringify({ label: label, url: url }));
        bumpConfigVersion();
        showStatus('docsStatus', 'Docs settings saved.', 'ok');
        showSuccessToast('Changes added successfully.');
      });

      var addKeyBtn = document.getElementById('addKeyBtn');
      var sparkleTimer = null;

      function triggerAddKeySparkle() {
        if (!addKeyBtn) {
          return;
        }

        if (sparkleTimer) {
          clearTimeout(sparkleTimer);
        }

        addKeyBtn.classList.remove('sparkle');
        void addKeyBtn.offsetWidth;
        addKeyBtn.classList.add('sparkle');

        sparkleTimer = setTimeout(function () {
          addKeyBtn.classList.remove('sparkle');
        }, 700);
      }

      document.getElementById('addKeyBtn').addEventListener('click', function () {
        triggerAddKeySparkle();

        var keyName = document.getElementById('apiKeyName').value.trim();
        var keyFunction = document.getElementById('apiKeyFunction').value.trim();
        var agentKind = document.getElementById('apiAgentKind').value;
        var category = document.getElementById('apiKeyCategory').value;
        var keyUrl = document.getElementById('apiKeyUrl').value.trim();
        var price = Number(document.getElementById('apiKeyPrice').value);
        var paymentMethod = document.getElementById('paymentMethod').value;

        if (!keyName) {
          showStatus('keysStatus', 'Key name is required.', 'warn');
          return;
        }

        if (!keyFunction) {
          showStatus('keysStatus', 'Key function is required.', 'warn');
          return;
        }

        if (!agentKind) {
          showStatus('keysStatus', 'Agent kind is required.', 'warn');
          return;
        }

        if (!category) {
          showStatus('keysStatus', 'Key category is required.', 'warn');
          return;
        }

        if (!Number.isFinite(price) || price <= 0) {
          showStatus('keysStatus', 'Enter a valid key price greater than 0.', 'warn');
          return;
        }

        if (!keyUrl) {
          showStatus('keysStatus', 'Pasted key URL or raw key is required.', 'warn');
          return;
        }

        // Accept either a valid URL or a raw API key (common prefixes: gsk_, sk_, av_, rzp_)
        var isUrl = false;
        try {
          new URL(keyUrl);
          isUrl = true;
        } catch (error) {
          // not a URL, will validate as raw key below
        }

        var rawKeyPattern = /^(gsk_|sk_|av_|rzp_|pk_live_|pk_test_)[A-Za-z0-9_\-]+/i;
        if (!isUrl && !rawKeyPattern.test(keyUrl)) {
          showStatus('keysStatus', 'Enter a valid URL or paste a raw API key (starts with gsk_, sk_, av_, rzp_).', 'warn');
          return;
        }

        if (!paymentMethod) {
          showStatus('keysStatus', 'Select a payment method.', 'warn');
          return;
        }

        var entry = {
          keyName: keyName,
          keyFunction: keyFunction,
          agentKind: agentKind,
          category: category,
          price: Math.round(price),
          paymentMethod: paymentMethod,
          createdAt: serverTimestamp()
        };

        if (isUrl) {
          entry.keyUrl = keyUrl;
        } else {
          entry.key = keyUrl;
        }

        addDoc(collection(db, 'apiKeys'), entry).then(() => {
          bumpConfigVersion();
          document.getElementById('apiKeyName').value = '';
          document.getElementById('apiKeyFunction').value = '';
          document.getElementById('apiAgentKind').value = '';
          document.getElementById('apiKeyCategory').value = '';
          document.getElementById('apiKeyUrl').value = '';
          document.getElementById('apiKeyPrice').value = '';
          document.getElementById('paymentMethod').value = '';
          renderKeys();
          showStatus('keysStatus', 'API key option added with price and payment method.', 'ok');
          showSuccessToast('Changes added successfully.');
        }).catch((error) => {
          console.error("Error adding key", error);
          showStatus('keysStatus', 'Failed to add API key.', 'warn');
        });
      });


    document.getElementById('logoutBtn').addEventListener('click', function () {
      auth.signOut().then(() => {
        localStorage.removeItem(SETTINGS_KEYS.adminSession);
        window.location.href = 'index.html';
