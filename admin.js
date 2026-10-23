// ===== Panel de administración FNS Autos =====
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => Number(String(v ?? "").replace(/\D/g, "")) || 0;
const miles = (n) => (n ? Number(n).toLocaleString("es-AR") : "");
const TIPOS = { auto: "Auto", suv: "SUV", pickup: "Pick-up", utilitario: "Utilitario", moto: "Moto" };
const ESTADOS = { disponible: "Disponible", reservado: "Reservado", vendido: "Vendido", oculto: "Oculto" };

let autos = [];
let filtro = "todos";
let editando = null;      // copia del auto que se está editando
let subidasNuevas = [];   // fotos subidas en esta edición (se borran si se cancela)
let subiendo = 0;

// ---------- API ----------
async function api(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.includes("login")) { showLogin(); throw new Error("Tu sesión venció, ingresá de nuevo"); }
  if (!res.ok) throw new Error(data.error || "Algo salió mal, probá de nuevo");
  return data;
}

function toast(msg, error = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("is-error", error);
  t.classList.add("is-show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("is-show"), 2600);
}

// ---------- Login ----------
function showLogin() { $("#viewPanel").hidden = true; $("#viewLogin").hidden = false; closeEditor(true); }
async function showPanel() {
  $("#viewLogin").hidden = true; $("#viewPanel").hidden = false;
  try { autos = (await api("/api/autos?admin=1")).autos; render(); }
  catch (e) { toast(e.message, true); }
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector("button");
  $("#loginError").textContent = "";
  btn.disabled = true;
  try {
    await api("/api/login", { method: "POST", body: { user: f.user.value, pass: f.pass.value } });
    f.reset();
    showPanel();
  } catch (err) { $("#loginError").textContent = err.message; }
  btn.disabled = false;
});

$("#logout").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  showLogin();
});

// ---------- Guardar lista ----------
async function guardar(lista, okMsg = "Guardado ✓") {
  const anterior = autos;
  autos = lista; render();
  try {
    autos = (await api("/api/autos", { method: "PUT", body: { autos: lista } })).autos;
    render(); toast(okMsg);
    return true;
  } catch (e) {
    autos = anterior; render(); toast(e.message, true);
    return false;
  }
}

// ---------- Lista ----------
function render() {
  const c = { disponible: 0, reservado: 0, vendido: 0, oculto: 0 };
  autos.forEach((a) => c[a.estado]++);
  $("#stats").textContent = `${c.disponible} disponibles · ${c.reservado} reservados · ${c.vendido} vendidos`;

  const visibles = autos.map((a, i) => ({ a, i })).filter(({ a }) => filtro === "todos" || a.estado === filtro);
  $("#empty").hidden = visibles.length > 0;
  $("#list").innerHTML = visibles.map(({ a, i }) => `
    <li class="item" data-i="${i}">
      <div class="item__thumb" data-act="edit">${a.fotos?.[0] ? `<img src="${esc(a.fotos[0])}" alt="" loading="lazy" />` : "🚗"}</div>
      <div class="item__info" data-act="edit">
        <p class="item__name">${esc(a.marca)} ${esc(a.modelo)}</p>
        <p class="item__meta">${esc(a.anio)} · ${miles(a.km) || 0} km${a.precio ? ` · $${miles(a.precio)}` : ""}</p>
        <div class="item__badges">
          <span class="badge badge--${a.estado}">${ESTADOS[a.estado]}</span>
          ${a.destacado ? `<span class="badge badge--star">★ Destacado</span>` : ""}
          ${a.mostrarPrecio ? `<span class="badge">Precio visible</span>` : ""}
        </div>
      </div>
      <div class="item__actions">
        <button class="icon-btn ${a.destacado ? "is-on" : ""}" data-act="star" title="Destacado">★</button>
        <div class="order">
          <button class="icon-btn" data-act="up" title="Subir" ${i === 0 ? "disabled" : ""}>▲</button>
          <button class="icon-btn" data-act="down" title="Bajar" ${i === autos.length - 1 ? "disabled" : ""}>▼</button>
        </div>
        <button class="btn btn--ghost btn--sm" data-act="edit">Editar</button>
      </div>
    </li>`).join("");
}

$("#list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const i = Number(btn.closest(".item").dataset.i);
  const lista = autos.map((a) => ({ ...a }));
  switch (btn.dataset.act) {
    case "edit": return openEditor(autos[i]);
    case "star":
      lista[i].destacado = !lista[i].destacado;
      return guardar(lista, lista[i].destacado ? "Agregado a destacados ★" : "Quitado de destacados");
    case "up": case "down": {
      const j = btn.dataset.act === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= lista.length) return;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return guardar(lista, "Orden actualizado");
    }
  }
});

$("#tabs").addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (!t) return;
  filtro = t.dataset.f;
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("is-active", x === t));
  render();
});

// ---------- Editor ----------
const form = $("#editor");

function openEditor(auto) {
  const nuevo = !auto;
  editando = auto ? structuredClone(auto) : {
    id: "", marca: "", modelo: "", anio: new Date().getFullYear(), km: 0, tipo: "auto",
    precio: 0, mostrarPrecio: false, estado: "disponible", destacado: true, descripcion: "", fotos: [],
  };
  subidasNuevas = [];
  $("#editorTitle").textContent = nuevo ? "Cargar auto" : "Editar auto";
  $("#btnDelete").hidden = nuevo;
  $("#editorError").textContent = "";
  $("#uploadStatus").textContent = "";
  form.marca.value = editando.marca;
  form.modelo.value = editando.modelo;
  form.anio.value = editando.anio || "";
  form.km.value = miles(editando.km);
  form.tipo.value = editando.tipo;
  form.precio.value = miles(editando.precio);
  form.descripcion.value = editando.descripcion || "";
  form.estado.value = editando.estado;
  form.destacado.checked = editando.destacado;
  form.mostrarPrecio.checked = editando.mostrarPrecio;
  renderFotos();
  $("#sheet").classList.add("is-open");
  $("#sheet").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeEditor(descartar = true) {
  if (descartar && subidasNuevas.length) {
    // borra de R2 las fotos subidas que no se guardaron
    subidasNuevas.forEach((url) => api("/api/upload", { method: "DELETE", body: { url } }).catch(() => {}));
  }
  subidasNuevas = [];
  editando = null;
  $("#sheet").classList.remove("is-open");
  $("#sheet").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

document.querySelectorAll("[data-cancel]").forEach((el) => el.addEventListener("click", () => {
  if (subiendo) return toast("Esperá a que terminen de subir las fotos", true);
  closeEditor(true);
}));

// Formateo de miles mientras escribe
["km", "precio"].forEach((n) => form[n].addEventListener("input", (e) => {
  e.target.value = miles(num(e.target.value));
}));

// ---------- Fotos ----------
function renderFotos(cargando = 0) {
  const f = editando.fotos;
  $("#photos").innerHTML = f.map((url, i) => `
    <div class="photo">
      <img src="${esc(url)}" alt="" />
      ${i === 0 ? `<span class="photo__cover">Portada</span>` : ""}
      <div class="photo__tools">
        <button type="button" data-p="left" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Mover a la izquierda">◀</button>
        <button type="button" data-p="del" data-i="${i}" aria-label="Quitar foto">🗑</button>
        <button type="button" data-p="right" data-i="${i}" ${i === f.length - 1 ? "disabled" : ""} aria-label="Mover a la derecha">▶</button>
      </div>
    </div>`).join("") + Array.from({ length: cargando }, () => `<div class="photo photo--loading">Subiendo…</div>`).join("");
}

$("#photos").addEventListener("click", (e) => {
  const b = e.target.closest("[data-p]");
  if (!b) return;
  const i = Number(b.dataset.i), f = editando.fotos;
  if (b.dataset.p === "del") {
    const [url] = f.splice(i, 1);
    if (subidasNuevas.includes(url)) {
      subidasNuevas = subidasNuevas.filter((u) => u !== url);
      api("/api/upload", { method: "DELETE", body: { url } }).catch(() => {});
    }
  } else {
    const j = b.dataset.p === "left" ? i - 1 : i + 1;
    [f[i], f[j]] = [f[j], f[i]];
  }
  renderFotos(subiendo);
});

// Achica la foto en el celu antes de subirla (máx 1600px, WebP o JPG)
async function comprimir(file) {
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    let blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.8));
    if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  } finally { URL.revokeObjectURL(src); }
}

$("#fileInput").addEventListener("change", async (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith("image/"));
  e.target.value = "";
  if (!files.length) return;
  const espacio = 15 - editando.fotos.length;
  if (espacio <= 0) return toast("Máximo 15 fotos por auto", true);

  const lote = files.slice(0, espacio);
  subiendo += lote.length;
  renderFotos(subiendo);
  $("#btnSave").disabled = true;
  let errores = 0;

  for (const file of lote) {
    try {
      const data = await comprimir(file);
      const { url } = await api("/api/upload", { method: "POST", body: { data } });
      if (!editando) { api("/api/upload", { method: "DELETE", body: { url } }).catch(() => {}); continue; }
      editando.fotos.push(url);
      subidasNuevas.push(url);
    } catch (err) {
      errores++;
      console.error(err);
    }
    subiendo--;
    if (editando) renderFotos(subiendo);
  }
  $("#btnSave").disabled = false;
  $("#uploadStatus").textContent = errores ? `${errores} foto(s) no se pudieron subir. Probá de nuevo.` : "";
});

// ---------- Guardar / eliminar ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (subiendo) return;
  const err = $("#editorError");
  err.textContent = "";
  const datos = {
    ...editando,
    marca: form.marca.value.trim(),
    modelo: form.modelo.value.trim(),
    anio: Number(form.anio.value),
    km: num(form.km.value),
    tipo: form.tipo.value,
    precio: num(form.precio.value),
    descripcion: form.descripcion.value.trim(),
    estado: form.estado.value,
    destacado: form.destacado.checked,
    mostrarPrecio: form.mostrarPrecio.checked,
  };
  if (!datos.marca || !datos.modelo) return (err.textContent = "Completá marca y modelo");
  if (!datos.anio || datos.anio < 1950 || datos.anio > 2100) return (err.textContent = "Revisá el año");
  if (!datos.fotos.length) return (err.textContent = "Agregá al menos una foto");
  if (datos.mostrarPrecio && !datos.precio) return (err.textContent = "Para mostrar el precio, cargalo primero");

  const lista = autos.map((a) => ({ ...a }));
  if (datos.id) {
    const i = lista.findIndex((a) => a.id === datos.id);
    lista[i] = datos;
  } else {
    datos.id = Date.now().toString(36);
    lista.unshift(datos); // los nuevos aparecen primero
  }

  const btn = $("#btnSave");
  btn.disabled = true; btn.textContent = "Guardando…";
  const ok = await guardar(lista, datos.estado === "vendido" ? "Guardado. ¡Felicitaciones por la venta! 🎉" : "Guardado ✓");
  btn.disabled = false; btn.textContent = "Guardar";
  if (ok) { subidasNuevas = []; closeEditor(false); }
});

$("#btnDelete").addEventListener("click", async () => {
  if (!editando?.id) return;
  if (!confirm(`¿Eliminar ${editando.marca} ${editando.modelo}? Se borran también sus fotos.\n\nSi lo vendiste, mejor marcalo como "Vendido".`)) return;
  const id = editando.id;
  const ok = await guardar(autos.filter((a) => a.id !== id), "Auto eliminado");
  if (ok) closeEditor(true);
});

$("#btnNew").addEventListener("click", () => openEditor(null));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && editando && !subiendo) closeEditor(true); });

// ---------- Inicio ----------
api("/api/me").then((r) => (r.ok ? showPanel() : showLogin())).catch(showLogin);
