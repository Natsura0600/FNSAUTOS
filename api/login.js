import { authConfigured, createSessionCookie, readJson, safeEqual, send } from "./_lib.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Método no permitido" });
  if (!authConfigured()) return send(res, 500, { error: "Faltan ADMIN_USER, ADMIN_PASSWORD o SESSION_SECRET en Vercel" });

  const { user = "", pass = "" } = await readJson(req, 10_000).catch(() => ({}));
  const okUser = safeEqual(String(user).trim().toLowerCase(), process.env.ADMIN_USER.trim().toLowerCase());
  const okPass = safeEqual(pass, process.env.ADMIN_PASSWORD);

  if (!(okUser && okPass)) {
    await wait(900); // frena intentos repetidos
    return send(res, 401, { error: "Usuario o contraseña incorrectos" });
  }
  send(res, 200, { ok: true }, { "Set-Cookie": createSessionCookie(), "Cache-Control": "no-store" });
}
