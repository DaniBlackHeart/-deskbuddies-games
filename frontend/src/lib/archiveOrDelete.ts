// Question sets and questions may already have real play history attached
// by the time a MOD tries to remove one. Archived rows are hidden from
// active MOD views but keep past leaderboards/answers intact.
//
// Since 0025_trivia_mixed_sessions.sql, answers.question_id points at
// trivia_session_questions (a per-session SNAPSHOT of whichever questions
// got randomly mixed into that session), not directly at `questions` —
// same restructuring 0023_rebus_mixed_sessions.sql did for "Type What You
// See". Deleting an authored question or set no longer trips a Postgres FK
// violation just because it was once played (trivia_session_questions.
// source_question_id is `on delete set null`, not restrict), and a live
// session can never be corrupted by editing/deleting the original, since
// it already holds its own independent copy of the question text. The
// archive-instead-of-delete UX is still worth keeping (don't let a MOD
// accidentally lose a question with real history), so it's an explicit
// "was this ever copied into a session?" check (wasQuestionUsed/
// wasQuestionSetUsed) rather than relying on an FK violation — mirrors
// wasRebusPuzzleUsed/wasRebusSetUsed below.
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

// Whether a specific authored question has ever been copied into a
// session's snapshot (trivia_session_questions.source_question_id) — live
// or long since ended. This check exists purely to preserve the "protect
// questions with real play history, archive instead of losing them" UX,
// not for live-session safety (see file header).
async function wasQuestionUsed(questionId: string): Promise<boolean> {
  const { data } = await supabase.from("trivia_session_questions").select("id").eq("source_question_id", questionId).limit(1);
  return (data?.length ?? 0) > 0;
}

async function wasQuestionSetUsed(questionSetId: string): Promise<boolean> {
  const { data: setQuestions } = await supabase.from("questions").select("id").eq("question_set_id", questionSetId);
  const questionIds = (setQuestions ?? []).map((q) => q.id);
  if (questionIds.length === 0) return false;

  const { data } = await supabase.from("trivia_session_questions").select("id").in("source_question_id", questionIds).limit(1);
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
  if (await wasQuestionUsed(question.id)) {
    const { error: archiveError } = await supabase
      .from("questions")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", question.id);

    if (archiveError) {
      console.error("question archive failed", archiveError);
      return { outcome: "error", message: "Couldn't archive that question. Please try again." };
    }

    const renumberError = await renumberActiveQuestions(question.question_set_id);
    return renumberError ? { outcome: "error", message: renumberError } : { outcome: "archived" };
  }

  const { error: deleteError } = await supabase.from("questions").delete().eq("id", question.id);

  if (deleteError) {
    console.error("question delete failed", deleteError);
    return { outcome: "error", message: "Something went wrong deleting that question. Please try again." };
  }

  const renumberError = await renumberActiveQuestions(question.question_set_id);
  return renumberError ? { outcome: "error", message: renumberError } : { outcome: "deleted" };
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
  if (await wasQuestionSetUsed(setId)) {
    const { error: archiveError } = await supabase
      .from("question_sets")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", setId);

    if (archiveError) {
      console.error("question_set archive failed", archiveError);
      return { outcome: "error", message: "Couldn't archive that set. Please try again." };
    }
    return { outcome: "archived" };
  }

  const { error: deleteError } = await supabase.from("question_sets").delete().eq("id", setId);
  if (deleteError) {
    console.error("question_set delete failed", deleteError);
    return { outcome: "error", message: "Something went wrong deleting that set. Please try again." };
  }
  return { outcome: "deleted" };
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

// =========================================================
// Wheel of Fortune — wheel_categories
// Same shape as impostor_categories: wheel_phrases has no FK back to
// sessions (a round only ever copies a phrase's text into
// wheel_round_secrets, never references the row), so phrases always
// hard-delete cleanly. wheel_categories IS referenced by
// wheel_rounds.category_id though, so a category used in a past game
// hits the same FK RESTRICT and needs the same archive fallback.
// =========================================================
export async function deleteWheelCategory(categoryId: string): Promise<ArchiveOrDeleteResult> {
  const { error: deleteError } = await supabase.from("wheel_categories").delete().eq("id", categoryId);

  if (!deleteError) return { outcome: "deleted" };

  if (deleteError.code !== FOREIGN_KEY_VIOLATION) {
    console.error("wheel_category delete failed", deleteError);
    return { outcome: "error", message: "Something went wrong deleting that category. Please try again." };
  }

  const { error: archiveError } = await supabase
    .from("wheel_categories")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", categoryId);

  if (archiveError) {
    console.error("wheel_category archive failed", archiveError);
    return { outcome: "error", message: "Couldn't archive that category either. Please try again." };
  }
  return { outcome: "archived" };
}

export async function restoreWheelCategory(categoryId: string): Promise<ArchiveOrDeleteResult> {
  const { error } = await supabase.from("wheel_categories").update({ archived_at: null }).eq("id", categoryId);
  if (error) {
    console.error("wheel_category restore failed", error);
    return { outcome: "error", message: "Couldn't restore that category. Please try again." };
  }
  return { outcome: "restored" };
}

// =========================================================
// "Type What You See" (rebus) — rebus_sets / rebus_puzzles
// Since 0023_rebus_mixed_sessions.sql, rebus_answers.puzzle_id and
// rebus_sessions.final_puzzle_id point at rebus_session_puzzles (a
// per-session SNAPSHOT of whichever puzzles got randomly picked into that
// session), not directly at rebus_puzzles — so deleting an authored
// puzzle or set no longer trips a Postgres FK violation just because it
// was once played. The archive-instead-of-delete UX is still worth
// keeping (don't let a MOD accidentally lose a puzzle with real history,
// same reasoning as questions/question_sets), so it's reimplemented here
// as an explicit "was this ever copied into a session?" check
// (wasRebusPuzzleUsed/wasRebusSetUsed) rather than relying on the FK.
// order_index must stay contiguous 0..N-1 per set (same reasoning as
// Trivia — rebus-host indexes into the active puzzle list positionally
// for rounds 1-3), so removing an active puzzle renumbers the rest.
//
// rebus_sprint_puzzles has NO archive dance — see 0021_rebus_game.sql for
// why (nothing ever references a specific row by id, only by pool
// position — now doubly true, since 0023's rebus_session_sprint_puzzles
// is its own independent snapshot too), so it always hard-deletes cleanly
// like impostor_words/wheel_phrases.
// =========================================================

// Whether a specific authored puzzle has ever been copied into a session's
// snapshot (rebus_session_puzzles.source_puzzle_id) — live or long since
// ended. Since 0023_rebus_mixed_sessions.sql, a live session holds its own
// independent copy of the puzzle text, so deleting/archiving the original
// authored row can never corrupt an in-progress game the way it could
// before that migration — this check exists purely to preserve the
// existing "protect puzzles with real play history, archive instead of
// losing them" UX, not for live-session safety.
async function wasRebusPuzzleUsed(puzzleId: string): Promise<boolean> {
  const { data } = await supabase.from("rebus_session_puzzles").select("id").eq("source_puzzle_id", puzzleId).limit(1);
  return (data?.length ?? 0) > 0;
}

async function wasRebusSetUsed(rebusSetId: string): Promise<boolean> {
  const { data: setPuzzles } = await supabase.from("rebus_puzzles").select("id").eq("rebus_set_id", rebusSetId);
  const puzzleIds = (setPuzzles ?? []).map((p) => p.id);
  if (puzzleIds.length === 0) return false;

  const { data } = await supabase.from("rebus_session_puzzles").select("id").in("source_puzzle_id", puzzleIds).limit(1);
  return (data?.length ?? 0) > 0;
}

async function renumberActiveRebusPuzzles(rebusSetId: string): Promise<string | null> {
  const { data: remaining, error } = await supabase
    .from("rebus_puzzles")
    .select("id, order_index")
    .eq("rebus_set_id", rebusSetId)
    .is("archived_at", null)
    .order("order_index", { ascending: true });

  if (error) {
    console.error("rebus renumber fetch failed", error);
    return "Removed, but couldn't renumber the remaining puzzles — reload to check the order.";
  }

  for (let i = 0; i < (remaining ?? []).length; i++) {
    const p = remaining![i];
    if (p.order_index !== i) {
      const { error: updateError } = await supabase.from("rebus_puzzles").update({ order_index: i }).eq("id", p.id);
      if (updateError) {
        console.error("rebus renumber update failed", updateError);
        return "Removed, but couldn't renumber the remaining puzzles — reload to check the order.";
      }
    }
  }
  return null;
}

export async function deleteRebusPuzzle(puzzle: { id: string; rebus_set_id: string }): Promise<ArchiveOrDeleteResult> {
  if (await wasRebusPuzzleUsed(puzzle.id)) {
    const { error: archiveError } = await supabase
      .from("rebus_puzzles")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", puzzle.id);

    if (archiveError) {
      console.error("rebus puzzle archive failed", archiveError);
      return { outcome: "error", message: "Couldn't archive that puzzle. Please try again." };
    }

    const renumberError = await renumberActiveRebusPuzzles(puzzle.rebus_set_id);
    return renumberError ? { outcome: "error", message: renumberError } : { outcome: "archived" };
  }

  const { error: deleteError } = await supabase.from("rebus_puzzles").delete().eq("id", puzzle.id);

  if (deleteError) {
    console.error("rebus puzzle delete failed", deleteError);
    return { outcome: "error", message: "Something went wrong deleting that puzzle. Please try again." };
  }

  const renumberError = await renumberActiveRebusPuzzles(puzzle.rebus_set_id);
  return renumberError ? { outcome: "error", message: renumberError } : { outcome: "deleted" };
}

export async function restoreRebusPuzzle(puzzle: { id: string; rebus_set_id: string }): Promise<ArchiveOrDeleteResult> {
  const { data: active } = await supabase
    .from("rebus_puzzles")
    .select("order_index")
    .eq("rebus_set_id", puzzle.rebus_set_id)
    .is("archived_at", null)
    .order("order_index", { ascending: false })
    .limit(1);

  const nextOrderIndex = active && active.length > 0 ? active[0].order_index + 1 : 0;

  const { error } = await supabase
    .from("rebus_puzzles")
    .update({ archived_at: null, order_index: nextOrderIndex })
    .eq("id", puzzle.id);

  if (error) {
    console.error("rebus puzzle restore failed", error);
    return { outcome: "error", message: "Couldn't restore that puzzle. Please try again." };
  }
  return { outcome: "restored" };
}

export async function deleteRebusSet(setId: string): Promise<ArchiveOrDeleteResult> {
  if (await wasRebusSetUsed(setId)) {
    const { error: archiveError } = await supabase
      .from("rebus_sets")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", setId);

    if (archiveError) {
      console.error("rebus_set archive failed", archiveError);
      return { outcome: "error", message: "Couldn't archive that set. Please try again." };
    }
    return { outcome: "archived" };
  }

  const { error: deleteError } = await supabase.from("rebus_sets").delete().eq("id", setId);
  if (deleteError) {
    console.error("rebus_set delete failed", deleteError);
    return { outcome: "error", message: "Something went wrong deleting that set. Please try again." };
  }
  return { outcome: "deleted" };
}

export async function restoreRebusSet(setId: string): Promise<ArchiveOrDeleteResult> {
  const { error } = await supabase.from("rebus_sets").update({ archived_at: null }).eq("id", setId);
  if (error) {
    console.error("rebus_set restore failed", error);
    return { outcome: "error", message: "Couldn't restore that set. Please try again." };
  }
  return { outcome: "restored" };
}

/** Sprint puzzles never need archiving — always a plain hard delete (see 0021_rebus_game.sql). */
export async function deleteRebusSprintPuzzle(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("rebus_sprint_puzzles").delete().eq("id", id);
  if (error) {
    console.error("rebus_sprint_puzzle delete failed", error);
    return { error: "Something went wrong deleting that puzzle. Please try again." };
  }
  return { error: null };
}
