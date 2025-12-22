import { useEffect, useState } from "react"
import iconDefault from "../assets/icon_default.png"

// Map available avatar assets by filename (without extension)
const avatarModules = import.meta.glob("../assets/**/*.{png,jpg,jpeg,webp,svg}", { eager: true, import: "default" }) as Record<string, string>
const AVATAR_MAP: Record<string, string> = Object.entries(avatarModules).reduce<Record<string, string>>((acc, [path, src]) => {
  const file = path.split("/").pop()
  if (!file) return acc
  const id = file.replace(/\.[^.]+$/, "")
  acc[id] = src
  return acc
}, {})

export const resolveAvatarSrc = (avatarId?: string | null): string => {
  if (avatarId) return AVATAR_MAP[avatarId] ?? `/avatars/${avatarId}.png`
  return iconDefault
}

type Props = {
  avatarId?: string | null
  alt?: string
  size?: number
  style?: React.CSSProperties
  className?: string
}

export default function NpcAvatar({ avatarId, alt = "Avatar", size = 64, style, className }: Props) {
  const [src, setSrc] = useState(() => resolveAvatarSrc(avatarId))

  useEffect(() => {
    setSrc(resolveAvatarSrc(avatarId))
  }, [avatarId])

  const handleError = () => {
    if (src !== iconDefault) setSrc(iconDefault)
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      onError={handleError}
      style={{ borderRadius: 8, objectFit: "cover", background: "#000", ...style }}
      className={className}
    />
  )
}
