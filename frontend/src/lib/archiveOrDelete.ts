// Question sets and questions may already have real play history attached
// (trivia_sessions / answers) by the time a MOD tries to remove one.
// Postgres rejects a hard DELETE in that case — answers.question_id and
// trivia_sessions.question_set_id both RESTRICT on delete — so we try a
// real delete first and fall back to archiving (soft delete) when history
// exists. Archived rows are hidden from active MOD views and skipped by
// live sessions, but keep past leaderboards/answers intact.
//
// Requires migration 0010_archive_question_sets_and_questions.sql.

import { supabase } from "./supabaseClient";
import type { Question } from "../types";

const FOREIGN_KEY_VIOLATION = "23503";

export type ArchiveOrDeleteResult =
  | { outcome: "deleted" }
  | { outcome: "archived" }
  | { outcome: "restored" }
  | { outcome: "blocked"; message: string }
  | { outcome: "error"; message: string };

async function isSessionInProgress(questionSetId: string): Promise<boolean> {
  const { data } = await supabase
    .from("trivia_sessions")
    .select("id")
    .eq("question_set_id", questionSetId)
    .in("status", ["lobby", "live", "grading"])
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// Renumbers a set's remaining active questions to stay contiguous
// (0..N-1). Required because trivia-host / get-current-question /
// trivia-answer all line up session.current_question_index against
// questions.order_index — a gap breaks the next question they serve.
async function renumberActiveQuestions(questionSetId: string): Promise<string | null> {
  const { data: remaining, error } = await supabase
    .from("questions")
    .select("id, order_index")
    .eq("question_set_id", questionSetId)
    .is("archived_at", null)
    .order("order_index", { ascending: true });

  if (error) {
    console.error("renumber fetch failed", error);
    return "Removed, but couldn't renumber the remaining questions — reload to check the order.";
  }

  for (let i = 0; i < (remaining ?? []).length; i++) {
    const q = remaining![i];
    if (q.order_index !== i) {
      const { error: updateError } = await supabase.from("questions").update({ order_index: i }).eq("id", q.id);
      if (updateError) {
        console.error("renumber update failed", updateError);
        return "Removed, but couldn't renumber the remaining questions — reload to check the order.";
      }
    }
  }
  return null;
}

export async function deleteQuestion(
  question: Pick<Question, "id" | "question_set_id">
): Promise<ArchiveOrDeleteResult> {
  if (await isSessionInProgress(question.question_set_id)) {
    return {
      outcome: "blocked",
      message: "This set has a session in progress right now — end it before removing questions.",
    };
  }

  const { error: deleteError } = await supabase.from("questions").delete().eq("id", question.id);

  if (!deleteError) {
    const renumberError = await renumberActiveQuestions(question.question_set_id);
    return renumberError ? { outcome: "error", message: renumberError } : { outcome: "deleted" };
  }

  if (deleteError.code !== FOREIGN_KEY_VIOLATION) {
    console.error("question delete failed", deleteError);
    return { outcome: "error", message: "Something went wrong deleting that question. Please try again." };
  }

  // Already answered in a past session — archive instead of deleting.
  const { error: archiveError } = await supabase
    .from("questions")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", question.id);

  if (archiveError) {
    console.error("question archive failed", archiveError);
    return { outcome: "error", message: "Couldn't archive that question either. Please try again." };
  }

  const renumberError = await renumberActiveQuestions(question.question_set_id);
  return renumberError ? { outcome: "error", message: renumberError } : { outcome: "archived" };
}

export async function restoreQuestion(
  question: Pick<Question, "id" | "question_set_id">
): Promise<ArchiveOrDeleteResult> {
  const { data: active } = await supabase
    .from("questions")
    .select("order_index")
    .eq("question_set_id", question.question_set_id)
    .is("archived_at", null)
    .order("order_index", { ascending: false })
    .limit(1);

  const nextOrderIndex = active && active.length > 0 ? active[0].order_index + 1 : 0;

  const { error } = await supabase
    .from("questions")
    .update({ archived_at: null, order_index: nextOrderIndex })
    .eq("id", question.id);

  if (error) {
    console.error("question restore failed", error);
    return { outcome: "error", message: "Couldn't restore that question. Please try again." };
  }
  return { outcome: "restored" };
}

export async function deleteQuestionSet(setId: string): Promise<ArchiveOrDeleteResult> {
  const { error: deleteError } = await supabase.from("question_sets").delete().eq("id", setId);

  if (!deleteError) return { outcome: "deleted" };

  if (deleteError.code !== FOREIGN_KEY_VIOLATION) {
    console.error("question_set delete failed", deleteError);
    return { outcome: "error", message: "Something went wrong deleting that set. Please try again." };
  }

  // Already used to host a session — archive instead of deleting.
  const { error: archiveError } = await supabase
    .from("question_sets")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", setId);

  if (archiveError) {
    console.error("question_set archive failed", archiveError);
    return { outcome: "error", message: "Couldn't archive that set either. Please try again." };
  }
  return { outcome: "archived" };
}

export async function restoreQuestionSet(setId: string): Promise<ArchiveOrDeleteResult> {
  const { error } = await supabase.from("question_sets").update({ archived_at: null }).eq("id", setId);
  if (error) {
    console.error("question_set restore failed", error);
    return { outcome: "error", message: "Couldn't restore that set. Please try again." };
  }
  return { outcome: "restored" };
}

// =========================================================
// Impostor WHO? — impostor_categories
// Simpler than question_sets: impostor_words has no FK back to sessions
// at all (a session only ever copies a word's text into impostor_secrets/
// impostor_cards, never references the row), so words always hard-delete
// cleanly — no archive dance needed for them, just a plain
// `supabase.from("impostor_words").delete()` at the call site.
// impostor_categories DOES get referenced by impostor_sessions.category_id
// though, so a category used in a past game hits the same FK RESTRICT as
// question_sets and needs the same archive fallback.
// =========================================================
export async function deleteImpostorCategory(categoryId: string): Promise<ArchiveOrDeleteResult> {
  const { error: deleteError } = await supabase.from("impostor_categories").delete().eq("id", categoryId);

  if (!deleteError) return { outcome: "deleted" };

  if (deleteError.code !== FOREIGN_KEY_VIOLATION) {
    console.error("impostor_category delete failed", deleteError);
    return { outcome: "error", message: "Something went wrong deleting that category. Please try again." };
  }

  const { error: archiveError } = await supabase
    .from("impostor_categories")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", categoryId);

  if (archiveError) {
    console.error("impostor_category archive failed", archiveError);
    return { outcome: "error", message: "Couldn't archive that category either. Please try again." };
  }
  return { outcome: "archived" };
}

export async function restoreImpostorCategory(categoryId: string): Promise<ArchiveOrDeleteResult> {
  const { error } = await supabase.from("impostor_categories").update({ archived_at: null }).eq("id", categoryId);
  if (error) {
    console.error("impostor_category restore failed", error);
    return { outcome: "error", message: "Couldn't restore that category. Please try again." };
  }
  return { outcome: "restored" };
}
