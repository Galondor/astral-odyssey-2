import { getPlayer } from "../character/player";
import { startCombat } from "../combat/combat";
import { DUNGEON_TYPES, DUNGEON_TYPE_IDS } from "./dungeonData";
import { getDungeonOptions, NAME_ELIXIR_DROP_CHANCE } from "./dungeons";

jest.mock("../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../combat/combat", () => ({
  startCombat: jest.fn(), endCombat: jest.fn(), getEnemy: () => null,
}));
jest.mock("../firebase", () => ({ db: {} }));

const type = DUNGEON_TYPES[DUNGEON_TYPE_IDS[0]];
let player;

function enemy(tier = "boss") {
  const template = tier === "boss" ? type.bosses[0] : tier === "elite" ? type.elites[0] : type.basics[0];
  player = {
    name: "Alice", level: 20, stats: {}, consumables: { elixirOfNameChanging: 2 },
    dungeon: {
      type: type.id, name: type.name, level: 20, index: 0,
      steps: [{ kind: "fight", tier, tpl: template.id }, { kind: "fight", tier: "boss", tpl: type.bosses[0].id }],
    },
  };
  getPlayer.mockReturnValue(player);
  getDungeonOptions()[0].onSelect();
  return startCombat.mock.calls.at(-1)[0];
}

afterEach(() => jest.restoreAllMocks());

test.each([[0, true], [0.049999, true], [0.05, false], [0.999, false]])(
  "boss elixir drop at random=%s is %s",
  (roll, drops) => {
    const boss = enemy();
    jest.spyOn(Math, "random").mockReturnValue(roll);
    const patch = {};
    const replies = [];
    boss.onDefeat(player, {}, patch, replies);
    expect(NAME_ELIXIR_DROP_CHANCE).toBe(0.05);
    expect(patch.consumables?.elixirOfNameChanging).toBe(drops ? 3 : undefined);
    expect(replies.some((line) => line.includes("Elixir of Name Changing"))).toBe(drops);
  },
);

test.each(["basic", "elite"])("%s enemies never drop the name elixir", (tier) => {
  const foe = enemy(tier);
  jest.spyOn(Math, "random").mockReturnValue(0);
  const patch = {};
  foe.onDefeat(player, {}, patch, []);
  expect(patch.consumables).toBeUndefined();
});

test("losing to a dungeon boss never grants the elixir", () => {
  const boss = enemy();
  jest.spyOn(Math, "random").mockReturnValue(0);
  const patch = {};
  boss.onPlayerDefeat(player, { maxHealth: 100, maxPower: 100 }, patch, []);
  expect(patch.consumables).toBeUndefined();
});
