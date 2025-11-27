/********************
 * MR SmartService - app.js
 * Catálogo + Filtros + Carrito + Checkout MP + Admin + Footer + Ventas/Stats
 ********************/

/* ============== CONFIG ============== */
const host    = location.hostname;
const isLocal = host === 'localhost' || host === '127.0.0.1';

// Backend local vs producción (Render)
const API = isLocal
  ? 'http://localhost:8080/api'
  : 'https://mrsmartservice-backend.onrender.com/api';

// Origen base del backend (para servir /uploads/...)
const API_ORIGIN = API.replace(/\/api$/, '');

/* ============== HELPERS DE RUTA/SESIÓN ============== */
const isPage = (name) => {
  const url = new URL(location.href);
  return url.pathname.endsWith('/' + name) || url.pathname.endsWith(name);
};

const getToken   = () => localStorage.getItem('token') || '';
const setToken   = (t) => localStorage.setItem('token', t || '');
const clearToken = () => localStorage.removeItem('token');

const authHeaders = () => {
  const t = getToken();
  return t
    ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, opts);
  const text = await res.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }

  if (!res.ok) {
    const err = new Error(data?.error || `API ${res.status}: ${res.statusText}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const money = (n) => `$${Number(n||0).toLocaleString('es-CO')}`;

/* ============== DATOS con fallback ============== */
const LS_KEY = 'products_offline';
const MOCK = [
  { product_id: 1, name: "Torre Gamer",    price: 850000, stock: 10, discount_percent: 10, image_url: "images/banner1.jpg",  category: "computadoras" },
  { product_id: 2, name: "Monitor 27\"",   price: 450000, stock: 5,  discount_percent: 0,  image_url: "images/banner1.jpg",  category: "computadoras" },
  { product_id: 3, name: "Cámara IP",      price: 600000, stock: 8,  discount_percent: 5,  image_url: "images/banner1.jpg",  category: "camaras" },
  { product_id: 4, name: "Disco Duro 2TB", price: 320000, stock: 12, discount_percent: 0,  image_url: "images/banner1.jpg",  category: "componentes" },
];

const getOffline = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }
  catch { return null; }
};
const setOffline = (arr) => localStorage.setItem(LS_KEY, JSON.stringify(arr));

async function fetchProducts() {
  try {
    const r = await fetch(`${API}/products`, { cache: 'no-store' });
    if (!r.ok) throw new Error('api');
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('bad-shape');
    setOffline(data);
    return data;
  } catch {
    const local = getOffline();
    if (Array.isArray(local)) return local;
    setOffline(MOCK);
    return MOCK;
  }
}

/* ============== HOME: productos destacados ============== */
async function loadHomeProducts() {
  const wrap = document.getElementById('homeProducts');
  if (!wrap) return;
  const all = await fetchProducts();
  renderCatalog(all.slice(0, 8), wrap);
}

/* ============== HOME: categorías dinámicas ============== */
async function loadHomeCategories() {
  const wrap = document.getElementById('homeCategories');
  if (!wrap) return;

  const all = await fetchProducts();

  // Mapa categoría -> primera imagen encontrada
  const map = new Map();
  all.forEach(p => {
    const cat = (p.category || 'General').trim();
    if (!map.has(cat)) {
      map.set(cat, resolveImg(p.image_url));
    }
  });

  const cats = Array.from(map.entries()).slice(0, 8);

  wrap.innerHTML = cats.map(([cat, img]) => `
    <article class="home-cat-card" data-cat="${cat}">
      <div class="home-cat-thumb">
        ${img ? `<img src="${img}" alt="${cat}">` : ''}
      </div>
      <div class="home-cat-name">${cat}</div>
    </article>
  `).join('');

  wrap.querySelectorAll('.home-cat-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = (card.dataset.cat || '').toLowerCase();
      const url = new URL('productos.html', location.origin);
      url.searchParams.set('cat', cat);
      location.href = url.toString();
    });
  });
}

/* ============== CATÁLOGO (productos.html) ============== */
const unique = (arr) => [...new Set(arr)];
const debounce = (fn, ms = 300) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

/** Normaliza rutas de imágenes */
function resolveImg(url) {
  if (!url) return 'images/banner1.jpg';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return API_ORIGIN + url;
  return url;
}

function renderCatalog(items, into){
  into.innerHTML = items.map(p=>{
    const base  = Number(p.price) || 0;
    const desc  = Number(p.discount_percent) || 0;
    const final = Math.max(0, Math.round(base * (1 - desc/100)));
    const img   = resolveImg(p.image_url);

    return `
      <article class="card-producto">
        <img src="${img}" alt="${p.name}">
        <h3>${p.name}</h3>
        <div class="price">
          ${desc>0 ? `<del>${money(base)}</del>` : ''}
          <span>${money(final)}</span>
        </div>
        <div class="meta">${(p.category||'General')} ${desc>0 ? `• -${desc}%` : ''}</div>

        <div class="producto-actions">
          <button class="btn-add"
            data-id="${p.product_id}"
            data-name="${p.name}"
            data-price="${final}"
            data-img="${img}">
            Añadir
          </button>

          <a href="detalle-producto.html?id=${p.product_id}"
             class="btn-detalle">
            Ver detalle
          </a>
        </div>
      </article>`;
  }).join('');

  into.querySelectorAll('.btn-add').forEach(b=>{
    b.addEventListener('click', ()=>{
      addToCart({
        id: Number(b.dataset.id) || 0,
        nombre: b.dataset.name || 'Producto',
        precio: Number(b.dataset.price) || 0,
        imagen: b.dataset.img || ''
      });
      alert('Producto añadido al carrito');
    });
  });
}

async function loadCatalogPage(){
  const grid = document.getElementById('productos');
  if(!grid) return;

  const form = document.getElementById('filtrosProd') || document.getElementById('searchForm') || document;
  const all  = await fetchProducts();

  // Controles
  const selCat = document.getElementById('categoriaSelect');
  const q      = document.getElementById('q');
  const pmin   = document.getElementById('pmin') || document.getElementById('minPrice');
  const pmax   = document.getElementById('pmax') || document.getElementById('maxPrice');
  const solo   = document.getElementById('soloDesc') || document.getElementById('onlyDiscount');
  const orden  = document.getElementById('ordenSelect');

  // ?cat= desde el home
  const urlParams = new URLSearchParams(location.search);
  const urlCat = urlParams.get('cat');
  let initialCat = urlCat ? urlCat.toLowerCase() : 'todos';

  // Categorías
  if (selCat){
    const cats = ['todos', ...unique(all.map(p=> (p.category||'General').toLowerCase()))];
    selCat.innerHTML = cats.map(c=>`<option value="${c}">${c}</option>`).join('');

    if (urlCat) {
      const lower = urlCat.toLowerCase();
      const opt = Array.from(selCat.options).find(o => o.value.toLowerCase() === lower);
      if (opt) selCat.value = opt.value;
    }
  }

  const apply = ()=>{
    const txt  = (q?.value || '').trim().toLowerCase();
    const cat  = (selCat?.value || initialCat || 'todos').toLowerCase();
    initialCat = null;
    const min  = Number(pmin?.value);
    const max  = Number(pmax?.value);
    const dsc  = !!solo?.checked;
    const ord  = orden?.value || 'recent';

    let list = all.filter(p=>{
      const nameCat = `${p.name||''} ${(p.category||'').toLowerCase()}`.toLowerCase();
      if (txt && !nameCat.includes(txt)) return false;
      if (cat !== 'todos' && (p.category||'').toLowerCase() !== cat) return false;

      const base  = Number(p.price) || 0;
      const desc  = Number(p.discount_percent) || 0;
      const final = Math.max(0, Math.round(base * (1 - desc/100)));
      if (!Number.isNaN(min) && min>0 && final < min) return false;
      if (!Number.isNaN(max) && max>0 && final > max) return false;

      if (dsc && !(desc > 0)) return false;
      return true;
    });

    list.sort((a,b)=>{
      const pa = Math.round((Number(a.price)||0)*(1-(Number(a.discount_percent)||0)/100));
      const pb = Math.round((Number(b.price)||0)*(1-(Number(b.discount_percent)||0)/100));
      if (ord==='priceAsc')  return pa - pb;
      if (ord==='priceDesc') return pb - pa;
      if (ord==='nameAsc')   return String(a.name||'').localeCompare(String(b.name||''));
      return (Number(b.product_id)||0) - (Number(a.product_id)||0);
    });

    const empty = document.getElementById('prodEmpty');
    if (list.length){
      if (empty) empty.hidden = true;
      renderCatalog(list, grid);
    } else {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
    }
  };

  const deb = debounce(apply, 250);
  q?.addEventListener('input', deb);
  selCat?.addEventListener('change', apply);
  pmin?.addEventListener('input', deb);
  pmax?.addEventListener('input', deb);
  solo?.addEventListener('change', apply);
  orden?.addEventListener('change', apply);
  form.addEventListener('submit', (e)=>{ if(form.id) e.preventDefault(); apply(); });

  apply();
}

/* ============== CARRITO ============== */
let carrito;
try { carrito = JSON.parse(localStorage.getItem("carrito")) || []; }
catch { carrito = []; }

function guardarCarrito(){
  localStorage.setItem("carrito", JSON.stringify(carrito));
  actualizarContadorCarrito();
}
function actualizarContadorCarrito(){
  const el=document.getElementById("cart-count");
  if(el) el.textContent = carrito.reduce((a,b)=>a+(b.cant||1),0);
}

function addToCart(item){
  const i = carrito.findIndex(x => +x.id === +item.id);
  if (i===-1) carrito.push({...item, cant:1});
  else carrito[i].cant = (carrito[i].cant||1) + 1;
  guardarCarrito();
  if (document.getElementById("lista-carrito")) mostrarCarrito();
}

function mostrarCarrito(){
  const cont = document.getElementById("lista-carrito");
  const totalEl = document.getElementById("total");
  if(!cont || !totalEl) return;

  cont.innerHTML = '';
  let suma = 0;

  carrito.forEach((it, idx)=>{
    const sub = Number(it.precio) * (it.cant||1);
    suma += sub;
    cont.insertAdjacentHTML('beforeend', `
      <div class="cart-item">
        <img src="${it.imagen || 'https://via.placeholder.com/120'}" alt="">
        <div><h4>${it.nombre}</h4><div style="color:#888">ID: ${it.id}</div></div>
        <div class="qty">
          <button data-i="${idx}" data-op="minus">–</button>
          <strong>${it.cant||1}</strong>
          <button data-i="${idx}" data-op="plus">+</button>
        </div>
        <div>${money(sub)}</div>
        <button data-i="${idx}" data-op="del" title="Quitar">✕</button>
      </div>
    `);
  });

  totalEl.textContent = money(suma);

  cont.onclick = (e)=>{
    const i = +e.target.dataset.i;
    const op = e.target.dataset.op;
    if(Number.isNaN(i) || !op) return;
    if(op==='plus'){ carrito[i].cant = (carrito[i].cant||1)+1; }
    if(op==='minus'){ carrito[i].cant = Math.max(1,(carrito[i].cant||1)-1); }
    if(op==='del'){ carrito.splice(i,1); }
    guardarCarrito(); mostrarCarrito();
  };
}

/* ====== MP: iniciar checkout (redirigir a MP) ====== */
async function finalizarCompra() {
  if (!carrito.length) return alert("Tu carrito está vacío");

  const payload = {
    items: carrito.map(i => ({
      product_id: i.id ?? 0,
      title: i.nombre,
      unit_price: Number(i.precio) || 0,
      quantity: i.cant || 1,
      currency_id: 'COP'
    }))
  };

  try {
    const r = await fetch(`${API}/payments/create`, {
      method:'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (r.ok && data.init_point) {
      window.location.href = data.init_point;
      return;
    }
    console.error('MP create error:', data);
    alert('No pude iniciar el pago (API caída o llaves MP faltantes).');
  } catch (e) {
    console.error('Fetch error:', e);
    alert('No pude iniciar el pago (conexión fallida).');
  }
}

/* ============== LOGIN ============== */
async function doLogin(user, pass){
  const msg = document.getElementById('mensaje');
  if (msg) msg.textContent = '';

  try {
    const res = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ email: user, password: pass })
    });

    const data = await res.json().catch(()=> ({}));
    if (!res.ok || !data.token) {
      throw new Error(data.error || 'Error de login');
    }

    setToken(data.token);
    location.href = 'admin.html';
  } catch (e) {
    console.error(e);
    if (msg) msg.textContent = 'Usuario o contraseña incorrectos';
  }
}

/* ============== ADMIN (CRUD con API o LocalStorage) ============== */
async function adminLoadProducts(){
  const cards = document.getElementById('listaAdmin');
  const rows  = document.getElementById('rows');
  const data  = await fetchProducts();

  if (cards){
    cards.innerHTML = data.map(p=>{
      const img = p.image_url ? resolveImg(p.image_url)
        : 'https://via.placeholder.com/300x200?text=Producto';
      return `
      <div class="admin-card" data-id="${p.product_id}">
        <img src="${img}" alt="">
        <h3>${p.name}</h3>
        <p>Categoría: ${p.category||''}</p>
        <p>Precio: ${money(p.price)}</p>
        <p><strong>Stock:</strong> ${p.stock ?? 0}</p>
        <div class="botones">
          <button class="editar">Editar</button>
          <button class="eliminar">Eliminar</button>
        </div>
      </div>`;
    }).join('');

    cards.onclick = async (e)=>{
      const card = e.target.closest('.admin-card'); if(!card) return;
      const id   = +card.dataset.id;

      if(e.target.classList.contains('eliminar')){
        await delProd(id);
      }
      if(e.target.classList.contains('editar')){
        const currName  = card.querySelector('h3').textContent;
        const priceText = (card.querySelectorAll('p')[1]?.textContent||'').replace(/[^\d]/g,'');
        const stockText = (card.querySelector('p strong')?.parentElement?.textContent||'').replace(/[^\d]/g,'');

        const name  = prompt('Nombre:', currName);
        if (name===null) return;
        const price = Number(prompt('Precio ($):', Number(priceText))) || 0;
        const stock = Number(prompt('Stock:', Number(stockText))) || 0;

        await saveProd(id, { name, price, stock });
      }
    };
    return;
  }

  if (rows){
    rows.innerHTML = data.map(p=>`
      <tr data-id="${p.product_id}">
        <td>${p.product_id}</td>
        <td><input value="${p.name}" data-f="name" class="form-control form-control-sm"></td>
        <td><input type="number" value="${p.price}" data-f="price" class="form-control form-control-sm"></td>
        <td><input type="number" value="${p.stock}" data-f="stock" class="form-control form-control-sm"></td>
        <td><input type="number" value="${p.discount_percent||0}" data-f="discount_percent" class="form-control form-control-sm"></td>
        <td><input value="${p.category||''}" data-f="category" class="form-control form-control-sm"></td>
        <td><input value="${p.image_url||''}" data-f="image_url" class="form-control form-control-sm"></td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-primary btn-save">Guardar</button>
          <button class="btn btn-sm btn-danger btn-del">Eliminar</button>
        </td>
      </tr>`).join('');

    rows.onclick = async (e)=>{
      const tr = e.target.closest('tr'); if(!tr) return;
      const id = +tr.dataset.id;
      if(e.target.classList.contains('btn-del')) await delProd(id);
      if(e.target.classList.contains('btn-save')){
        const b = {};
        tr.querySelectorAll('input').forEach(i => b[i.dataset.f] = i.type==='number'? +i.value : i.value);
        await saveProd(id, b);
      }
    };
  }
}

async function createProd(body){
  try{
    const res = await fetch(`${API}/products`, {
      method:'POST', headers:authHeaders(), body:JSON.stringify(body)
    });
    if (!res.ok) throw new Error('api');
  }catch{
    const arr = getOffline() || [];
    const nextId = arr.length ? Math.max(...arr.map(p=>+p.product_id||0)) + 1 : 1;
    arr.unshift({
      product_id: nextId,
      name: body.name,
      price: Number(body.price)||0,
      stock: Number(body.stock)||0,
      discount_percent: Number(body.discount_percent)||0,
      image_url: body.image_url||'',
      category: body.category||'General',
      active: true
    });
    setOffline(arr);
  }
  adminLoadProducts();
}

async function saveProd(id, body){
  try{
    const res = await fetch(`${API}/products/${id}`, {
      method:'PUT', headers:authHeaders(), body:JSON.stringify(body)
    });
    if (!res.ok) throw new Error('api');
  }catch{
    const arr = getOffline() || [];
    const i = arr.findIndex(p => +p.product_id === +id);
    if (i !== -1) arr[i] = { ...arr[i], ...body };
    setOffline(arr);
  }
  adminLoadProducts();
}

async function delProd(id){
  if(!confirm('Eliminar producto?')) return;
  try{
    const res = await fetch(`${API}/products/${id}`, {
      method:'DELETE', headers:authHeaders()
    });
    if (!res.ok) throw new Error('api');
  }catch{
    const arr = (getOffline() || []).filter(p => +p.product_id !== +id);
    setOffline(arr);
  }
  adminLoadProducts();
}

async function uploadImage() {
  const fileInput = document.getElementById("imgFile");
  if (!fileInput || !fileInput.files.length) return null;

  const fd = new FormData();
  fd.append("image", fileInput.files[0]);

  const res = await fetch(API + "/upload", {
    method: "POST",
    headers: { Authorization: "Bearer " + getToken() },
    body: fd
  });

  if (!res.ok) {
    console.error("upload failed", await res.text());
    return null;
  }

  const out = await res.json();
  return out.url || null;
}

/* ============== UI/FLUJO GLOBAL ============== */
function bindHeaderButtons(){
  const adminBtn = document.getElementById('btnAdmin');
  if (adminBtn) {
    adminBtn.addEventListener('click', ()=>{
      if (getToken()) location.href = 'admin.html';
      else location.href = 'login.html';
    });
  }
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', ()=>{
    clearToken(); location.href='index.html';
  });
}

/* ========== SLIDER HOME: botones + puntos + auto ========== */
function initHeroSlider() {
  const slides = document.querySelectorAll('.slide');
  const dotsContainer = document.querySelector('.slider-dots');
  const btnPrev = document.querySelector('.slider-btn.prev');
  const btnNext = document.querySelector('.slider-btn.next');

  if (!slides.length || !dotsContainer || !btnPrev || !btnNext) return;

  let current = 0;
  let timer = null;

  dotsContainer.innerHTML = '';
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
    dot.type = 'button';
    dot.dataset.index = i;
    dotsContainer.appendChild(dot);
  });

  const dots = dotsContainer.querySelectorAll('.slider-dot');

  function goTo(index) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');

    current = (index + slides.length) % slides.length;

    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function resetTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(next, 5000);
  }

  btnNext.addEventListener('click', () => { next(); resetTimer(); });
  btnPrev.addEventListener('click', () => { prev(); resetTimer(); });

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const i = Number(dot.dataset.index || 0);
      goTo(i);
      resetTimer();
    });
  });

  resetTimer();
}

/* Admin: Tabs */
function initAdminTabs(){
  const tabs = document.querySelectorAll('.tab-btn');
  const panes = document.querySelectorAll('.tab-pane');
  if(!tabs.length) return;
  tabs.forEach(btn=>{
    btn.onclick = ()=>{
      tabs.forEach(b=>b.classList.remove('active'));
      panes.forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    };
  });
}

/* ============== FOOTER GLOBAL (para páginas que tengan #app-footer) ============== */
function injectFooter(){
  const mount = document.getElementById('app-footer');
  if(!mount) return;
  mount.innerHTML = `
  <footer class="footer">
    <div class="footer-container">
      <div class="footer-col">
        <h3>MR SmartService</h3>
        <p>Venta e instalación de equipos de cómputo, componentes, accesorios y cámaras de seguridad.</p>
      </div>
      <div class="footer-col">
        <h3>Contáctanos</h3>
        <p>Cra. 31 #37-32, Local 42 – C.C. Los Centauros</p>
        <p>+57 321 614 5781</p>
        <p>aaronmotta5@gmail.com</p>
      </div>
      <div class="footer-col">
        <h3>Síguenos</h3>
        <a href="#">Facebook</a>
        <a href="#">Instagram</a>
        <a href="https://wa.me/573216145781">WhatsApp</a>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2025 MR SmartService. Todos los derechos reservados.</p>
    </div>
  </footer>`;
}

/* ============== GUARD & DOM READY ============== */
if (isPage('admin.html') && !getToken()) {
  location.replace('login.html');
}

/************ Ventas – datos y render (real desde API) ************/
const fmtMoney = (n)=> `$${Number(n||0).toLocaleString('es-CO')}`;
const fmtDate  = (d)=> new Date(d).toLocaleDateString('es-CO');

async function fetchVentas(params = {}) {
  try {
    const qs = new URLSearchParams();
    if (params.estado && params.estado !== 'todos') qs.append('status', params.estado);
    if (params.q && params.q.trim()) qs.append('q', params.q.trim());
    if (params.desde) qs.append('from', params.desde);
    if (params.hasta) qs.append('to', params.hasta);

    const url = `/orders${qs.toString() ? '?' + qs.toString() : ''}`;
    const data = await apiFetch(url, {
      headers: authHeaders()
    });

    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('fetchVentas error, usando vacío:', e);
    return [];
  }
}

async function initVentasUI(){
  const form = document.getElementById('filtrosVentas');
  if (!form) return;

  const params = { q:'', estado:'todos', desde:'', hasta:'' };

  const run = async ()=>{
    const data = await fetchVentas(params);
    renderVentas(data, 1, 10);
  };

  form.addEventListener('submit', e=>{
    e.preventDefault();
    params.q      = document.getElementById('ventaQuery').value.trim();
    params.estado = document.getElementById('ventaEstado').value;
    params.desde  = document.getElementById('ventaDesde').value;
    params.hasta  = document.getElementById('ventaHasta').value;
    run();
  });

  run();
}

/************ Estadísticas – KPIs y barras (reales desde API) ************/
async function initStatsUI(){
  const sel = document.getElementById('statsRange');
  const btn = document.getElementById('btnStats');
  if (!sel || !btn) return;

  const run = async () => {
    const range = sel.value || 'month';

    try {
      const data = await apiFetch(`/stats/sales?range=${encodeURIComponent(range)}`, {
        headers: authHeaders()
      });

      renderKPIs({
        ingresos: data.ingresos || 0,
        ingresosDelta: 0,
        ordenes: data.ordenes || 0,
        ordenesDelta: 0,
        ticket: data.ticket || 0,
        ticketDelta: 0,
        rate: data.rate || 0,
        rateDelta: 0
      });

      renderMiniBars(data.series || []);
    } catch (e) {
      console.error('Error cargando stats:', e);
    }
  };

  btn.addEventListener('click', run);
  run();
}

/************ DETALLE DE PRODUCTO ************/
function initDetalleProducto() {
  const contenedor = document.getElementById('detalleProducto');
  if (!contenedor) return;

  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get('id') || 0);

  if (!id) {
    contenedor.innerHTML = '<p>Producto no encontrado.</p>';
    return;
  }

  fetchProducts().then(productos => {
    const p = productos.find(pr => pr.product_id === id);
    if (!p) {
      contenedor.innerHTML = '<p>Producto no disponible.</p>';
      return;
    }

    const img = resolveImg(p.image_url);
    const base  = Number(p.price) || 0;
    const desc  = Number(p.discount_percent) || 0;
    const final = Math.max(0, Math.round(base * (1 - desc/100)));

    contenedor.innerHTML = `
      <div class="detalle-img-box">
        <img src="${img}" alt="${p.name}">
      </div>
      <div class="detalle-info">
        <h1>${p.name}</h1>
        <div class="detalle-marca">${p.category || 'Tecnología MR SmartService'}</div>
        <div class="detalle-precio">${money(final)}</div>
        ${desc > 0 ? `<div class="detalle-cuotas">Precio anterior: <del>${money(base)}</del>  •  -${desc}% OFF</div>` : ''}
        <div class="detalle-cuotas">
          Hasta 12 cuotas con tus medios de pago favoritos.
        </div>

        <div class="detalle-actions">
          <button class="btn-primario" data-id="${p.product_id}" id="btnComprarAhora">
            Comprar ahora
          </button>
          <button class="btn-secundario" data-id="${p.product_id}" id="btnAgregarDetalle">
            Agregar al carrito
          </button>
        </div>

        <div class="detalle-extra">
          <p>Stock disponible: <strong>${p.stock ?? 0}</strong> unidades.</p>
          <p>Envíos y entregas coordinadas directamente con MR SmartService.</p>
        </div>
      </div>
    `;

    const btnAgregar = document.getElementById('btnAgregarDetalle');
    const btnComprar = document.getElementById('btnComprarAhora');

    if (btnAgregar) {
      btnAgregar.addEventListener('click', () => {
        addToCart({
          id: p.product_id,
          nombre: p.name,
          precio: final,
          imagen: img
        });
        actualizarContadorCarrito();
        alert('Producto agregado al carrito');
      });
    }

    if (btnComprar) {
      btnComprar.addEventListener('click', () => {
        addToCart({
          id: p.product_id,
          nombre: p.name,
          precio: final,
          imagen: img
        });
        actualizarContadorCarrito();
        window.location.href = 'carrito.html';
      });
    }
  });
}

/************ Cambio de contraseña admin (FRONT) ************/
function initChangePasswordForm() {
  const form = document.getElementById('formChangePassword');
  if (!form) return;

  const oldInput  = document.getElementById('oldPassword');
  const newInput  = document.getElementById('newPassword');
  const new2Input = document.getElementById('newPassword2');
  const msg       = document.getElementById('changePassMsg');

  const showMsg = (text, ok = false) => {
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = ok ? 'green' : 'red';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const oldPassword  = (oldInput.value || '').trim();
    const newPassword  = (newInput.value || '').trim();
    const newPassword2 = (new2Input.value || '').trim();

    if (!oldPassword || !newPassword || !newPassword2) {
      showMsg('Completa todos los campos.');
      return;
    }

    if (newPassword !== newPassword2) {
      showMsg('Las contraseñas nuevas no coinciden.');
      return;
    }

    if (newPassword.length < 8) {
      showMsg('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    try {
      const res = await fetch(API + '/users/change-password', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });

      const data = await res.json().catch(()=> ({}));

      if (!res.ok) {
        const code = data.error || 'change_password_failed';
        if (code === 'invalid_password') {
          showMsg('La contraseña actual no es correcta.');
        } else if (code === 'weak_password') {
          showMsg('La nueva contraseña es muy débil.');
        } else {
          showMsg('No se pudo actualizar la contraseña, intenta más tarde.');
        }
        return;
      }

      showMsg('Contraseña actualizada correctamente ✅', true);
      form.reset();
    } catch (err) {
      console.error('Error cambiando contraseña:', err);
      showMsg('Error de conexión al cambiar la contraseña.');
    }
  });
}

/* ============== DOM READY (ÚNICO) ============== */
document.addEventListener('DOMContentLoaded', ()=>{
  bindHeaderButtons();
  actualizarContadorCarrito();

  loadHomeProducts();
  loadHomeCategories();
  initHeroSlider();
  loadCatalogPage();
  initAdminTabs();

  if (document.getElementById("lista-carrito")) mostrarCarrito();

  const btnFin = document.getElementById("finalizarCompra");
  if (btnFin) btnFin.addEventListener("click", finalizarCompra);

  if (isPage('admin.html')) adminLoadProducts();

  const btnLogin = document.getElementById('btnLogin');
  if (btnLogin) btnLogin.addEventListener('click', ()=>{
    const user = (document.getElementById('usuario')||{}).value?.trim();
    const pass = (document.getElementById('password')||{}).value?.trim();
    doLogin(user, pass);
  });

  injectFooter();
  initVentasUI();
  initStatsUI();
  initDetalleProducto();
  initChangePasswordForm(); // 👈 aquí se engancha el formulario del admin
});
