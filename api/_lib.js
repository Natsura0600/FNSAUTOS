// Utilidades compartidas por las funciones de /api
// Almacenamiento: Cloudflare R2 (fotos + data/autos.json). Login: variables de entorno.
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const env = process.env;
export const DATA_KEY = "data/autos.json";
export const PUBLIC_URL = (env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
const LOCAL_DIR = env.LOCAL_STORAGE_DIR; // solo para probar en la compu, sin R2

// ---------- Datos iniciales (se usan hasta el primer guardado desde el panel) ----------
const SEED = [
  { id: "taos", marca: "Volkswagen", modelo: "Taos", anio: 2024, km: 90000, tipo: "suv", precio: 38000000, fotos: ["/img/taos.jpg"] },
  { id: "partner", marca: "Peugeot", modelo: "Partner", anio: 2026, km: 4000, tipo: "utilitario", precio: 35000000, fotos: ["/img/partner.jpg"] },
  { id: "hilux", marca: "Toyota", modelo: "Hilux", anio: 2012, km: 270000, tipo: "pickup", precio: 29000000, fotos: ["/img/hilux.jpg"] },
  { id: "308", marca: "Peugeot", modelo: "308", anio: 2017, km: 160000, tipo: "auto", precio: 17000000, fotos: ["/img/308.jpg"] },
  { id: "aircross", marca: "Citroën", modelo: "C3 Aircross", anio: 2012, km: 150000, tipo: "suv", precio: 12500000, fotos: ["/img/aircross.jpg"] },
].map((a) => ({ ...a, estado: "disponible", destacado: true, mostrarPrecio: false, descripcion: "" }));

// ---------- R2 ----------
let s3;
function r2() {
  if (!s3) {
    s3 = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    });
  }
  return s3;
}

async function getText(key) {
  if (LOCAL_DIR) {
    try { return await fs.readFile(path.join(LOCAL_DIR, key), "utf8"); } catch { return null; }
  }
  try {
    const r = await r2().send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
    return await r.Body.transformToString();
  } catch (e) {
    if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}

export async function putObject(key, body, contentType, cacheControl = "no-cache") {
  if (LOCAL_DIR) {
    const p = path.join(LOCAL_DIR, key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    return fs.writeFile(p, body);
  }
  return r2().send(new PutObjectCommand({
    Bucket: env.R2_BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl,
  }));
}

export async function deleteObject(key) {
  if (LOCAL_DIR) return fs.rm(path.join(LOCAL_DIR, key), { force: true });
  return r2().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
}

// ---------- Autos ----------
export async function loadAutos() {
  const txt = await getText(DATA_KEY);
  if (!txt) return SEED;
  try { return JSON.parse(txt).autos || []; } catch { return []; }
}

export async function saveAutos(autos) {
  const json = JSON.stringify({ autos, actualizado: new Date().toISOString() });
  await putObject(DATA_KEY, json, "application/json", "no-cache");
}

export const TIPOS = ["auto", "suv", "pickup", "utilitario", "moto"];
export const ESTADOS = ["disponible", "reservado", "vendido", "oculto"];

// Clave en R2 a partir de una URL pública (solo fotos subidas desde el panel)
export function keyFromUrl(url) {
  const prefix = PUBLIC_URL + "/autos/";
  return typeof url === "string" && url.startsWith(prefix) && !url.includes("..")
    ? url.slice(PUBLIC_URL.length + 1) : null;
}
const isFotoValida = (u) => keyFromUrl(u) !== null || (typeof u === "string" && /^\/img\/[\w.-]+$/.test(u));

const str = (v, max) => String(v ?? "").trim().slice(0, max);
const int = (v, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : 0; };

export function cleanAuto(a = {}) {
  return {
    id: str(a.id, 40).replace(/[^\w-]/g, "") || crypto.randomUUID().slice(0, 8),
    marca: str(a.marca, 40),
    modelo: str(a.modelo, 60),
    anio: int(a.anio, 1950, 2100),
    km: int(a.km, 0, 2_000_000),
    tipo: TIPOS.includes(a.tipo) ? a.tipo : "auto",
    precio: int(a.precio, 0, 100_000_000_000),
    mostrarPrecio: Boolean(a.mostrarPrecio),
    estado: ESTADOS.includes(a.estado) ? a.estado : "disponible",
    destacado: Boolean(a.destacado),
    descripcion: str(a.descripcion, 600),
    fotos: (Array.isArray(a.fotos) ? a.fotos : []).filter(isFotoValida).slice(0, 15),
  };
}

// Lo que ve el público: sin ocultos y sin precio si no se quiere mostrar
export function publicList(autos) {
  return autos
    .filter((a) => a.estado !== "oculto")
    .map(({ precio, mostrarPrecio, ...rest }) => (mostrarPrecio && precio ? { ...rest, precio } : rest));
}

// ---------- Sesión ----------
const COOKIE = "fns_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 días

// Si se cambia la contraseña en Vercel, se cierran todas las sesiones abiertas
const sign = (v) => crypto.createHmac("sha256", `${env.SESSION_SECRET}|${env.ADMIN_PASSWORD}`).update(v).digest("base64url");

export function safeEqual(a, b) {
  const A = crypto.createHash("sha256").update(String(a)).digest();
  const B = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(A, B);
}

export const authConfigured = () => Boolean(env.ADMIN_USER && env.ADMIN_PASSWORD && env.SESSION_SECRET);

export function createSessionCookie() {
  const payload = Buffer.from(JSON.stringify({ u: env.ADMIN_USER, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${env.VERCEL ? "; Secure" : ""}`;
}
export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${env.VERCEL ? "; Secure" : ""}`;

export function isAuthed(req) {
  if (!authConfigured()) return false;
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  const token = raw?.slice(COOKIE.length + 1);
  const [payload, sig] = (token || "").split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString());
    return d.u === env.ADMIN_USER && d.exp > Date.now();
  } catch { return false; }
}

// ---------- HTTP ----------
export function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

export async function readJson(req, limit = 1_000_000) {
  if (req.body && typeof req.body === "object") return req.body; // Vercel ya lo parsea
  if (typeof req.body === "string") return JSON.parse(req.body);
  let size = 0; const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error("Archivo demasiado grande"), { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}

export const queryParam = (req, name) => new URL(req.url, "http://x").searchParams.get(name);
