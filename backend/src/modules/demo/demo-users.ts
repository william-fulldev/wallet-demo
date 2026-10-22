import { emailSchema } from "../auth/auth.schemas.js";

export type DemoUserDefinition = {
    handle: string;
    demoNumber: number;
    avatarId: string;
    name: string;
    email: string;
};

export const DEMO_EMAIL_DOMAIN = "gmail.com";

export function demoEmail(user: { handle: string }): string {
    const raw = `${user.handle.trim().toLowerCase()}.demo@${DEMO_EMAIL_DOMAIN}`;
    return emailSchema.parse(raw);
}

export function demoPassword(user: { demoNumber: number }): string {
    return `Password${user.demoNumber}!`;
}

export const LEGACY_DEMO_EMAILS: Readonly<Record<string, string>> = {
    alana: "alana.demo@wallet.demo",
    kerol: "kerol.demo@wallet.demo",
    joao: "joao.demo@wallet.demo",
    thais: "thais.demo@wallet.demo",
    selmy: "selmy.demo@wallet.demo",
    angella: "angella.demo@wallet.demo",
    gisel: "gisel.demo@wallet.demo",
    william: "william.demo@wallet.demo",
    laura: "laura.demo@wallet.demo",
} as const;

const RAW_DEMO_USERS = [
    { handle: "alana", demoNumber: 101, avatarId: "avatar-01", name: "Alana R." },
    { handle: "kerol", demoNumber: 102, avatarId: "avatar-02", name: "Kerol G." },
    { handle: "joao", demoNumber: 103, avatarId: "avatar-03", name: "Joao Jc." },
    { handle: "thais", demoNumber: 104, avatarId: "avatar-04", name: "Thaís G." },
    { handle: "selmy", demoNumber: 105, avatarId: "avatar-05", name: "Selmy V." },
    { handle: "angella", demoNumber: 106, avatarId: "avatar-06", name: "Angella B." },
    { handle: "gisel", demoNumber: 107, avatarId: "avatar-07", name: "Gisel R." },
    { handle: "william", demoNumber: 108, avatarId: "avatar-08", name: "William S." },
    { handle: "laura", demoNumber: 109, avatarId: "avatar-09", name: "Laura B." },
] as const;

export const DEMO_USERS: readonly DemoUserDefinition[] = RAW_DEMO_USERS.map((u) => ({
    handle: u.handle,
    demoNumber: u.demoNumber,
    avatarId: u.avatarId,
    name: u.name,
    email: demoEmail(u),
}));

// Saldos iniciales finales de partida para cada cuenta de demostración (500,00 en céntimos enteros).
export const INITIAL_EUR_FINAL_CENTS = 50_000; // 500,00 EUR
export const INITIAL_USD_CENTS = 50_000; // 500,00 USD
export const INITIAL_BRL_CENTS = 50_000; // 500,00 BRL
