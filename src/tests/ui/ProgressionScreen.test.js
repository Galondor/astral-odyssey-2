jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));
jest.mock("../../firebase", () => ({ auth: { currentUser: null }, db: {} }));
jest.mock("../../world/marketplace", () => ({
  getItemStats: jest.fn(),
  MARKET_RARITIES: [],
  MARKET_SLOTS: [],
  MARKET_STATS: [],
  MARKETPLACE_MIN_LEVEL: 5,
}));
jest.mock("../../ui/ChangelogScreen", () => () => null);
jest.mock("../../ui/RoadmapScreen", () => () => null);

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { SCREENS } from "../../ui/screens";
import { createSkillGemstone } from "../../items/items";
import ProfessionProgress from "../../ui/ProfessionProgress";

const ProgressionScreen = SCREENS.progression.component;
const player = {
  level: 25,
  class: "Spellcaster",
  astra: 0,
  skillPoints: 0,
  statPoints: 0,
  skills: {},
  equippedSkills: [],
  stats: { strength: 1, dexterity: 1, intelligence: 1 },
};

test("profession stats explain their effects in focusable tooltips", () => {
  jest.useFakeTimers();
  render(<ProfessionProgress player={player} profession="weaponry" />);

  const expectedDescriptions = [
    ["Reagent slots", "extra materials you can add as reagents"],
    ["Craft quality", "higher-rarity, better-condition, and higher-tier gear"],
    ["Astra discount", "Reduces the astra cost of crafting"],
    ["Discovery", "discover the next unknown property"],
    ["Mythic chance", "Chance for a crafted gear item to be Mythic"],
  ];

  try {
    expectedDescriptions.forEach(([label, description]) => {
      const currentStat = screen.getByLabelText(new RegExp(`^${label}:`));
      fireEvent.focus(currentStat);
      act(() => jest.advanceTimersByTime(150));
      expect(screen.getByRole("tooltip").textContent).toContain(description);
      fireEvent.blur(currentStat);
    });
  } finally {
    jest.useRealTimers();
  }
});

test("Progression provides skill category subtabs and a Subclasses tab", () => {
  render(<ProgressionScreen player={player} inCombat={false} onChange={jest.fn()} />);

  fireEvent.click(screen.getByRole("tab", { name: /^Skills/ }));
  const categories = screen.getByRole("tablist", { name: "Skill categories" });
  expect(categories).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Offensive" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByText("Whirlwind")).toBeTruthy();
  expect(screen.getByText("Chain Lightning")).toBeTruthy();

  fireEvent.click(screen.getByRole("tab", { name: "Ultimate" }));
  expect(screen.getByText("Meteor")).toBeTruthy();
  expect(screen.getByText("Dimensional Slash")).toBeTruthy();

  fireEvent.click(screen.getByRole("tab", { name: "Passive" }));
  expect(screen.getByText("Vitality Overflow")).toBeTruthy();
  expect(screen.getByText("Skillful")).toBeTruthy();
  expect(screen.getByText(/Passives \(0\/3\)/)).toBeTruthy();

  fireEvent.click(screen.getByRole("tab", { name: "Subclasses" }));
  expect(screen.getByRole("status").textContent).toContain("Subclass progression is coming soon.");

  fireEvent.click(screen.getByRole("tab", { name: "Professions" }));
  const professions = screen.getByRole("tablist", { name: "Profession categories" });
  expect(within(professions).getByRole("tab", { name: "Crafting" }).getAttribute("aria-selected")).toBe("true");
  const disciplines = screen.getByRole("tablist", { name: "Crafting disciplines" });
  expect(within(disciplines).getByRole("tab", { name: "Weapons & Tools" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("region", { name: "Weapons & Tools progression" }).textContent).toContain("Weapons & Tools level 1");
  fireEvent.click(within(disciplines).getByRole("tab", { name: "Armor" }));
  const armor = screen.getByRole("region", { name: "Armor progression" });
  expect(armor.textContent).toContain("Armor level 1");
  expect(within(armor).getByRole("region", { name: "Unique recipes" }).textContent).toContain("Frostwoven Mantle");
  expect(within(armor).getByRole("progressbar", { name: "Armor exp" })).toBeTruthy();
  fireEvent.click(within(disciplines).getByRole("tab", { name: "Jewelry" }));
  const jewelry = screen.getByRole("region", { name: "Jewelry progression" });
  expect(within(jewelry).getByRole("region", { name: "Tool blueprints" }).textContent).toContain("Precision Tools");
  expect(jewelry.textContent).toContain("Next unlock · Lv 5");
  fireEvent.click(within(professions).getByRole("tab", { name: "Gathering" }));
  expect(screen.getByRole("region", { name: "Mining progression" }).textContent).toContain("Mining level 1");
  fireEvent.click(screen.getByRole("tab", { name: "Logging" }));
  expect(screen.getByRole("region", { name: "Logging progression" }).textContent).toContain("Logging level 1");
});

test("overcapped skills display gem levels without blocking learned-level upgrades", () => {
  const hero = {
    ...player, skillPoints: 5, skills: { fireball: 4, meteor: 3 },
    equipment: {
      helmet: { gemstones: [createSkillGemstone("fireball"), createSkillGemstone("fireball")] },
      chestplate: { gemstones: [createSkillGemstone("meteor")] },
    },
  };
  render(<ProgressionScreen player={hero} inCombat={false} onChange={jest.fn()} />);
  fireEvent.click(screen.getByRole("tab", { name: /^Skills/ }));
  const fireball = screen.getByText("Fireball").closest(".skill-card");
  expect(within(fireball).getByText("Level 6/5")).toBeTruthy();
  expect(within(fireball).getByRole("button", { name: "Level up (1 points)" }).disabled).toBe(false);
  fireEvent.click(screen.getByRole("tab", { name: "Ultimate" }));
  const meteor = screen.getByText("Meteor").closest(".skill-card");
  expect(within(meteor).getByText("Level 4/3")).toBeTruthy();
  expect(within(meteor).getByRole("button", { name: "Level up (2 points)" }).disabled).toBe(true);
});
