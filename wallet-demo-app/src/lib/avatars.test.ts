import { describe, expect, it } from "vitest";
import { avatarUrl, initialsOf } from "./avatars";

describe("initialsOf", () => {
  it.each([
    ["Ana López", "AL"],
    ["ana", "A"],
    ["Juan Carlos Pérez", "JP"],
    ["álvaro", "Á"],
    ["   ", "?"],
    ["", "?"],
  ])("%j -> %s", (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

describe("avatarUrl", () => {
  it.each(["avatar-01", "avatar-08", "avatar-09"])("devuelve una cadena no vacía para %s", (avatarId) => {
    const url = avatarUrl(avatarId);
    expect(typeof url).toBe("string");
    expect(url?.length).toBeGreaterThan(0);
  });

  it("devuelve undefined para un id válido sin archivo existente", () => {
    expect(avatarUrl("avatar-99")).toBeUndefined();
  });

  it("devuelve undefined para null", () => {
    expect(avatarUrl(null)).toBeUndefined();
  });

  it.each(["../secreto", "avatar-1"])("devuelve undefined para el formato no válido %j", (invalidId) => {
    expect(avatarUrl(invalidId)).toBeUndefined();
  });
});

