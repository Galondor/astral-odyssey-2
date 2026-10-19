import { getPlayer, setPlayer } from "../character/player";
import { parseAmount } from "./bank";

/*
 Blackjack at the tavern. The hand lives in memory only; astra is paid or taken when the hand ends,
 so closing the game mid-hand costs nothing.
 Rules: one fresh shuffled deck per hand, dealer stands on all 17s,  blackjack pays 3:2 (rounded down).
*/
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

let game = null;

export const getBlackjackGame = () => game;

const newDeck = () => {
  const deck = SUITS.flatMap((s) => RANKS.map((r) => ({ rank: r, suit: s })));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const cardValue = (c) => (c.rank === "A" ? 11 : ["J", "Q", "K"].includes(c.rank) ? 10 : Number(c.rank));

export const handValue = (hand) => {
  let total = hand.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = hand.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
};

const isBlackjack = (hand) => hand.length === 2 && handValue(hand) === 21;
const show = (hand) => hand.map((c) => `${c.rank}${c.suit}`).join(" ");

const describe = (hideDealer) =>
  `Your hand: ${show(game.player)} (${handValue(game.player)})\n` +
  (hideDealer
    ? `Dealer shows: ${show(game.dealer.slice(0, 1))} ??`
    : `Dealer's hand: ${show(game.dealer)} (${handValue(game.dealer)})`);

export const describeHand = () => (game ? describe(true) : "There is no hand in play.");

const finish = (outcome) => {
  const player = getPlayer();
  const stake = game.bet;
  const net =
    outcome === "blackjack" ? Math.floor(stake * 1.5) : outcome === "win" ? stake : outcome === "push" ? 0 : -stake;
  const astra = Math.max(0, (player.astra || 0) + net);
  setPlayer({ astra });
  const text = {
    blackjack: `Blackjack! You win ${net} {{astra|astra}}.`,
    win: `You win ${net} {{astra|astra}}.`,
    push: "Push. Your bet is returned.",
    lose: `You lose ${-net} {{astra|astra}}.`,
  }[outcome];
  const result = `${describe(false)}\n${text}\nYou now have ${astra} {{astra|astra}}. Place another bet, or leave the table.`;
  game = null;
  return { reply: result, over: true };
};

const settleDealer = () => {
  while (handValue(game.dealer) < 17) game.dealer.push(game.deck.pop());
  const p = handValue(game.player);
  const d = handValue(game.dealer);
  if (d > 21 || p > d) return finish("win");
  return finish(p === d ? "push" : "lose");
};

// Starts a hand from the typed text ("bet 50", "bet all"). Returns { error } or { reply, over }.
export const startBlackjack = (text) => {
  const player = getPlayer();
  const astra = player?.astra || 0;
  const bet = parseAmount(text, astra);
  if (bet === null) return { error: 'Type "bet <amount>" or "bet all" to play a hand.' };
  if (bet <= 0) return { error: "You have no astra to bet." };
  if (bet > astra) return { error: `You only have ${astra} {{astra|astra}} on hand.` };
  const deck = newDeck();
  game = { deck, bet, player: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()] };
  if (isBlackjack(game.player) && isBlackjack(game.dealer)) return finish("push");
  if (isBlackjack(game.player)) return finish("blackjack");
  if (isBlackjack(game.dealer)) return finish("lose");
  return { reply: `You bet ${bet} {{astra|astra}}.\n${describe(true)}`, over: false };
};

export const blackjackHit = () => {
  if (!game) return { reply: "There is no hand in play.", over: true };
  game.player.push(game.deck.pop());
  if (handValue(game.player) > 21) return finish("lose");
  if (handValue(game.player) === 21) return settleDealer();
  return { reply: describe(true), over: false };
};

export const blackjackStand = () => (game ? settleDealer() : { reply: "There is no hand in play.", over: true });

export const clearBlackjack = () => {
  game = null;
};
