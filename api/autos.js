import { cleanAuto, deleteObject, isAuthed, keyFromUrl, loadAutos, publicList, queryParam, readJson, saveAutos, send } from "./_lib.js";

export default async function handler(req, res) {
  try {
    // ---- Leer ----
    if (req.method === "GET") {
      if (queryParam(req, "admin")) {
        if (!isAuthed(req)) return send(res, 401, { error: "Sesión vencida" }, { "Cache-Control": "no-store" });
        return send(res, 200, { autos: await loadAutos() }, { "Cache-Control": "no-store" });
      }
      return send(res, 200, { autos: publicList(await loadAutos()) }, {
        "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=300",
      });
    }

    // ---- Guardar la lista completa (desde el panel) ----
    if (req.method === "PUT") {
      if (!isAuthed(req)) return send(res, 401, { error: "Sesión vencida" });
      const body = await readJson(req, 500_000);
      if (!Array.isArray(body.autos) || body.autos.length > 300) return send(res, 400, { error: "Datos inválidos" });

      const nuevos = body.autos.map(cleanAuto);
      const anteriores = await loadAutos();
      await saveAutos(nuevos);

      // Borrar de R2 las fotos que ya no usa ningún auto
      const enUso = new Set(nuevos.flatMap((a) => a.fotos));
      const huerfanas = anteriores.flatMap((a) => a.fotos || []).filter((u) => !enUso.has(u)).map(keyFromUrl).filter(Boolean);
      await Promise.allSettled(huerfanas.map(deleteObject));

      return send(res, 200, { autos: nuevos }, { "Cache-Control": "no-store" });
    }

    send(res, 405, { error: "Método no permitido" });
  } catch (e) {
    console.error(e);
    send(res, e.status || 500, { error: e.status ? e.message : "Error del servidor" });
  }
}
