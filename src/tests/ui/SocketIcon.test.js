import { renderToStaticMarkup } from "react-dom/server";
import { ItemSockets } from "../../ui/SocketIcon";

test.each([
  ["Common", 0], ["Uncommon", 0], ["Rare", 1], ["Epic", 1],
  ["Legendary", 2], ["Unique", 2], ["Mythic", 2],
])("%s cards display %i socket icons", (rarity, count) => {
  const view = renderToStaticMarkup(<ItemSockets item={{ rarity }} />);
  expect((view.match(/<svg/g) || []).length).toBe(count);
});

test("Epic cards honor their saved roll and filled icons are colored by gemstone type", () => {
  const view = renderToStaticMarkup(<ItemSockets item={{
    rarity: "Epic", socketCount: 2,
    gemstones: [{ type: "ruby" }, { type: "emerald" }],
  }} />);
  expect((view.match(/<svg/g) || []).length).toBe(2);
  expect(view).toContain("#e5484d");
  expect(view).toContain("#46a758");
  expect(view).toContain('width="18"');
});

test("legacy low-rarity gems are visible and placeholders have no socket row", () => {
  const item = { rarity: "Common", gemstone: { type: "sapphire" } };
  expect(renderToStaticMarkup(<ItemSockets item={item} />)).toContain("#3e8ef0");
  expect(renderToStaticMarkup(<ItemSockets item={{ ...item, twoHandedOf: "mainHand" }} />)).toBe("");
});

test("Skill Gems render as filled sockets rather than empty rings", () => {
  const view = renderToStaticMarkup(<ItemSockets item={{
    rarity: "Legendary", gemstones: [{ type: "skill", skill: "meteor", rarity: "Unique", value: 1 }],
  }} />);
  expect(view).toContain("#ff8000");
  expect(view).toContain("<polygon");
});

test.each([["Common", 1], ["Rare", 2], ["Legendary", 3]])(
  "Holofoil %s cards display %s sockets",
  (rarity, count) => {
    const view = renderToStaticMarkup(<ItemSockets item={{ rarity, holofoil: ["#123456", "#abcdef"] }} />);
    expect((view.match(/<svg/g) || []).length).toBe(count);
  },
);
