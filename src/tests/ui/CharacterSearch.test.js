import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CharacterSearch from "../../ui/CharacterSearch";
import ProfileMenu from "../../ui/ProfileMenu";
import { loadPublicProfile, searchCharacters } from "../../character/profiles";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/profiles", () => ({
  loadPublicProfile: jest.fn(),
  searchCharacters: jest.fn(),
}));

afterEach(() => jest.clearAllMocks());

test("shows searchable character details, disables private profiles, and opens public profiles", async () => {
  searchCharacters.mockResolvedValue([
    { id: "private-id", name: "NoraPrivate", level: 12, class: "Duelist", gearScore: 320, publicProfile: false },
    { id: "public-id", name: "Nova", level: 20, class: "Spellblade", gearScore: 850, publicProfile: true },
  ]);
  loadPublicProfile.mockResolvedValue({
    name: "Nova",
    level: 20,
    class: "Spellblade",
    stats: null,
    equipment: {},
    skills: { backstab: 3 },
    equippedSkills: ["backstab"],
    crafted: { sharpeningStone: 2 },
    keyItems: ["analyzer"],
    region: "Meadowlands",
    astra: 300,
    rep: 80,
  });
  render(<CharacterSearch excludeIdentity='self-id' />);

  fireEvent.change(screen.getByRole("combobox", { name: "Search characters" }), { target: { value: "no" } });
  const privateResult = await screen.findByRole("option", { name: /NoraPrivate.*Level 12 Duelist.*Gear score 320.*Private profile/ });
  expect(privateResult.disabled).toBe(true);
  fireEvent.click(privateResult);
  expect(loadPublicProfile).not.toHaveBeenCalled();

  const publicResult = await screen.findByRole("option", { name: /Nova.*Level 20 Spellblade.*Gear score 850/ });
  fireEvent.click(publicResult);
  expect(await screen.findByRole("dialog", { name: "Nova's character profile" })).toBeTruthy();
  expect(screen.getByText(/Sharpening Stone × 2/)).toBeTruthy();
  expect(screen.getByText("Backstab — Level 3").closest("li").textContent).toBe("Backstab — Level 3");
  expect(screen.getByText("Analyzer").closest("li").textContent).toBe("Analyzer");
  expect(loadPublicProfile).toHaveBeenCalledWith("public-id");
});

test("the character popup opens settings and saves the Public Profile option", async () => {
  const onSetPublicProfile = jest.fn().mockResolvedValue();
  render(
    <ProfileMenu
      player={{ name: "Nova", level: 3, astra: 0 }}
      sending={false}
      inCombat={false}
      onMainMenu={jest.fn()}
      onLogout={jest.fn()}
      onSetPublicProfile={onSetPublicProfile}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Character profile" }));
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByRole("checkbox", { name: "Public Profile" }).checked).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "Public Profile" }));

  await waitFor(() => expect(onSetPublicProfile).toHaveBeenCalledWith(false));
});

test("the character popup shows lifetime character stats and returns to the profile", () => {
  render(
    <ProfileMenu
      player={{
        name: "Nova",
        level: 3,
        astra: 0,
        records: {
          basicEnemiesKilled: 12,
          eliteEnemiesKilled: 3,
          bossEnemiesKilled: 2,
          playerKills: 7,
          playerDeaths: 5,
          totalAstraGained: 2400,
          totalAstraLostInBlackjack: 150,
          mostDamageDealt: 850,
          dungeonsCleared: 4,
          labyrinthsCleared: 1,
        },
      }}
      sending={false}
      inCombat={false}
      onMainMenu={jest.fn()}
      onLogout={jest.fn()}
      onSetPublicProfile={jest.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Character profile" }));
  fireEvent.click(screen.getByRole("button", { name: "Stats" }));

  expect(screen.getByRole("heading", { name: "Character stats" })).toBeTruthy();
  for (const [label, value] of [
    ["Basic enemies killed", "12"],
    ["Elites killed", "3"],
    ["Bosses killed", "2"],
    ["Player kills", "7"],
    ["Player deaths", "5"],
    ["Total Astra gained", "2,400"],
    ["Astra lost in Blackjack", "150"],
    ["Most damage dealt in one hit", "850"],
    ["Dungeons cleared", "4"],
    ["Labyrinths cleared", "1"],
  ]) {
    expect(screen.getByText(label).nextElementSibling.textContent).toBe(value);
  }

  fireEvent.click(screen.getByRole("button", { name: "Back to profile" }));
  expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
});

test("profiles without an explicit privacy setting are treated as public", async () => {
  searchCharacters.mockResolvedValue([
    { id: "legacy-id", name: "Legacy", level: 7, class: "Tactician", gearScore: 100 },
  ]);
  loadPublicProfile.mockResolvedValue({
    name: "Legacy",
    level: 7,
    class: "Tactician",
    stats: null,
    equipment: {},
    crafted: {},
    keyItems: [],
  });
  render(<CharacterSearch />);

  fireEvent.change(screen.getByRole("combobox", { name: "Search characters" }), { target: { value: "le" } });
  fireEvent.click(await screen.findByRole("option", { name: /Legacy.*Level 7 Tactician.*Gear score 100/ }));

  expect(await screen.findByRole("dialog", { name: "Legacy's character profile" })).toBeTruthy();
  expect(loadPublicProfile).toHaveBeenCalledWith("legacy-id");
});

test("shows holofoil backgrounds on equipped gear in a public profile", async () => {
  searchCharacters.mockResolvedValue([
    { id: "foil-id", name: "Foil", level: 20, class: "Spellblade", gearScore: 850, publicProfile: true },
  ]);
  loadPublicProfile.mockResolvedValue({
    name: "Foil",
    level: 20,
    class: "Spellblade",
    stats: null,
    equipment: {
      helmet: {
        name: "Prismatic Helm",
        rarity: "Legendary",
        holofoil: ["#123456", "#abcdef"],
        holofoilEffect: "aurora",
      },
    },
    crafted: {},
    keyItems: [],
  });
  render(<CharacterSearch />);

  fireEvent.change(screen.getByRole("combobox", { name: "Search characters" }), { target: { value: "fo" } });
  fireEvent.click(await screen.findByRole("option", { name: /Foil.*Level 20 Spellblade/ }));

  const gear = await screen.findByText("Prismatic Helm");
  expect(gear.closest("li").style.getPropertyValue("--holofoil-background"))
    .toBe("linear-gradient(135deg, #12345666, #abcdef66)");
});

test("public profile setting defaults to enabled", () => {
  render(
    <ProfileMenu
      player={{ name: "Nova", level: 3, astra: 0 }}
      sending={false}
      inCombat={false}
      onMainMenu={jest.fn()}
      onLogout={jest.fn()}
      onSetPublicProfile={jest.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Character profile" }));
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByRole("checkbox", { name: "Public Profile" }).checked).toBe(true);
});
