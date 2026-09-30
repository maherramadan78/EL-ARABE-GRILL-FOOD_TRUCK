const STORAGE_KEY = "arabic-foodtruck-pos-v1";
const POS_DRAFTS_KEY = "arabic-foodtruck-pos-drafts-v1";
const CLOUD_CONFIG_KEY = "arabic-foodtruck-firebase-config-v2";
const FIREBASE_STATE_COLLECTION = "foodtruck_pos";
const FIREBASE_STATE_DOC = "state";
const PHOTO_FOLDER = "foodtruck-dish-photos";
const BRAND_LOGO_SRC = "assets/logo_el_arabe_grill.jpg";
const LEGACY_BUSINESS_NAMES = ["Habibi Food Truck", "Habibi Grill"];
const EMBEDDED_IMAGE_MAX_LENGTH = 80000;

const DEFAULT_FIREBASE_CONFIG = {
  enabled: true,
  apiKey: "AIzaSyCmSXYpAhNz2nM5dnn4eqEo7TF8vqMhbvk",
  authDomain: "food-truck-pos-55717.firebaseapp.com",
  projectId: "food-truck-pos-55717",
  storageBucket: "food-truck-pos-55717.firebasestorage.app",
  messagingSenderId: "930611797711",
  appId: "1:930611797711:web:997469f48f248561d6a1ba",
  measurementId: "G-0K9CYQXVZF"
};

const ROUTES = [
  { id: "dashboard", label: "Resumen", icon: "dashboard" },
  { id: "pos", label: "Punto de venta", icon: "cart" },
  { id: "orders", label: "Pedidos", icon: "ticket" },
  { id: "menu", label: "Menu WhatsApp", icon: "phone" },
  { id: "products", label: "Platillos", icon: "dish" },
  { id: "inventory", label: "Inventario", icon: "box" },
  { id: "finance", label: "Gastos e ingresos", icon: "wallet" },
  { id: "reports", label: "Reportes", icon: "chart" },
  { id: "cash", label: "Caja", icon: "cash" },
  { id: "users", label: "Usuarios", icon: "users" },
  { id: "settings", label: "Ajustes", icon: "settings" }
];

const ROLE_PERMISSIONS = {
  admin: ROUTES.map((route) => route.id),
  cajero: ["dashboard", "pos", "orders", "menu", "reports", "cash"],
  cocina: ["orders", "inventory"],
  inventario: ["dashboard", "products", "inventory", "finance", "reports"]
};

const DEFAULT_SETTINGS = {
  businessName: "El Arabe Grill",
  currency: "MXN",
  whatsappNumber: "5218341422227",
  address: "",
  ticketPrefix: "EAG",
  taxIncluded: true
};

const app = document.querySelector("#app");
const toastNode = document.querySelector("#toast");

let db = loadDatabase();
let cloudConfig = loadCloudConfig();
let cloudSaveTimer = null;
let cloud = {
  client: null,
  connected: false,
  pending: false,
  status: "local",
  error: "",
  lastSync: "",
  unsubscribe: null,
  listenerPrimed: false,
  knownOrderIds: new Set((db.orders || []).map((orderItem) => orderItem.id))
};
let ui = {
  route: getInitialRoute(),
  posDrafts: loadPosDrafts(),
  activePosDraftId: localStorage.getItem(`${POS_DRAFTS_KEY}-active`) || "",
  publicCart: [],
  productFilter: "Todos",
  publicFilter: "Todos",
  productSearch: "",
  publicSearch: "",
  editProductId: null,
  editIngredientId: null,
  editUserId: null,
  reportPeriod: "day",
  reportDate: todayInput(),
  orderStatusFilter: "todos"
};

if (!ui.posDrafts.length) ui.posDrafts = [createPosDraft(1)];
if (!ui.posDrafts.some((draft) => draft.id === ui.activePosDraftId)) {
  ui.activePosDraftId = ui.posDrafts[0].id;
}

app.innerHTML = renderBootScreen();
boot();

window.addEventListener("hashchange", () => {
  ui.route = getInitialRoute();
  render();
});
window.addEventListener("popstate", () => {
  ui.route = getInitialRoute();
  render();
});

document.addEventListener("click", handleClick);
document.addEventListener("submit", handleSubmit);
document.addEventListener("input", handleInput);
document.addEventListener("change", handleChange);

async function boot() {
  await initializeCloud();
  render();
}

function seedDatabase() {
  const ingredients = [
    ingredient("ing-pita", "Pan pita", "pz", 90, 25, 6.5, "Panaderia"),
    ingredient("ing-pollo", "Pollo marinado", "kg", 14, 4, 92, "Proteina"),
    ingredient("ing-res", "Carne para kebab", "kg", 10, 3, 145, "Proteina"),
    ingredient("ing-falafel", "Falafel preparado", "pz", 120, 35, 3.8, "Preparado"),
    ingredient("ing-hummus", "Hummus", "kg", 7, 2, 68, "Preparado"),
    ingredient("ing-taboule", "Tabbouleh", "kg", 5, 1.5, 72, "Ensalada"),
    ingredient("ing-verdura", "Verdura mixta", "kg", 8, 2, 32, "Verdura"),
    ingredient("ing-ajo", "Salsa de ajo", "lt", 4, 1, 48, "Salsa"),
    ingredient("ing-papas", "Papas", "kg", 18, 5, 28, "Guarnicion"),
    ingredient("ing-refresco", "Refresco", "pz", 80, 20, 10, "Bebida")
  ];

  const products = [
    product("prod-shawarma-pollo", "Shawarma de pollo", "Shawarmas", 95, "Pan pita, pollo marinado, verdura fresca y salsa de ajo.", [
      recipe("ing-pita", 1),
      recipe("ing-pollo", 0.18),
      recipe("ing-verdura", 0.08),
      recipe("ing-ajo", 0.03)
    ]),
    product("prod-shawarma-mixto", "Shawarma mixto", "Shawarmas", 115, "Pollo y carne con encurtidos, verdura y salsa de ajo.", [
      recipe("ing-pita", 1),
      recipe("ing-pollo", 0.12),
      recipe("ing-res", 0.1),
      recipe("ing-verdura", 0.08),
      recipe("ing-ajo", 0.03)
    ]),
    product("prod-falafel-wrap", "Falafel wrap", "Vegetariano", 85, "Falafel crujiente, hummus, tabbouleh y verduras.", [
      recipe("ing-pita", 1),
      recipe("ing-falafel", 4),
      recipe("ing-hummus", 0.08),
      recipe("ing-taboule", 0.08),
      recipe("ing-verdura", 0.06)
    ]),
    product("prod-kebab", "Plato kebab", "Platillos", 145, "Brochetas, hummus, tabbouleh, pita y salsa.", [
      recipe("ing-res", 0.22),
      recipe("ing-hummus", 0.1),
      recipe("ing-taboule", 0.12),
      recipe("ing-pita", 1),
      recipe("ing-ajo", 0.04)
    ]),
    product("prod-hummus", "Hummus con pita", "Entradas", 70, "Hummus cremoso con aceite de oliva y pan pita.", [
      recipe("ing-hummus", 0.18),
      recipe("ing-pita", 1)
    ]),
    product("prod-combo", "Combo shawarma", "Combos", 135, "Shawarma de pollo con papas y refresco.", [
      recipe("ing-pita", 1),
      recipe("ing-pollo", 0.18),
      recipe("ing-verdura", 0.08),
      recipe("ing-ajo", 0.03),
      recipe("ing-papas", 0.2),
      recipe("ing-refresco", 1)
    ])
  ];

  return {
    settings: { ...DEFAULT_SETTINGS },
    ingredients,
    products,
    orders: [],
    ledger: [],
    cashSessions: [],
    users: [
      {
        id: "user-admin",
        name: "Administrador",
        role: "admin",
        email: "admin@elarabegrill.com",
        pin: "1234",
        active: true,
        permissions: ROLE_PERMISSIONS.admin
      },
      {
        id: "user-caja",
        name: "Caja",
        role: "cajero",
        email: "caja@elarabegrill.com",
        pin: "1111",
        active: true,
        permissions: ROLE_PERMISSIONS.cajero
      }
    ],
    session: {
      currentUserId: null
    }
  };
}

function ingredient(id, name, unit, stock, min, cost, category) {
  return { id, name, unit, stock, min, cost, category, updatedAt: new Date().toISOString() };
}

function product(id, name, category, price, description, recipeItems, imageUrl = "") {
  return {
    id,
    name,
    category,
    price,
    description,
    imageUrl,
    active: true,
    recipe: recipeItems,
    createdAt: new Date().toISOString()
  };
}

function recipe(ingredientId, qty) {
  return { ingredientId, qty };
}

function loadDatabase() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedDatabase();

  try {
    const parsed = JSON.parse(raw);
    return mergeDatabase(parsed);
  } catch (error) {
    console.warn("No se pudieron cargar los datos locales", error);
    return seedDatabase();
  }
}

function loadPosDrafts() {
  try {
    const drafts = JSON.parse(localStorage.getItem(POS_DRAFTS_KEY) || "[]");
    return Array.isArray(drafts)
      ? drafts.filter((draft) => draft && draft.id).map((draft) => ({
        customerName: "",
        customerPhone: "",
        orderType: "recoger",
        tableName: "",
        paymentMethod: "efectivo",
        notes: "",
        discount: "0",
        ...draft,
        cart: Array.isArray(draft.cart) ? draft.cart : []
      }))
      : [];
  } catch {
    return [];
  }
}

function createPosDraft(number = 1) {
  return {
    id: uid("draft"),
    label: `Pedido ${number}`,
    cart: [],
    customerName: "",
    customerPhone: "",
    orderType: "recoger",
    tableName: "",
    paymentMethod: "efectivo",
    notes: "",
    discount: "0"
  };
}

function savePosDrafts() {
  try {
    localStorage.setItem(POS_DRAFTS_KEY, JSON.stringify(ui.posDrafts));
    localStorage.setItem(`${POS_DRAFTS_KEY}-active`, ui.activePosDraftId);
  } catch (error) {
    console.warn("No se pudieron guardar los pedidos en curso", error);
  }
}

function activePosDraft() {
  let draft = ui.posDrafts.find((item) => item.id === ui.activePosDraftId);
  if (!draft) {
    draft = createPosDraft(ui.posDrafts.length + 1);
    ui.posDrafts.push(draft);
    ui.activePosDraftId = draft.id;
  }
  return draft;
}

function currentCart(cartName) {
  return cartName === "posCart" ? activePosDraft().cart : ui[cartName];
}

function savePosDraftField(input) {
  const draft = activePosDraft();
  if (input.name in draft) draft[input.name] = input.value;
}

function mergeDatabase(data) {
  const parsed = data || {};
  const seeded = seedDatabase();
  return {
    ...seeded,
    ...parsed,
    settings: migrateSettings(parsed.settings),
    ingredients: parsed.ingredients || seeded.ingredients,
    products: (parsed.products || seeded.products).map((item) => ({ imageUrl: "", ...item })),
    deletedProductIds: Array.isArray(parsed.deletedProductIds) ? parsed.deletedProductIds : [],
    orders: parsed.orders || [],
    ledger: parsed.ledger || [],
    cashSessions: parsed.cashSessions || [],
    users: parsed.users || seeded.users,
    session: { currentUserId: null, ...(parsed.session || {}) }
  };
}

function migrateSettings(settings = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...settings };

  if (!settings.businessName || LEGACY_BUSINESS_NAMES.includes(merged.businessName)) {
    merged.businessName = DEFAULT_SETTINGS.businessName;
  }

  if (!settings.ticketPrefix || merged.ticketPrefix === "HAB") {
    merged.ticketPrefix = DEFAULT_SETTINGS.ticketPrefix;
  }

  return merged;
}

function loadCloudConfig() {
  const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
  if (!raw) return normalizeCloudConfig();

  try {
    return normalizeCloudConfig(JSON.parse(raw));
  } catch (error) {
    console.warn("No se pudo leer la configuracion de Firebase", error);
    return normalizeCloudConfig();
  }
}

function normalizeCloudConfig(config = {}) {
  const merged = { ...DEFAULT_FIREBASE_CONFIG, ...config };
  if (!merged.storageBucket) {
    merged.storageBucket = DEFAULT_FIREBASE_CONFIG.storageBucket;
  }
  return merged;
}

function saveCloudConfig() {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cloudConfig));
}

function saveDatabase(options = {}) {
  const { syncCloud = true } = options;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (error) {
    console.warn("No se pudieron guardar los datos locales", error);
    toast("No hay espacio suficiente para guardar. Usa una foto mas ligera.");
    return false;
  }
  if (syncCloud) queueCloudSave();
  return true;
}

function renderBootScreen() {
  return `
    <section class="login-screen">
      <div class="login-card">
        <div class="brand">
          ${brandLogo("large")}
          <div>
            <h1 class="brand-name">${escapeHtml(db.settings.businessName)}</h1>
            <p class="brand-subtitle">Preparando el POS</p>
          </div>
        </div>
        <p class="muted">Cargando datos locales${cloudConfig.enabled ? " y nube" : ""}...</p>
      </div>
      ${renderFooter("login-footer")}
    </section>
  `;
}

function hasCloudConfig() {
  return Boolean(cloudConfig.enabled && cloudConfig.apiKey && cloudConfig.projectId && cloudConfig.appId);
}

function firebaseConfigPayload() {
  return {
    apiKey: cloudConfig.apiKey,
    authDomain: cloudConfig.authDomain,
    projectId: cloudConfig.projectId,
    storageBucket: cloudConfig.storageBucket || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: cloudConfig.messagingSenderId,
    appId: cloudConfig.appId,
    measurementId: cloudConfig.measurementId
  };
}

async function waitForFirebaseAdapter() {
  if (window.firebaseReady) {
    try {
      return await window.firebaseReady;
    } catch (error) {
      console.warn("No se pudo cargar Firebase SDK", error);
      return null;
    }
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 5000);
    window.addEventListener("firebase-adapter-ready", async () => {
      clearTimeout(timeout);
      try {
        resolve(await window.firebaseReady);
      } catch (error) {
        console.warn("No se pudo cargar Firebase SDK", error);
        resolve(null);
      }
    }, { once: true });
  });
}

async function initializeCloud(options = {}) {
  const { pushLocalIfEmpty = true } = options;

  if (!hasCloudConfig()) {
    cloud = { ...cloud, client: null, connected: false, pending: false, status: "local", error: "" };
    return;
  }

  const firebaseApi = await waitForFirebaseAdapter();
  if (!firebaseApi) {
    cloud = {
      ...cloud,
      client: null,
      connected: false,
      pending: false,
      status: "error",
      error: "No se cargo Firebase SDK. Revisa internet o abre la app desde un servidor local."
    };
    return;
  }

  try {
    cloud = { ...cloud, status: "connecting", error: "" };
    const firebaseApp = firebaseApi.getApps().length
      ? firebaseApi.getApp()
      : firebaseApi.initializeApp(firebaseConfigPayload());
    const firestore = firebaseApi.getFirestore(firebaseApp);
    const storage = firebaseApi.getStorage(firebaseApp);
    const auth = firebaseApi.getAuth(firebaseApp);
    const stateRef = firebaseApi.doc(firestore, FIREBASE_STATE_COLLECTION, FIREBASE_STATE_DOC);
    cloud = { ...cloud, client: firestore, storage, auth, firebase: firebaseApi, stateRef };

    if (firebaseApi.onAuthStateChanged) {
      firebaseApi.onAuthStateChanged(auth, (user) => {
        if (!user) {
          const currentUserId = db.session?.currentUserId;
          if (currentUserId) {
            db.session.currentUserId = null;
            saveDatabase({ syncCloud: false });
          }
        }
      });
    }

    const snapshot = await firebaseApi.getDoc(stateRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      const remoteOrderIds = new Set((data.payload?.orders || []).map((orderItem) => orderItem.id));
      const localProductsNeedSync = hasLocalProductChanges(data.payload?.products || [], data.payload?.deletedProductIds || []);
      const localSession = db.session?.currentUserId || null;
      db = mergeRemoteWithLocalProducts(mergeDatabase(data.payload));
      db.session.currentUserId = localSession;
      saveDatabase({ syncCloud: false });
      cloud = { ...cloud, connected: true, pending: false, status: "connected", error: "", lastSync: data.updatedAtIso || new Date().toISOString() };
      primeKnownOrders();
      startCloudListener();
      if (localProductsNeedSync || db.orders.some((orderItem) => !remoteOrderIds.has(orderItem.id))) queueCloudSave();
      return;
    }

    cloud = { ...cloud, connected: true, pending: false, status: "connected", error: "", lastSync: "" };
    primeKnownOrders();
    startCloudListener();
    if (pushLocalIfEmpty) {
      await pushDatabaseToCloud();
    }
  } catch (error) {
    cloud = {
      ...cloud,
      connected: false,
      pending: false,
      status: "error",
      error: error.message || "No se pudo conectar con Firebase."
    };
  }
}

function primeKnownOrders() {
  cloud.knownOrderIds = new Set((db.orders || []).map((orderItem) => orderItem.id));
  cloud.listenerPrimed = true;
}

function startCloudListener() {
  if (!cloud.firebase?.onSnapshot || !cloud.stateRef) return;
  if (typeof cloud.unsubscribe === "function") cloud.unsubscribe();

  cloud.unsubscribe = cloud.firebase.onSnapshot(cloud.stateRef, (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    if (!data?.payload) return;

    const remoteOrderIds = new Set((data.payload.orders || []).map((orderItem) => orderItem.id));
    const localProductsNeedSync = hasLocalProductChanges(data.payload.products || [], data.payload.deletedProductIds || []);
    const localSession = db.session?.currentUserId || null;
    const nextDb = mergeRemoteWithLocalProducts(mergeDatabase(data.payload));
    nextDb.session.currentUserId = localSession;
    const newOrders = findNewWhatsAppOrders(nextDb.orders || []);

    db = nextDb;
    saveDatabase({ syncCloud: false });
    cloud.lastSync = data.updatedAtIso || cloud.lastSync || new Date().toISOString();
    cloud.connected = true;
    cloud.status = "connected";
    cloud.error = "";

    if (newOrders.length) {
      notifyNewOrders(newOrders);
    }

    if (localProductsNeedSync || db.orders.some((orderItem) => !remoteOrderIds.has(orderItem.id))) queueCloudSave();

    render();
  }, (error) => {
    cloud = { ...cloud, connected: false, status: "error", error: error.message || "No se pudo escuchar Firebase." };
    render();
  });
}

function findNewWhatsAppOrders(orders) {
  const newOrders = [];
  const known = cloud.knownOrderIds || new Set();

  for (const orderItem of orders) {
    if (!known.has(orderItem.id)) {
      if (orderItem.channel === "WhatsApp" && orderItem.status !== "cancelado") {
        newOrders.push(orderItem);
      }
      known.add(orderItem.id);
    }
  }

  cloud.knownOrderIds = known;
  return cloud.listenerPrimed ? newOrders : [];
}

function queueCloudSave() {
  if (!cloud.connected || !cloud.client || !cloud.stateRef || !hasCloudConfig()) return;
  cloud.pending = true;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    pushDatabaseToCloud().then(() => render()).catch((error) => {
      cloud = { ...cloud, connected: false, pending: false, status: "error", error: error.message || "No se pudo guardar en Firebase." };
      render();
    });
  }, 450);
}

async function pushDatabaseToCloud() {
  if (!cloud.client || !cloud.stateRef || !cloud.firebase || !hasCloudConfig()) return;
  const payload = cloudPayload();
  const updatedAt = new Date().toISOString();
  await cloud.firebase.setDoc(cloud.stateRef, {
    payload,
    updatedAtIso: updatedAt,
    updatedAt: cloud.firebase.serverTimestamp()
  }, { merge: true });
  cloud = { ...cloud, connected: true, pending: false, status: "connected", error: "", lastSync: updatedAt };
}

function cloudPayload() {
  return {
    ...db,
    session: { currentUserId: null }
  };
}

function brandLogo(extraClass = "") {
  const classes = ["brand-logo", extraClass].filter(Boolean).join(" ");
  return `<img class="${classes}" src="${BRAND_LOGO_SRC}" alt="${escapeAttr(db.settings.businessName)} logo" loading="eager" decoding="async" />`;
}

function renderFooter(extraClass = "") {
  const classes = ["app-footer", extraClass].filter(Boolean).join(" ");
  return `<footer class="${classes}">Dise&ntilde;ado y programado por <strong>Maher Ramadan</strong></footer>`;
}

function render() {
  const user = currentUser();

  if (ui.route === "menu") {
    app.innerHTML = renderPublicMenu();
    return;
  }

  if (!user) {
    app.innerHTML = renderLogin();
    return;
  }

  if (!canAccess(ui.route)) {
    ui.route = firstAllowedRoute();
    setHash(ui.route, false);
  }

  app.innerHTML = `
    <div class="app-shell">
      ${renderSidebar(user)}
      <main class="main">
        ${renderTopbar(user)}
        ${renderMobileNav()}
        ${renderRoute()}
        ${renderFooter()}
      </main>
    </div>
  `;
}

function renderLogin() {
  return `
    <section class="login-screen">
      <form class="login-card" data-form="login">
        <div class="brand">
          ${brandLogo("large")}
          <div>
            <h1 class="brand-name">${escapeHtml(db.settings.businessName)}</h1>
            <p class="brand-subtitle">POS para food truck</p>
          </div>
        </div>
        <div>
          <h2>Entrar al sistema</h2>
          <p class="muted">Usa tu cuenta de Firebase creada en Authentication. Si no existe una cuenta, crea primero un usuario administrador o de caja.</p>
        </div>
        <label class="field">
          <span>Correo electrónico</span>
          <input name="email" type="email" autocomplete="email" required autofocus />
        </label>
        <label class="field">
          <span>Contraseña</span>
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <button class="button primary" type="submit">${icon("login")} Entrar</button>
        <button class="button ghost" type="button" data-route="menu">${icon("phone")} Ver menu digital</button>
      </form>
      ${renderFooter("login-footer")}
    </section>
  `;
}

function renderSidebar(user) {
  return `
    <aside class="sidebar">
      <div class="brand">
        ${brandLogo()}
        <div>
          <p class="brand-name">${escapeHtml(db.settings.businessName)}</p>
          <p class="brand-subtitle">${escapeHtml(user.name)} - ${roleLabel(user.role)}</p>
        </div>
      </div>
      <nav class="nav">
        ${allowedRoutes().map((route) => navButton(route, "nav-button")).join("")}
      </nav>
      <div class="sidebar-footer">
        <span>${cashSessionOpen() ? "Caja abierta" : "Caja cerrada"}</span>
        <button class="button ghost" type="button" data-action="logout">${icon("logout")} Salir</button>
      </div>
    </aside>
  `;
}

function renderTopbar(user) {
  const route = ROUTES.find((item) => item.id === ui.route);
  return `
    <header class="topbar">
      <div class="topbar-title">
        ${brandLogo("topbar-logo")}
        <div>
          <h1>${escapeHtml(route?.label || "POS")}</h1>
          <p>${topbarSubtitle()}</p>
        </div>
      </div>
      <div class="topbar-actions">
        ${cloudStatusBadge()}
        ${notificationStatusControl()}
        <button class="button" type="button" data-route="menu">${icon("phone")} Menu WhatsApp</button>
        <button class="button" type="button" data-route="pos">${icon("cart")} Nueva venta</button>
        <span class="badge">${escapeHtml(user.name)}</span>
      </div>
    </header>
  `;
}

function renderMobileNav() {
  return `<nav class="mobile-nav">${allowedRoutes().map((route) => navButton(route, "mobile-nav-button")).join("")}</nav>`;
}

function navButton(route, className) {
  const active = ui.route === route.id ? "active" : "";
  return `
    <button class="${className} ${active}" type="button" data-route="${route.id}">
      ${icon(route.icon)}
      <span>${escapeHtml(route.label)}</span>
    </button>
  `;
}

function renderRoute() {
  switch (ui.route) {
    case "dashboard":
      return renderDashboard();
    case "pos":
      return renderPOS();
    case "orders":
      return renderOrders();
    case "products":
      return renderProducts();
    case "inventory":
      return renderInventory();
    case "finance":
      return renderFinance();
    case "reports":
      return renderReports();
    case "cash":
      return renderCash();
    case "users":
      return renderUsers();
    case "settings":
      return renderSettings();
    default:
      return renderDashboard();
  }
}

function renderDashboard() {
  const today = getPeriod("day", todayInput());
  const report = calculateReport(today.start, today.end);
  const openOrders = db.orders.filter((orderItem) => !["entregado", "cancelado"].includes(orderItem.status)).length;
  const lowStock = lowStockIngredients();
  const openCash = cashSessionOpen();

  return `
    <section class="page">
      <div class="grid four">
        ${metric("Ventas hoy", formatMoney(report.salesTotal), `${report.orderCount} pedidos`)}
        ${metric("Ticket promedio", formatMoney(report.averageTicket), "Ventas completadas")}
        ${metric("Pedidos abiertos", openOrders, "Cocina y WhatsApp")}
        ${metric("Inventario bajo", lowStock.length, "Ingredientes por reponer")}
      </div>

      <div class="grid two">
        <section class="panel">
          <div class="section-head">
            <div>
              <h2>Movimiento de hoy</h2>
              <p>Ventas, gastos y caja en el dia actual.</p>
            </div>
            <button class="button" type="button" data-route="reports">${icon("chart")} Ver reportes</button>
          </div>
          <div class="table-wrap" style="margin-top:14px">
            <table>
              <tbody>
                <tr><td>Ventas</td><td><strong>${formatMoney(report.salesTotal)}</strong></td></tr>
                <tr><td>Gastos</td><td><strong>${formatMoney(report.expenseTotal)}</strong></td></tr>
                <tr><td>Ingresos manuales</td><td><strong>${formatMoney(report.manualIncomeTotal)}</strong></td></tr>
                <tr><td>Utilidad estimada</td><td><strong>${formatMoney(report.netTotal)}</strong></td></tr>
                <tr><td>Estado de caja</td><td>${openCash ? '<span class="badge">Abierta</span>' : '<span class="badge warn">Cerrada</span>'}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <div class="section-head">
            <div>
              <h2>Pedidos recientes</h2>
              <p>Ultimos pedidos registrados.</p>
            </div>
            <button class="button" type="button" data-route="orders">${icon("ticket")} Pedidos</button>
          </div>
          <div class="status-list" style="margin-top:14px">
            ${db.orders.slice().sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)).slice(0, 5).map(renderOrderSummary).join("") || emptyState("Todavia no hay pedidos.")}
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="section-head">
          <div>
            <h2>Alertas de inventario</h2>
            <p>Ingredientes que estan abajo del minimo.</p>
          </div>
          <button class="button" type="button" data-route="inventory">${icon("box")} Inventario</button>
        </div>
        <div class="table-wrap" style="margin-top:14px">
          <table>
            <thead><tr><th>Ingrediente</th><th>Stock</th><th>Minimo</th><th>Categoria</th></tr></thead>
            <tbody>
              ${lowStock.map((item) => `
                <tr>
                  <td>${escapeHtml(item.name)}</td>
                  <td><span class="badge danger">${number(item.stock)} ${escapeHtml(item.unit)}</span></td>
                  <td>${number(item.min)} ${escapeHtml(item.unit)}</td>
                  <td>${escapeHtml(item.category || "-")}</td>
                </tr>
              `).join("") || `<tr><td colspan="4">${emptyInline("Inventario en buen nivel.")}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `;
}

function renderPOS() {
  const products = filteredProducts(ui.productFilter, ui.productSearch);
  return `
    <section class="page">
      <div class="section-head">
        <div>
          <h2>Venta rapida</h2>
          <p>Abre varias ordenes a la vez; guarda cada orden abierta y cobrale al cliente cuando la entregues.</p>
        </div>
        <button class="button ${cashSessionOpen() ? "" : "warning"}" type="button" data-route="cash">
          ${icon("cash")} ${cashSessionOpen() ? "Caja abierta" : "Abrir caja"}
        </button>
      </div>

      <div class="pos-layout">
        <section class="panel">
          ${renderProductFilters("pos")}
          <div class="product-grid" style="margin-top:14px">
            ${products.map((item) => renderProductCard(item, "pos")).join("") || emptyState("No hay platillos con ese filtro.")}
          </div>
        </section>
        ${renderCartPanel("pos")}
      </div>
    </section>
  `;
}

function renderProductFilters(scope) {
  const filterKey = scope === "public" ? ui.publicFilter : ui.productFilter;
  const searchValue = scope === "public" ? ui.publicSearch : ui.productSearch;
  return `
    <div class="grid" style="gap:12px">
      <div class="field">
        <label for="${scope}-search">Buscar platillo</label>
        <input id="${scope}-search" data-input="${scope}-search" value="${escapeAttr(searchValue)}" placeholder="Shawarma, falafel, hummus..." />
      </div>
      <div class="pill-row">
        ${categories().map((cat) => `
          <button class="pill ${filterKey === cat ? "active" : ""}" type="button" data-action="${scope}-filter" data-filter="${escapeAttr(cat)}">
            ${escapeHtml(cat)}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderProductCard(item, scope) {
  const action = scope === "public" ? "add-public" : "add-pos";
  const image = item.imageUrl
    ? `<img src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(item.name)}" loading="lazy" />`
    : `<span class="item-initials">${initials(item.name)}</span>`;
  return `
    <article class="item-card">
      <div class="item-photo">
        ${image}
        <span class="item-price">${formatMoney(item.price)}</span>
      </div>
      <div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description || item.category)}</p>
      </div>
      <button class="button primary" type="button" data-action="${action}" data-id="${item.id}">
        ${icon("plus")} Agregar
      </button>
    </article>
  `;
}

function renderCartPanel(scope) {
  const isPublic = scope === "public";
  const draft = isPublic ? null : activePosDraft();
  const cart = isPublic ? ui.publicCart : draft.cart;
  const totals = calculateCartTotals(cart);
  const formName = isPublic ? "public-checkout" : "pos-checkout";
  const title = isPublic ? "Tu pedido" : "Carrito de venta";

  return `
    <aside class="panel cart">
      <div class="section-head">
        <div>
          <h2>${title}</h2>
          <p>${cart.length} productos seleccionados</p>
        </div>
        <button class="icon-button" type="button" title="Vaciar carrito" data-action="${isPublic ? "clear-public" : "clear-pos"}" ${cart.length ? "" : "disabled"}>
          ${icon("trash")}
        </button>
      </div>
      ${isPublic ? "" : renderPosDraftTabs()}
      <div class="cart-list">
        ${cart.map((line) => renderCartLine(line, scope)).join("") || emptyState("El carrito esta vacio.")}
      </div>
      <form class="grid" data-form="${formName}">
        <div class="totals">
          <div class="total-line"><span>Subtotal</span><strong>${formatMoney(totals.subtotal)}</strong></div>
          ${isPublic ? "" : `
            <label class="field">
              <span>Descuento</span>
              <input name="discount" type="number" min="0" step="1" value="${escapeAttr(draft.discount)}" />
            </label>
          `}
          <div class="total-line final"><span>Total</span><strong>${formatMoney(totals.total)}</strong></div>
        </div>
        <div class="form-grid">
          <label class="field">
            <span>Nombre</span>
            <input name="customerName" placeholder="Cliente" value="${escapeAttr(draft?.customerName || "")}" ${isPublic ? "required" : ""} />
          </label>
          <label class="field">
            <span>Telefono</span>
            <input name="customerPhone" inputmode="tel" placeholder="55..." value="${escapeAttr(draft?.customerPhone || "")}" />
          </label>
          <label class="field">
            <span>Tipo</span>
            <select name="orderType">
              <option value="recoger" ${draft?.orderType === "recoger" ? "selected" : ""}>Recoger</option>
              <option value="comer aqui" ${draft?.orderType === "comer aqui" ? "selected" : ""}>Comer aqui</option>
              <option value="delivery" ${draft?.orderType === "delivery" ? "selected" : ""}>Delivery</option>
            </select>
          </label>
          ${isPublic ? "" : `
            <label class="field">
              <span>Mesa</span>
              <select name="tableName" data-input="pos-table" ${draft.orderType === "comer aqui" ? "required" : ""}>
                <option value="" ${draft.tableName ? "" : "selected"}>Sin asignar</option>
                <option value="Mesa 1" ${draft.tableName === "Mesa 1" ? "selected" : ""}>Mesa 1</option>
                <option value="Mesa 2" ${draft.tableName === "Mesa 2" ? "selected" : ""}>Mesa 2</option>
              </select>
            </label>
          `}
          <label class="field">
            <span>Pago</span>
            <select name="paymentMethod">
              <option value="efectivo" ${draft?.paymentMethod === "efectivo" ? "selected" : ""}>Efectivo</option>
              <option value="tarjeta" ${draft?.paymentMethod === "tarjeta" ? "selected" : ""}>Tarjeta</option>
              <option value="transferencia" ${draft?.paymentMethod === "transferencia" ? "selected" : ""}>Transferencia</option>
            </select>
          </label>
          <label class="field full">
            <span>Notas</span>
            <textarea name="notes" placeholder="Sin cebolla, extra salsa...">${escapeHtml(draft?.notes || "")}</textarea>
          </label>
        </div>
        ${isPublic ? "" : `
          <button class="button" type="button" data-action="save-open-pos-order" ${cart.length ? "" : "disabled"}>
            ${icon("save")} Guardar orden abierta y seguir
          </button>
        `}
        <button class="button primary" type="submit" ${cart.length ? "" : "disabled"}>
          ${icon(isPublic ? "phone" : "check")} ${isPublic ? "Enviar por WhatsApp" : "Cobrar y registrar"}
        </button>
      </form>
    </aside>
  `;
}

function renderPosDraftTabs() {
  return `
    <div class="pill-row" aria-label="Pedidos en curso">
      ${ui.posDrafts.map((draft) => `
        <button class="pill ${draft.id === ui.activePosDraftId ? "active" : ""}" type="button" data-action="select-pos-draft" data-id="${escapeAttr(draft.id)}">
          ${escapeHtml(draft.label)} · ${draft.cart.length}
        </button>
      `).join("")}
      <button class="button" type="button" data-action="new-pos-draft">${icon("plus")} Otro pedido</button>
      ${ui.posDrafts.length > 1 ? `<button class="icon-button" type="button" title="Cerrar pedido en curso" data-action="remove-pos-draft" data-id="${escapeAttr(ui.activePosDraftId)}">${icon("x")}</button>` : ""}
    </div>
  `;
}

function renderCartLine(line, scope) {
  const productItem = db.products.find((item) => item.id === line.productId);
  const name = productItem?.name || line.name || "Producto";
  const price = productItem?.price || line.price || 0;
  const prefix = scope === "public" ? "public" : "pos";
  return `
    <div class="cart-line">
      <div class="ellipsis">
        <strong>${escapeHtml(name)}</strong>
        <div class="small muted">${formatMoney(price)} c/u</div>
      </div>
      <div class="qty-controls" aria-label="Cantidad">
        <button type="button" data-action="dec-${prefix}" data-id="${line.productId}">-</button>
        <span>${line.qty}</span>
        <button type="button" data-action="inc-${prefix}" data-id="${line.productId}">+</button>
      </div>
    </div>
  `;
}

function renderPublicMenu() {
  const products = filteredProducts(ui.publicFilter, ui.publicSearch);
  return `
    <div class="public-menu-shell">
      <section class="public-hero">
        <div>
          ${brandLogo("public-hero-logo")}
          <span class="badge">Pedido por WhatsApp</span>
          <h1>${escapeHtml(db.settings.businessName)}</h1>
          <p>Elige tus platillos, confirma el carrito y envia el pedido directo al WhatsApp del negocio.</p>
        </div>
      </section>
      <main class="public-content">
        <div class="public-layout">
          <section class="public-panel">
            ${renderProductFilters("public")}
            <div class="product-grid" style="margin-top:14px">
              ${products.map((item) => renderProductCard(item, "public")).join("") || emptyState("No hay platillos disponibles.")}
            </div>
          </section>
          ${renderCartPanel("public")}
        </div>
        ${renderFooter("public-footer public-menu-footer")}
      </main>
    </div>
  `;
}

function renderOrders() {
  const statuses = ["todos", "nuevo", "preparando", "listo", "entregado", "cancelado"];
  const orders = db.orders
    .filter((orderItem) => ui.orderStatusFilter === "todos" || orderItem.status === ui.orderStatusFilter)
    .slice()
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

  return `
    <section class="page">
      <div class="section-head">
        <div>
          <h2>Pedidos</h2>
          <p>${db.orders.length} ventas y pedidos guardados · Todos los dias</p>
        </div>
        <div class="pill-row">
          <button class="button" type="button" data-action="refresh-cloud" ${hasCloudConfig() ? "" : "disabled"}>${icon("refresh")} Actualizar desde la nube</button>
          ${statuses.map((status) => `
            <button class="pill ${ui.orderStatusFilter === status ? "active" : ""}" type="button" data-action="order-filter" data-filter="${status}">
              ${statusLabel(status)}
            </button>
          `).join("")}
        </div>
      </div>
      <div class="status-list">
        ${orders.map(renderOrderCard).join("") || emptyState("No hay pedidos con este estado.")}
      </div>
    </section>
  `;
}

function renderOrderCard(orderItem) {
  return `
    <article class="panel">
      <div class="order-row" style="border:0;padding:0">
        <div>
          <div class="pill-row">
            <span class="badge">${escapeHtml(orderItem.ticket)}</span>
            <span class="badge ${orderItem.status === "cancelado" ? "danger" : orderItem.status === "nuevo" ? "warn" : ""}">${statusLabel(orderItem.status)}</span>
            ${orderItem.paymentStatus === "pending" ? '<span class="badge warn">Pendiente de cobro</span>' : ""}
            <span class="badge">${escapeHtml(orderItem.channel)}</span>
          </div>
          <h3 style="margin:10px 0 4px">${escapeHtml(orderItem.customerName || "Cliente mostrador")} · ${formatMoney(orderItem.total)}</h3>
          <p class="muted">${formatDateTime(orderItem.createdAt)} · ${escapeHtml(orderItem.orderType)}${orderItem.tableName ? ` · ${escapeHtml(orderItem.tableName)}` : ""} · ${escapeHtml(orderItem.paymentMethod)}</p>
          <p>${orderItem.items.map((line) => `${line.qty}x ${escapeHtml(line.name)}`).join(", ")}</p>
          ${orderItem.notes ? `<p class="muted">Notas: ${escapeHtml(orderItem.notes)}</p>` : ""}
        </div>
        <div class="pill-row">
          ${["nuevo", "preparando", "listo", "entregado"].map((status) => `
            <button class="button" type="button" data-action="set-order-status" data-id="${orderItem.id}" data-status="${status}">
              ${status === "entregado" && orderItem.paymentStatus === "pending" ? "Entregar / cobrar" : statusLabel(status)}
            </button>
          `).join("")}
          <button class="icon-button" title="Enviar resumen por WhatsApp" type="button" data-action="order-whatsapp" data-id="${orderItem.id}">
            ${icon("phone")}
          </button>
          <button class="icon-button" title="Cancelar pedido" type="button" data-action="set-order-status" data-id="${orderItem.id}" data-status="cancelado">
            ${icon("x")}
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderProducts() {
  const editing = db.products.find((item) => item.id === ui.editProductId);
  return `
    <section class="page">
      <div class="grid two">
        <section class="panel">
          <div class="section-head">
            <div>
              <h2>Platillos y precios</h2>
              <p>Activa, edita o agrega nuevos productos al menu.</p>
            </div>
            <div class="pill-row">
              <button class="button" type="button" data-action="refresh-cloud" ${hasCloudConfig() ? "" : "disabled"}>${icon("refresh")} Actualizar catálogo</button>
              <button class="button" type="button" data-action="new-product">${icon("plus")} Nuevo</button>
            </div>
          </div>
          <div class="table-wrap" style="margin-top:14px">
            <table>
              <thead><tr><th>Foto</th><th>Platillo</th><th>Categoria</th><th>Precio</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                ${db.products.map((item) => `
                  <tr>
                    <td>${item.imageUrl ? `<img class="table-thumb" src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(item.name)}" loading="lazy" />` : `<span class="badge warn">Sin foto</span>`}</td>
                    <td><strong>${escapeHtml(item.name)}</strong><br><span class="muted small">${escapeHtml(item.description || "")}</span></td>
                    <td>${escapeHtml(item.category)}</td>
                    <td>${formatMoney(item.price)}</td>
                    <td>${item.active ? '<span class="badge">Activo</span>' : '<span class="badge danger">Oculto</span>'}</td>
                    <td>
                      <button class="icon-button" type="button" title="Editar" data-action="edit-product" data-id="${item.id}">${icon("edit")}</button>
                      <button class="icon-button danger" type="button" title="Eliminar" data-action="delete-product" data-id="${item.id}">${icon("trash")}</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </section>
        <section class="panel">
          <h2>${editing ? "Editar platillo" : "Nuevo platillo"}</h2>
          <p>La receta descuenta ingredientes cuando se registra una venta.</p>
          ${renderProductForm(editing)}
        </section>
      </div>
    </section>
  `;
}

function renderProductForm(item) {
  const recipeMap = new Map((item?.recipe || []).map((line) => [line.ingredientId, line.qty]));
  return `
    <form class="grid" data-form="product" style="margin-top:14px">
      <div class="form-grid">
        <label class="field">
          <span>Nombre</span>
          <input name="name" value="${escapeAttr(item?.name || "")}" required />
        </label>
        <label class="field">
          <span>Categoria</span>
          <input name="category" list="category-list" value="${escapeAttr(item?.category || "")}" required />
          <datalist id="category-list">
            ${categories().filter((cat) => cat !== "Todos").map((cat) => `<option value="${escapeAttr(cat)}"></option>`).join("")}
          </datalist>
        </label>
        <label class="field">
          <span>Precio</span>
          <input name="price" type="number" min="0" step="0.01" value="${item?.price ?? ""}" required />
        </label>
        <label class="field">
          <span>Visible en menu</span>
          <select name="active">
            <option value="true" ${item?.active !== false ? "selected" : ""}>Activo</option>
            <option value="false" ${item?.active === false ? "selected" : ""}>Oculto</option>
          </select>
        </label>
        <label class="field full">
          <span>Descripcion</span>
          <textarea name="description">${escapeHtml(item?.description || "")}</textarea>
        </label>
        <label class="field">
          <span>URL de foto</span>
          <input name="imageUrl" value="${escapeAttr(item?.imageUrl || "")}" placeholder="https://..." />
        </label>
        <label class="field">
          <span>Subir foto</span>
          <input name="imageFile" type="file" accept="image/*" />
        </label>
      </div>
      ${item?.imageUrl ? `<img class="form-preview" src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(item.name)}" loading="lazy" />` : ""}
      <div>
        <h3>Receta / insumos</h3>
        <p>Deja en cero los ingredientes que no use este platillo.</p>
      </div>
      <div class="recipe-grid">
        ${db.ingredients.map((ing) => `
          <label class="recipe-cell">
            <span class="small"><strong>${escapeHtml(ing.name)}</strong> (${escapeHtml(ing.unit)})</span>
            <input data-recipe-ingredient="${ing.id}" type="number" min="0" step="0.001" value="${recipeMap.get(ing.id) || 0}" />
          </label>
        `).join("")}
      </div>
      <div class="pill-row">
        <button class="button primary" type="submit">${icon("save")} Guardar platillo</button>
        ${item ? `<button class="button ghost" type="button" data-action="new-product">${icon("x")} Cancelar</button>` : ""}
      </div>
    </form>
  `;
}

function renderInventory() {
  const editing = db.ingredients.find((item) => item.id === ui.editIngredientId);
  return `
    <section class="page">
      <div class="grid two">
        <section class="panel">
          <div class="section-head">
            <div>
              <h2>Ingredientes</h2>
              <p>Stock actual, minimo y costo estimado por unidad.</p>
            </div>
            <button class="button" type="button" data-action="new-ingredient">${icon("plus")} Nuevo</button>
          </div>
          <div class="table-wrap" style="margin-top:14px">
            <table>
              <thead><tr><th>Ingrediente</th><th>Stock</th><th>Minimo</th><th>Costo</th><th></th></tr></thead>
              <tbody>
                ${db.ingredients.map((item) => {
                  const low = item.stock <= item.min;
                  return `
                    <tr>
                      <td><strong>${escapeHtml(item.name)}</strong><br><span class="muted small">${escapeHtml(item.category || "")}</span></td>
                      <td><span class="badge ${low ? "danger" : ""}">${number(item.stock)} ${escapeHtml(item.unit)}</span></td>
                      <td>${number(item.min)} ${escapeHtml(item.unit)}</td>
                      <td>${formatMoney(item.cost)} / ${escapeHtml(item.unit)}</td>
                      <td class="pill-row">
                        <button class="icon-button" type="button" title="Restar" data-action="quick-stock" data-id="${item.id}" data-delta="-1">${icon("minus")}</button>
                        <button class="icon-button" type="button" title="Sumar" data-action="quick-stock" data-id="${item.id}" data-delta="1">${icon("plus")}</button>
                        <button class="icon-button" type="button" title="Editar" data-action="edit-ingredient" data-id="${item.id}">${icon("edit")}</button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </section>
        <section class="panel">
          <h2>${editing ? "Editar ingrediente" : "Nuevo ingrediente"}</h2>
          <p>Usa unidades consistentes con tus recetas: kg, lt, pz.</p>
          ${renderIngredientForm(editing)}
        </section>
      </div>
    </section>
  `;
}

function renderIngredientForm(item) {
  return `
    <form class="grid" data-form="ingredient" style="margin-top:14px">
      <div class="form-grid">
        <label class="field">
          <span>Nombre</span>
          <input name="name" value="${escapeAttr(item?.name || "")}" required />
        </label>
        <label class="field">
          <span>Categoria</span>
          <input name="category" value="${escapeAttr(item?.category || "")}" />
        </label>
        <label class="field">
          <span>Unidad</span>
          <input name="unit" value="${escapeAttr(item?.unit || "pz")}" required />
        </label>
        <label class="field">
          <span>Stock actual</span>
          <input name="stock" type="number" step="0.001" min="0" value="${item?.stock ?? 0}" required />
        </label>
        <label class="field">
          <span>Minimo</span>
          <input name="min" type="number" step="0.001" min="0" value="${item?.min ?? 0}" required />
        </label>
        <label class="field">
          <span>Costo por unidad</span>
          <input name="cost" type="number" step="0.01" min="0" value="${item?.cost ?? 0}" required />
        </label>
      </div>
      <div class="pill-row">
        <button class="button primary" type="submit">${icon("save")} Guardar ingrediente</button>
        ${item ? `<button class="button ghost" type="button" data-action="new-ingredient">${icon("x")} Cancelar</button>` : ""}
      </div>
    </form>
  `;
}

function renderFinance() {
  const recent = db.ledger.slice().reverse().slice(0, 30);
  return `
    <section class="page">
      <div class="grid two">
        <section class="panel">
          <h2>Registrar gasto o ingreso</h2>
          <p>Los gastos en efectivo afectan el cierre de caja abierto.</p>
          <form class="grid" data-form="ledger" style="margin-top:14px">
            <div class="form-grid">
              <label class="field">
                <span>Tipo</span>
                <select name="type">
                  <option value="expense">Gasto</option>
                  <option value="income">Ingreso manual</option>
                </select>
              </label>
              <label class="field">
                <span>Fecha</span>
                <input name="date" type="date" value="${todayInput()}" required />
              </label>
              <label class="field">
                <span>Concepto</span>
                <input name="concept" placeholder="Gas, renta, compra..." required />
              </label>
              <label class="field">
                <span>Categoria</span>
                <input name="category" placeholder="Operativo" />
              </label>
              <label class="field">
                <span>Monto</span>
                <input name="amount" type="number" min="0" step="0.01" required />
              </label>
              <label class="field">
                <span>Metodo</span>
                <select name="paymentMethod">
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </label>
              <label class="field full">
                <span>Notas</span>
                <textarea name="notes"></textarea>
              </label>
            </div>
            <button class="button primary" type="submit">${icon("save")} Guardar movimiento</button>
          </form>
        </section>
        <section class="panel">
          <div class="section-head">
            <div>
              <h2>Movimientos recientes</h2>
              <p>Ingresos por ventas y movimientos manuales recientes.</p>
            </div>
          </div>
          <div class="table-wrap" style="margin-top:14px">
            <table>
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Monto</th><th></th></tr></thead>
              <tbody>
                ${recent.map((item) => `
                  <tr>
                    <td>${formatDate(item.date)}</td>
                    <td><strong>${escapeHtml(item.concept)}</strong><br><span class="muted small">${escapeHtml(item.category || "")}</span></td>
                    <td>${item.voided ? '<span class="badge danger">Anulado</span>' : item.linkedOrderId ? '<span class="badge">Venta automática</span>' : item.type === "expense" ? '<span class="badge danger">Gasto</span>' : '<span class="badge">Ingreso</span>'}</td>
                    <td>${formatMoney(item.amount)}</td>
                    <td>${item.linkedOrderId ? "" : `<button class="icon-button" type="button" title="Eliminar" data-action="delete-ledger" data-id="${item.id}">${icon("trash")}</button>`}</td>
                  </tr>
                `).join("") || `<tr><td colspan="5">${emptyInline("Sin movimientos registrados.")}</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderReports() {
  const period = getPeriod(ui.reportPeriod, ui.reportDate);
  const report = calculateReport(period.start, period.end);
  return `
    <section class="page">
      <section class="panel">
        <div class="section-head">
          <div>
            <h2>Reportes</h2>
            <p>${formatDate(period.start)} a ${formatDate(period.end)}</p>
          </div>
          <div class="pill-row">
            ${["day", "week", "month"].map((periodName) => `
              <button class="pill ${ui.reportPeriod === periodName ? "active" : ""}" type="button" data-action="report-period" data-period="${periodName}">
                ${periodLabel(periodName)}
              </button>
            `).join("")}
            <input class="button" style="width:160px" type="date" data-input="report-date" value="${ui.reportDate}" />
          </div>
        </div>
      </section>
      <div class="grid four">
        ${metric("Ventas", formatMoney(report.salesTotal), `${report.orderCount} pedidos`)}
        ${metric("Gastos", formatMoney(report.expenseTotal), "Movimientos registrados")}
        ${metric("Costo estimado", formatMoney(report.estimatedCost), "Segun recetas")}
        ${metric("Utilidad estimada", formatMoney(report.netTotal), "Ventas + ingresos - gastos - costo")}
      </div>
      <div class="grid two">
        <section class="panel">
          <h2>Platillos mas vendidos</h2>
          <div class="table-wrap" style="margin-top:14px">
            <table>
              <thead><tr><th>Platillo</th><th>Cantidad</th><th>Total</th></tr></thead>
              <tbody>
                ${report.topProducts.map((item) => `
                  <tr><td>${escapeHtml(item.name)}</td><td>${item.qty}</td><td>${formatMoney(item.total)}</td></tr>
                `).join("") || `<tr><td colspan="3">${emptyInline("Sin ventas en este periodo.")}</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>
        <section class="panel">
          <h2>Gastos por categoria</h2>
          <div class="table-wrap" style="margin-top:14px">
            <table>
              <thead><tr><th>Categoria</th><th>Total</th></tr></thead>
              <tbody>
                ${report.expensesByCategory.map((item) => `
                  <tr><td>${escapeHtml(item.category)}</td><td>${formatMoney(item.total)}</td></tr>
                `).join("") || `<tr><td colspan="2">${emptyInline("Sin gastos en este periodo.")}</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section class="panel">
        <div class="section-head">
          <div>
            <h2>Resumen para cierre</h2>
            <p>Ventas separadas por metodo de pago.</p>
          </div>
          <button class="button" type="button" data-action="copy-report">${icon("copy")} Copiar resumen</button>
        </div>
        <div class="table-wrap" style="margin-top:14px">
          <table>
            <tbody>
              <tr><td>Efectivo</td><td>${formatMoney(report.salesByPayment.efectivo || 0)}</td></tr>
              <tr><td>Tarjeta</td><td>${formatMoney(report.salesByPayment.tarjeta || 0)}</td></tr>
              <tr><td>Transferencia</td><td>${formatMoney(report.salesByPayment.transferencia || 0)}</td></tr>
              <tr><td>Ingresos manuales</td><td>${formatMoney(report.manualIncomeTotal)}</td></tr>
              <tr><td>Promedio por pedido</td><td>${formatMoney(report.averageTicket)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `;
}

function renderCash() {
  const open = cashSessionOpen();
  const summary = open ? cashSummary(open) : null;
  return `
    <section class="page">
      <div class="grid two">
        <section class="panel">
          <h2>${open ? "Caja abierta" : "Abrir caja"}</h2>
          <p>${open ? `Abierta desde ${formatDateTime(open.openedAt)}` : "Registra el efectivo inicial antes de vender."}</p>
          ${open ? renderOpenCash(open, summary) : renderOpenCashForm()}
        </section>
        <section class="panel">
          <h2>Cierres anteriores</h2>
          <div class="table-wrap" style="margin-top:14px">
            <table>
              <thead><tr><th>Fecha</th><th>Inicial</th><th>Esperado</th><th>Contado</th><th>Diferencia</th></tr></thead>
              <tbody>
                ${db.cashSessions.filter((item) => item.status === "closed").slice().reverse().map((item) => `
                  <tr>
                    <td>${formatDateTime(item.closedAt)}</td>
                    <td>${formatMoney(item.openingCash)}</td>
                    <td>${formatMoney(item.expectedCash)}</td>
                    <td>${formatMoney(item.closingCash)}</td>
                    <td><span class="badge ${Math.abs(item.difference) > 0.01 ? "warn" : ""}">${formatMoney(item.difference)}</span></td>
                  </tr>
                `).join("") || `<tr><td colspan="5">${emptyInline("Todavia no hay cierres.")}</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderOpenCashForm() {
  return `
    <form class="grid" data-form="open-cash" style="margin-top:14px">
      <label class="field">
        <span>Efectivo inicial</span>
        <input name="openingCash" type="number" min="0" step="0.01" value="0" required />
      </label>
      <button class="button primary" type="submit">${icon("cash")} Abrir caja</button>
    </form>
  `;
}

function renderOpenCash(open, summary) {
  return `
    <div class="grid" style="margin-top:14px">
      <div class="table-wrap">
        <table>
          <tbody>
            <tr><td>Efectivo inicial</td><td>${formatMoney(open.openingCash)}</td></tr>
            <tr><td>Ventas en efectivo</td><td>${formatMoney(summary.cashSales)}</td></tr>
            <tr><td>Ingresos manuales efectivo</td><td>${formatMoney(summary.cashIncome)}</td></tr>
            <tr><td>Gastos efectivo</td><td>${formatMoney(summary.cashExpenses)}</td></tr>
            <tr><td><strong>Efectivo esperado</strong></td><td><strong>${formatMoney(summary.expectedCash)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <form class="grid" data-form="close-cash">
        <label class="field">
          <span>Efectivo contado</span>
          <input name="closingCash" type="number" min="0" step="0.01" value="${summary.expectedCash.toFixed(2)}" required />
        </label>
        <label class="field">
          <span>Notas de cierre</span>
          <textarea name="notes"></textarea>
        </label>
        <button class="button primary" type="submit">${icon("check")} Cerrar dia</button>
      </form>
    </div>
  `;
}

function renderUsers() {
  const editing = db.users.find((item) => item.id === ui.editUserId);
  return `
    <section class="page">
      <div class="grid two">
        <section class="panel">
          <div class="section-head">
            <div>
              <h2>Usuarios</h2>
              <p>Control de roles y permisos por pantalla.</p>
            </div>
            <button class="button" type="button" data-action="new-user">${icon("plus")} Nuevo</button>
          </div>
          <div class="table-wrap" style="margin-top:14px">
            <table>
              <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                ${db.users.map((user) => `
                  <tr>
                    <td><strong>${escapeHtml(user.name)}</strong><br><span class="muted small">${user.permissions.length} permisos</span></td>
                    <td>${roleLabel(user.role)}</td>
                    <td>${user.active ? '<span class="badge">Activo</span>' : '<span class="badge danger">Inactivo</span>'}</td>
                    <td><button class="icon-button" type="button" title="Editar" data-action="edit-user" data-id="${user.id}">${icon("edit")}</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </section>
        <section class="panel">
          <h2>${editing ? "Editar usuario" : "Nuevo usuario"}</h2>
          <p>Los PIN se guardan localmente para este MVP.</p>
          ${renderUserForm(editing)}
        </section>
      </div>
    </section>
  `;
}

function renderUserForm(user) {
  const selectedPermissions = new Set(user?.permissions || ROLE_PERMISSIONS.cajero);
  const selectedRole = user?.role || "cajero";
  return `
    <form class="grid" data-form="user" style="margin-top:14px">
      <div class="form-grid">
        <label class="field">
          <span>Nombre</span>
          <input name="name" value="${escapeAttr(user?.name || "")}" required />
        </label>
        <label class="field">
          <span>PIN</span>
          <input name="pin" inputmode="numeric" value="${escapeAttr(user?.pin || "")}" required />
        </label>
        <label class="field">
          <span>Rol</span>
          <select name="role" data-input="role-template">
            ${Object.keys(ROLE_PERMISSIONS).map((role) => `<option value="${role}" ${selectedRole === role ? "selected" : ""}>${roleLabel(role)}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>Estado</span>
          <select name="active">
            <option value="true" ${user?.active !== false ? "selected" : ""}>Activo</option>
            <option value="false" ${user?.active === false ? "selected" : ""}>Inactivo</option>
          </select>
        </label>
      </div>
      <div>
        <h3>Permisos</h3>
        <p>Marca las pantallas que este usuario puede abrir.</p>
      </div>
      <div class="permission-grid">
        ${ROUTES.map((route) => `
          <label class="permission-cell">
            <span><input type="checkbox" data-user-permission value="${route.id}" ${selectedPermissions.has(route.id) ? "checked" : ""} /> ${escapeHtml(route.label)}</span>
          </label>
        `).join("")}
      </div>
      <div class="pill-row">
        <button class="button primary" type="submit">${icon("save")} Guardar usuario</button>
        ${user ? `<button class="button ghost" type="button" data-action="new-user">${icon("x")} Cancelar</button>` : ""}
      </div>
    </form>
  `;
}

function renderSettings() {
  return `
    <section class="page">
      <div class="grid two">
        <section class="panel">
          <h2>Ajustes del negocio</h2>
          <p>El telefono debe incluir lada pais. Mexico normalmente empieza con 52.</p>
          <form class="grid" data-form="settings" style="margin-top:14px">
            <div class="form-grid">
              <label class="field">
                <span>Nombre del negocio</span>
                <input name="businessName" value="${escapeAttr(db.settings.businessName)}" required />
              </label>
              <label class="field">
                <span>Moneda</span>
                <input name="currency" value="${escapeAttr(db.settings.currency)}" required />
              </label>
              <label class="field">
                <span>WhatsApp pedidos</span>
                <input name="whatsappNumber" value="${escapeAttr(db.settings.whatsappNumber)}" placeholder="5218341422227" inputmode="tel" />
              </label>
              <label class="field">
                <span>Prefijo de tickets</span>
                <input name="ticketPrefix" value="${escapeAttr(db.settings.ticketPrefix)}" required />
              </label>
              <label class="field full">
                <span>Direccion / punto de venta</span>
                <textarea name="address">${escapeHtml(db.settings.address || "")}</textarea>
              </label>
            </div>
            <button class="button primary" type="submit">${icon("save")} Guardar ajustes</button>
          </form>
        </section>
        <section class="panel">
          <h2>Firebase</h2>
          <p>Conecta Firestore del proyecto Food Truck POS para guardar datos y fotos en la nube.</p>
          <div class="grid" style="margin-top:14px">
            <div class="table-wrap">
              <table>
                <tbody>
                  <tr><td>Estado</td><td>${cloudStatusBadge()}</td></tr>
                  <tr><td>Ultima sincronizacion</td><td>${cloud.lastSync ? formatDateTime(cloud.lastSync) : "Pendiente"}</td></tr>
                  ${cloud.error ? `<tr><td>Error</td><td><span class="badge danger">${escapeHtml(cloud.error)}</span></td></tr>` : ""}
                </tbody>
              </table>
            </div>
            <form class="grid" data-form="firebase">
              <div class="form-grid">
                <label class="field">
                  <span>Usar Firebase</span>
                  <select name="enabled">
                    <option value="true" ${cloudConfig.enabled ? "selected" : ""}>Si</option>
                    <option value="false" ${!cloudConfig.enabled ? "selected" : ""}>No, solo local</option>
                  </select>
                </label>
                <label class="field">
                  <span>Project ID</span>
                  <input name="projectId" value="${escapeAttr(cloudConfig.projectId || "")}" required />
                </label>
                <label class="field">
                  <span>API key</span>
                  <input name="apiKey" value="${escapeAttr(cloudConfig.apiKey || "")}" required />
                </label>
                <label class="field">
                  <span>Auth domain</span>
                  <input name="authDomain" value="${escapeAttr(cloudConfig.authDomain || "")}" required />
                </label>
                <label class="field">
                  <span>Storage bucket</span>
                  <input name="storageBucket" value="${escapeAttr(cloudConfig.storageBucket || "")}" />
                </label>
                <label class="field">
                  <span>Messaging sender ID</span>
                  <input name="messagingSenderId" value="${escapeAttr(cloudConfig.messagingSenderId || "")}" />
                </label>
                <label class="field full">
                  <span>App ID</span>
                  <input name="appId" value="${escapeAttr(cloudConfig.appId || "")}" required />
                </label>
                <label class="field full">
                  <span>Measurement ID</span>
                  <input name="measurementId" value="${escapeAttr(cloudConfig.measurementId || "")}" />
                </label>
              </div>
              <button class="button primary" type="submit">${icon("save")} Guardar Firebase y conectar</button>
            </form>
            <div class="pill-row">
              <button class="button" type="button" data-action="sync-cloud" ${hasCloudConfig() ? "" : "disabled"}>${icon("upload")} Subir datos actuales</button>
              <button class="button" type="button" data-action="refresh-cloud" ${hasCloudConfig() ? "" : "disabled"}>${icon("refresh")} Cargar desde Firestore</button>
            </div>
          </div>
        </section>
        <section class="panel">
          <h2>Datos locales</h2>
          <p>Exporta una copia JSON para respaldo o reinicia el demo local.</p>
          <div class="grid" style="margin-top:14px">
            <button class="button" type="button" data-action="export-data">${icon("download")} Exportar datos</button>
            <button class="button warning" type="button" data-action="restore-demo">${icon("refresh")} Restaurar demo</button>
          </div>
        </section>
      </div>
    </section>
  `;
}

async function handleClick(event) {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    const route = routeButton.dataset.route;
    if (route === "login") {
      setRoute(firstAllowedRoute());
      return;
    }
    setRoute(route);
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "logout") {
    if (cloud.auth && cloud.firebase?.signOut) {
      try {
        await cloud.firebase.signOut(cloud.auth);
      } catch (error) {
        console.warn("No se pudo cerrar sesion de Firebase", error);
      }
    }
    db.session.currentUserId = null;
    saveDatabase();
    setRoute("dashboard");
    return;
  }

  if (action === "enable-alerts") {
    await enableOrderAlerts();
    return;
  }

  if (action === "add-pos" || action === "add-public") {
    addToCart(action === "add-pos" ? "posCart" : "publicCart", id);
    render();
    return;
  }

  if (action === "new-pos-draft") {
    const draft = createPosDraft(ui.posDrafts.length + 1);
    ui.posDrafts.push(draft);
    ui.activePosDraftId = draft.id;
    savePosDrafts();
    render();
    return;
  }

  if (action === "select-pos-draft") {
    ui.activePosDraftId = id;
    savePosDrafts();
    render();
    return;
  }

  if (action === "remove-pos-draft") {
    const draft = ui.posDrafts.find((item) => item.id === id);
    if (draft?.cart.length && !confirm(`Cerrar ${draft.label} y descartar sus productos?`)) return;
    ui.posDrafts = ui.posDrafts.filter((item) => item.id !== id);
    if (!ui.posDrafts.length) ui.posDrafts.push(createPosDraft(1));
    ui.activePosDraftId = ui.posDrafts[0].id;
    savePosDrafts();
    render();
    return;
  }

  if (action === "save-open-pos-order") {
    const form = app.querySelector('[data-form="pos-checkout"]');
    if (form?.reportValidity()) {
      createOrderFromCart("posCart", form, "POS", false, { keepOpen: true });
    }
    return;
  }

  if (action.startsWith("inc-") || action.startsWith("dec-")) {
    const cartName = action.endsWith("public") ? "publicCart" : "posCart";
    changeCartQty(cartName, id, action.startsWith("inc-") ? 1 : -1);
    render();
    return;
  }

  if (action === "clear-pos" || action === "clear-public") {
    if (action === "clear-pos") activePosDraft().cart = [];
    else ui.publicCart = [];
    savePosDrafts();
    render();
    return;
  }

  if (action === "pos-filter" || action === "public-filter") {
    if (action === "pos-filter") ui.productFilter = button.dataset.filter;
    if (action === "public-filter") ui.publicFilter = button.dataset.filter;
    render();
    return;
  }

  if (action === "order-filter") {
    ui.orderStatusFilter = button.dataset.filter;
    render();
    return;
  }

  if (action === "set-order-status") {
    updateOrderStatus(id, button.dataset.status);
    return;
  }

  if (action === "order-whatsapp") {
    const orderItem = db.orders.find((item) => item.id === id);
    if (orderItem) openWhatsApp(orderItem);
    return;
  }

  if (action === "new-product") {
    ui.editProductId = null;
    render();
    return;
  }

  if (action === "edit-product") {
    ui.editProductId = id;
    render();
    return;
  }

  if (action === "delete-product") {
    await deleteProduct(id);
    return;
  }

  if (action === "new-ingredient") {
    ui.editIngredientId = null;
    render();
    return;
  }

  if (action === "edit-ingredient") {
    ui.editIngredientId = id;
    render();
    return;
  }

  if (action === "quick-stock") {
    adjustStock(id, Number(button.dataset.delta));
    render();
    return;
  }

  if (action === "delete-ledger") {
    db.ledger = db.ledger.filter((item) => item.id !== id);
    saveDatabase();
    toast("Movimiento eliminado.");
    render();
    return;
  }

  if (action === "report-period") {
    ui.reportPeriod = button.dataset.period;
    render();
    return;
  }

  if (action === "copy-report") {
    copyReport();
    return;
  }

  if (action === "new-user") {
    ui.editUserId = null;
    render();
    return;
  }

  if (action === "edit-user") {
    ui.editUserId = id;
    render();
    return;
  }

  if (action === "export-data") {
    exportData();
    return;
  }

  if (action === "sync-cloud") {
    await syncCloudNow();
    return;
  }

  if (action === "refresh-cloud") {
    await refreshCloudNow();
    return;
  }

  if (action === "restore-demo") {
    if (confirm("Esto reemplaza los datos locales por los datos de ejemplo. Continuar?")) {
      db = seedDatabase();
      saveDatabase();
      ui.posDrafts = [createPosDraft(1)];
      ui.activePosDraftId = ui.posDrafts[0].id;
      savePosDrafts();
      ui.publicCart = [];
      toast("Datos demo restaurados.");
      render();
    }
  }
}

async function handleSubmit(event) {
  const form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();

  const formName = form.dataset.form;
  const data = new FormData(form);

  if (formName === "login") {
    const email = String(data.get("email") || "").trim().toLowerCase();
    const password = String(data.get("password") || "").trim();

    if (hasCloudConfig() && cloud.firebase?.signInWithEmailAndPassword && cloud.auth) {
      try {
        await cloud.firebase.signInWithEmailAndPassword(cloud.auth, email, password);
      } catch (error) {
        toast("Credenciales de Firebase incorrectas o la cuenta no existe.");
        return;
      }
    } else {
      const pin = String(data.get("pin") || "").trim();
      const user = db.users.find((item) => item.pin === pin && item.active);
      if (!user) {
        toast("PIN incorrecto o usuario inactivo.");
        return;
      }
      db.session.currentUserId = user.id;
      saveDatabase();
      setRoute(firstAllowedRoute());
      return;
    }

    const matchedUser = db.users.find((item) => (
      item.email && item.email.toLowerCase() === email && item.active
    ));

    if (!matchedUser) {
      toast("La cuenta de Firebase no tiene un usuario autorizado en este POS.");
      if (cloud.auth && cloud.firebase?.signOut) {
        try {
          await cloud.firebase.signOut(cloud.auth);
        } catch (error) {
          console.warn("No se pudo cerrar la sesion de Firebase tras error", error);
        }
      }
      return;
    }

    db.session.currentUserId = matchedUser.id;
    saveDatabase();
    setRoute(firstAllowedRoute());
    return;
  }

  if (formName === "pos-checkout") {
    createOrderFromCart("posCart", form, "POS", false);
    return;
  }

  if (formName === "public-checkout") {
    const orderItem = createOrderFromCart("publicCart", form, "WhatsApp", true);
    if (orderItem) openWhatsApp(orderItem);
    return;
  }

  if (formName === "product") {
    await saveProduct(form);
    return;
  }

  if (formName === "ingredient") {
    saveIngredient(data);
    return;
  }

  if (formName === "ledger") {
    saveLedger(data);
    return;
  }

  if (formName === "open-cash") {
    openCash(data);
    return;
  }

  if (formName === "close-cash") {
    closeCash(data);
    return;
  }

  if (formName === "user") {
    saveUser(form, data);
    return;
  }

  if (formName === "settings") {
    db.settings = {
      ...db.settings,
      businessName: String(data.get("businessName") || "").trim(),
      currency: String(data.get("currency") || "MXN").trim().toUpperCase(),
      whatsappNumber: normalizePhone(String(data.get("whatsappNumber") || "")),
      ticketPrefix: String(data.get("ticketPrefix") || DEFAULT_SETTINGS.ticketPrefix).trim().toUpperCase(),
      address: String(data.get("address") || "").trim()
    };
    saveDatabase();
    toast("Ajustes guardados.");
    render();
  }

  if (formName === "firebase") {
    cloudConfig = {
      enabled: data.get("enabled") === "true",
      apiKey: String(data.get("apiKey") || "").trim(),
      authDomain: String(data.get("authDomain") || "").trim(),
      projectId: String(data.get("projectId") || "").trim(),
      storageBucket: String(data.get("storageBucket") || "").trim(),
      messagingSenderId: String(data.get("messagingSenderId") || "").trim(),
      appId: String(data.get("appId") || "").trim(),
      measurementId: String(data.get("measurementId") || "").trim()
    };
    saveCloudConfig();
    toast("Configuracion de Firebase guardada.");
    await initializeCloud();
    render();
  }
}

function handleInput(event) {
  const input = event.target;
  if (input.closest('[data-form="pos-checkout"]')) {
    savePosDraftField(input);
    savePosDrafts();
  }
  if (input.dataset.input === "pos-search") {
    const cursor = input.selectionStart;
    ui.productSearch = input.value;
    render();
    restoreInputFocus("pos-search", cursor);
  }
  if (input.dataset.input === "public-search") {
    const cursor = input.selectionStart;
    ui.publicSearch = input.value;
    render();
    restoreInputFocus("public-search", cursor);
  }
  if (input.dataset.input === "report-date") {
    ui.reportDate = input.value || todayInput();
    render();
  }
}

function handleChange(event) {
  const input = event.target;
  if (input.closest('[data-form="pos-checkout"]')) {
    savePosDraftField(input);
    savePosDrafts();
    if (input.name === "orderType") render();
  }
  if (input.dataset.input === "role-template") {
    const role = input.value;
    document.querySelectorAll("[data-user-permission]").forEach((box) => {
      box.checked = ROLE_PERMISSIONS[role]?.includes(box.value) || false;
    });
  }
}

function createOrderFromCart(cartName, form, channel, isPublic, options = {}) {
  const { keepOpen = false } = options;
  const draft = cartName === "posCart" ? activePosDraft() : null;
  const cart = currentCart(cartName);
  if (!cart.length) return null;

  if (!keepOpen && !cashSessionOpen() && channel === "POS") {
    toast("Abre la caja antes de cobrar.");
    setRoute("cash");
    return null;
  }

  const data = new FormData(form);
  const orderType = String(data.get("orderType") || "recoger");
  const tableName = orderType === "comer aqui" ? String(data.get("tableName") || "") : "";
  if (orderType === "comer aqui" && !tableName) {
    toast("Selecciona Mesa 1 o Mesa 2 para comer aqui.");
    return null;
  }
  const totals = calculateCartTotals(cart);
  const discount = Math.max(0, Number(data.get("discount") || 0));
  const total = Math.max(0, totals.subtotal - discount);
  const orderItem = {
    id: uid("order"),
    ticket: nextTicket(),
    createdAt: new Date().toISOString(),
    channel,
    status: channel === "POS" && !keepOpen ? "entregado" : "nuevo",
    paymentStatus: keepOpen ? "pending" : "paid",
    customerName: String(data.get("customerName") || "").trim() || "Cliente mostrador",
    customerPhone: normalizePhone(String(data.get("customerPhone") || "")),
    orderType,
    tableName,
    paymentMethod: String(data.get("paymentMethod") || "efectivo"),
    notes: String(data.get("notes") || "").trim(),
    items: cart.map((line) => {
      const productItem = db.products.find((item) => item.id === line.productId);
      return {
        productId: line.productId,
        name: productItem?.name || line.name || "Producto",
        qty: line.qty,
        price: productItem?.price || line.price || 0
      };
    }),
    subtotal: totals.subtotal,
    discount,
    total,
    userId: currentUser()?.id || null,
    inventoryApplied: true,
    ...(keepOpen ? {} : { paidAt: new Date().toISOString() })
  };

  db.orders.push(orderItem);
  deductInventory(orderItem);
  if (orderItem.paymentStatus === "paid") recordSaleIncome(orderItem);
  if (draft) {
    ui.posDrafts = ui.posDrafts.filter((item) => item.id !== draft.id);
    if (keepOpen) {
      const nextDraft = createPosDraft(ui.posDrafts.length + 1);
      ui.posDrafts.push(nextDraft);
      ui.activePosDraftId = nextDraft.id;
    } else {
      if (!ui.posDrafts.length) ui.posDrafts.push(createPosDraft(1));
      ui.activePosDraftId = ui.posDrafts[0].id;
    }
    savePosDrafts();
  } else {
    ui[cartName] = [];
  }
  saveDatabase();
  toast(isPublic ? "Pedido listo para WhatsApp." : keepOpen ? "Orden abierta guardada. Puedes iniciar otro pedido." : "Venta registrada.");
  render();
  return orderItem;
}

async function saveProduct(form) {
  const data = new FormData(form);
  const recipeItems = [...form.querySelectorAll("[data-recipe-ingredient]")]
    .map((input) => ({ ingredientId: input.dataset.recipeIngredient, qty: Number(input.value || 0) }))
    .filter((line) => line.qty > 0);
  let imageUrl = String(data.get("imageUrl") || "").trim();
  const imageFile = form.querySelector('input[name="imageFile"]')?.files?.[0];
  const productName = String(data.get("name") || "").trim();

  if (imageFile) {
    toast("Preparando foto...");
    const uploadedUrl = await uploadProductImage(imageFile, productName);
    if (!uploadedUrl && !imageUrl) return;
    imageUrl = uploadedUrl || imageUrl;
  }

  const payload = {
    name: productName,
    category: String(data.get("category") || "").trim(),
    price: Number(data.get("price") || 0),
    active: data.get("active") === "true",
    description: String(data.get("description") || "").trim(),
    imageUrl,
    recipe: recipeItems
  };

  if (ui.editProductId) {
    const updatedAt = new Date().toISOString();
    db.products = db.products.map((item) => item.id === ui.editProductId ? { ...item, ...payload, updatedAt } : item);
    toast("Platillo actualizado.");
  } else {
    const createdAt = new Date().toISOString();
    db.products.push({ id: uid("prod"), ...payload, createdAt, updatedAt: createdAt });
    toast("Platillo agregado.");
  }

  ui.editProductId = null;
  await saveProductChanges();
  render();
}

async function uploadProductImage(file, productName) {
  if (!isImageFile(file)) {
    toast("Selecciona un archivo de imagen valido.");
    return "";
  }

  const embeddedUrl = await embedProductImage(file);
  if (embeddedUrl) {
    toast("Foto guardada en el platillo.");
    return embeddedUrl;
  }

  return uploadProductImageToStorage(file, productName);
}

function isImageFile(file) {
  if (file.type?.startsWith("image/")) return true;
  return /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name || "");
}

async function uploadProductImageToStorage(file, productName) {
  const isReady = await ensureCloudStorageReady();
  if (!isReady) return "";

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${slugify(productName || "platillo")}-${Date.now()}.${extension}`;
  const imageRef = cloud.firebase.ref(cloud.storage, `${PHOTO_FOLDER}/${fileName}`);

  try {
    await cloud.firebase.uploadBytes(imageRef, file, {
      contentType: file.type || "image/jpeg"
    });
    return await cloud.firebase.getDownloadURL(imageRef);
  } catch (error) {
    console.warn("No se pudo subir la foto a Storage. Se guardara comprimida en el platillo.", error);
    return "";
  }
}

async function ensureCloudStorageReady() {
  if (!hasCloudConfig()) return false;
  if (cloud.storage && cloud.firebase) return true;

  await initializeCloud({ pushLocalIfEmpty: false });
  return Boolean(cloud.storage && cloud.firebase);
}

async function embedProductImage(file) {
  try {
    const image = await loadImageFile(file);
    const attempts = [
      { maxSide: 520, quality: 0.7 },
      { maxSide: 420, quality: 0.62 },
      { maxSide: 340, quality: 0.56 },
      { maxSide: 280, quality: 0.5 },
      { maxSide: 220, quality: 0.46 }
    ];

    let dataUrl = "";
    for (const attempt of attempts) {
      dataUrl = renderCompressedImage(image, attempt.maxSide, attempt.quality);
      if (dataUrl.length <= EMBEDDED_IMAGE_MAX_LENGTH) return dataUrl;
    }
    return dataUrl;
  } catch (error) {
    console.warn("No se pudo preparar la foto localmente", error);
    toast("No se pudo preparar la foto. Intenta con JPG o PNG.");
    return "";
  }
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    image.src = url;
  });
}

function renderCompressedImage(image, maxSide, quality) {
  const width = image.naturalWidth || image.width || maxSide;
  const height = image.naturalHeight || image.height || maxSide;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la imagen.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function saveProductChanges(changeLabel = "Platillo guardado") {
  const saved = saveDatabase({ syncCloud: false });
  if (!saved) return "failed";

  if (!hasCloudConfig()) return "local";

  if (!cloud.connected || !cloud.client || !cloud.stateRef || !cloud.firebase) {
    const reason = cloud.error ? ` Firebase: ${cloud.error}` : " Revisa Ajustes > Firebase.";
    toast(`${changeLabel} solo en este equipo; no se subio a la nube.${reason}`);
    return "local";
  }

  try {
    await pushDatabaseToCloud();
    return "synced";
  } catch (error) {
    cloud = { ...cloud, connected: false, status: "error", error: error.message || "No se pudo guardar en Firebase." };
    toast(`${changeLabel} en este equipo, pero no se pudo sincronizar con Firebase.`);
    return "failed";
  }
}

async function deleteProduct(id) {
  const item = db.products.find((productItem) => productItem.id === id);
  if (!item || !confirm(`Eliminar el platillo "${item.name}"? Esta accion no se puede deshacer.`)) return;

  db.products = db.products.filter((productItem) => productItem.id !== id);
  db.deletedProductIds = [...new Set([...(db.deletedProductIds || []), id])];
  ui.posDrafts.forEach((draft) => {
    draft.cart = draft.cart.filter((line) => line.productId !== id);
  });
  ui.publicCart = ui.publicCart.filter((line) => line.productId !== id);
  if (ui.editProductId === id) ui.editProductId = null;
  savePosDrafts();

  const result = await saveProductChanges("Platillo eliminado");
  if (result === "synced") toast("Platillo eliminado del equipo y de Firebase.");
  else if (result === "local" && !hasCloudConfig()) toast("Platillo eliminado de este equipo.");
  render();
}

function mergeRemoteWithLocalProducts(remoteDb) {
  const localProducts = db.products || [];
  const deletedProductIds = [...new Set([...(remoteDb.deletedProductIds || []), ...(db.deletedProductIds || [])])];
  const deletedIds = new Set(deletedProductIds);
  const remoteProducts = (remoteDb.products || []).filter((item) => !deletedIds.has(item.id));
  const remoteIds = new Set(remoteProducts.map((item) => item.id));
  const localById = new Map(localProducts.map((item) => [item.id, item]));

  const products = remoteProducts.map((remoteProduct) => {
    const localProduct = localById.get(remoteProduct.id);
    return shouldKeepLocalProduct(localProduct, remoteProduct) ? localProduct : remoteProduct;
  });

  for (const localProduct of localProducts) {
    if (!remoteIds.has(localProduct.id) && !deletedIds.has(localProduct.id) && localProduct.updatedAt) {
      products.push(localProduct);
    }
  }

  const ordersById = new Map((remoteDb.orders || []).map((orderItem) => [orderItem.id, orderItem]));
  for (const localOrder of db.orders || []) {
    const remoteOrder = ordersById.get(localOrder.id);
    if (!remoteOrder) {
      ordersById.set(localOrder.id, localOrder);
      continue;
    }
    const localUpdatedAt = Date.parse(localOrder.updatedAt || localOrder.createdAt || "");
    const remoteUpdatedAt = Date.parse(remoteOrder.updatedAt || remoteOrder.createdAt || "");
    if (Number.isFinite(localUpdatedAt) && (!Number.isFinite(remoteUpdatedAt) || localUpdatedAt > remoteUpdatedAt)) {
      ordersById.set(localOrder.id, localOrder);
    }
  }

  const orders = [...ordersById.values()].sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0));
  return { ...remoteDb, deletedProductIds, products, orders };
}

function shouldKeepLocalProduct(localProduct, remoteProduct) {
  if (!localProduct?.updatedAt) return false;

  const localTime = Date.parse(localProduct.updatedAt);
  const remoteTime = Date.parse(remoteProduct?.updatedAt || "");
  if (!Number.isFinite(localTime)) return false;

  if (!Number.isFinite(remoteTime)) return true;
  if (localTime > remoteTime) return true;

  return hasEmbeddedImage(localProduct) && !remoteProduct?.imageUrl && localTime === remoteTime;
}

function hasLocalProductChanges(remoteProducts, remoteDeletedProductIds = []) {
  const remoteById = new Map(remoteProducts.map((productItem) => [productItem.id, productItem]));
  const remoteDeletedIds = new Set(remoteDeletedProductIds);
  if ((db.deletedProductIds || []).some((id) => !remoteDeletedIds.has(id))) return true;
  return (db.products || []).some((localProduct) => {
    if (!localProduct.updatedAt) return false;
    const remoteProduct = remoteById.get(localProduct.id);
    return !remoteProduct || shouldKeepLocalProduct(localProduct, remoteProduct);
  });
}

function hasEmbeddedImage(productItem) {
  return String(productItem?.imageUrl || "").startsWith("data:image/");
}

function saveIngredient(data) {
  const payload = {
    name: String(data.get("name") || "").trim(),
    category: String(data.get("category") || "").trim(),
    unit: String(data.get("unit") || "pz").trim(),
    stock: Number(data.get("stock") || 0),
    min: Number(data.get("min") || 0),
    cost: Number(data.get("cost") || 0),
    updatedAt: new Date().toISOString()
  };

  if (ui.editIngredientId) {
    db.ingredients = db.ingredients.map((item) => item.id === ui.editIngredientId ? { ...item, ...payload } : item);
    toast("Ingrediente actualizado.");
  } else {
    db.ingredients.push({ id: uid("ing"), ...payload });
    toast("Ingrediente agregado.");
  }

  ui.editIngredientId = null;
  saveDatabase();
  render();
}

function saveLedger(data) {
  db.ledger.push({
    id: uid("mov"),
    type: String(data.get("type")),
    date: String(data.get("date") || todayInput()),
    concept: String(data.get("concept") || "").trim(),
    category: String(data.get("category") || "General").trim() || "General",
    amount: Number(data.get("amount") || 0),
    paymentMethod: String(data.get("paymentMethod") || "efectivo"),
    notes: String(data.get("notes") || "").trim(),
    userId: currentUser()?.id || null,
    createdAt: new Date().toISOString()
  });
  saveDatabase();
  toast("Movimiento guardado.");
  render();
}

function recordSaleIncome(orderItem) {
  if (!orderItem || orderItem.paymentStatus === "pending" || orderItem.status === "cancelado") return;
  const movementId = `sale-${orderItem.id}`;
  const existing = db.ledger.find((item) => item.id === movementId || item.linkedOrderId === orderItem.id);
  const movement = {
    id: movementId,
    type: "income",
    date: dateInputFromTimestamp(orderItem.paidAt || orderItem.createdAt),
    concept: `Venta ${orderItem.ticket}`,
    category: "Ventas",
    amount: Number(orderItem.total || 0),
    paymentMethod: orderItem.paymentMethod || "efectivo",
    notes: "Ingreso generado automáticamente desde la venta.",
    userId: orderItem.userId || currentUser()?.id || null,
    createdAt: orderItem.paidAt || orderItem.createdAt || new Date().toISOString(),
    linkedOrderId: orderItem.id,
    voided: false
  };

  if (existing) Object.assign(existing, movement, { id: existing.id });
  else db.ledger.push(movement);
}

function setSaleIncomeVoided(orderId, voided) {
  const movement = db.ledger.find((item) => item.linkedOrderId === orderId);
  if (movement) movement.voided = voided;
}

function openCash(data) {
  if (cashSessionOpen()) {
    toast("Ya hay una caja abierta.");
    return;
  }

  db.cashSessions.push({
    id: uid("cash"),
    status: "open",
    openedAt: new Date().toISOString(),
    closedAt: null,
    openingCash: Number(data.get("openingCash") || 0),
    expectedCash: 0,
    closingCash: 0,
    difference: 0,
    notes: "",
    userId: currentUser()?.id || null
  });
  saveDatabase();
  toast("Caja abierta.");
  render();
}

function closeCash(data) {
  const open = cashSessionOpen();
  if (!open) return;

  const summary = cashSummary(open);
  const closingCash = Number(data.get("closingCash") || 0);
  open.status = "closed";
  open.closedAt = new Date().toISOString();
  open.expectedCash = summary.expectedCash;
  open.closingCash = closingCash;
  open.difference = closingCash - summary.expectedCash;
  open.notes = String(data.get("notes") || "").trim();
  saveDatabase();
  toast("Cierre de caja guardado.");
  render();
}

function saveUser(form, data) {
  const permissions = [...form.querySelectorAll("[data-user-permission]:checked")].map((box) => box.value);
  const payload = {
    name: String(data.get("name") || "").trim(),
    pin: String(data.get("pin") || "").trim(),
    role: String(data.get("role") || "cajero"),
    active: data.get("active") === "true",
    permissions
  };

  if (!permissions.length) {
    toast("Selecciona al menos un permiso.");
    return;
  }

  if (ui.editUserId) {
    db.users = db.users.map((item) => item.id === ui.editUserId ? { ...item, ...payload } : item);
    toast("Usuario actualizado.");
  } else {
    db.users.push({ id: uid("user"), ...payload });
    toast("Usuario agregado.");
  }

  ui.editUserId = null;
  saveDatabase();
  render();
}

function updateOrderStatus(id, status) {
  const orderItem = db.orders.find((item) => item.id === id);
  if (!orderItem) return;
  const wasCanceled = orderItem.status === "cancelado";
  const willCancel = status === "cancelado";

  if (status === "entregado" && orderItem.paymentStatus !== "paid" && orderItem.channel === "POS" && !cashSessionOpen()) {
    toast("Abre la caja antes de cobrar y cerrar esta orden.");
    setRoute("cash");
    return;
  }

  if (willCancel && orderItem.inventoryApplied) {
    restoreInventory(orderItem);
    orderItem.inventoryApplied = false;
  }

  if (wasCanceled && !willCancel && !orderItem.inventoryApplied) {
    deductInventory(orderItem);
    orderItem.inventoryApplied = true;
  }

  orderItem.status = status;
  if (status === "entregado") {
    orderItem.paymentStatus = "paid";
    orderItem.paidAt = orderItem.paidAt || new Date().toISOString();
    recordSaleIncome(orderItem);
  }
  setSaleIncomeVoided(orderItem.id, status === "cancelado");
  orderItem.updatedAt = new Date().toISOString();
  saveDatabase();
  toast("Pedido actualizado.");
  render();
}

function addToCart(cartName, productId) {
  const productItem = db.products.find((item) => item.id === productId && item.active);
  if (!productItem) return;
  const cart = currentCart(cartName);
  const existing = cart.find((line) => line.productId === productId);
  if (existing) existing.qty += 1;
  else cart.push({ productId, qty: 1, price: productItem.price, name: productItem.name });
  if (cartName === "posCart") savePosDrafts();
  toast(`${productItem.name} agregado.`);
}

function changeCartQty(cartName, productId, delta) {
  const cart = currentCart(cartName)
    .map((line) => line.productId === productId ? { ...line, qty: line.qty + delta } : line)
    .filter((line) => line.qty > 0);
  if (cartName === "posCart") {
    activePosDraft().cart = cart;
    savePosDrafts();
  } else {
    ui[cartName] = cart;
  }
}

function calculateCartTotals(cart) {
  const subtotal = cart.reduce((sum, line) => {
    const productItem = db.products.find((item) => item.id === line.productId);
    return sum + (productItem?.price || line.price || 0) * line.qty;
  }, 0);
  return { subtotal, total: subtotal };
}

function deductInventory(orderItem) {
  for (const line of orderItem.items) {
    const productItem = db.products.find((item) => item.id === line.productId);
    if (!productItem) continue;
    for (const recipeLine of productItem.recipe || []) {
      const ing = db.ingredients.find((item) => item.id === recipeLine.ingredientId);
      if (ing) {
        ing.stock = Math.max(0, Number(ing.stock || 0) - recipeLine.qty * line.qty);
        ing.updatedAt = new Date().toISOString();
      }
    }
  }
}

function restoreInventory(orderItem) {
  for (const line of orderItem.items) {
    const productItem = db.products.find((item) => item.id === line.productId);
    if (!productItem) continue;
    for (const recipeLine of productItem.recipe || []) {
      const ing = db.ingredients.find((item) => item.id === recipeLine.ingredientId);
      if (ing) {
        ing.stock = Number(ing.stock || 0) + recipeLine.qty * line.qty;
        ing.updatedAt = new Date().toISOString();
      }
    }
  }
}

function adjustStock(id, delta) {
  const ing = db.ingredients.find((item) => item.id === id);
  if (!ing) return;
  ing.stock = Math.max(0, Number(ing.stock || 0) + delta);
  ing.updatedAt = new Date().toISOString();
  saveDatabase();
  toast("Stock actualizado.");
}

function filteredProducts(category, search) {
  const query = (search || "").trim().toLowerCase();
  return db.products.filter((item) => {
    if (!item.active) return false;
    const matchesCategory = category === "Todos" || item.category === category;
    const matchesQuery = !query || `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });
}

function categories() {
  return ["Todos", ...new Set(db.products.map((item) => item.category).filter(Boolean))];
}

function currentUser() {
  return db.users.find((item) => item.id === db.session.currentUserId && item.active) || null;
}

function canAccess(routeId) {
  const user = currentUser();
  if (!user) return routeId === "menu";
  return (user.permissions || ROLE_PERMISSIONS[user.role] || []).includes(routeId);
}

function allowedRoutes() {
  const user = currentUser();
  if (!user) return [];
  return ROUTES.filter((route) => canAccess(route.id));
}

function firstAllowedRoute() {
  return allowedRoutes()[0]?.id || "dashboard";
}

function topbarSubtitle() {
  const subtitles = {
    dashboard: "Indicadores del dia, pedidos abiertos e inventario critico.",
    pos: "Cobra ventas de mostrador y descuenta ingredientes.",
    orders: "Seguimiento de pedidos por cocina, mostrador y WhatsApp.",
    products: "Administra platillos, precios y recetas.",
    inventory: "Control de ingredientes, minimos y costos.",
    finance: "Registra gastos e ingresos fuera de las ventas.",
    reports: "Consulta cortes diarios, semanales y mensuales.",
    cash: "Apertura y cierre de caja.",
    users: "Roles, PIN y permisos.",
    settings: "Datos del negocio y WhatsApp."
  };
  return subtitles[ui.route] || "";
}

function cloudStatusBadge() {
  if (!cloudConfig.enabled) return '<span class="badge warn">Local</span>';
  if (cloud.pending) return '<span class="badge warn">Guardando nube</span>';
  if (cloud.status === "connected") return '<span class="badge">Nube conectada</span>';
  if (cloud.status === "connecting") return '<span class="badge warn">Conectando nube</span>';
  if (cloud.status === "error") return '<span class="badge danger">Nube con error</span>';
  return '<span class="badge warn">Local</span>';
}

function notificationStatusControl() {
  if (!("Notification" in window)) return "";
  if (Notification.permission === "granted") {
    return '<span class="badge">Alertas activas</span>';
  }
  if (Notification.permission === "denied") {
    return '<span class="badge danger">Alertas bloqueadas</span>';
  }
  return `<button class="button" type="button" data-action="enable-alerts">${icon("bell")} Activar alertas</button>`;
}

function cashSessionOpen() {
  return db.cashSessions.find((item) => item.status === "open") || null;
}

function cashSummary(session) {
  const from = new Date(session.openedAt);
  const to = session.closedAt ? new Date(session.closedAt) : new Date();
  const orders = db.orders.filter((item) => {
    const date = new Date(item.paidAt || item.createdAt);
    return date >= from && date <= to && item.status !== "cancelado" && item.paymentStatus !== "pending";
  });
  const ledger = db.ledger.filter((item) => {
    const date = new Date(item.createdAt || item.date);
    return date >= from && date <= to && item.paymentMethod === "efectivo";
  });
  const cashSales = orders.filter((item) => item.paymentMethod === "efectivo").reduce((sum, item) => sum + item.total, 0);
  const cashIncome = ledger.filter((item) => item.type === "income" && !item.linkedOrderId && !item.voided).reduce((sum, item) => sum + item.amount, 0);
  const cashExpenses = ledger.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const expectedCash = Number(session.openingCash || 0) + cashSales + cashIncome - cashExpenses;
  return { cashSales, cashIncome, cashExpenses, expectedCash };
}

function calculateReport(startInput, endInput) {
  const start = startOfDay(new Date(startInput));
  const end = endOfDay(new Date(endInput));
  const orders = db.orders.filter((item) => {
    const date = new Date(item.paidAt || item.createdAt);
    return date >= start && date <= end && item.status !== "cancelado" && item.paymentStatus !== "pending";
  });
  const ledger = db.ledger.filter((item) => {
    const date = item.date ? new Date(`${item.date}T00:00:00`) : new Date(item.createdAt);
    return date >= start && date <= end;
  });

  const salesTotal = orders.reduce((sum, item) => sum + item.total, 0);
  const expenseTotal = ledger.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const manualIncomeTotal = ledger.filter((item) => item.type === "income" && !item.linkedOrderId && !item.voided).reduce((sum, item) => sum + item.amount, 0);
  const estimatedCost = orders.reduce((sum, orderItem) => sum + orderCost(orderItem), 0);
  const salesByPayment = groupSum(orders, "paymentMethod", "total");
  const topProducts = topProductsFromOrders(orders);
  const expensesByCategory = Object.entries(groupSum(ledger.filter((item) => item.type === "expense"), "category", "amount"))
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  return {
    salesTotal,
    expenseTotal,
    manualIncomeTotal,
    estimatedCost,
    netTotal: salesTotal + manualIncomeTotal - expenseTotal - estimatedCost,
    orderCount: orders.length,
    averageTicket: orders.length ? salesTotal / orders.length : 0,
    salesByPayment,
    topProducts,
    expensesByCategory
  };
}

function orderCost(orderItem) {
  return orderItem.items.reduce((sum, line) => {
    const productItem = db.products.find((item) => item.id === line.productId);
    if (!productItem) return sum;
    const productCost = (productItem.recipe || []).reduce((recipeSum, recipeLine) => {
      const ing = db.ingredients.find((item) => item.id === recipeLine.ingredientId);
      return recipeSum + (ing?.cost || 0) * recipeLine.qty;
    }, 0);
    return sum + productCost * line.qty;
  }, 0);
}

function topProductsFromOrders(orders) {
  const map = new Map();
  for (const orderItem of orders) {
    for (const line of orderItem.items) {
      const current = map.get(line.productId) || { name: line.name, qty: 0, total: 0 };
      current.qty += line.qty;
      current.total += line.qty * line.price;
      map.set(line.productId, current);
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);
}

function groupSum(items, key, amountKey) {
  return items.reduce((acc, item) => {
    const group = item[key] || "Sin categoria";
    acc[group] = (acc[group] || 0) + Number(item[amountKey] || 0);
    return acc;
  }, {});
}

function getPeriod(type, dateString) {
  const base = startOfDay(new Date(`${dateString}T00:00:00`));
  if (type === "week") {
    const day = base.getDay() || 7;
    const start = new Date(base);
    start.setDate(base.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }
  if (type === "month") {
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return { start, end };
  }
  return { start: base, end: base };
}

function lowStockIngredients() {
  return db.ingredients.filter((item) => Number(item.stock || 0) <= Number(item.min || 0));
}

async function enableOrderAlerts() {
  if (!("Notification" in window)) {
    toast("Este navegador no soporta notificaciones.");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    toast("Alertas activadas.");
    playOrderSound();
  } else {
    toast("Alertas no autorizadas.");
  }
  render();
}

function notifyNewOrders(orders) {
  if (!currentUser() || ui.route === "menu") return;

  const count = orders.length;
  const first = orders[0];
  const message = count === 1
    ? `Nuevo pedido ${first.ticket} de ${first.customerName}`
    : `${count} pedidos nuevos por WhatsApp`;

  toast(message);
  playOrderSound();
  showBrowserOrderNotification(first, count);

  const originalTitle = document.title;
  document.title = count === 1 ? `Nuevo pedido ${first.ticket}` : `${count} pedidos nuevos`;
  setTimeout(() => {
    document.title = originalTitle;
  }, 8000);
}

function showBrowserOrderNotification(orderItem, count) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const body = count === 1
    ? `${orderItem.customerName} - ${formatMoney(orderItem.total)}`
    : "Abre el POS para revisar la lista.";

  const notice = new Notification(count === 1 ? "Nuevo pedido por WhatsApp" : "Pedidos nuevos por WhatsApp", {
    body,
    tag: count === 1 ? orderItem.id : "foodtruck-new-orders",
    requireInteraction: true
  });

  notice.onclick = () => {
    window.focus();
    setRoute("orders");
    notice.close();
  };
}

function playOrderSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const gain = context.createGain();
    const first = context.createOscillator();
    const second = context.createOscillator();

    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.55);

    first.frequency.value = 880;
    second.frequency.value = 1175;
    first.type = "sine";
    second.type = "sine";

    first.connect(gain);
    second.connect(gain);
    gain.connect(context.destination);

    first.start();
    second.start(context.currentTime + 0.13);
    first.stop(context.currentTime + 0.35);
    second.stop(context.currentTime + 0.55);
    setTimeout(() => context.close(), 800);
  } catch {
    // Audio can be blocked until the user interacts with the page.
  }
}

function renderOrderSummary(orderItem) {
  return `
    <div class="order-row">
      <div>
        <strong>${escapeHtml(orderItem.ticket)} · ${escapeHtml(orderItem.customerName)}</strong>
        <div class="small muted">${formatDateTime(orderItem.createdAt)} · ${statusLabel(orderItem.status)}</div>
      </div>
      <strong>${formatMoney(orderItem.total)}</strong>
    </div>
  `;
}

function metric(label, value, note) {
  return `
    <article class="metric">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong class="metric-value">${escapeHtml(String(value))}</strong>
      <span class="metric-note">${escapeHtml(note)}</span>
    </article>
  `;
}

function emptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function emptyInline(text) {
  return `<span class="muted">${escapeHtml(text)}</span>`;
}

function openWhatsApp(orderItem) {
  const phone = normalizePhone(db.settings.whatsappNumber);
  if (!phone) {
    toast("Configura tu numero de WhatsApp en Ajustes.");
    return;
  }
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(orderMessage(orderItem))}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function orderMessage(orderItem) {
  const lines = [
    `Pedido ${orderItem.ticket} - ${db.settings.businessName}`,
    `Cliente: ${orderItem.customerName}`,
    orderItem.customerPhone ? `Telefono: ${orderItem.customerPhone}` : "",
    `Tipo: ${orderItem.orderType}`,
    orderItem.tableName ? `Mesa: ${orderItem.tableName}` : "",
    "",
    "Productos:",
    ...orderItem.items.map((line) => `- ${line.qty} x ${line.name} (${formatMoney(line.price * line.qty)})`),
    "",
    `Subtotal: ${formatMoney(orderItem.subtotal)}`,
    orderItem.discount ? `Descuento: ${formatMoney(orderItem.discount)}` : "",
    `Total: ${formatMoney(orderItem.total)}`,
    orderItem.notes ? `Notas: ${orderItem.notes}` : "",
    db.settings.address ? `Ubicacion: ${db.settings.address}` : ""
  ];
  return lines.filter(Boolean).join("\n");
}

function copyReport() {
  const period = getPeriod(ui.reportPeriod, ui.reportDate);
  const report = calculateReport(period.start, period.end);
  const text = [
    `Reporte ${periodLabel(ui.reportPeriod)} ${formatDate(period.start)} - ${formatDate(period.end)}`,
    `Ventas: ${formatMoney(report.salesTotal)}`,
    `Pedidos: ${report.orderCount}`,
    `Gastos: ${formatMoney(report.expenseTotal)}`,
    `Ingresos manuales: ${formatMoney(report.manualIncomeTotal)}`,
    `Costo estimado: ${formatMoney(report.estimatedCost)}`,
    `Utilidad estimada: ${formatMoney(report.netTotal)}`
  ].join("\n");

  if (!navigator.clipboard) {
    toast("Copia no disponible en este navegador.");
    return;
  }

  navigator.clipboard.writeText(text).then(
    () => toast("Resumen copiado."),
    () => toast("No se pudo copiar automaticamente.")
  );
}

function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `foodtruck-pos-${todayInput()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("Datos exportados.");
}

async function syncCloudNow() {
  if (!hasCloudConfig()) {
    toast("Configura Firebase primero.");
    return;
  }

  if (!cloud.connected) {
    await initializeCloud({ pushLocalIfEmpty: false });
  }

  try {
    await pushDatabaseToCloud();
    toast("Datos actuales subidos a Firebase.");
    render();
  } catch (error) {
    cloud = { ...cloud, connected: false, status: "error", error: error.message || "No se pudo subir a Firebase." };
    toast("No se pudo subir a Firebase.");
    render();
  }
}

async function refreshCloudNow() {
  if (!hasCloudConfig()) {
    toast("Configura Firebase primero.");
    return;
  }

  const previousCount = db.orders.length;
  await initializeCloud({ pushLocalIfEmpty: false });
  if (cloud.connected) {
    const addedCount = Math.max(0, db.orders.length - previousCount);
    const productCount = db.products.length;
    const categoryCount = categories().length - 1;
    toast(`Sincronización terminada: ${productCount} platos, ${categoryCount} categorías y ${addedCount} pedidos nuevos.`);
  } else {
    toast(`No se pudo cargar el historial de Firebase: ${cloud.error || "revisa la conexion y el Project ID en Ajustes."}`);
  }
  render();
}

function nextTicket() {
  const count = db.orders.length + 1;
  return `${db.settings.ticketPrefix || DEFAULT_SETTINGS.ticketPrefix}-${String(count).padStart(4, "0")}`;
}

function setRoute(route) {
  ui.route = route === "login" ? firstAllowedRoute() : route;
  setHash(ui.route, true);
  render();
}

function setHash(route, push) {
  if (supportsCleanRoutes()) {
    const value = route === "dashboard" ? "/" : `/${route}`;
    if (location.pathname === value && !location.hash) return;
    if (push) history.pushState(null, "", value);
    else history.replaceState(null, "", value);
    return;
  }

  const value = `#${route}`;
  if (location.hash === value) return;
  if (push) location.hash = value;
  else history.replaceState(null, "", value);
}

function getInitialRoute() {
  const hashRoute = location.hash.replace("#", "").replace("/", "");
  const pathRoute = location.pathname.split("/").filter(Boolean).pop() || "dashboard";
  const route = hashRoute || pathRoute;
  return [...ROUTES.map((item) => item.id), "menu"].includes(route) ? route : "dashboard";
}

function supportsCleanRoutes() {
  return location.protocol === "http:" || location.protocol === "https:";
}

function statusLabel(status) {
  const labels = {
    todos: "Todos",
    nuevo: "Nuevo",
    preparando: "Preparando",
    listo: "Listo",
    entregado: "Entregado",
    cancelado: "Cancelado"
  };
  return labels[status] || status;
}

function roleLabel(role) {
  const labels = {
    admin: "Administrador",
    cajero: "Caja",
    cocina: "Cocina",
    inventario: "Inventario"
  };
  return labels[role] || role;
}

function periodLabel(period) {
  return { day: "Diario", week: "Semanal", month: "Mensual" }[period] || period;
}

function formatMoney(value) {
  const currency = db.settings?.currency || "MXN";
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(value || 0));
  } catch {
    return `$${number(value)}`;
  }
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
}

function todayInput() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function dateInputFromTimestamp(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return todayInput();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function number(value) {
  return Number(value || 0).toLocaleString("es-MX", { maximumFractionDigits: 3 });
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "platillo";
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function initials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function toast(message) {
  toastNode.textContent = message;
  toastNode.classList.add("show");
  clearTimeout(toast.hideTimer);
  toast.hideTimer = setTimeout(() => toastNode.classList.remove("show"), 2400);
}

function restoreInputFocus(id, cursor) {
  requestAnimationFrame(() => {
    const next = document.getElementById(id);
    if (!next) return;
    next.focus();
    if (typeof cursor === "number") {
      next.setSelectionRange(cursor, cursor);
    }
  });
}

function icon(name) {
  const paths = {
    dashboard: '<path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"/>',
    cart: '<path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2ZM5.2 5l1.7 8.4A2 2 0 0 0 8.9 15h7.8a2 2 0 0 0 1.9-1.4L21 7H7.1L6.7 5H3V3h3a2 2 0 0 1 1.9 1.4Z"/>',
    ticket: '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a3 3 0 0 0 0 6v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4a3 3 0 0 0 0-6V5Zm8 1v12h2V6h-2Z"/>',
    phone: '<path d="M6.6 10.8c1.4 2.7 3.7 4.9 6.4 6.3l2.1-2.1c.3-.3.8-.4 1.2-.3 1 .3 2 .5 3.1.5.7 0 1.2.5 1.2 1.2v3.3c0 .7-.5 1.2-1.2 1.2C10.4 21 3 13.6 3 4.6 3 3.9 3.5 3.4 4.2 3.4h3.3c.7 0 1.2.5 1.2 1.2 0 1.1.2 2.1.5 3.1.1.4 0 .9-.3 1.2l-2.3 1.9Z"/>',
    dish: '<path d="M4 12a8 8 0 0 1 16 0H4Zm-2 3h20v2H2v-2Zm4 4h12v2H6v-2ZM11 2h2v3h-2V2Zm5.7 1.6 1.4 1.4-2.1 2.1-1.4-1.4 2.1-2.1ZM5.9 5 7.3 3.6l2.1 2.1L8 7.1 5.9 5Z"/>',
    box: '<path d="m12 2 9 4.8v10.4L12 22l-9-4.8V6.8L12 2Zm0 2.3L6.2 7.4 12 10.5l5.8-3.1L12 4.3ZM5 9.1v6.9l6 3.2v-6.9L5 9.1Zm8 10.1 6-3.2V9.1l-6 3.2v6.9Z"/>',
    wallet: '<path d="M4 5h14a2 2 0 0 1 2 2v2h-5a4 4 0 0 0 0 8h5v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm11 6h7v4h-7a2 2 0 0 1 0-4Zm0 3h1v-2h-1v2Z"/>',
    chart: '<path d="M4 19h17v2H2V3h2v16Zm3-2V9h3v8H7Zm5 0V5h3v12h-3Zm5 0v-6h3v6h-3Z"/>',
    cash: '<path d="M3 6h18v12H3V6Zm2 2v8h14V8H5Zm7 1a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-5 1h2v2H7v-2Zm8 4h2v2h-2v-2Z"/>',
    bell: '<path d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.7V3a2 2 0 1 0-4 0v1.3A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"/>',
    users: '<path d="M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0 2c3.3 0 6 1.7 6 3.8V20H3v-3.2C3 14.7 5.7 13 9 13Zm7.4-1.8A3.5 3.5 0 0 0 16 4.3a4.8 4.8 0 0 1 0 6.9h.4Zm.6 1.8c2.8.2 5 1.7 5 3.6V20h-5v-3.2c0-1.4-.7-2.7-2-3.8h2Z"/>',
    settings: '<path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2.6-1.5L14 2h-4l-.4 3a8 8 0 0 0-2.6 1.5l-2.4-1-2 3.5 2 1.5c-.1.5-.1 1-.1 1.5s0 1 .1 1.5l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2.6 1.5l.4 3h4l.4-3a8 8 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"/>',
    login: '<path d="M10 17v-3H3v-4h7V7l5 5-5 5Zm2-14h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7v-2h7V5h-7V3Z"/>',
    logout: '<path d="M14 7V4H5v16h9v-3h2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3h-2Zm-1 8v-2h8v-2h-8V9l-4 3 4 3Z"/>',
    plus: '<path d="M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8V3Z"/>',
    minus: '<path d="M4 11h16v2H4v-2Z"/>',
    check: '<path d="m9 16.2-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/>',
    x: '<path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5Z"/>',
    trash: '<path d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2H7ZM9 4h6l1 1h4v2H4V5h4l1-1Zm0 6v8h2v-8H9Zm4 0v8h2v-8h-2Z"/>',
    edit: '<path d="M4 17.2V21h3.8L18.9 9.9l-3.8-3.8L4 17.2ZM20.7 8.1c.4-.4.4-1 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0L15.5 5.7l3.8 3.8 1.4-1.4Z"/>',
    save: '<path d="M5 3h12l2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 2v5h10V5H6Zm2 12h8v-5H8v5Z"/>',
    copy: '<path d="M8 7h11v14H8V7Zm-3 9H3V3h11v2H5v11Z"/>',
    upload: '<path d="M11 21h2V11l3.5 3.5 1.4-1.4L12 7.2l-5.9 5.9 1.4 1.4L11 11v10ZM5 5h14V3H5v2Z"/>',
    download: '<path d="M11 3h2v10l3.5-3.5 1.4 1.4L12 16.8 6.1 10.9l1.4-1.4L11 13V3ZM5 19h14v2H5v-2Z"/>',
    refresh: '<path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.2L13 11h8V3l-3.3 3.3Z"/>'
  };

  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
      ${paths[name] || paths.dashboard}
    </svg>
  `;
}
