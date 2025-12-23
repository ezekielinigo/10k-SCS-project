import ProfileViewHandler from "./ProfileViewHandler"

// Legacy re-export to avoid breaking imports during migration. Use ProfileViewHandler directly instead.
export default function NpcProfileModal({ open, onClose, npcId, npc }: { open: boolean; onClose: () => void; npcId?: string; npc?: any }) {
  return <ProfileViewHandler open={open} onClose={onClose} target={{ mode: "npc", npcId, npc }} />
}
