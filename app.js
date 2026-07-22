/* ==========================================================================
   RODRIGUEZ RANCH - FIREBASE-POWERED APPLICATION
   ========================================================================== */

// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-analytics.js";

// --- FIREBASE INIT ---
const firebaseConfig = {
  apiKey: "AIzaSyBz9Zay89w6e1eZRDfILVwTieBz1xySxDg",
  authDomain: "rodriguez-ranch.firebaseapp.com",
  projectId: "rodriguez-ranch",
  storageBucket: "rodriguez-ranch.firebasestorage.app",
  messagingSenderId: "1040803580184",
  appId: "1:1040803580184:web:c7873bb2e541ef3817b66d",
  measurementId: "G-RHEJSPDXZL"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
getAnalytics(firebaseApp);

// --- CONSTANTS ---
const ADMIN_EMAIL = "morganmv145@gmail.com";
const DEFAULTS = { 
  promoteKittens: true, 
  price12: 6.00, 
  price18: 8.50,
  openTime: "09:00",
  closeTime: "17:00",
  blockedDates: [],
  pickupAddress: "Castroville, TX 78009"
};

// --- APP STATE ---
let state = {
  currentUser: null,
  isAdmin: false,
  settings: { ...DEFAULTS },
  kittens: [],
  orders: [],
  myOrders: [],
  currentCart: null,
  unsubSettings: null,
  unsubKittens: null,
  unsubOrders: null,
};

// ==========================================================================
//  FIRESTORE HELPERS
// ==========================================================================

// Helper to prevent database calls from hanging forever (e.g. if Firestore is not created or client is offline)
async function writeWithTimeout(promise, timeoutMs = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Database connection timeout. Please make sure: 1. You clicked 'Create Database' under Firestore Database in your Firebase console. 2. You are connected to the internet.")), timeoutMs))
  ]);
}

async function ensureSettingsExist() {
  const ref = doc(db, "settings", "global");
  try {
    const snap = await writeWithTimeout(getDoc(ref), 5000);
    if (!snap.exists()) await writeWithTimeout(setDoc(ref, DEFAULTS), 5000);
  } catch (err) {
    console.error("ensureSettingsExist error:", err);
    throw err;
  }
}

async function getUserProfile(uid) {
  try {
    const snap = await writeWithTimeout(getDoc(doc(db, "users", uid)), 5000);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("getUserProfile error:", err);
    return null;
  }
}

async function saveUserProfile(uid, data) {
  try {
    await writeWithTimeout(setDoc(doc(db, "users", uid), data, { merge: true }), 5000);
  } catch (err) {
    console.error("saveUserProfile error:", err);
  }
}

// ==========================================================================
//  REAL-TIME LISTENERS
// ==========================================================================

function stopListeners() {
  if (state.unsubSettings) { state.unsubSettings(); state.unsubSettings = null; }
  if (state.unsubKittens) { state.unsubKittens(); state.unsubKittens = null; }
  if (state.unsubOrders) { state.unsubOrders(); state.unsubOrders = null; }
}

function startPublicListeners() {
  state.unsubSettings = onSnapshot(doc(db, "settings", "global"), (snap) => {
    state.settings = snap.exists() ? snap.data() : { ...DEFAULTS };
    updateSiteUI();
  });
  state.unsubKittens = onSnapshot(collection(db, "kittens"), (snap) => {
    state.kittens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderKittensGrid();
  });
}

function startAuthListeners() {
  // Settings + kittens (same as public)
  state.unsubSettings = onSnapshot(doc(db, "settings", "global"), (snap) => {
    state.settings = snap.exists() ? snap.data() : { ...DEFAULTS };
    updateSiteUI();
  });
  state.unsubKittens = onSnapshot(collection(db, "kittens"), (snap) => {
    state.kittens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderKittensGrid();
    if (state.isAdmin) renderAdminKittensGrid();
  });

  // Orders
  if (state.isAdmin) {
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    state.unsubOrders = onSnapshot(q, (snap) => {
      state.orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAdminOrdersTable();
    });
  } else {
    const q = query(
      collection(db, "orders"),
      where("userId", "==", state.currentUser.uid),
      orderBy("timestamp", "desc"),
      limit(3)
    );
    state.unsubOrders = onSnapshot(q, (snap) => {
      state.myOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderCustomerOrders();
    });
  }
}

// ==========================================================================
//  AUTH STATE LISTENER — controls all UI
// ==========================================================================

onAuthStateChanged(auth, async (user) => {
  stopListeners();
  if (user) {
    state.currentUser = user;
    state.isAdmin = user.email === ADMIN_EMAIL;
    updateAuthHeaderUI(user);
    await ensureSettingsExist();
    startAuthListeners();
  } else {
    state.currentUser = null;
    state.isAdmin = false;
    state.myOrders = [];
    state.orders = [];
    updateAuthHeaderUI(null);
    await ensureSettingsExist();
    startPublicListeners();
  }
});

// ==========================================================================
//  AUTH HEADER BUTTON
// ==========================================================================

function updateAuthHeaderUI(user) {
  const btn = document.getElementById('btn-auth-header');
  if (!btn) return;
  if (!user) {
    btn.innerHTML = '<i class="fa-solid fa-user"></i> Sign In';
    btn.className = 'btn btn-outline btn-sm';
    btn.onclick = () => openAuthModal('login');
    return;
  }
  if (state.isAdmin) {
    btn.innerHTML = '<i class="fa-solid fa-gauge-high"></i> Admin';
    btn.className = 'btn btn-primary btn-sm';
    btn.onclick = openAdminModal;
  } else {
    const firstName = user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0];
    btn.innerHTML = `<i class="fa-solid fa-circle-user"></i> ${firstName}`;
    btn.className = 'btn btn-secondary btn-sm';
    btn.onclick = openCustomerDashboard;
  }
}

// ==========================================================================
//  AUTH MODAL (Login / Signup)
// ==========================================================================

function openAuthModal(tab = 'login') {
  document.getElementById('auth-modal').classList.remove('hidden');
  document.getElementById('auth-login-error').classList.add('hidden');
  document.getElementById('auth-signup-error').classList.add('hidden');
  switchAuthTab(tab);
}

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('auth-login-pane').classList.toggle('hidden', !isLogin);
  document.getElementById('auth-signup-pane').classList.toggle('hidden', isLogin);
  document.getElementById('tab-login').classList.toggle('auth-tab-active', isLogin);
  document.getElementById('tab-signup').classList.toggle('auth-tab-active', !isLogin);
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('auth-login-error');
  const btn = document.getElementById('btn-login-submit');
  btn.disabled = true; btn.textContent = 'Signing In...';
  try {
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('login-form').reset();
    showToast('Welcome back! 🤠');
  } catch (err) {
    errorEl.textContent = getFriendlyAuthError(err.code);
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const errorEl = document.getElementById('auth-signup-error');
  const btn = document.getElementById('btn-signup-submit');
  btn.disabled = true; btn.textContent = 'Creating Account...';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await saveUserProfile(cred.user.uid, { name, phone, email, createdAt: serverTimestamp() });
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('signup-form').reset();
    showToast(`Welcome to Rodriguez Ranch, ${name.split(' ')[0]}! 🤠`);
  } catch (err) {
    errorEl.textContent = getFriendlyAuthError(err.code);
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

async function handleGoogleAuth(e) {
  e.preventDefault();
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check if this is a new user by trying to fetch profile
    const docRef = doc(db, "users", user.uid);
    let profileSnap = null;
    try {
      profileSnap = await writeWithTimeout(getDoc(docRef));
    } catch(err) { /* ignore timeout here and assume new user if fails */ }
    
    if (!profileSnap || !profileSnap.exists()) {
      await saveUserProfile(user.uid, {
        name: user.displayName || 'Guest',
        email: user.email,
        phone: user.phoneNumber || '',
        createdAt: serverTimestamp()
      });
      showToast(`Welcome to Rodriguez Ranch, ${user.displayName ? user.displayName.split(' ')[0] : 'Guest'}! 🤠`);
    } else {
      showToast('Welcome back! 🤠');
    }
    document.getElementById('auth-modal').classList.add('hidden');
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      showToast('❌ Google Sign-In failed: ' + getFriendlyAuthError(err.code));
    }
  }
}

async function handleSignOut() {
  await signOut(auth);
  document.getElementById('customer-dashboard-modal').classList.add('hidden');
  document.getElementById('admin-modal').classList.add('hidden');
  showToast('You have been signed out.');
}

function getFriendlyAuthError(code) {
  const map = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Incorrect email or password. Please try again.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/unauthorized-domain': 'This website domain is not authorized for Google Sign-In. Add it in the Firebase Console.',
  };
  return map[code] || 'An error occurred. Please try again.';
}

// ==========================================================================
//  CUSTOMER DASHBOARD
// ==========================================================================

async function openCustomerDashboard() {
  if (!state.currentUser) { openAuthModal('login'); return; }
  const profile = await getUserProfile(state.currentUser.uid);
  const nameEl = document.getElementById('dash-cust-name');
  const emailEl = document.getElementById('dash-cust-email');
  if (nameEl) nameEl.textContent = profile?.name || state.currentUser.email;
  if (emailEl) emailEl.textContent = state.currentUser.email;
  document.getElementById('customer-dashboard-modal').classList.remove('hidden');
  renderCustomerOrders();
}

function renderCustomerOrders() {
  const container = document.getElementById('my-orders-list');
  if (!container) return;
  if (state.myOrders.length === 0) {
    container.innerHTML = `
      <div class="empty-orders-state">
        <i class="fa-solid fa-receipt"></i>
        <h4>No orders yet</h4>
        <p>Your egg reservations will show up here once you place your first order.</p>
        <a href="#eggs" class="btn btn-primary" id="dash-order-eggs-link">
          <i class="fa-solid fa-egg"></i> Order Eggs Now
        </a>
      </div>`;
    document.getElementById('dash-order-eggs-link')?.addEventListener('click', () => {
      document.getElementById('customer-dashboard-modal').classList.add('hidden');
    });
    return;
  }
  container.innerHTML = '';
  state.myOrders.forEach(order => {
    const statusClass = order.status === 'Completed' ? 'completed' : 'pending';
    const card = document.createElement('div');
    card.className = 'my-order-card';
    card.innerHTML = `
      <div class="my-order-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="my-order-id">${order.id.substring(0, 8).toUpperCase()}</span>
          <span class="order-status ${statusClass}">${order.status}</span>
        </div>
        <span class="my-order-date">${formatDate(order.pickupDate)}</span>
      </div>
      <div class="my-order-body">
        <p class="my-order-item">${order.items}</p>
        <p class="my-order-total"><strong>$${Number(order.total).toFixed(2)}</strong> due at pickup</p>
      </div>
      <div class="my-order-footer">
        <span class="my-order-pickup"><i class="fa-solid fa-clock"></i> ${order.pickupTime || ''}</span>
        <button class="btn btn-outline btn-sm btn-reorder" data-items="${encodeURIComponent(order.items)}">
          <i class="fa-solid fa-rotate-right"></i> Reorder
        </button>
      </div>`;
    container.appendChild(card);
  });
  document.querySelectorAll('.btn-reorder').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('customer-dashboard-modal').classList.add('hidden');
      document.getElementById('eggs').scrollIntoView({ behavior: 'smooth' });
      showToast('Configure your order and click Reserve! 🥚');
    });
  });
}

// ==========================================================================
//  EGG ORDERING
// ==========================================================================

function updateEggSubtotal() {
  const selected = document.querySelector('input[name="egg-pack"]:checked');
  const packSize = selected ? selected.value : "12";
  const unitPrice = packSize === "12" ? state.settings.price12 : state.settings.price18;
  const qty = parseInt(document.getElementById('egg-qty-input').value, 10) || 1;
  document.getElementById('egg-subtotal').textContent = `$${(unitPrice * qty).toFixed(2)}`;
}

function openEggCheckout() {
  if (!state.currentUser) {
    showToast('Please sign in to place an order!');
    openAuthModal('login');
    return;
  }
  const selected = document.querySelector('input[name="egg-pack"]:checked');
  const packSize = selected ? selected.value : "12";
  const qty = parseInt(document.getElementById('egg-qty-input').value, 10) || 1;
  const unitPrice = packSize === "12" ? state.settings.price12 : state.settings.price18;
  const total = unitPrice * qty;
  state.currentCart = {
    type: 'eggs', packSize, qty, unitPrice, total,
    summary: `${packSize}-Pack Eggs (${packSize === '12' ? 'Dozen' : '1.5 Dozen'}) x${qty}`
  };
  renderCheckoutSummary();
  prefillCheckoutForm();
  document.getElementById('checkout-modal').classList.remove('hidden');
}

function openKittenInquiry(kittenId) {
  if (!state.currentUser) {
    showToast('Please sign in to inquire about a kitten!');
    openAuthModal('login');
    return;
  }
  const kitten = state.kittens.find(k => k.id === kittenId);
  if (!kitten || kitten.status?.toLowerCase() === 'sold') return;
  state.currentCart = {
    type: 'kitten', kittenId: kitten.id, name: kitten.name,
    total: kitten.price, summary: `Kitten Adoption Inquiry: ${kitten.name}`
  };
  renderCheckoutSummary();
  prefillCheckoutForm();
  document.getElementById('checkout-modal').classList.remove('hidden');
}

async function prefillCheckoutForm() {
  if (!state.currentUser) return;
  const profile = await getUserProfile(state.currentUser.uid);
  if (profile) {
    document.getElementById('cust-name').value = profile.name || '';
    document.getElementById('cust-phone').value = profile.phone || '';
  }
  document.getElementById('cust-email').value = state.currentUser.email;
}

function renderCheckoutSummary() {
  if (!state.currentCart) return;
  document.getElementById('checkout-items-list').innerHTML = `
    <div class="summary-item-row">
      <span>${state.currentCart.summary}</span>
      <span>$${state.currentCart.total.toFixed(2)}</span>
    </div>`;
  document.getElementById('checkout-grand-total').textContent = `$${state.currentCart.total.toFixed(2)}`;
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  if (!state.currentCart || !state.currentUser) return;
  const btn = document.getElementById('btn-submit-order');
  btn.disabled = true; btn.textContent = 'Saving...';
  const custName = document.getElementById('cust-name').value;
  const custPhone = document.getElementById('cust-phone').value;
  const custEmail = document.getElementById('cust-email').value;
  const pickupDate = document.getElementById('pickup-date').value;
  const pickupTimeEl = document.getElementById('pickup-time');
  const pickupTimeText = pickupTimeEl.options[pickupTimeEl.selectedIndex].text;
  const orderNotes = document.getElementById('order-notes').value;
  try {
    const docRef = await writeWithTimeout(addDoc(collection(db, "orders"), {
      userId: state.currentUser.uid, custName, custPhone, custEmail,
      items: state.currentCart.summary, total: state.currentCart.total,
      pickupDate, pickupTime: pickupTimeText, notes: orderNotes,
      status: 'Pending', timestamp: serverTimestamp()
    }));
    
    if (state.currentCart.type === 'kitten') {
      await writeWithTimeout(updateDoc(doc(db, "kittens", state.currentCart.kittenId), { status: 'Sold' }));
    }
    
    await saveUserProfile(state.currentUser.uid, { name: custName, phone: custPhone, email: custEmail });

    // Send confirmation email via Firebase Trigger Email extension
    const address = state.settings.pickupAddress || DEFAULTS.pickupAddress;
    try {
      await writeWithTimeout(addDoc(collection(db, "mail"), {
        to: [custEmail],
        message: {
          subject: `Order Confirmation #${docRef.id.substring(0, 8).toUpperCase()} - Rodriguez Ranch`,
          text: `Hello ${custName},\n\nThank you for reserving with Rodriguez Ranch! Order #${docRef.id.substring(0, 8).toUpperCase()} for ${state.currentCart.summary} ($${state.currentCart.total.toFixed(2)}) is confirmed for pickup on ${formatDate(pickupDate)} during time slot: ${pickupTimeText}.\n\nPickup Location:\n${address}\n\nThank you!\nRodriguez Ranch`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
              <div style="background-color: #1C1917; color: #fff; padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 26px; font-weight: normal; font-family: Georgia, serif;">Rodriguez Ranch</h1>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #D97706; text-transform: uppercase; letter-spacing: 1px;">Order Reservation Confirmed</p>
              </div>
              <div style="padding: 24px; background-color: #fff;">
                <p>Hello <strong>${custName}</strong>,</p>
                <p>Thank you for reserving with Rodriguez Ranch! We have received your order details and are preparing it for your chosen pickup slot.</p>
                
                <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;">
                
                <h3 style="color: #1C1917; margin-top: 0; font-family: Georgia, serif;">Order Summary</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Order ID:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">#${docRef.id.substring(0, 8).toUpperCase()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Items Reserved:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${state.currentCart.summary}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Total Due:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #15803D; font-size: 16px;">$${state.currentCart.total.toFixed(2)}</td>
                  </tr>
                </table>
                <p style="font-size: 13px; color: #666; margin-bottom: 24px;">Please prepare payment via Cash, Venmo, or Credit Card at pickup.</p>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;">

                <h3 style="color: #1C1917; margin-top: 0; font-family: Georgia, serif;">Pickup Details & Instructions</h3>
                <p style="margin: 6px 0;">📅 <strong>Date:</strong> ${formatDate(pickupDate)}</p>
                <p style="margin: 6px 0;">🕒 <strong>Time Slot:</strong> ${pickupTimeText}</p>
                <p style="margin: 6px 0;">📍 <strong>Pickup Location:</strong></p>
                <div style="background-color: #FAF7F2; padding: 15px; border-radius: 6px; border: 1px solid #E7E1D5; color: #292524; font-family: monospace; font-size: 14px; margin-bottom: 16px; white-space: pre-line;">
                  ${address}
                </div>
                
                <p style="background-color: #FFFBEB; padding: 15px; border-left: 4px solid #D97706; border-radius: 4px; font-size: 13px; color: #78350F; line-height: 1.5; margin-top: 15px;">
                  <strong>Please Note:</strong> Since our ranch is also our private family home, we ask that you pick up your order during your scheduled window. If you need to make changes or have any questions, feel free to contact us by replying to this email or at <strong>morganmv145@gmail.com</strong>.
                </p>
              </div>
              <div style="background-color: #1C1917; color: #A8A29E; padding: 16px; text-align: center; font-size: 12px; border-top: 1px solid #eee;">
                &copy; Rodriguez Ranch. Established 1856.
              </div>
            </div>
          `
        }
      }));
    } catch (mailErr) {
      console.error("Failed to generate order confirmation email:", mailErr);
    }

    document.getElementById('checkout-modal').classList.add('hidden');
    document.getElementById('success-cust-name').textContent = custName.split(' ')[0];
    document.getElementById('success-order-id').textContent = docRef.id.substring(0, 8).toUpperCase();
    document.getElementById('success-order-summary').textContent = state.currentCart.summary;
    document.getElementById('success-pickup-date').textContent = formatDate(pickupDate);
    
    const successAddr = document.getElementById('success-pickup-address');
    if (successAddr) successAddr.textContent = address;
    
    document.getElementById('success-modal').classList.remove('hidden');
    document.getElementById('checkout-form').reset();
    state.currentCart = null;
  } catch (err) {
    console.error("Order save error:", err);
    alert("Error saving your order. Please try again.");
  } finally {
    btn.disabled = false; btn.textContent = 'Confirm Reservation';
  }
}

// ==========================================================================
//  KITTENS (PUBLIC)
// ==========================================================================

function renderKittensGrid() {
  const grid = document.getElementById('kittens-grid');
  const noKittens = document.getElementById('no-kittens-card');
  if (!grid) return;
  grid.innerHTML = '';
  if (state.kittens.length === 0) {
    noKittens?.classList.remove('hidden');
    grid.classList.add('hidden');
    return;
  }
  noKittens?.classList.add('hidden');
  grid.classList.remove('hidden');
  state.kittens.forEach(kitten => {
    const isSold = kitten.status?.toLowerCase() === 'sold';
    const card = document.createElement('div');
    card.className = 'kitten-card';
    card.innerHTML = `
      <div class="kitten-img-wrapper">
        <img src="${kitten.image}" alt="${kitten.name}" loading="lazy">
        <div class="kitten-badge-status ${isSold ? 'sold' : ''}">${isSold ? 'Adopted' : 'Available'}</div>
        <div class="kitten-badge-price">$${kitten.price}</div>
      </div>
      <div class="kitten-info">
        <h3>${kitten.name}</h3>
        <div class="kitten-meta">
          <span>${kitten.breed}</span>
          <div class="kitten-meta-dot"></div>
          <span>${kitten.age}</span>
        </div>
        <p>${kitten.description || ''}</p>
        ${isSold
          ? `<button class="btn btn-outline btn-block" disabled>Adopted</button>`
          : `<button class="btn btn-primary btn-block btn-kitten-inquire" data-id="${kitten.id}">Inquire About ${kitten.name}</button>`
        }
      </div>`;
    grid.appendChild(card);
  });
  document.querySelectorAll('.btn-kitten-inquire').forEach(btn => {
    btn.addEventListener('click', (e) => openKittenInquiry(e.currentTarget.getAttribute('data-id')));
  });
}

// ==========================================================================
//  ADMIN PORTAL
// ==========================================================================

function openAdminModal() {
  if (!state.isAdmin) {
    showToast('This portal is for ranch staff only.');
    return;
  }
  // Skip the password screen - Firebase Auth handles authentication
  document.getElementById('admin-login-screen').classList.add('hidden');
  document.getElementById('admin-dashboard-screen').classList.remove('hidden');
  document.getElementById('admin-modal').classList.remove('hidden');
  renderAdminOrdersTable();
  renderAdminKittensGrid();
  loadSettingsInDashboard();
}

function renderAdminOrdersTable() {
  const tbody = document.getElementById('orders-table-body');
  const noMsg = document.getElementById('no-orders-msg');
  if (!tbody) return;
  tbody.innerHTML = '';
  const pendingCount = state.orders.filter(o => o.status === 'Pending').length;
  const badge = document.getElementById('pending-orders-badge');
  if (badge) { badge.textContent = pendingCount; badge.classList.toggle('hidden', pendingCount === 0); }
  if (state.orders.length === 0) { noMsg?.classList.remove('hidden'); return; }
  noMsg?.classList.add('hidden');
  state.orders.forEach(order => {
    const statusClass = order.status?.toLowerCase() === 'pending' ? 'pending' : 'completed';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td data-label="Order ID"><strong>${order.id.substring(0, 8).toUpperCase()}</strong></td>
      <td data-label="Customer Name">${order.custName}</td>
      <td data-label="Contact Info"><div style="display:flex;flex-direction:column;gap:2px;font-size:0.85rem">
        <span>${order.custPhone}</span><span>${order.custEmail}</span></div></td>
      <td data-label="Reserved Items">${order.items}</td>
      <td data-label="Pickup Schedule"><div style="display:flex;flex-direction:column;gap:2px;">
        <span>${formatDate(order.pickupDate)}</span>
        <small class="text-muted">${order.pickupTime || ''}</small></div></td>
      <td data-label="Total Due"><strong>$${Number(order.total).toFixed(2)}</strong></td>
      <td data-label="Status"><span class="order-status ${statusClass}">${order.status}</span></td>
      <td data-label="Actions"><div class="action-btn-group">
        <button class="action-btn btn-toggle-order" data-id="${order.id}" title="Toggle Status">
          <i class="fa-solid ${order.status === 'Pending' ? 'fa-check' : 'fa-rotate-left'}"></i>
        </button>
        <button class="action-btn delete btn-delete-order" data-id="${order.id}" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div></td>`;
    tbody.appendChild(row);
    if (order.notes) {
      const nr = document.createElement('tr');
      nr.innerHTML = `<td colspan="8" style="background:#FAFAF9;padding:8px 20px;font-size:0.8rem;color:var(--color-text-muted)">
        <i class="fa-solid fa-comment-dots" style="margin-right:6px;color:var(--color-secondary)"></i>
        <strong>Note:</strong> "${order.notes}"</td>`;
      tbody.appendChild(nr);
    }
  });
  document.querySelectorAll('.btn-toggle-order').forEach(btn => {
    btn.addEventListener('click', (e) => toggleOrderStatus(e.currentTarget.getAttribute('data-id')));
  });
  document.querySelectorAll('.btn-delete-order').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (confirm(`Delete order?`)) deleteOrder(id);
    });
  });
}

async function toggleOrderStatus(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  try {
    await writeWithTimeout(updateDoc(doc(db, "orders", orderId), { status: order.status === 'Pending' ? 'Completed' : 'Pending' }), 5000);
  } catch (err) {
    showToast("❌ Connection error: Could not update order status.");
  }
}

async function deleteOrder(orderId) {
  try {
    await writeWithTimeout(deleteDoc(doc(db, "orders", orderId)), 5000);
  } catch (err) {
    showToast("❌ Connection error: Could not delete order.");
  }
}

function renderAdminKittensGrid() {
  const grid = document.getElementById('admin-kitten-list-grid');
  if (!grid) return;
  grid.innerHTML = '';
  state.kittens.forEach(kitten => {
    const isSold = kitten.status?.toLowerCase() === 'sold';
    const card = document.createElement('div');
    card.className = 'admin-kitten-card';
    card.innerHTML = `
      <div class="admin-kit-img-box">
        <img src="${kitten.image}" alt="${kitten.name}">
        <div class="kitten-badge-status ${isSold ? 'sold' : ''}">${kitten.status || 'Available'}</div>
      </div>
      <div class="admin-kit-meta">
        <h4>${kitten.name}</h4>
        <span class="admin-kit-price">$${kitten.price}</span>
        <span class="admin-kit-breed">${kitten.breed} &bull; ${kitten.age}</span>
        <div class="admin-kit-actions">
          <button class="btn btn-outline btn-sm btn-edit-kitten" data-id="${kitten.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="btn ${isSold ? 'btn-outline' : 'btn-primary'} btn-sm btn-toggle-kitten" data-id="${kitten.id}">${isSold ? 'Mark Available' : 'Mark Adopted'}</button>
          <button class="btn btn-outline btn-sm delete btn-delete-kitten" data-id="${kitten.id}" style="max-width:40px;"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
    grid.appendChild(card);
  });
  document.querySelectorAll('.btn-edit-kitten').forEach(btn => {
    btn.addEventListener('click', (e) => showEditKittenForm(e.currentTarget.getAttribute('data-id')));
  });
  document.querySelectorAll('.btn-toggle-kitten').forEach(btn => {
    btn.addEventListener('click', (e) => toggleKittenStatus(e.currentTarget.getAttribute('data-id')));
  });
  document.querySelectorAll('.btn-delete-kitten').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (confirm("Delete this kitten listing?")) deleteKitten(id);
    });
  });
}

async function toggleKittenStatus(kittenId) {
  const kitten = state.kittens.find(k => k.id === kittenId);
  if (!kitten) return;
  try {
    await writeWithTimeout(updateDoc(doc(db, "kittens", kittenId), { status: kitten.status === 'Available' ? 'Sold' : 'Available' }), 5000);
  } catch (err) {
    showToast("❌ Connection error: Could not update kitten status.");
  }
}

async function deleteKitten(kittenId) {
  try {
    await writeWithTimeout(deleteDoc(doc(db, "kittens", kittenId)), 5000);
  } catch (err) {
    showToast("❌ Connection error: Could not delete kitten.");
  }
}

function showAddKittenForm() {
  const container = document.getElementById('kitten-form-container');
  container.classList.remove('hidden');
  document.getElementById('kitten-form-title').textContent = 'Add New Kitten for Sale';
  document.getElementById('kitten-form').reset();
  document.getElementById('edit-kitten-id').value = '';
  document.getElementById('kit-image-preview').src = 'assets/kitten_1.png';
  const firstPreset = document.querySelector('input[name="kit-preset-img"]');
  if (firstPreset) firstPreset.checked = true;
  container.scrollIntoView({ behavior: 'smooth' });
}

function showEditKittenForm(kittenId) {
  const kitten = state.kittens.find(k => k.id === kittenId);
  if (!kitten) return;
  const container = document.getElementById('kitten-form-container');
  container.classList.remove('hidden');
  document.getElementById('kitten-form-title').textContent = `Edit Kitten: ${kitten.name}`;
  document.getElementById('edit-kitten-id').value = kitten.id;
  document.getElementById('kit-name').value = kitten.name;
  document.getElementById('kit-price').value = kitten.price;
  document.getElementById('kit-breed').value = kitten.breed;
  document.getElementById('kit-age').value = kitten.age;
  document.getElementById('kit-description').value = kitten.description || '';
  document.getElementById('kit-image-preview').src = kitten.image;
  document.querySelectorAll('input[name="kit-preset-img"]').forEach(r => { r.checked = r.value === kitten.image; });
  container.scrollIntoView({ behavior: 'smooth' });
}

async function handleKittenFormSubmit(e) {
  e.preventDefault();
  if (!state.isAdmin) return;
  const id = document.getElementById('edit-kitten-id').value;
  const data = {
    name: document.getElementById('kit-name').value,
    price: parseFloat(document.getElementById('kit-price').value) || 0,
    breed: document.getElementById('kit-breed').value,
    age: document.getElementById('kit-age').value,
    description: document.getElementById('kit-description').value,
    image: document.getElementById('kit-image-preview').src,
  };
  const btn = document.getElementById('btn-save-kitten');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    if (id) {
      await writeWithTimeout(updateDoc(doc(db, "kittens", id), data));
    } else {
      await writeWithTimeout(addDoc(collection(db, "kittens"), { ...data, status: 'Available', createdAt: serverTimestamp() }));
    }
    document.getElementById('kitten-form-container').classList.add('hidden');
    document.getElementById('kitten-form').reset();
    showToast('Kitten listing saved! 🐱');
  } catch (err) {
    console.error("Kitten save error:", err);
    alert("Error saving kitten. Please try again.");
  } finally {
    btn.disabled = false; btn.textContent = 'Save Kitten Listing';
  }
}

let pendingBlockedDates = [];

function loadSettingsInDashboard() {
  const promoteEl = document.getElementById('settings-promote-kittens');
  const p12El = document.getElementById('settings-price-12');
  const p18El = document.getElementById('settings-price-18');
  const openEl = document.getElementById('settings-open-time');
  const closeEl = document.getElementById('settings-close-time');
  const addrEl = document.getElementById('settings-pickup-address');
  
  if (promoteEl) promoteEl.checked = !!state.settings.promoteKittens;
  if (p12El) p12El.value = state.settings.price12;
  if (p18El) p18El.value = state.settings.price18;
  if (openEl) openEl.value = state.settings.openTime || DEFAULTS.openTime;
  if (closeEl) closeEl.value = state.settings.closeTime || DEFAULTS.closeTime;
  if (addrEl) addrEl.value = state.settings.pickupAddress || DEFAULTS.pickupAddress;
  
  pendingBlockedDates = Array.isArray(state.settings.blockedDates) ? [...state.settings.blockedDates] : [];
  renderBlockedRulesList();
}

async function handleSaveSettings() {
  const btn = document.getElementById('btn-save-settings');
  const origContent = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  
  const p12Val = parseFloat(document.getElementById('settings-price-12').value);
  const p18Val = parseFloat(document.getElementById('settings-price-18').value);
  const openVal = document.getElementById('settings-open-time').value;
  const closeVal = document.getElementById('settings-close-time').value;
  const addrVal = document.getElementById('settings-pickup-address').value.trim();
  
  if (isNaN(p12Val) || p12Val < 0 || isNaN(p18Val) || p18Val < 0) {
    showToast('❌ Please enter valid positive numbers for egg prices.');
    btn.disabled = false;
    btn.innerHTML = origContent;
    return;
  }
  
  if (!openVal || !closeVal) {
    showToast('❌ Please select valid opening and closing times.');
    btn.disabled = false;
    btn.innerHTML = origContent;
    return;
  }

  try {
    await writeWithTimeout(setDoc(doc(db, "settings", "global"), {
      promoteKittens: document.getElementById('settings-promote-kittens').checked,
      price12: p12Val,
      price18: p18Val,
      openTime: openVal,
      closeTime: closeVal,
      blockedDates: pendingBlockedDates,
      pickupAddress: addrVal
    }));
    
    // Success feedback
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
    btn.classList.add('btn-success-state'); // Add custom success styles temporarily
    
    const feedback = document.getElementById('settings-save-feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      setTimeout(() => feedback.classList.add('hidden'), 3500);
    }
    
    showToast('Ranch settings updated successfully! ⚙️');
    
    setTimeout(() => {
      btn.classList.remove('btn-success-state');
      btn.innerHTML = origContent;
      btn.disabled = false;
    }, 2500);
    
  } catch (err) {
    console.error("Firestore settings save error:", err);
    showToast('❌ Error saving settings: ' + (err.message || 'Access denied'));
    btn.disabled = false;
    btn.innerHTML = origContent;
  }
}

// ==========================================================================
//  SITE UI SYNC
// ==========================================================================

function updateSiteUI() {
  const p12 = document.getElementById('price-12-display');
  const p18 = document.getElementById('price-18-display');
  if (p12) p12.textContent = `$${Number(state.settings.price12).toFixed(2)}`;
  if (p18) p18.textContent = `$${Number(state.settings.price18).toFixed(2)}`;
  updateEggSubtotal();
  const promote = state.settings.promoteKittens;
  document.getElementById('promo-ribbon')?.classList.toggle('hidden', !promote);
  document.getElementById('kittens')?.classList.toggle('hidden', !promote);
  document.getElementById('nav-link-kittens')?.parentElement?.classList.toggle('hidden', !promote);
  document.getElementById('hero-btn-kittens')?.classList.toggle('hidden', !promote);

  const dateInput = document.getElementById('pickup-date');
  if (dateInput) {
    generateCheckoutTimeSlots(dateInput.value);
  }
}

function generateCheckoutTimeSlots(selectedDate) {
  const timeSelect = document.getElementById('pickup-time');
  if (!timeSelect) return;
  
  if (!selectedDate) {
    selectedDate = new Date().toISOString().split('T')[0];
  }
  
  const open = state.settings.openTime || DEFAULTS.openTime;
  const close = state.settings.closeTime || DEFAULTS.closeTime;
  const blockedDates = Array.isArray(state.settings.blockedDates) ? state.settings.blockedDates : [];
  
  // Find blackout rules for this specific date
  const rulesForDate = blockedDates.filter(r => r.date === selectedDate);
  const isAllDayBlocked = rulesForDate.some(r => r.time === 'all');
  
  timeSelect.innerHTML = '';
  
  if (isAllDayBlocked) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '❌ No slots available on this date';
    timeSelect.appendChild(opt);
    timeSelect.disabled = true;
    return;
  }
  
  timeSelect.disabled = false;
  const specificBlockedTimes = rulesForDate.map(r => r.time);
  
  // Remember current selection
  const currentSelVal = timeSelect.value;
  
  let [oh, om] = open.split(':').map(Number);
  let [ch, cm] = close.split(':').map(Number);
  let current = new Date(); current.setHours(oh, om, 0, 0);
  const end = new Date(); end.setHours(ch, cm, 0, 0);
  
  let addedCount = 0;
  while (current <= end) {
    let h = current.getHours(); let m = current.getMinutes();
    let ampm = h >= 12 ? 'PM' : 'AM'; let h12 = h % 12 || 12;
    let timeString = `${h12}:${m < 10 ? '0' + m : m} ${ampm}`;
    
    // Only add if not blocked
    if (!specificBlockedTimes.includes(timeString)) {
      const opt = document.createElement('option');
      opt.value = timeString;
      opt.textContent = timeString;
      if (timeString === currentSelVal) opt.selected = true;
      timeSelect.appendChild(opt);
      addedCount++;
    }
    current.setMinutes(current.getMinutes() + 30);
  }
  
  if (addedCount === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '❌ Fully booked today';
    timeSelect.appendChild(opt);
    timeSelect.disabled = true;
  }
}

// ==========================================================================
//  UTILITY
// ==========================================================================

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function showToast(message) {
  const existing = document.getElementById('toast-notification');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.className = 'toast-notification';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => { toast.classList.remove('toast-visible'); setTimeout(() => toast.remove(), 400); }, 3500);
}

// ==========================================================================
//  EVENT LISTENERS
// ==========================================================================

function initEventListeners() {
  // Egg configurator
  document.querySelectorAll('input[name="egg-pack"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.getElementById('pack-12-label').classList.toggle('active', e.target.value === '12');
      document.getElementById('pack-18-label').classList.toggle('active', e.target.value === '18');
      updateEggSubtotal();
    });
  });
  document.getElementById('egg-qty-minus').addEventListener('click', () => {
    const inp = document.getElementById('egg-qty-input');
    const v = parseInt(inp.value, 10) || 1;
    if (v > 1) { inp.value = v - 1; updateEggSubtotal(); }
  });
  document.getElementById('egg-qty-plus').addEventListener('click', () => {
    const inp = document.getElementById('egg-qty-input');
    const v = parseInt(inp.value, 10) || 1;
    if (v < 10) { inp.value = v + 1; updateEggSubtotal(); }
  });
  document.getElementById('egg-qty-input').addEventListener('input', () => {
    const inp = document.getElementById('egg-qty-input');
    let v = parseInt(inp.value, 10);
    if (isNaN(v) || v < 1) inp.value = 1;
    if (v > 10) inp.value = 10;
    updateEggSubtotal();
  });
  document.getElementById('btn-reserve-eggs').addEventListener('click', openEggCheckout);

  // Checkout modal
  document.getElementById('btn-close-checkout').addEventListener('click', () => document.getElementById('checkout-modal').classList.add('hidden'));
  document.getElementById('btn-cancel-checkout').addEventListener('click', () => document.getElementById('checkout-modal').classList.add('hidden'));
  document.getElementById('checkout-form').addEventListener('submit', handleCheckoutSubmit);

  // Success modal
  document.getElementById('btn-close-success').addEventListener('click', () => document.getElementById('success-modal').classList.add('hidden'));

  // Auth modal
  document.getElementById('btn-close-auth').addEventListener('click', () => document.getElementById('auth-modal').classList.add('hidden'));
  document.getElementById('tab-login').addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tab-signup').addEventListener('click', () => switchAuthTab('signup'));
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('signup-form').addEventListener('submit', handleSignup);
  document.getElementById('link-to-signup').addEventListener('click', (e) => { e.preventDefault(); switchAuthTab('signup'); });
  document.getElementById('link-to-login').addEventListener('click', (e) => { e.preventDefault(); switchAuthTab('login'); });
  document.getElementById('btn-google-signin').addEventListener('click', handleGoogleAuth);
  document.getElementById('btn-google-signup').addEventListener('click', handleGoogleAuth);

  // Customer dashboard
  document.getElementById('btn-close-customer-dash').addEventListener('click', () => document.getElementById('customer-dashboard-modal').classList.add('hidden'));
  document.getElementById('btn-signout-customer').addEventListener('click', handleSignOut);

  // Admin modal
  document.getElementById('btn-open-admin-portal').addEventListener('click', () => {
    if (state.isAdmin) openAdminModal();
    else { showToast('Admin access only. Please sign in with your admin account.'); openAuthModal('login'); }
  });
  document.getElementById('btn-close-admin').addEventListener('click', () => document.getElementById('admin-modal').classList.add('hidden'));
  document.getElementById('btn-admin-logout').addEventListener('click', handleSignOut);

  // Admin tabs
  document.querySelectorAll('.admin-tab-item').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.currentTarget.getAttribute('data-tab');
      document.querySelectorAll('.admin-tab-item').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
      e.currentTarget.classList.add('active');
      document.getElementById(target)?.classList.add('active');
    });
  });

  // Admin kittens form
  document.getElementById('btn-show-add-kitten-form').addEventListener('click', showAddKittenForm);
  document.getElementById('btn-cancel-kitten').addEventListener('click', () => document.getElementById('kitten-form-container').classList.add('hidden'));
  document.getElementById('kitten-form').addEventListener('submit', handleKittenFormSubmit);

  // Kitten image handlers
  document.getElementById('kit-image-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        document.getElementById('kit-image-preview').src = ev.target.result;
        document.querySelectorAll('input[name="kit-preset-img"]').forEach(r => r.checked = false);
      };
      reader.readAsDataURL(file);
    }
  });
  document.getElementById('file-upload-trigger').addEventListener('click', () => document.getElementById('kit-image-file').click());
  document.querySelectorAll('input[name="kit-preset-img"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.getElementById('kit-image-preview').src = e.target.value;
        document.getElementById('kit-image-file').value = '';
      }
    });
  });

  // Admin settings
  document.getElementById('btn-save-settings').addEventListener('click', handleSaveSettings);
  initBlackoutUI();

  // Waitlist / contact
  document.getElementById('btn-kitten-waitlist')?.addEventListener('click', () => {
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('contact-msg-type').value = 'kittens';
  });

  // Contact form
  document.getElementById('contact-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('contact-name').value;
    showToast(`Thank you, ${name.split(' ')[0]}! We'll be in touch soon. 🤠`);
    e.target.reset();
  });

  // Mobile nav
  document.querySelector('.mobile-nav-toggle').addEventListener('click', () => {
    const nav = document.querySelector('.main-nav');
    nav.classList.toggle('mobile-active');
    document.querySelector('.mobile-nav-toggle i').className =
      nav.classList.contains('mobile-active') ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
  });
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelector('.main-nav').classList.remove('mobile-active');
      document.querySelector('.mobile-nav-toggle i').className = 'fa-solid fa-bars';
    });
  });

  // Scroll spy
  const sections = document.querySelectorAll('section');
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 150) current = s.getAttribute('id'); });
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
  }, { passive: true });

  // Pickup date
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('pickup-date');
  if (dateInput) { 
    dateInput.setAttribute('min', today); 
    dateInput.value = today; 
    dateInput.addEventListener('change', (e) => generateCheckoutTimeSlots(e.target.value));
    generateCheckoutTimeSlots(today);
  }

  // Backdrop click to close modals
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.classList.add('hidden'); });
  });
}

// ==========================================================================
//  BLACKOUT DATES UI LOGIC
// ==========================================================================

function initBlackoutUI() {
  const blockType = document.getElementById('block-type-select');
  const timeRow = document.getElementById('block-time-row');
  const timeSelect = document.getElementById('block-time-select');
  if (!blockType) return;
  
  blockType.addEventListener('change', () => {
    if (blockType.value === 'specific') {
      timeRow.classList.remove('hidden');
      populateBlockTimeDropdown();
    } else {
      timeRow.classList.add('hidden');
    }
  });

  document.getElementById('btn-add-block-rule').addEventListener('click', () => {
    const dateVal = document.getElementById('block-date-input').value;
    if (!dateVal) { showToast('❌ Please select a date to block.'); return; }
    
    const isSpecific = blockType.value === 'specific';
    const timeVal = timeSelect.value;
    
    // Check for duplicates
    const exists = pendingBlockedDates.find(r => r.date === dateVal && (r.time === 'all' || r.time === timeVal));
    if (exists) { showToast('❌ This rule already exists.'); return; }
    
    pendingBlockedDates.push({
      id: Date.now().toString(),
      date: dateVal,
      time: isSpecific ? timeVal : 'all'
    });
    
    // Sort chronologically
    pendingBlockedDates.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    renderBlockedRulesList();
    document.getElementById('block-date-input').value = '';
  });
}

function renderBlockedRulesList() {
  const list = document.getElementById('blocked-rules-list');
  const noMsg = document.getElementById('no-blocked-msg');
  if (!list) return;
  list.innerHTML = '';
  
  if (pendingBlockedDates.length === 0) {
    noMsg.classList.remove('hidden');
    return;
  }
  noMsg.classList.add('hidden');
  
  pendingBlockedDates.forEach(rule => {
    const li = document.createElement('li');
    li.className = 'blocked-list-item';
    const timeStr = rule.time === 'all' ? 'Entire Day' : rule.time;
    // Format date beautifully
    const [y, m, d] = rule.date.split('-');
    const dateObj = new Date(y, m-1, d);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    li.innerHTML = `
      <span><strong>${dateStr}</strong> &nbsp;&mdash;&nbsp; <span style="color:var(--color-danger);font-weight:600;">${timeStr}</span></span>
      <button type="button" class="btn-remove-rule" data-id="${rule.id}" title="Remove Rule"><i class="fa-solid fa-xmark"></i></button>
    `;
    list.appendChild(li);
  });
  
  document.querySelectorAll('.btn-remove-rule').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      pendingBlockedDates = pendingBlockedDates.filter(r => r.id !== id);
      renderBlockedRulesList();
    });
  });
}

function populateBlockTimeDropdown() {
  const timeSelect = document.getElementById('block-time-select');
  if (!timeSelect) return;
  const open = document.getElementById('settings-open-time').value || state.settings.openTime || DEFAULTS.openTime;
  const close = document.getElementById('settings-close-time').value || state.settings.closeTime || DEFAULTS.closeTime;
  timeSelect.innerHTML = '';
  
  let [oh, om] = open.split(':').map(Number);
  let [ch, cm] = close.split(':').map(Number);
  let current = new Date(); current.setHours(oh, om, 0, 0);
  const end = new Date(); end.setHours(ch, cm, 0, 0);
  
  while (current <= end) {
    let h = current.getHours(); let m = current.getMinutes();
    let ampm = h >= 12 ? 'PM' : 'AM'; let h12 = h % 12 || 12;
    let timeString = `${h12}:${m < 10 ? '0' + m : m} ${ampm}`;
    const opt = document.createElement('option');
    opt.value = timeString; opt.textContent = timeString;
    timeSelect.appendChild(opt);
    current.setMinutes(current.getMinutes() + 30);
  }
}

// ==========================================================================
//  INIT
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  // onAuthStateChanged listener handles all data + UI initialization
});
