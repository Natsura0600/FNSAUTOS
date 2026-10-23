import crypto from "node:crypto";
import { deleteObject, isAuthed, keyFromUrl, loadAutos, PUBLIC_URL, putObject, readJson, send } from "./_lib.js";

const TIPOS = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const MAX_BYTES = 2.5 * 1024 * 1024; // el panel ya comprime cada foto a ~300 KB

export default async function handler(req, res) {
  try {
    if (!isAuthed(req)) return send(res, 401, { error: "Sesión vencida" });
    if (!PUBLIC_URL) return send(res, 500, { error: "Falta R2_PUBLIC_URL en Vercel" });

    // ---- Subir foto ----
    if (req.method === "POST") {
      const { data = "" } = await readJson(req, 4_000_000);
      const m = /^data:(image\/(?:webp|jpeg|png));base64,(.+)$/.exec(data);
      if (!m) return send(res, 400, { error: "Formato de imagen no válido" });
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > MAX_BYTES) return send(res, 413, { error: "La foto es demasiado pesada" });

      const key = `autos/${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}.${TIPOS[m[1]]}`;
      await putObject(key, buf, m[1], "public, max-age=31536000, immutable");
      return send(res, 200, { url: `${PUBLIC_URL}/${key}` });
    }

    // ---- Borrar una foto recién subida que no se llegó a guardar ----
    if (req.method === "DELETE") {
      const { url } = await readJson(req, 10_000);
      const key = keyFromUrl(url);
      if (!key) return send(res, 400, { error: "URL inválida" });
      const enUso = (await loadAutos()).some((a) => (a.fotos || []).includes(url));
      if (!enUso) await deleteObject(key);
      return send(res, 200, { ok: true });
    }

    send(res, 405, { error: "Método no permitido" });
  } catch (e) {
    console.error(e);
    send(res, e.status || 500, { error: e.status ? e.message : "Error del servidor" });
  }
}
