/**
 * AgentVerse Global Checkout System
 * Handles the payment modal lifecycle, UPI integration, and API key provisioning.
 */

const Checkout = (function () {
  const STORAGE_KEYS = {
    purchaseHistory: 'agentversePurchaseHistory'
  };

  const API_ENDPOINTS = {
    config: '/api/config',
    createOrder: '/api/create-order',
    verifyPayment: '/api/verify-payment'
  };

  let modalOverlay = null;
  let currentItem = null;
  let selectedMethod = 'card';
  let paymentButtonState = null;
  let razorpayConfigPromise = null;

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

        <!-- UPI Gateway View (Simulated) -->
        <div class="checkout-view" id="upiGatewayView" style="display: none;">
          <div class="checkout-header">
            <button class="material-symbols-outlined" id="backToMain" style="background:none; border:none; cursor:pointer;">arrow_back</button>
            <h2 style="flex: 1; text-align: center;">UPI Gateway</h2>
          </div>
          
          <div style="text-align: center; padding: 20px 0;">
            <div style="width: 180px; height: 180px; background: #f3f4f6; border: 4px solid #fff; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
               <span class="material-symbols-outlined" style="font-size: 80px; color: #374151;">qr_code_2</span>
            </div>
            <p style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">Scan QR to Pay</p>
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 24px;">Open your UPI app and scan the code</p>
            
            <button class="checkout-pay-btn" id="completeUpiPayment">
              Confirm Payment Done
            </button>
          </div>
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
    document.getElementById('checkoutClose').onclick = close;
    document.getElementById('closeSuccess').onclick = close;
    document.getElementById('backToMain').onclick = () => switchView('mainView');
    
    document.querySelectorAll('.payment-option').forEach(opt => {
      opt.onclick = function() {
        document.querySelector('.payment-option.selected').classList.remove('selected');
        this.classList.add('selected');
        selectedMethod = this.dataset.method;
        updatePayButtonText();
      };
    });

    document.getElementById('payButton').onclick = handlePaymentAction;
    document.getElementById('completeUpiPayment').onclick = processPayment;
    document.getElementById('copyKey').onclick = copyToClipboard;
    
    // Close on backdrop click
    modalOverlay.onclick = function(e) {
      if (e.target === modalOverlay) close();
    };
  }

  function updatePayButtonText() {
    const btn = document.getElementById('payButton');
    btn.textContent = 'Pay with Razorpay';
  }

  function handlePaymentAction() {
    if (selectedMethod === 'upi') {
      switchView('upiGatewayView');
    } else {
      processPayment();
    }
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
    const activeBtn = selectedMethod === 'upi' ? document.getElementById('completeUpiPayment') : document.getElementById('payButton');
    const originalText = activeBtn ? activeBtn.textContent : 'Pay with Razorpay';

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

      const razorpay = new window.Razorpay({
        key: config.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: 'AgentVerse',
        description: currentItem && currentItem.name ? currentItem.name : 'Agent Access Key',
        order_id: order.order_id,
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

            savePurchase({
              paymentMethod: 'RAZORPAY',
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
      });

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

  function savePurchase(paymentDetails) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.purchaseHistory);
      const history = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(history) ? history : [];
      
      let newKey = `av_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
        try {
        const rawKeys = localStorage.getItem('agentverseApiKeys');
        const keys = rawKeys ? JSON.parse(rawKeys) : [];
        if (Array.isArray(keys) && keys.length > 0) {
          newKey = keys[0].keyUrl || keys[0].key || newKey;
        }
      } catch (e) {
        console.warn('Could not retrieve API key from settings.');
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
        await addDoc(collection(db, 'users', user.uid, 'purchaseHistory'), {
            itemName: entry.itemName || 'Unknown Item',
            amount: entry.amount ?? null,
            paymentMethod: entry.paymentMethod || 'N/A',
            source: entry.source || 'Unknown',
            purchasedAt: entry.purchasedAt ? new Date(entry.purchasedAt) : serverTimestamp(),
            createdAt: serverTimestamp()
        });
        console.log("Purchase successfully connected and saved to Firebase.");
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
