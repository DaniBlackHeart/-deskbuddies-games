import type { ReactNode } from "react";
import ImpostorImportModal from "../components/ImpostorImportModal";
import WheelImportModal from "../components/WheelImportModal";
import {
  deleteImpostorCategory,
  deleteQuestionSet,
  deleteRebusSet,
  deleteWheelCategory,
  restoreImpostorCategory,
  restoreQuestionSet,
  restoreRebusSet,
  restoreWheelCategory,
  type ArchiveOrDeleteResult,
} from "./archiveOrDelete";
import { supabase } from "./supabaseClient";
import type { GameKey } from "./gameCatalog";
import type { ParsedCategory } from "../utils/impostorParser";
import type { ParsedWheelCategory } from "../utils/wheelParser";

// What a MOD can do from the unified hosting page (components/MemberHostPage.tsx):
// the same load / create / edit / delete / restore / import behaviour the old
// per-game MOD list pages had, moved here so every game uses one page. Members
// never use any of this; they only start a game.

export type ManageRow = { id: string; name: string; detail: string; archived: boolean };

export type ManageConfig = {
  /** "set" or "category", used in button labels. */
  noun: string;
  placeholder: string;
  editorPath: (id: string) => string;
  load: () => Promise<ManageRow[]>;
  create: (name: string, userId: string) => Promise<string | null>;
  /** Absent when the old page had no delete (Family Feud sets). */
  remove?: (id: string) => Promise<ArchiveOrDeleteResult>;
  restore?: (id: string) => Promise<ArchiveOrDeleteResult>;
  deleteConfirm?: string;
  archivedNotice?: string;
  importLabel?: string;
  renderImport?: (onCancel: () => void, onDone: (userId: string | undefined) => void, userId: string | undefined) => ReactNode;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

async function createRow(table: string, name: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase.from(table).insert({ name: name.trim(), created_by: userId }).select().single();
  if (error) {
    console.error(error);
    return null;
  }
  return data.id as string;
}

const SET_ARCHIVED =
  "That set has already been used to host a session, so it's been archived instead of deleted. Past leaderboards are still safe. You can restore it from \"Show archived\" below.";
const CATEGORY_ARCHIVED =
  "That category has already been used in a game, so it's been archived instead of deleted. Past games are still safe. You can restore it from \"Show archived\" below.";

export const MANAGE: Partial<Record<GameKey, ManageConfig>> = {
  trivia: {
    noun: "set",
    placeholder: "e.g. General Knowledge #1",
    editorPath: (id) => `/mod/sets/${id}`,
    load: async () => {
      const { data } = await supabase.from("question_sets").select("*").order("created_at", { ascending: false });
      return Promise.all(
        (data ?? []).map(async (s) => {
          const { count } = await supabase
            .from("questions")
            .select("id", { count: "exact", head: true })
            .eq("question_set_id", s.id)
            .is("archived_at", null);
          return { id: s.id, name: s.name, detail: plural(count ?? 0, "question"), archived: !!s.archived_at };
        })
      );
    },
    create: (name, userId) => createRow("question_sets", name, userId),
    remove: deleteQuestionSet,
    restore: restoreQuestionSet,
    deleteConfirm: "Delete this question set?",
    archivedNotice: SET_ARCHIVED,
  },

  feud: {
    noun: "set",
    placeholder: "e.g. Family Night #1",
    editorPath: (id) => `/mod/feud-sets/${id}`,
    load: async () => {
      const { data } = await supabase.from("feud_sets").select("*").order("created_at", { ascending: false });
      return Promise.all(
        (data ?? []).map(async (s) => {
          const [{ count: rounds }, { count: fm }] = await Promise.all([
            supabase.from("feud_round_questions").select("id", { count: "exact", head: true }).eq("feud_set_id", s.id),
            supabase.from("feud_fastmoney_questions").select("id", { count: "exact", head: true }).eq("feud_set_id", s.id),
          ]);
          return { id: s.id, name: s.name, detail: `${plural(rounds ?? 0, "board question")} · ${fm ?? 0}/5 Fast Money`, archived: false };
        })
      );
    },
    create: (name, userId) => createRow("feud_sets", name, userId),
    // The old Family Feud page had Edit only, no delete or archive.
  },

  impostor: {
    noun: "category",
    placeholder: "e.g. Foods, Animals, Movies",
    editorPath: (id) => `/mod/impostor-categories/${id}`,
    load: async () => {
      const { data } = await supabase.from("impostor_categories").select("*").order("created_at", { ascending: false });
      return Promise.all(
        (data ?? []).map(async (c) => {
          const { count } = await supabase
            .from("impostor_words")
            .select("id", { count: "exact", head: true })
            .eq("category_id", c.id)
            .is("archived_at", null);
          return { id: c.id, name: c.name, detail: plural(count ?? 0, "word"), archived: !!c.archived_at };
        })
      );
    },
    create: (name, userId) => createRow("impostor_categories", name, userId),
    remove: deleteImpostorCategory,
    restore: restoreImpostorCategory,
    deleteConfirm: "Delete this category?",
    archivedNotice: CATEGORY_ARCHIVED,
    importLabel: "📋 Import categories",
    renderImport: (onCancel, onDone, userId) => (
      <ImpostorImportModal
        mode="categories"
        onCancel={onCancel}
        onConfirm={async (parsed: ParsedCategory[]) => {
          if (!userId) return;
          for (const cat of parsed) {
            const { data: row, error } = await supabase
              .from("impostor_categories")
              .insert({ name: cat.name, description: cat.description, created_by: userId })
              .select()
              .single();
            if (error || !row) continue;
            await supabase.from("impostor_words").insert(cat.words.map((w) => ({ category_id: row.id, word: w.word, clue: w.clue })));
          }
          onDone(userId);
        }}
      />
    ),
  },

  wheel: {
    noun: "category",
    placeholder: "e.g. Person, Place, Phrase, Around the House",
    editorPath: (id) => `/mod/wheel-categories/${id}`,
    load: async () => {
      const { data } = await supabase.from("wheel_categories").select("*").order("created_at", { ascending: false });
      return Promise.all(
        (data ?? []).map(async (c) => {
          const { count } = await supabase
            .from("wheel_phrases")
            .select("id", { count: "exact", head: true })
            .eq("category_id", c.id)
            .is("archived_at", null);
          return { id: c.id, name: c.name, detail: plural(count ?? 0, "phrase"), archived: !!c.archived_at };
        })
      );
    },
    create: (name, userId) => createRow("wheel_categories", name, userId),
    remove: deleteWheelCategory,
    restore: restoreWheelCategory,
    deleteConfirm: "Delete this category?",
    archivedNotice: CATEGORY_ARCHIVED,
    importLabel: "📋 Import categories",
    renderImport: (onCancel, onDone, userId) => (
      <WheelImportModal
        mode="categories"
        onCancel={onCancel}
        onConfirm={async (parsed: ParsedWheelCategory[]) => {
          if (!userId) return;
          for (const cat of parsed) {
            const { data: row, error } = await supabase
              .from("wheel_categories")
              .insert({ name: cat.name, description: cat.description, created_by: userId })
              .select()
              .single();
            if (error || !row) continue;
            await supabase.from("wheel_phrases").insert(cat.phrases.map((p) => ({ category_id: row.id, phrase: p })));
          }
          onDone(userId);
        }}
      />
    ),
  },

  rebus: {
    noun: "set",
    placeholder: "e.g. Movies & Shows",
    editorPath: (id) => `/mod/rebus-sets/${id}`,
    load: async () => {
      const { data } = await supabase.from("rebus_sets").select("*").order("created_at", { ascending: false });
      return Promise.all(
        (data ?? []).map(async (s) => {
          const [{ count: puzzles }, { count: sprint }] = await Promise.all([
            supabase.from("rebus_puzzles").select("id", { count: "exact", head: true }).eq("rebus_set_id", s.id).is("archived_at", null),
            supabase.from("rebus_sprint_puzzles").select("id", { count: "exact", head: true }).eq("rebus_set_id", s.id),
          ]);
          return { id: s.id, name: s.name, detail: `${plural(puzzles ?? 0, "puzzle")} · ${plural(sprint ?? 0, "sprint puzzle")}`, archived: !!s.archived_at };
        })
      );
    },
    create: (name, userId) => createRow("rebus_sets", name, userId),
    remove: deleteRebusSet,
    restore: restoreRebusSet,
    deleteConfirm: "Delete this set?",
    archivedNotice: SET_ARCHIVED,
  },
};
