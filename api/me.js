import { isAuthed, send } from "./_lib.js";

export default function handler(req, res) {
  send(res, 200, { ok: isAuthed(req) }, { "Cache-Control": "no-store" });
}
