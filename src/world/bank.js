import { getPlayer, setPlayer } from "../character/player";

/*
 Bank. The player saves `bank: { balance, updatedAt }`.
 Deposited astra earns BANK_INTEREST every full hour (compounded, rounded down each hour).
 Interest is applied whenever the bank is read, so time passing while the game is closed still counts.
*/
export const BANK_INTEREST = 0.01;
export const BANK_INTEREST_INTERVAL_MS = 60 * 60 * 1000;

// Returns the bank with any interest earned since it was last updated.
export const accrueBank = (bank, now = Date.now()) => {
  let balance = bank?.balance || 0;
  let updatedAt = bank?.updatedAt ?? now;
  if (balance <= 0) return { balance: Math.max(0, balance), updatedAt: now };
  const hours = Math.floor((now - updatedAt) / BANK_INTEREST_INTERVAL_MS);
  for (let i = 0; i < hours; i++) balance += Math.floor(balance * BANK_INTEREST);
  updatedAt += Math.max(0, hours) * BANK_INTEREST_INTERVAL_MS;
  return { balance, updatedAt };
};

// Applies pending interest to the saved player and returns the bank.
export const getBank = () => {
  const player = getPlayer();
  if (!player) return { balance: 0, updatedAt: Date.now() };
  const bank = accrueBank(player.bank);
  if (bank.balance !== player.bank?.balance || bank.updatedAt !== player.bank?.updatedAt)
    setPlayer({ bank });
  return bank;
};

export const parseAmount = (text, max) => {
  const words = String(text || "").toLowerCase().split(/\s+/);
  if (words.includes("all") || words.includes("a")) return max;
  const n = words.find((w) => /^\d+$/.test(w));
  return n === undefined ? null : Number(n);
};

// Handles "deposit <amount|all>" and "withdraw <amount|all>". Returns a reply string.
export const bankTransaction = (type, text) => {
  const player = getPlayer();
  const bank = getBank();
  const deposit = type === "deposit";
  const available = deposit ? player.astra || 0 : bank.balance;
  const amount = parseAmount(text, available);
  if (amount === null)
    return `Type "${type} <amount>" or "${type} all" to ${deposit ? "deposit into" : "withdraw from"} your account.`;
  if (amount <= 0) return `You have no {{astra|astra}} to ${type}.`;
  if (amount > available)
    return deposit
      ? `You only have ${available} {{astra|astra}} on hand.`
      : `Your account only holds ${bank.balance} {{astra|astra}}.`;
  const balance = bank.balance + (deposit ? amount : -amount);
  setPlayer({
    astra: (player.astra || 0) + (deposit ? -amount : amount),
    bank: { balance, updatedAt: bank.balance > 0 ? bank.updatedAt : Date.now() },
  }, { countAstraGain: false });
  return `You ${deposit ? "deposit" : "withdraw"} ${amount} {{astra|astra}}. Account balance: ${balance} {{astra|astra}}.`;
};
