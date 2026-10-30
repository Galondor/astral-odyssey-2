import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { calculateStats } from "../../character/stats";
import { getClassForStats } from "../../character/classes";
import { createGroupRun } from "../../world/groupDungeons";
import { createPuzzle, puzzleClues } from "../../world/groupPuzzles";
import {
  createParty, getGroupStatus, invitePlayer, joinParty, sendChat, setReady, startRun, submitIntent, subscribeGroup,
} from "../../world/groupParty";
import { GroupLobby, GroupRunActions, GroupRunScreen } from "../../ui/GroupDungeonScreen";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({ getPlayer: () => ({ level: 45 }), setPlayer: () => {} }));
jest.mock("../../ui/Tooltip", () => ({ children }) => children);
jest.mock("../../world/groupParty", () => ({
  GROUP_CHAT_MAX: 200,
  GROUP_MAX_MEMBERS: 3,
  acceptInvite: jest.fn(),
  clearGroupError: jest.fn(),
  createParty: jest.fn(),
  declineInvite: jest.fn(),
  disbandParty: jest.fn(),
  getGroupStatus: jest.fn(),
  invitePlayer: jest.fn(),
  joinParty: jest.fn(),
  kickMember: jest.fn(),
  leaveParty: jest.fn(),
  promoteMember: jest.fn(),
  sendChat: jest.fn(),
  setPartyDungeon: jest.fn(),
  setPartyOpen: jest.fn(),
  setReady: jest.fn(),
  startRun: jest.fn(),
  submitIntent: jest.fn(),
  subscribeGroup: jest.fn(),
}));

const hero = (name, skills) => {
  const player = {
    name, level: 45,
    baseStats: { strength: 80, dexterity: 40, intelligence: 40 },
    equipment: {},
    bonusStats: { maxHealth: 440 },
    skills, equippedSkills: Object.keys(skills),
    consumables: { healthPotion: 2 },
  };
  player.stats = calculateStats(player);
  player.class = getClassForStats(player.stats);
  return player;
};

const baseStatus = (extra = {}) => ({
  identity: "a", connected: true, partyId: null, party: null, dungeon: null, isLeader: false, members: [],
  invites: [], lfg: [], chat: [], run: null, active: false, inRun: false, intentsIn: {}, myIntent: null,
  remainingMs: 0, roundRemainingMs: 0, startBlocker: null, unclaimed: [], claimLines: [], pending: false, error: "",
  ...extra,
});

const makeRun = () => createGroupRun({
  id: "run-1", dungeonId: "tidewrack", members: ["a", "b"], now: 1000, actor: "a",
  snapshots: { a: hero("Ana", { mendingLight: 2, cleave: 1 }), b: hero("Bo", { cleave: 1 }) },
});

let status;
beforeEach(() => {
  status = baseStatus();
  getGroupStatus.mockImplementation(() => status);
  subscribeGroup.mockImplementation(() => () => {});
  submitIntent.mockResolvedValue(true);
});

test("the lobby lists the three dungeons with level gates, points invitations to Social and shows the LFG board", () => {
  status = baseStatus({
    invites: [{ id: "p1", from: "Zed", dungeon: "chronoforge", at: 1 }],
    lfg: [
      { id: "p2", dungeon: "tidewrack", leaderName: "Kai", size: 2, at: 1 },
      { id: "p3", dungeon: "starless", leaderName: "Lux", size: 1, at: 1 },
    ],
  });
  render(<GroupLobby player={{ level: 45 }} />);
  expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(expect.arrayContaining([
    "Tidewrack Hold", "The Chronoforge Spire", "The Starless Throne", "Looking for Group",
  ]));
  expect(screen.queryByRole("heading", { name: "Invitations" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
  expect(screen.getByText(/a party invitation waiting in the Social tab/)).toBeTruthy();
  expect(screen.getAllByText("Challenge")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Form a Party" }));
  expect(createParty).toHaveBeenCalledWith("tidewrack");
  expect(screen.getAllByRole("button", { name: "Level 60+" })[0].disabled).toBe(true);
  expect(screen.getAllByRole("button", { name: "Level 80+" })[0].disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
  expect(joinParty).toHaveBeenCalledWith("p2");
});

test("party leaders manage the roster, invite by name, ready up and see why the run can't start", () => {
  status = baseStatus({
    partyId: "p1", isLeader: true,
    party: { leader: "a", dungeon: "tidewrack", open: false },
    dungeon: { id: "tidewrack", name: "Tidewrack Hold", level: 40 },
    members: [
      { id: "a", name: "Ana", level: 45, ready: false, online: true, leader: true },
      { id: "b", name: "Bo", level: 44, ready: true, online: false, leader: false },
    ],
    startBlocker: "Everyone must be ready.",
  });
  render(<GroupLobby player={{ level: 45 }} />);
  const roster = within(document.querySelector(".group-roster"));
  expect(roster.getByText("★ Ana")).toBeTruthy();
  expect(roster.getByRole("button", { name: "Kick" })).toBeTruthy();
  expect(roster.getByText("Open slot")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Character name to invite"), { target: { value: "Cy" } });
  fireEvent.click(screen.getByRole("button", { name: "Invite" }));
  expect(invitePlayer).toHaveBeenCalledWith("Cy");
  fireEvent.click(screen.getByRole("button", { name: "Ready Up" }));
  expect(setReady).toHaveBeenCalledWith(true);
  const enter = screen.getByRole("button", { name: "Enter Dungeon" });
  expect(enter.disabled).toBe(true);
  fireEvent.click(enter);
  expect(startRun).not.toHaveBeenCalled();
  expect(screen.getByText("Everyone must be ready.")).toBeTruthy();
});

test("the run screen shows the timer, current stage, party and living enemies", () => {
  const run = makeRun();
  const enemyCount = run.combat.enemies.filter((e) => !e.hidden).length;
  run.combat.enemies.find((e) => !e.hidden).dead = true;
  status = baseStatus({ run, active: true, inRun: true, remainingMs: 29 * 60 * 1000 + 5000, intentsIn: { b: true } });
  render(<GroupRunScreen />);
  expect(screen.getByRole("heading", { name: "Tidewrack Hold" })).toBeTruthy();
  expect(screen.getByRole("timer").textContent).toBe("Time left: 29:05");
  expect(document.querySelector(".group-stages")).toBeNull();
  expect(document.querySelector(".group-run-sub").textContent).toContain("Boarding Action");
  expect(document.querySelectorAll(".group-member")).toHaveLength(2);
  expect(document.querySelector(".group-member.me").textContent).toContain("Choosing...");
  expect(document.querySelectorAll(".group-member")[1].textContent).toContain("✔ Ready");
  expect(document.querySelectorAll(".group-enemy")).toHaveLength(enemyCount - 1);
  expect(document.querySelector(".group-enemy.dead")).toBeNull();
});

test("combat actions pick enemy targets and allies for guard, potions and support skills", async () => {
  const run = makeRun();
  status = baseStatus({ run, active: true, inRun: true, remainingMs: 60000, roundRemainingMs: 20000 });
  render(<GroupRunActions />);
  expect(screen.getByRole("status").textContent).toContain("Waiting for you, Bo.");

  fireEvent.click(screen.getByRole("button", { name: "1. Melee Attack" }));
  const enemy = run.combat.enemies.find((e) => !e.dead && !e.hidden);
  await act(async () => fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent.includes(enemy.name))));
  expect(submitIntent).toHaveBeenLastCalledWith({ type: "melee", target: expect.any(String) });

  fireEvent.click(await screen.findByRole("button", { name: "6. Guard an Ally" }));
  expect(screen.queryByRole("button", { name: /Yourself/ })).toBeNull();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /^2\. Bo/ })));
  expect(submitIntent).toHaveBeenLastCalledWith({ type: "guard", target: "b" });

  fireEvent.click(await screen.findByRole("button", { name: "4. Use Item" }));
  fireEvent.click(screen.getByRole("button", { name: /Health Potion x2/ }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /^2\. Yourself/ })));
  expect(submitIntent).toHaveBeenLastCalledWith({ type: "item", key: "healthPotion", target: "a" });

  fireEvent.click(await screen.findByRole("button", { name: "3. Skills" }));
  fireEvent.click(screen.getByRole("button", { name: /Mending Light/ }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /^3\. Bo/ })));
  expect(submitIntent).toHaveBeenLastCalledWith({ type: "skill", key: "mendingLight", target: "b" });

  await screen.findByRole("button", { name: "5. Defend" });
  await act(async () => fireEvent.keyDown(window, { key: "5" }));
  expect(submitIntent).toHaveBeenLastCalledWith({ type: "defend" });
});

test("target buttons follow the living enemies, even when enemies share a name and health", () => {
  const run = makeRun();
  const first = run.combat.enemies.find((e) => !e.dead && !e.hidden);
  run.combat.enemies = [first, { ...first, uid: `${first.uid}-twin` }, { ...first, uid: `${first.uid}-triplet` }];
  status = baseStatus({ run, active: true, inRun: true, remainingMs: 60000, roundRemainingMs: 20000 });
  const consoleError = jest.spyOn(console, "error");
  const { rerender } = render(<GroupRunActions />);
  fireEvent.click(screen.getByRole("button", { name: "1. Melee Attack" }));
  const targetButtons = () => screen.getAllByRole("button").filter((b) => b.textContent.includes(first.name));
  expect(targetButtons()).toHaveLength(3);

  run.combat.enemies = run.combat.enemies.map((e, index) => (index < 2 ? { ...e, dead: true, hp: 0 } : e));
  status = { ...status, run: { ...run } };
  rerender(<GroupRunActions />);
  expect(targetButtons()).toHaveLength(1);
  expect(targetButtons()[0].textContent).toMatch(/^2\. /);

  run.combat.enemies = run.combat.enemies.map((e) => ({ ...e, dead: true, hp: 0 }));
  status = { ...status, run: { ...run } };
  rerender(<GroupRunActions />);
  expect(targetButtons()).toHaveLength(0);
  expect(screen.getByRole("button", { name: "1. Melee Attack" })).toBeTruthy();
  expect(document.querySelectorAll(".input-buttons button")).toHaveLength(9);
  expect(consoleError.mock.calls.some((args) => String(args[0]).includes("same key"))).toBe(false);
  consoleError.mockRestore();
});

test("the run controls open party chat and count messages that arrived while it was closed", () => {
  const run = makeRun();
  const chat = [{ id: "m1", from: "b", name: "Bo", text: "hi", at: 10 }];
  status = baseStatus({ run, active: true, inRun: true, remainingMs: 60000, roundRemainingMs: 20000, chat, partyId: "chat-party" });
  const { rerender, unmount } = render(<GroupRunActions />);
  const toggle = () => screen.getByRole("button", { name: /Chat/ });
  expect(toggle().textContent).toBe("Chat");
  expect(screen.queryByLabelText("Party chat message")).toBeNull();

  status = { ...status, chat: [...chat, { id: "m2", from: "b", name: "Bo", text: "ready?", at: 20 }, { id: "m3", from: "a", name: "Ana", text: "mine", at: 30 }] };
  rerender(<GroupRunActions />);
  expect(screen.getByLabelText("1 new messages")).toBeTruthy();

  fireEvent.click(toggle());
  expect(toggle().getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("ready?")).toBeTruthy();
  expect(screen.queryByLabelText(/new messages/)).toBeNull();
  fireEvent.change(screen.getByLabelText("Party chat message"), { target: { value: "go" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(sendChat).toHaveBeenCalledWith("go");

  fireEvent.click(screen.getByRole("button", { name: "Hide Chat" }));
  expect(screen.queryByLabelText("Party chat message")).toBeNull();
  expect(screen.queryByLabelText(/new messages/)).toBeNull();

  fireEvent.click(toggle());
  expect(screen.getByRole("dialog", { name: "Party chat" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close party chat" }));
  expect(screen.queryByRole("dialog", { name: "Party chat" })).toBeNull();
  expect(toggle().getAttribute("aria-expanded")).toBe("false");

  // A sender whose clock runs behind still lights the dot, and it survives the controls remounting.
  status = { ...status, chat: [...status.chat, { id: "m4", from: "b", name: "Bo", text: "late clock", at: 5 }] };
  rerender(<GroupRunActions />);
  expect(screen.getByLabelText("1 new messages").textContent).toBe("1");
  unmount();
  render(<GroupRunActions />);
  expect(screen.getByLabelText("1 new messages")).toBeTruthy();
});

test("puzzle stages offer station choices and private dial clues without leaking the solution", async () => {
  const run = makeRun();
  run.combat = null;
  run.stage = 1;
  run.puzzle = createPuzzle("stations", ["a", "b"]);
  status = baseStatus({ run, active: true, inRun: true, remainingMs: 60000, roundRemainingMs: 50000 });
  const { unmount } = render(<><GroupRunScreen /><GroupRunActions /></>);
  expect(screen.getByText(run.puzzle.order.text)).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "1. Capstan" })));
  expect(submitIntent).toHaveBeenLastCalledWith({ type: "station", key: "capstan" });
  unmount();

  run.puzzle = createPuzzle("dials", ["a", "b"]);
  status = { ...status, run: { ...run } };
  render(<><GroupRunScreen /><GroupRunActions /></>);
  const clues = puzzleClues(run.puzzle, ["a", "b"], "a");
  expect(clues).toHaveLength(2);
  for (const clue of clues) expect(screen.getByText(clue)).toBeTruthy();
  for (const clue of puzzleClues(run.puzzle, ["a", "b"], "b")) expect(screen.queryByText(clue)).toBeNull();
  fireEvent.change(document.querySelector(".group-setter select"), { target: { value: "4" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Lock In" })));
  expect(submitIntent).toHaveBeenLastCalledWith({ type: "dial", values: { 0: 4, 2: run.puzzle.values[2] } });
});
