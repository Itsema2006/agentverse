/**
 * AgentVerse Global Checkout System
 * Handles the payment modal lifecycle, UPI integration, and API key provisioning.
 */

const Checkout = (function () {
  const STORAGE_KEYS = {
    purchaseHistory: 'agentversePurchaseHistory'
  };

  const API_BASE_URL = (function () {
    if (window.AGENTVERSE_API_BASE_URL && typeof window.AGENTVERSE_API_BASE_URL === 'string') {
      return window.AGENTVERSE_API_BASE_URL.replace(/\/+$/, '');
    }

    return window.location.origin;
  })();

  const API_ENDPOINTS = {
    config: API_BASE_URL + '/api/config',
    createOrder: API_BASE_URL + '/api/create-order',
    verifyPayment: API_BASE_URL + '/api/verify-payment'
  };

  let modalOverlay = null;
  let currentItem = null;
  let selectedMethod = 'card';
  let paymentButtonState = null;
  let razorpayConfigPromise = null;
  let authStatePromise = null;

  const modalHTML = `
    <div class="checkout-overlay" id="checkoutOverlay">
      <div class="checkout-modal">
        <!-- Main Checkout View -->
        <div class="checkout-view" id="mainView">
          <div class="checkout-header">
            <h2>Complete Purchase</h2>
            <button class="checkout-close" id="checkoutClose">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="checkout-summary">
            <h3 class="checkout-section-title">Order Summary</h3>
            <div class="checkout-item">
              <span class="checkout-item-name" id="checkoutItemName">Agent Access Key</span>
              <span class="checkout-item-price" id="checkoutItemPrice">$49.00</span>
            </div>
          </div>

          <div class="checkout-summary" style="margin-top: 14px;">
            <h3 class="checkout-section-title">Key Details</h3>
            <p id="checkoutItemDescription" style="color: #6b7280; font-size: 14px; line-height: 1.7; margin-top: 4px;">
              This API key will be unlocked after your payment is completed and verified.
            </p>
          </div>

          <h3 class="checkout-section-title">Select Payment Method</h3>
          <div class="payment-options">
            <div class="payment-option selected" data-method="card">
              <div class="payment-icon">
                <span class="material-symbols-outlined">credit_card</span>
              </div>
              <div class="payment-details">
                <h4>Credit / Debit Card</h4>
                <p>Stripe, Visa, Mastercard</p>
              </div>
            </div>
            
            <div class="payment-option" data-method="paypal">
              <div class="payment-icon">
                <span class="material-symbols-outlined">payments</span>
              </div>
              <div class="payment-details">
                <h4>PayPal</h4>
                <p>Fast and secure checkout</p>
              </div>
            </div>

            <div class="payment-option" data-method="upi">
              <div class="payment-icon">
                <span class="material-symbols-outlined">smartphone</span>
              </div>
              <div class="payment-details">
                <h4>UPI Payment</h4>
                <p>Google Pay, PhonePe, Paytm</p>
              </div>
            </div>


          </div>



          <button class="checkout-pay-btn" id="payButton">
            Pay with Razorpay
          </button>

          <p id="paymentStatus" style="min-height: 18px; margin-top: 12px; font-size: 13px; font-weight: 600; color: #6b7280;"></p>
          
          <p style="text-align: center; font-size: 11px; color: #6b7280; margin-top: 16px;">
            By clicking Pay, you agree to AgentVerse's Terms of Service.
          </p>
        </div>



        <!-- Success View -->
        <div class="checkout-view" id="successView" style="display: none;">
          <div class="success-icon">
            <span class="material-symbols-outlined">check_circle</span>
          </div>
          <h3 style="text-align: center; font-size: 20px; font-weight: 800; margin-bottom: 8px;">Payment Done!</h3>
          <p id="successMessage" style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">Your purchase has been completed successfully.</p>
          
          <div class="api-key-container" style="display: none;">
            <label>YOUR API KEY</label>
            <div class="api-key-box">
              <code id="generatedKey">av_live_7x9pL...</code>
              <button id="copyKey" class="material-symbols-outlined">content_copy</button>
            </div>
          </div>

          <button class="checkout-pay-btn" onclick="window.location.href='dashboard.html'">
            Go to Dashboard
          </button>
          <button class="checkout-pay-btn" style="margin-top: 10px; background: transparent; color: #f97316; border: 1px solid #f97316; box-shadow: none;" id="closeSuccess">
            Continue Browsing
          </button>
        </div>
      </div>
    </div>
  `;

  function init() {
    if (document.getElementById('checkoutOverlay')) return;
    
    const wrapper = document.createElement('div');
    wrapper.innerHTML = modalHTML;
    document.body.appendChild(wrapper.firstElementChild);
    
    modalOverlay = document.getElementById('checkoutOverlay');
    
    // Event Listeners
    const checkoutCloseButton = document.getElementById('checkoutClose');
    const closeSuccessButton = document.getElementById('closeSuccess');
    const backToMainButton = document.getElementById('backToMain');

    if (checkoutCloseButton) checkoutCloseButton.onclick = close;
    if (closeSuccessButton) closeSuccessButton.onclick = close;
    if (backToMainButton) backToMainButton.onclick = () => switchView('mainView');
    
    document.querySelectorAll('.payment-option').forEach(opt => {
      opt.onclick = function() {
        document.querySelector('.payment-option.selected').classList.remove('selected');
        this.classList.add('selected');
        selectedMethod = this.dataset.method;
        updatePayButtonText();
        toggleUpiIdField();
      };
    });

    const payButton = document.getElementById('payButton');
    const copyKeyButton = document.getElementById('copyKey');

    if (payButton) payButton.onclick = handlePaymentAction;
    if (copyKeyButton) copyKeyButton.onclick = copyToClipboard;
    toggleUpiIdField();
    
    // Close on backdrop click
    modalOverlay.onclick = function(e) {
      if (e.target === modalOverlay) close();
    };
  }

  function updatePayButtonText() {
    const btn = document.getElementById('payButton');
    btn.textContent = 'Pay';
  }

  function toggleUpiIdField() {
    // UPI ID option removed; keep function safe/no-op.
    const upiFieldWrap = document.getElementById('upiIdFieldWrap');
    const upiInput = document.getElementById('upiIdInput');

    if (upiFieldWrap) upiFieldWrap.style.display = 'none';
    if (upiInput) upiInput.value = '';
  }



  function handlePaymentAction() {
    ensureAuthenticated().then((isAuthenticated) => {
      if (isAuthenticated) {
        processPayment();
      }
    });
  }

  async function getCurrentUser() {
    if (!authStatePromise) {
      authStatePromise = import('./firebase_config.js').then(async (firebaseModule) => {
        const auth = firebaseModule.auth;

        if (auth && typeof auth.authStateReady === 'function') {
          try {
            await auth.authStateReady();
          } catch (error) {
            // Ignore auth readiness failures and fall back to currentUser.
          }
        }

        return auth && auth.currentUser ? auth.currentUser : null;
      }).catch(() => null);
    }

    return authStatePromise;
  }

  function redirectToLogin() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    window.location.href = `login.html?tab=login&redirect=${encodeURIComponent(currentPage)}`;
  }

  async function ensureAuthenticated() {
    const user = await getCurrentUser();

    if (user) {
      return true;
    }

    setPaymentStatus('Please sign in to continue with payment.', 'error');
    redirectToLogin();
    return false;
  }



  function switchView(viewId) {
    document.querySelectorAll('.checkout-view').forEach(v => v.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
  }

  function open(itemInfo) {
    init();
    currentItem = itemInfo;
    
    document.getElementById('checkoutItemName').textContent = itemInfo.name || 'Agent Access Key';
    document.getElementById('checkoutItemPrice').textContent = itemInfo.price || '$49.00';
    document.getElementById('checkoutItemDescription').textContent = itemInfo.description
      || 'This API key will be unlocked after your payment is completed and verified.';
    
    switchView('mainView');
    modalOverlay.classList.remove('success');
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    setPaymentStatus('');
  }

  function close() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('active');
    modalOverlay.classList.remove('success');
    document.body.style.overflow = '';
    setPaymentStatus('');
    restorePaymentButton();
  }

  function resolveAmountInPaise(itemInfo) {
    if (itemInfo && Number.isFinite(itemInfo.amount)) {
      return Math.max(100, Math.round(itemInfo.amount));
    }

    if (itemInfo && Number.isFinite(itemInfo.amountInPaise)) {
      return Math.max(100, Math.round(itemInfo.amountInPaise));
    }

    const priceText = String((itemInfo && itemInfo.price) || '49').replace(/,/g, '');
    const parsedAmount = Number.parseFloat((priceText.match(/\d+(?:\.\d+)?/) || ['49'])[0]);

    if (!Number.isFinite(parsedAmount)) {
      return 4900;
    }

    return Math.max(100, Math.round(parsedAmount * 100));
  }

  function setPaymentStatus(message, tone) {
    const statusNode = document.getElementById('paymentStatus');

    if (!statusNode) return;

    statusNode.textContent = message || '';
    if (!message) {
      statusNode.style.color = '#6b7280';
      return;
    }

    if (tone === 'success') {
      statusNode.style.color = '#059669';
      return;
    }

    if (tone === 'error') {
      statusNode.style.color = '#dc2626';
      return;
    }

    statusNode.style.color = '#b45309';
  }

  function setPaymentButtonState(button, label) {
    paymentButtonState = {
      button: button,
      label: label
    };

    button.disabled = true;
    button.textContent = 'Processing...';
  }

  function restorePaymentButton() {
    if (!paymentButtonState || !paymentButtonState.button) return;

    paymentButtonState.button.disabled = false;
    paymentButtonState.button.textContent = paymentButtonState.label;
    paymentButtonState = null;
  }

  async function safeParseJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  async function loadRazorpayConfig() {
    if (!razorpayConfigPromise) {
      razorpayConfigPromise = fetch(API_ENDPOINTS.config, {
        headers: {
          Accept: 'application/json'
        }
      }).then(async response => {
        if (!response.ok) {
          const errorBody = await safeParseJson(response);
          throw new Error((errorBody && errorBody.message) || 'Unable to load Razorpay configuration.');
        }

        const payload = await response.json();

        if (!payload.razorpayKeyId) {
          throw new Error('Razorpay key id is missing from the backend configuration.');
        }

        if (payload.razorpayConfigured === false) {
          throw new Error('Razorpay is not configured on the server.');
        }

        return payload;
      }).catch(error => {
        razorpayConfigPromise = null;
        throw error;
      });
    }

    return razorpayConfigPromise;
  }

  async function createRazorpayOrder(amountInPaise) {
    const receipt = `receipt_${Date.now()}`;
    const response = await fetch(API_ENDPOINTS.createOrder, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: receipt
      })
    });

    const payload = await safeParseJson(response);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Razorpay credentials were rejected by the payment provider.');
      }

      throw new Error((payload && payload.message) || 'Unable to create Razorpay order.');
    }

    if (!payload || !payload.order_id) {
      throw new Error('Razorpay order response was incomplete.');
    }

    return payload;
  }

  async function verifyRazorpayPayment(payload) {
    const response = await fetch(API_ENDPOINTS.verifyPayment, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await safeParseJson(response);

    if (!response.ok || !result || !result.success) {
      throw new Error((result && result.message) || 'Payment verification failed.');
    }

    return result;
  }

  async function processPayment() {
    const activeBtn = document.getElementById('payButton');
    const originalText = activeBtn ? activeBtn.textContent : 'Pay with Razorpay';
    const paymentMethodUsed = selectedMethod;

    if (!activeBtn) {
      setPaymentStatus('Checkout is not ready yet.', 'error');
      return;
    }

    setPaymentButtonState(activeBtn, originalText);
    setPaymentStatus('Preparing secure Razorpay checkout...', 'info');

    try {
      const config = await loadRazorpayConfig();
      const amountInPaise = resolveAmountInPaise(currentItem);
      const order = await createRazorpayOrder(amountInPaise);

      if (typeof window.Razorpay !== 'function') {
        throw new Error('Razorpay checkout script is not available.');
      }

      // Mock mode: simulate successful payment without opening real Razorpay modal
      console.log('[DEBUG] Order object:', order);
      if (order.mock) {
        console.log('[DEBUG] Mock mode detected - skipping real Razorpay checkout');
        setPaymentStatus('Processing test payment...', 'info');
        
        // Simulate payment handler with mock credentials
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const mockResponse = {
          razorpay_order_id: order.order_id,
          razorpay_payment_id: `pay_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          razorpay_signature: `mock_sig_${Math.random().toString(36).substr(2, 20)}`
        };
        
        setPaymentStatus('Verifying payment...', 'info');
        
        try {
          await verifyRazorpayPayment(mockResponse);

          await savePurchase({
            paymentMethod: paymentMethodUsed === 'upi' ? 'RAZORPAY_UPI' : 'RAZORPAY',
            razorpayOrderId: mockResponse.razorpay_order_id,
            razorpayPaymentId: mockResponse.razorpay_payment_id
          });
          setPaymentStatus('Payment verified successfully.', 'success');
          showSuccess();
        } catch (error) {
          setPaymentStatus(error.message || 'Payment verification failed.', 'error');
        } finally {
          restorePaymentButton();
        }
        return;
      }

      const razorpayOptions = {
        key: config.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: 'AgentVerse',
        description: currentItem && currentItem.name ? currentItem.name : 'Agent Access Key',
        order_id: order.order_id,
        config: {
          display: {
            blocks: {
              preferred: {
                name: paymentMethodUsed === 'upi' ? 'Pay with UPI' : (paymentMethodUsed === 'paypal' ? 'Pay with Wallet' : 'Pay with Card'),
                instruments: [
                  { method: paymentMethodUsed === 'upi' ? 'upi' : (paymentMethodUsed === 'paypal' ? 'wallet' : 'card') }
                ]
              }
            },
            sequence: ['block.preferred'],
            preferences: {
              show_default_blocks: true
            }
          }
        },
        modal: {
          ondismiss: function () {
            setPaymentStatus('Payment cancelled.', 'error');
            restorePaymentButton();
          }
        },
        handler: async function (response) {
          setPaymentStatus('Verifying payment...', 'info');

          try {
            await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            await savePurchase({
              paymentMethod: paymentMethodUsed === 'upi' ? 'RAZORPAY_UPI' : 'RAZORPAY',
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id
            });
            setPaymentStatus('Payment verified successfully.', 'success');
            showSuccess();
          } catch (error) {
            setPaymentStatus(error.message || 'Payment verification failed.', 'error');
          } finally {
            restorePaymentButton();
          }
        }
      };

      const razorpay = new window.Razorpay(razorpayOptions);

      console.log('[DEBUG] Opening real Razorpay checkout for order:', order.order_id);

      razorpay.on('payment.failed', function (response) {
        const message = response && response.error && response.error.description
          ? response.error.description
          : 'Payment failed. Please try again.';
        setPaymentStatus(message, 'error');
        restorePaymentButton();
      });

      razorpay.open();
    } catch (error) {
      setPaymentStatus(error.message || 'Unable to start Razorpay checkout.', 'error');
      restorePaymentButton();
    }
  }

  async function savePurchase(paymentDetails) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.purchaseHistory);
      const history = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(history) ? history : [];
      
      let newKey = (currentItem && (currentItem.keyUrl || currentItem.rawKey)) ? (currentItem.keyUrl || currentItem.rawKey) : '';
      
      if (!newKey) {
        newKey = `av_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
        try {
          const firebaseModule = await import('./firebase_config.js');
          const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');

          // If the currentItem references a specific apiKeys document id, fetch that doc
          if (currentItem && currentItem.id) {
            try {
              const docRef = firestoreModule.doc(firebaseModule.db, 'apiKeys', currentItem.id);
              const docSnap = await firestoreModule.getDoc(docRef);
              if (docSnap && docSnap.exists()) {
                const keyData = docSnap.data();
                newKey = keyData.keyUrl || keyData.key || newKey;
              }
            } catch (innerErr) {
              console.warn('Could not fetch specific apiKey document', innerErr);
            }
          }

          // Fallback: get most recent key if specific id not available or fetch failed
          if (!newKey || newKey.indexOf('av_live_') === 0) {
            const q = firestoreModule.query(
              firestoreModule.collection(firebaseModule.db, 'apiKeys'),
              firestoreModule.orderBy('createdAt', 'desc'),
              firestoreModule.limit(1)
            );
            const snap = await firestoreModule.getDocs(q);
            if (!snap.empty) {
              const keyData = snap.docs[0].data();
              newKey = keyData.keyUrl || keyData.key || newKey;
            }
          }
        } catch (e) {
          console.warn('Could not retrieve API key from Firebase.', e);
        }
      }
      
      const entry = {
        itemName: currentItem.name,
        amount: currentItem.price,
        paymentMethod: paymentDetails && paymentDetails.paymentMethod ? paymentDetails.paymentMethod : 'RAZORPAY',
        source: window.location.pathname.split('/').pop() || 'Index',
        purchasedAt: new Date().toISOString(),
        licenseKey: newKey,
        razorpayOrderId: paymentDetails && paymentDetails.razorpayOrderId ? paymentDetails.razorpayOrderId : undefined,
        razorpayPaymentId: paymentDetails && paymentDetails.razorpayPaymentId ? paymentDetails.razorpayPaymentId : undefined
      };
      
      list.unshift(entry);
      
      localStorage.setItem(STORAGE_KEYS.purchaseHistory, JSON.stringify(list.slice(0, 30)));
      
      // Update the UI with the key
      document.getElementById('generatedKey').textContent = newKey;
      const keyContainer = document.querySelector('.api-key-container');
      if (keyContainer) {
        if (currentItem && currentItem.type === 'subscription') {
          keyContainer.style.display = 'none';
        } else {
          keyContainer.style.display = 'block';
        }
      }
      
      window.dispatchEvent(new Event('storage'));
      
      // Save purchase data to Firebase
      savePurchaseFirebase(entry);
    } catch (error) {
      console.warn('Unable to record purchase:', error);
    }
  }

  async function savePurchaseFirebase(entry) {
    try {
      const firebaseModule = await import('./firebase_config.js');
      const auth = firebaseModule.auth;
      const db = firebaseModule.db;
      
      const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
      const addDoc = firestoreModule.addDoc;
      const collection = firestoreModule.collection;
      const serverTimestamp = firestoreModule.serverTimestamp;

      const user = auth.currentUser;
      if (user) {
        // Save to user-specific purchase history
        await addDoc(collection(db, 'users', user.uid, 'purchaseHistory'), {
            itemName: entry.itemName || 'Unknown Item',
            amount: entry.amount ?? null,
            paymentMethod: entry.paymentMethod || 'N/A',
            source: entry.source || 'Unknown',
            purchasedAt: entry.purchasedAt ? new Date(entry.purchasedAt) : serverTimestamp(),
            licenseKey: entry.licenseKey || null,
            razorpayOrderId: entry.razorpayOrderId || null,
            razorpayPaymentId: entry.razorpayPaymentId || null,
            userId: user.uid,
            userEmail: user.email,
            createdAt: serverTimestamp()
        });
        
        // Also save to global purchase logs for admin reporting
        await addDoc(collection(db, 'logs', 'purchases', 'records'), {
            itemName: entry.itemName || 'Unknown Item',
            amount: entry.amount ?? null,
            paymentMethod: entry.paymentMethod || 'N/A',
            source: entry.source || 'Unknown',
            purchasedAt: entry.purchasedAt ? new Date(entry.purchasedAt) : serverTimestamp(),
            licenseKey: entry.licenseKey || null,
            razorpayOrderId: entry.razorpayOrderId || null,
            razorpayPaymentId: entry.razorpayPaymentId || null,
            userId: user.uid,
            userEmail: user.email,
            timestamp: serverTimestamp()
        });
        
        console.log("Purchase successfully saved to user history and purchase logs.");
      } else {
        console.warn("User not logged in, purchase not saved to Firebase.");
      }
    } catch (error) {
      console.warn("Could not save to Firebase", error);
    }
  }

  function showSuccess() {
    document.getElementById('successMessage').textContent = `Your purchase of ${currentItem.name} has been completed successfully.`;
    switchView('successView');
    modalOverlay.classList.add('success');
  }

  function copyToClipboard() {
    const keyText = document.getElementById('generatedKey').textContent;
    navigator.clipboard.writeText(keyText).then(() => {
      const btn = document.getElementById('copyKey');
      btn.textContent = 'check';
      setTimeout(() => btn.textContent = 'content_copy', 2000);
    });
  }

  return {
    open: open,
    init: init
  };
})();
