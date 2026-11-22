// note-for-debbie
// A Note for Debbie. A signed-in member sends one short note: a suggestion, a problem report,
// a kind word, or something else. { action: "send", kind, page?, body, reply_ok }
//
// The note is stored privately (debbie_notes has no member policy) and posted nowhere, so
// "only the team reads it" on the page is true. The daily limit and the insert happen together
// in the database function note_submit. The note text is never logged here. Sending a note earns
// nothing, and nothing from the member's journal, books, habits or focus goals is attached.

import { jsonResponse, handleOptions, getAdminClient, requireMember } from "../_shared/utils.ts";

const KINDS = ["idea", "broke", "liked", "else"];
// The pages a note can be about (the pages that exist). Anything else is stored as no page.
const PAGES = [
  "Home", "The Common Room", "Desk Time", "Reality Break", "My Desk", "Desk Finds",
  "Beyond the Desk", "Buddybook", "Buddy Calendar", "Keep the Desk Lit", "Settings",
];

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "send") return jsonResponse({ error: "unknown action" }, 400);

    const kind = typeof body.kind === "string" ? body.kind : "";
    if (!KINDS.includes(kind)) return jsonResponse({ error: "bad kind" }, 400);
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (text.length < 3) return jsonResponse({ status: "empty" });
    if (text.length > 1000) return jsonResponse({ error: "Your note is over 1000 characters." }, 400);
    const page = typeof body.page === "string" && PAGES.includes(body.page) ? body.page : null;
    const replyOk = body.reply_ok !== false;

    const admin = getAdminClient();
    const { data, error } = await admin.rpc("note_submit", {
      p_user: user.id,
      p_kind: kind,
      p_page: page,
      p_body: text,
      p_reply: replyOk,
    });
    if (error) throw error;
    return jsonResponse({ status: data === "ok" ? "ok" : "limit" });
  } catch (_err) {
    // Deliberately no logging of the request: it holds the member's private note.
    console.error("note-for-debbie failed");
    return jsonResponse({ error: "Something went wrong. Please try again." }, 500);
  }
});
