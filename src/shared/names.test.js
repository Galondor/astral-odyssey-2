import { hasInappropriateName, validateItemName } from "./names";

test.each(["Nova", "Blade 123", "123", "Assassin Sword", "Classical Spear", "Scunthorpe", "a".repeat(64)])(
  "allows appropriate item name %s", (name) => {
    expect(validateItemName(name)).toBeNull();
  },
);

test.each(["", "   ", "Sword!", "<Blade>", "A_B", "A-B", "A\nB", "A\tB", "a".repeat(65), null])(
  "rejects invalid item name %s", (name) => {
    expect(validateItemName(name)).toEqual(expect.any(String));
  },
);

test.each(["Fuck", "FUCK Sword", "Sh1t Blade", "f u c k", "f4gg0t", "N1gger", "B1tch", "BitchSword", "Nazi Sword"])(
  "filters inappropriate name %s", (name) => {
    expect(hasInappropriateName(name)).toBe(true);
    expect(validateItemName(name)).toBe("Please choose an appropriate name.");
  },
);
