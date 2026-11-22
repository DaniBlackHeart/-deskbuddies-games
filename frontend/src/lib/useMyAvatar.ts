import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "./supabaseClient";
import { cleanParts, DEFAULT_AVATAR, type AvatarParts } from "./avatarCatalog";

// The member's own avatar and the avatar parts they own. Both are read through row-level
// security (own rows). Saving goes through the member-avatar Edge Function, which checks
// ownership again on the server: what this hook says the member owns only decides what the page
// offers, never what is allowed.

export type SaveResult = "ok" | "not_owned" | "failed";

export function useMyAvatar() {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [saved, setSaved] = useState<AvatarParts | null>(null);
  const [ownedKeys, setOwnedKeys] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setFailed(false);
    setSaved(null);
    try {
      const [a, o] = await Promise.all([
        supabase.from("member_avatars").select("parts").eq("user_id", userId).maybeSingle(),
        supabase.from("member_items").select("item_key").eq("user_id", userId).like("item_key", "avatar:%"),
      ]);
      if (a.error) throw a.error;
      if (o.error) throw o.error;
      setSaved(a.data ? cleanParts(a.data.parts) : { ...DEFAULT_AVATAR });
      setOwnedKeys(new Set((o.data ?? []).map((r: { item_key: string }) => r.item_key)));
    } catch {
      setFailed(true);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (parts: AvatarParts): Promise<SaveResult> => {
    try {
      const { data, error } = await supabase.functions.invoke("member-avatar", { body: { action: "save", parts } });
      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        return status === 409 ? "not_owned" : "failed";
      }
      if ((data as { status?: string })?.status !== "ok") return "failed";
      setSaved({ ...parts });
      return "ok";
    } catch {
      return "failed";
    }
  }, []);

  return { saved, ownedKeys, failed, reload: load, save };
}
