let mockPlayer;

jest.mock("../../character/player", () => ({
  getPlayer: () => mockPlayer,
  setPlayer: jest.fn((patch) => {
    mockPlayer = { ...mockPlayer, ...patch };
  }),
}));
jest.mock("../../combat/combat", () => ({ getEnemy: () => null }));

import { setPlayer } from "../../character/player";
import { spendStatPoint } from "../../character/progression";

beforeEach(() => {
  setPlayer.mockClear();
  mockPlayer = {
    level: 1,
    statPoints: 12,
    baseStats: { strength: 1, dexterity: 1, intelligence: 1 },
    equipment: {},
    stats: { health: 10, stamina: 1, power: 1, exp: 0 },
  };
});

test.each([5, 10])("spends %i stat points on one core stat", (amount) => {
  expect(spendStatPoint("strength", amount)).toEqual({ ok: true });
  expect(setPlayer).toHaveBeenCalledWith(expect.objectContaining({
    baseStats: { strength: amount + 1, dexterity: 1, intelligence: 1 },
    statPoints: 12 - amount,
  }));
});

test("does not spend a requested amount the player cannot afford", () => {
  mockPlayer.statPoints = 4;

  expect(spendStatPoint("dexterity", 5)).toEqual({ ok: false, reason: "points" });
  expect(setPlayer).not.toHaveBeenCalled();
});

test("rejects non-positive or non-integer amounts", () => {
  expect(spendStatPoint("intelligence", 0)).toEqual({ ok: false });
  expect(spendStatPoint("intelligence", 1.5)).toEqual({ ok: false });
  expect(setPlayer).not.toHaveBeenCalled();
});
