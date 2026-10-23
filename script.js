// ===== Configuración =====
const WHATSAPP = "5492323585068"; // 2323 585068
const TIPOS = { auto: "Autos", suv: "SUV", pickup: "Pick-ups", utilitario: "Utilitarios", moto: "Motos" };
const TIPO_1 = { auto: "Auto", suv: "SUV", pickup: "Pick-up", utilitario: "Utilitario", moto: "Moto" };

// Se usa solo si la API no responde (por ejemplo, abriendo el archivo sin servidor)
const RESPALDO = [
  { id: "taos", marca: "Volkswagen", modelo: "Taos", anio: 2024, km: 90000, tipo: "suv", fotos: ["img/taos.jpg"] },
  { id: "partner", marca: "Peugeot", modelo: "Partner", anio: 2026, km: 4000, tipo: "utilitario", fotos: ["img/partner.jpg"] },
  { id: "hilux", marca: "Toyota", modelo: "Hilux", anio: 2012, km: 270000, tipo: "pickup", fotos: ["img/hilux.jpg"] },
  { id: "308", marca: "Peugeot", modelo: "308", anio: 2017, km: 160000, tipo: "auto", fotos: ["img/308.jpg"] },
  { id: "aircross", marca: "Citroën", modelo: "C3 Aircross", anio: 2012, km: 150000, tipo: "suv", fotos: ["img/aircross.jpg"] },
].map((a) => ({ ...a, estado: "disponible", destacado: true }));

// ===== Helpers =====
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtKm = (n) => Number(n || 0).toLocaleString("es-AR") + " km";
const fmtPrecio = (n) => "$ " + Number(n).toLocaleString("es-AR");
const waLink = (msg) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
const nombre = (a) => `${a.marca} ${a.modelo} ${a.anio}`;
const consulta = (a) => a.estado === "vendido"
  ? `Hola FNS Autos! Vi que vendieron el ${nombre(a)}. ¿Tienen algo parecido?`
  : `Hola FNS Autos! Vi en la web el ${nombre(a)} (${fmtKm(a.km)}) y quería consultar ${a.precio ? "" : "precio y "}formas de pago.`;

let AUTOS = [];
let filtro = "todos";
let verTodo = false;

// ===== Carga del stock =====
async function cargarAutos() {
  try {
    const r = await fetch("/api/autos");
    if (!r.ok) throw new Error();
    AUTOS = (await r.json()).autos;
  } catch {
    AUTOS = RESPALDO;
  }
  // Disponibles y reservados primero, vendidos al final
  const peso = { disponible: 0, reservado: 0, vendido: 1 };
  AUTOS = AUTOS.map((a, i) => ({ ...a, _i: i })).sort((x, y) => (peso[x.estado] ?? 0) - (peso[y.estado] ?? 0) || x._i - y._i);
  renderFiltros();
  render();
}

function renderFiltros() {
  const tipos = [...new Set(AUTOS.map((a) => a.tipo))].filter((t) => TIPOS[t]);
  document.getElementById("filters").innerHTML = tipos.length < 2 ? "" :
    `<button class="filter is-active" data-filter="todos">Todos</button>` +
    tipos.map((t) => `<button class="filter" data-filter="${t}">${TIPOS[t]}</button>`).join("");
}

function render() {
  const hayDestacados = AUTOS.some((a) => a.destacado);
  let lista = AUTOS.filter((a) => filtro === "todos" || a.tipo === filtro);
  const ocultos = verTodo || filtro !== "todos" || !hayDestacados ? 0 : lista.filter((a) => !a.destacado).length;
  if (ocultos) lista = lista.filter((a) => a.destacado);

  const grid = document.getElementById("grid");
  grid.innerHTML = lista.length ? lista.map(card).join("") :
    `<p class="empty-stock">Estamos renovando el stock. Escribinos y te contamos qué hay disponible.</p>`;

  const wrap = document.getElementById("showAllWrap");
  wrap.hidden = !ocultos;
  document.getElementById("showAll").textContent = `Ver todo el stock (${AUTOS.length})`;

  grid.querySelectorAll(".reveal").forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; io.observe(el); });
}

function card(a) {
  const foto = a.fotos?.[0] || "";
  const estado = a.estado === "reservado" ? `<span class="card__state">Reservado</span>`
    : a.estado === "vendido" ? `<span class="card__state">Vendido</span>` : "";
  const boton = a.estado === "vendido"
    ? `<a class="btn btn--muted" href="${waLink(consulta(a))}" target="_blank" rel="noopener">Buscar uno similar</a>`
    : `<a class="btn btn--wa" href="${waLink(consulta(a))}" target="_blank" rel="noopener">Consultar por WhatsApp</a>`;
  return `
  <article class="card reveal card--${esc(a.estado)}">
    <div class="card__media" data-open="${esc(a.id)}">
      ${foto ? `<img src="${esc(foto)}" alt="${esc(nombre(a))}" loading="lazy" />` : ""}
      <span class="card__tag">${esc(a.anio)}</span>
      ${estado}
      ${a.fotos?.length > 1 ? `<span class="card__photos">📷 ${a.fotos.length}</span>` : ""}
    </div>
    <div class="card__body">
      <div>
        <p class="card__brand">${esc(a.marca)}</p>
        <h3 class="card__name">${esc(a.modelo)}</h3>
      </div>
      <ul class="card__data">
        <li>Año <b>${esc(a.anio)}</b></li>
        <li><b>${fmtKm(a.km)}</b></li>
        <li>${TIPO_1[a.tipo] || ""}</li>
      </ul>
      ${a.precio ? `<p class="card__price">${fmtPrecio(a.precio)}</p>` : ""}
      <div class="card__actions">
        ${boton}
        <button class="btn btn--detail" data-open="${esc(a.id)}" aria-label="Ver detalle">Ver</button>
      </div>
    </div>
  </article>`;
}

document.getElementById("filters").addEventListener("click", (e) => {
  const btn = e.target.closest(".filter");
  if (!btn) return;
  document.querySelectorAll(".filter").forEach((b) => b.classList.toggle("is-active", b === btn));
  filtro = btn.dataset.filter;
  render();
});
document.getElementById("showAll").addEventListener("click", () => { verTodo = true; render(); });

// ===== Links de WhatsApp genéricos =====
document.querySelectorAll(".js-wa").forEach((el) => {
  el.href = waLink(el.dataset.msg || "Hola FNS Autos!");
  el.target = "_blank";
  el.rel = "noopener";
});

// ===== Modal con galería =====
const modal = document.getElementById("modal");
let galeria = [], fotoActual = 0;

function mostrarFoto(i) {
  if (!galeria.length) return;
  fotoActual = (i + galeria.length) % galeria.length;
  document.getElementById("modalImg").src = galeria[fotoActual];
  document.getElementById("galCount").textContent = galeria.length > 1 ? `${fotoActual + 1} / ${galeria.length}` : "";
  document.querySelectorAll("#galThumbs button").forEach((b, j) => b.classList.toggle("is-active", j === fotoActual));
}

function openModal(id) {
  const a = AUTOS.find((x) => String(x.id) === id);
  if (!a) return;
  galeria = a.fotos || [];
  const multi = galeria.length > 1;
  document.getElementById("galPrev").hidden = document.getElementById("galNext").hidden = !multi;
  document.getElementById("galThumbs").innerHTML = multi
    ? galeria.map((f, i) => `<button data-foto="${i}" aria-label="Foto ${i + 1}"><img src="${esc(f)}" alt="" loading="lazy" /></button>`).join("") : "";
  mostrarFoto(0);
  document.getElementById("modalImg").alt = nombre(a);
  document.getElementById("modalType").textContent = `${a.marca} · ${TIPO_1[a.tipo] || ""}`;
  document.getElementById("modalTitle").textContent = a.modelo;
  const precio = a.estado === "vendido" ? "Vendido" : a.precio ? fmtPrecio(a.precio) : "Consultar";
  document.getElementById("modalSpecs").innerHTML = `
    <li><span>Marca</span>${esc(a.marca)}</li>
    <li><span>Modelo</span>${esc(a.modelo)}</li>
    <li><span>Año</span>${esc(a.anio)}</li>
    <li><span>Kilometraje</span>${fmtKm(a.km)}</li>
    ${a.estado === "reservado" ? `<li><span>Estado</span>Reservado</li>` : ""}
    <li><span>Precio</span>${esc(precio)}</li>`;
  document.getElementById("modalDesc").textContent = a.descripcion || "";
  const wa = document.getElementById("modalWa");
  wa.href = waLink(consulta(a));
  wa.target = "_blank";
  wa.textContent = a.estado === "vendido" ? "Buscar uno similar" : "Consultar por este auto";
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
document.addEventListener("click", (e) => {
  const opener = e.target.closest("[data-open]");
  if (opener) openModal(opener.dataset.open);
  const t = e.target.closest("[data-foto]");
  if (t) mostrarFoto(Number(t.dataset.foto));
  if (e.target.closest("[data-close]")) closeModal();
});
document.getElementById("galPrev").addEventListener("click", () => mostrarFoto(fotoActual - 1));
document.getElementById("galNext").addEventListener("click", () => mostrarFoto(fotoActual + 1));
document.addEventListener("keydown", (e) => {
  if (!modal.classList.contains("is-open")) return;
  if (e.key === "Escape") closeModal();
  if (e.key === "ArrowLeft") mostrarFoto(fotoActual - 1);
  if (e.key === "ArrowRight") mostrarFoto(fotoActual + 1);
});
// Deslizar con el dedo en el celu
let x0 = null;
document.querySelector(".gallery__main").addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
document.querySelector(".gallery__main").addEventListener("touchend", (e) => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0;
  if (Math.abs(dx) > 40) mostrarFoto(fotoActual + (dx < 0 ? 1 : -1));
  x0 = null;
});

// ===== Menú mobile =====
const burger = document.getElementById("burger");
const nav = document.getElementById("nav");
burger.addEventListener("click", () => {
  burger.classList.toggle("is-open");
  nav.classList.toggle("is-open");
});
nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
  burger.classList.remove("is-open");
  nav.classList.remove("is-open");
}));

// ===== Header al hacer scroll =====
const header = document.getElementById("header");
const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 40);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ===== Animaciones de aparición =====
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
  });
}, { threshold: 0.08 });
document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 80}ms`;
  io.observe(el);
});

document.getElementById("year").textContent = new Date().getFullYear();
cargarAutos();
