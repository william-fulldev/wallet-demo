import { useEffect, useState } from "react";
import { avatarUrl, initialsOf } from "../lib/avatars";

type AvatarProps = {
  name: string;
  avatarId: string | null;
  size?: number;
};

export function Avatar({ name, avatarId, size = 56 }: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const src = avatarUrl(avatarId);

  // El estado de error debe reiniciarse si cambia avatarId.
  useEffect(() => {
    setHasError(false);
  }, [avatarId]);

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      // El nombre ya se muestra al lado; el lector de pantalla no debe repetirlo.
      aria-hidden="true"
    >
      {src && !hasError ? (
        <img
          src={src}
          alt=""
          draggable={false}
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

