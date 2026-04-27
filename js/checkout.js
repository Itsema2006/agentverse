/**
 * AgentVerse Global Checkout System
 * Handles the payment modal lifecycle, UPI integration, and API key provisioning.
 */

const Checkout = (function () {
  const STORAGE_KEYS = {
    purchaseHistory: 'agentversePurchaseHistory'
  };

  let modalOverlay = null;
  let currentItem = null;
  let selectedMethod = 'card';

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
            Pay with Credit Card
          </button>
          
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
          <p id="successMessage" style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">Your API key has been retrieved successfully.</p>
          
          <div class="api-key-container">
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
    const methodNames = {
      card: 'Credit Card',
      paypal: 'PayPal',
      upi: 'UPI'
    };
    btn.textContent = `Pay with ${methodNames[selectedMethod]}`;
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
  }

  function close() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('active');
    modalOverlay.classList.remove('success');
    document.body.style.overflow = '';
  }

  function processPayment() {
    const activeBtn = selectedMethod === 'upi' ? document.getElementById('completeUpiPayment') : document.getElementById('payButton');
    const originalText = activeBtn.textContent;
    activeBtn.disabled = true;
    activeBtn.textContent = 'Processing...';
    
    // Simulate API call
    setTimeout(() => {
      savePurchase();
      showSuccess();
      activeBtn.disabled = false;
      activeBtn.textContent = originalText;
    }, 1500);
  }

  function savePurchase() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.purchaseHistory);
      const history = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(history) ? history : [];
      
      let newKey = `av_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
      try {
        const rawKeys = localStorage.getItem('agentverseApiKeys');
        const keys = rawKeys ? JSON.parse(rawKeys) : [];
        if (Array.isArray(keys) && keys.length > 0 && keys[0].keyUrl) {
          newKey = keys[0].keyUrl;
        }
      } catch (e) {
        console.warn('Could not retrieve API key URL from settings.');
      }
      
      const entry = {
        itemName: currentItem.name,
        amount: currentItem.price,
        paymentMethod: selectedMethod.toUpperCase(),
        source: window.location.pathname.split('/').pop() || 'Index',
        purchasedAt: new Date().toISOString(),
        licenseKey: newKey
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
    document.getElementById('successMessage').textContent = `Your API key for ${currentItem.name} has been retrieved successfully.`;
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
