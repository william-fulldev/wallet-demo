// "Ana López" -> "AL"; "ana" -> "A"; vacío -> "?".
// Array.from separa por caracteres reales, no por unidades UTF-16.
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  const first = words[0];
  if (!first) return "?";

  const last = words.length > 1 ? words[words.length - 1] : undefined;

  const initial = (word: string | undefined): string =>
    word ? (Array.from(word)[0] ?? "") : "";

  return (initial(first) + initial(last)).toUpperCase();
}

// Los retratos se empaquetan con Vite: URL con hash, validadas en la compilación.
const portraits = import.meta.glob<string>("../assets/avatars/*.jpg", {
    eager: true,
    import: "default",
});

const AVATAR_ID_PATTERN = /^avatar-\d{2}$/;

// Devuelve la URL del retrato, o undefined si el id no es válido o no existe.
export function avatarUrl(avatarId: string | null): string | undefined {
    if (!avatarId || !AVATAR_ID_PATTERN.test(avatarId)) return undefined;
    return portraits[`../assets/avatars/${avatarId}.jpg`];
}

