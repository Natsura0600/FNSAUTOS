// ===== FNS Autos — sitio público =====
const WHATSAPP = "5492323585068"; // 2323 585068
const TIPOS = { auto: "Autos", suv: "SUV", pickup: "Pick-ups", utilitario: "Utilitarios", moto: "Motos" };
const TIPO = { auto: "Auto", suv: "SUV", pickup: "Pick-up", utilitario: "Utilitario", moto: "Moto" };

// Solo se usa si la API no responde (por ejemplo, abriendo el archivo sin servidor)
const RESPALDO = [
  { id: "taos", marca: "Volkswagen", modelo: "Taos", anio: 2024, km: 90000, tipo: "suv", fotos: ["img/taos.jpg"] },
  { id: "partner", marca: "Peugeot", modelo: "Partner", anio: 2026, km: 4000, tipo: "utilitario", fotos: ["img/partner.jpg"] },
  { id: "hilux", marca: "Toyota", modelo: "Hilux", anio: 2012, km: 270000, tipo: "pickup", fotos: ["img/hilux.jpg"] },
  { id: "308", marca: "Peugeot", modelo: "308", anio: 2017, km: 160000, tipo: "auto", fotos: ["img/308.jpg"] },
  { id: "aircross", marca: "Citroën", modelo: "C3 Aircross", anio: 2012, km: 150000, tipo: "suv", fotos: ["img/aircross.jpg"] },
].map((a) => ({ ...a, estado: "disponible", destacado: true }));

// ===== Helpers =====
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const km = (n) => Number(n || 0).toLocaleString("es-AR") + " km";
const pesos = (n) => "$ " + Number(n).toLocaleString("es-AR");
const wa = (msg) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
const nombre = (a) => `${a.marca} ${a.modelo} ${a.anio}`;
const msgAuto = (a) => a.estado === "vendido"
  ? `Hola FNS Autos! Vi que el ${nombre(a)} ya se vendió. ¿Tienen algo parecido?`
  : `Hola FNS Autos! Me interesa el ${nombre(a)} (${km(a.km)}). ¿Me pasan ${a.precio ? "" : "precio y "}opciones de pago?`;

let AUTOS = [];
const estado = { tipo: "todos", anioMin: 0, orden: "stock", todo: false };

// ===== Carga =====
async function cargar() {
  try {
    const r = await fetch("/api/autos");
    if (!r.ok) throw 0;
    AUTOS = (await r.json()).autos;
  } catch { AUTOS = RESPALDO; }
  AUTOS = AUTOS.map((a, i) => ({ ...a, _i: i }));
  armarSelects();
  armarTabs();
  render();
  vidriera();
}

function armarSelects() {
  const tipos = [...new Set(AUTOS.map((a) => a.tipo))].filter((t) => TIPOS[t]);
  $("#fTipo").innerHTML = `<option value="todos">Todos</option>` + tipos.map((t) => `<option value="${t}">${TIPOS[t]}</option>`).join("");
  const anios = [...new Set(AUTOS.map((a) => a.anio))].sort((a, b) => b - a);
  $("#fAnio").innerHTML = `<option value="0">Cualquiera</option>` + anios.map((y) => `<option value="${y}">${y}</option>`).join("");
  const vendibles = AUTOS.filter((a) => a.estado !== "vendido");
  $("#aAuto").innerHTML = `<option value="">Todavía no sé, quiero asesoramiento</option>` +
    vendibles.map((a) => `<option value="${esc(a.id)}">${esc(nombre(a))}</option>`).join("");
}

function armarTabs() {
  const n = (t) => AUTOS.filter((a) => t === "todos" || a.tipo === t).length;
  const tipos = ["todos", ...new Set(AUTOS.map((a) => a.tipo))].filter((t) => t === "todos" || TIPOS[t]);
  $("#tabs").innerHTML = tipos.length < 3 ? "" : tipos.map((t) =>
    `<button data-tipo="${t}" class="${estado.tipo === t ? "is-on" : ""}">${t === "todos" ? "Todo" : TIPOS[t]}<span>${n(t)}</span></button>`).join("");
}

// ===== Listado =====
function render() {
  const peso = { disponible: 0, reservado: 0, vendido: 1 };
  let lista = AUTOS.filter((a) => (estado.tipo === "todos" || a.tipo === estado.tipo) && a.anio >= estado.anioMin);

  const filtrando = estado.tipo !== "todos" || estado.anioMin > 0;
  const hayDestacados = AUTOS.some((a) => a.destacado);
  const recortar = !estado.todo && !filtrando && hayDestacados && estado.orden === "stock";
  const total = lista.length;
  if (recortar) lista = lista.filter((a) => a.destacado);

  lista.sort((x, y) => (peso[x.estado] ?? 0) - (peso[y.estado] ?? 0) ||
    (estado.orden === "nuevo" ? y.anio - x.anio : estado.orden === "km" ? x.km - y.km : x._i - y._i));

  const disp = AUTOS.filter((a) => a.estado !== "vendido").length;
  $("#count").textContent = filtrando ? `${total} ${total === 1 ? "unidad encontrada" : "unidades encontradas"}` : `${disp} unidades disponibles en el salón`;

  $("#list").innerHTML = lista.length ? lista.map(ficha).join("")
    : `<p class="list__empty">No hay unidades con ese filtro. <a href="${wa("Hola FNS Autos! Estoy buscando un auto, ¿qué tienen?")}" target="_blank" rel="noopener">Contanos qué buscás</a> y te avisamos cuando entre.</p>`;

  $("#moreWrap").hidden = !recortar || total === lista.length;
  $("#more").textContent = `Ver todo el stock (${total})`;
}

function ficha(a) {
  const flag = a.estado === "reservado" ? `<span class="unit__flag">Reservado</span>` : a.estado === "vendido" ? `<span class="unit__flag">Vendido</span>` : "";
  return `
  <article class="unit unit--${esc(a.estado)}">
    <div class="unit__pic" data-open="${esc(a.id)}">
      ${a.fotos?.[0] ? `<img src="${esc(a.fotos[0])}" alt="${esc(nombre(a))}" loading="lazy" />` : ""}
      ${flag}
      ${a.fotos?.length > 1 ? `<span class="unit__n">${a.fotos.length} fotos</span>` : ""}
    </div>
    <div class="unit__body">
      <span class="unit__brand">${esc(a.marca)}</span>
      <h3 class="unit__model">${esc(a.modelo)}</h3>
      <dl class="unit__specs">
        <div><dt>Año</dt><dd>${esc(a.anio)}</dd></div>
        <div><dt>Kilómetros</dt><dd>${Number(a.km || 0).toLocaleString("es-AR")}</dd></div>
        <div><dt>Tipo</dt><dd>${TIPO[a.tipo] || "-"}</dd></div>
      </dl>
      ${a.precio && a.estado !== "vendido" ? `<p class="unit__price">${pesos(a.precio)}</p>` : ""}
    </div>
    <div class="unit__foot">
      <a href="${wa(msgAuto(a))}" target="_blank" rel="noopener">${a.estado === "vendido" ? "Buscar uno similar" : "Consultar por WhatsApp"}</a>
      <button data-open="${esc(a.id)}">Ver ficha</button>
    </div>
  </article>`;
}

$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tipo]");
  if (!b) return;
  estado.tipo = b.dataset.tipo;
  $("#fTipo").value = estado.tipo;
  armarTabs(); render();
});
$("#orden").addEventListener("change", (e) => { estado.orden = e.target.value; render(); });
$("#more").addEventListener("click", () => { estado.todo = true; render(); });

$("#finder").addEventListener("submit", (e) => {
  e.preventDefault();
  estado.tipo = $("#fTipo").value;
  estado.anioMin = Number($("#fAnio").value);
  armarTabs(); render();
  $("#stock").scrollIntoView();
});

// ===== Vidriera de la portada (rota entre destacados) =====
let vIdx = 0, vTimer;
function vidriera() {
  const v = AUTOS.filter((a) => a.estado !== "vendido" && a.fotos?.length).sort((x, y) => (y.destacado ? 1 : 0) - (x.destacado ? 1 : 0)).slice(0, 5);
  if (!v.length) return;
  $("#showDots").innerHTML = v.length > 1 ? v.map((_, i) => `<button data-v="${i}" aria-label="Unidad ${i + 1}"></button>`).join("") : "";
  const mostrar = (i) => {
    vIdx = (i + v.length) % v.length;
    const a = v[vIdx], img = $("#showImg");
    img.classList.add("is-fading");
    setTimeout(() => {
      img.src = a.fotos[0];
      img.alt = nombre(a);
      $("#showBrand").textContent = a.marca;
      $("#showName").textContent = a.modelo;
      $("#showSpecs").textContent = `${a.anio} · ${km(a.km)}`;
      $("#showPlate").onclick = (e) => { e.preventDefault(); abrir(a.id); };
      img.classList.remove("is-fading");
    }, 250);
    document.querySelectorAll("#showDots button").forEach((b, j) => b.classList.toggle("is-on", j === vIdx));
  };
  $("#showDots").onclick = (e) => {
    const b = e.target.closest("[data-v]");
    if (b) { mostrar(Number(b.dataset.v)); reiniciar(); }
  };
  const reiniciar = () => { clearInterval(vTimer); if (v.length > 1) vTimer = setInterval(() => mostrar(vIdx + 1), 5000); };
  mostrar(0); reiniciar();
}

// ===== Ficha con galería =====
const sheet = $("#sheet");
let fotos = [], fIdx = 0;
function foto(i) {
  if (!fotos.length) return;
  fIdx = (i + fotos.length) % fotos.length;
  $("#sImg").src = fotos[fIdx];
  $("#gN").textContent = fotos.length > 1 ? `${fIdx + 1} / ${fotos.length}` : "";
  document.querySelectorAll("#gThumbs button").forEach((b, j) => b.classList.toggle("is-on", j === fIdx));
}
function abrir(id) {
  const a = AUTOS.find((x) => String(x.id) === String(id));
  if (!a) return;
  fotos = a.fotos || [];
  $("#gPrev").hidden = $("#gNext").hidden = fotos.length < 2;
  $("#gThumbs").innerHTML = fotos.length > 1 ? fotos.map((f, i) => `<button data-f="${i}" aria-label="Foto ${i + 1}"><img src="${esc(f)}" alt="" loading="lazy" /></button>`).join("") : "";
  foto(0);
  $("#sImg").alt = nombre(a);
  $("#sBrand").textContent = a.marca;
  $("#sTitle").textContent = a.modelo;
  const precio = a.estado === "vendido" ? "Vendido" : a.precio ? pesos(a.precio) : "Consultar";
  $("#sSpec").innerHTML = `
    <tr><th>Año</th><td>${esc(a.anio)}</td></tr>
    <tr><th>Kilometraje</th><td>${km(a.km)}</td></tr>
    <tr><th>Tipo</th><td>${TIPO[a.tipo] || "-"}</td></tr>
    ${a.estado === "reservado" ? `<tr><th>Estado</th><td>Reservado</td></tr>` : ""}
    <tr><th>Precio</th><td>${esc(precio)}</td></tr>`;
  $("#sDesc").textContent = a.descripcion || "";
  const link = $("#sWa");
  link.href = wa(msgAuto(a));
  link.target = "_blank";
  link.textContent = a.estado === "vendido" ? "Buscar uno similar" : "Consultar esta unidad";
  sheet.classList.add("is-open");
  sheet.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function cerrar() {
  sheet.classList.remove("is-open");
  sheet.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
document.addEventListener("click", (e) => {
  const o = e.target.closest("[data-open]");
  if (o) abrir(o.dataset.open);
  const t = e.target.closest("[data-f]");
  if (t) foto(Number(t.dataset.f));
  if (e.target.closest("[data-close]")) cerrar();
});
$("#gPrev").addEventListener("click", () => foto(fIdx - 1));
$("#gNext").addEventListener("click", () => foto(fIdx + 1));
document.addEventListener("keydown", (e) => {
  if (!sheet.classList.contains("is-open")) return;
  if (e.key === "Escape") cerrar();
  if (e.key === "ArrowLeft") foto(fIdx - 1);
  if (e.key === "ArrowRight") foto(fIdx + 1);
});
let x0 = null;
$(".gallery__main").addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
$(".gallery__main").addEventListener("touchend", (e) => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0;
  if (Math.abs(dx) > 40) foto(fIdx + (dx < 0 ? 1 : -1));
  x0 = null;
});

// ===== Formulario de consulta → WhatsApp =====
$("#aPago").addEventListener("change", (e) => { $("#trade").hidden = e.target.value !== "Parte en usado"; });
$("#askForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const a = AUTOS.find((x) => String(x.id) === $("#aAuto").value);
  const pago = $("#aPago").value;
  let m = `Hola FNS Autos! Soy ${$("#aNombre").value.trim()}.`;
  m += a ? ` Me interesa el ${nombre(a)} (${km(a.km)}).` : " Estoy buscando un auto y quería asesoramiento.";
  m += ` Forma de pago: ${pago.toLowerCase()}.`;
  if (pago === "Parte en usado") {
    const u = [$("#uModelo").value.trim(), $("#uAnio").value.trim(), $("#uKm").value.trim() && `${$("#uKm").value.trim()} km`].filter(Boolean).join(", ");
    if (u) m += ` Entrego: ${u}.`;
  }
  window.open(wa(m), "_blank", "noopener");
});

// ===== Links de WhatsApp genéricos =====
document.querySelectorAll(".js-wa").forEach((el) => {
  el.href = wa(el.dataset.msg || "Hola FNS Autos!");
  el.target = "_blank";
  el.rel = "noopener";
});

// ===== Menú mobile =====
const burger = $("#burger"), menu = $("#menu");
burger.addEventListener("click", () => {
  const abierto = menu.classList.toggle("is-open");
  burger.setAttribute("aria-expanded", abierto);
});
menu.querySelectorAll("a").forEach((l) => l.addEventListener("click", () => {
  menu.classList.remove("is-open");
  burger.setAttribute("aria-expanded", "false");
}));

$("#year").textContent = new Date().getFullYear();
cargar();
