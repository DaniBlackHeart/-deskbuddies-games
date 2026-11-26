import MemberHostPage from "../../components/MemberHostPage";

// The hosting page for this game. Everyone sees the same page: members can pick
// options and start a game; MODs also get New / Edit / Delete / Import here (see
// lib/gameManage.tsx). The editor page for each item is a separate MOD-only route.
export default function RebusSetsPage() {
  return <MemberHostPage gameKey="rebus" />;
}
