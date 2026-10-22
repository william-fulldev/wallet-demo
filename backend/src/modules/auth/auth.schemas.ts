import * as z from "zod";

// Uso el mismo tope de bytes que mi función de hash, para que ambas reglas coincidan.
const MAX_PASSWORD_BYTES = 72;

// Una sola definición del correo para registro, login y contactos.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "El correo no tiene un formato válido." }));

// Describo exactamente qué datos acepto para registrar a un usuario.
// "strictObject" rechaza campos que yo no he previsto, en lugar de ignorarlos en silencio.
export const registerSchema = z.strictObject({
  // Quito espacios de los extremos y exijo una longitud razonable.
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres.")
    .max(80, "El nombre no puede superar los 80 caracteres."),

  email: emailSchema,

  // No recorto la contraseña: los espacios podrían formar parte de ella.
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= MAX_PASSWORD_BYTES,
      "La contraseña es demasiado larga.",
    ),
});

// Solo necesito el token para renovar la sesión.
export const refreshBodySchema = z.strictObject({
  refreshToken: z.string().min(1).max(200),
});

// Obtengo el tipo de TypeScript directamente del esquema, sin escribirlo dos veces.
export type RegisterInput = z.infer<typeof registerSchema>;

// Defino qué datos acepto para iniciar sesión.
export const loginSchema = z.strictObject({
  email: emailSchema,

  // En login solo exijo que la contraseña exista y no sea absurdamente larga.
  password: z
    .string()
    .min(1, "La contraseña es obligatoria.")
    .max(72, "La contraseña no puede superar los 72 caracteres."),
});

// Saco el tipo de TypeScript a partir del esquema, como hicimos con el registro.
export type LoginInput = z.infer<typeof loginSchema>;
