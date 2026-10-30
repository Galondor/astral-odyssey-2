import { act, fireEvent, render, screen } from "@testing-library/react";
import SocialScreen from "../../ui/SocialScreen";
import { acceptInvite, declineInvite, getGroupStatus, inviteToParty, subscribeGroup } from "../../world/groupParty";
import {
  acceptFriendRequest, declineFriendRequest, getSocialStatus, markSocialSeen, removeFriend, sendFriendRequest, subscribeSocial,
} from "../../world/social";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({ getPlayer: () => ({ level: 45 }), setPlayer: () => {} }));
jest.mock("../../ui/Tooltip", () => ({ children }) => children);
jest.mock("../../world/groupParty", () => ({
  GROUP_CHAT_MAX: 200,
  GROUP_MAX_MEMBERS: 3,
  acceptInvite: jest.fn(),
  clearGroupError: jest.fn(),
  declineInvite: jest.fn(),
  getGroupStatus: jest.fn(),
  inviteToParty: jest.fn(),
  subscribeGroup: jest.fn(),
}));
jest.mock("../../world/social", () => ({
  acceptFriendRequest: jest.fn(),
  clearSocialMessages: jest.fn(),
  declineFriendRequest: jest.fn(),
  getSocialStatus: jest.fn(),
  markSocialSeen: jest.fn(),
  removeFriend: jest.fn(),
  sendFriendRequest: jest.fn(),
  subscribeSocial: jest.fn(),
}));

let group;
let social;
beforeEach(() => {
  group = {
    identity: "a", connected: true, partyId: null, party: null, isLeader: false, members: [], pending: false, error: "",
    invites: [
      { id: "p1", from: "Zed", dungeon: "tidewrack", at: 5 },
      { id: "p2", from: "Lux", dungeon: "starless", at: 4 },
    ],
  };
  social = {
    identity: "a", pending: false, error: "", notice: "",
    requests: [{ id: "c", name: "Cy", at: 3 }],
    friends: [{ id: "b", name: "Bo", online: true }, { id: "d", name: "Dee", online: false }],
  };
  getGroupStatus.mockImplementation(() => group);
  getSocialStatus.mockImplementation(() => social);
  subscribeGroup.mockImplementation(() => () => {});
  subscribeSocial.mockImplementation(() => () => {});
  acceptInvite.mockResolvedValue(true);
  inviteToParty.mockResolvedValue(true);
  sendFriendRequest.mockResolvedValue(true);
  removeFriend.mockResolvedValue(true);
});

test("party invitations are answered from the Social tab and link to the group lobby", async () => {
  const onNavigate = jest.fn();
  const { rerender } = render(<SocialScreen player={{ level: 45 }} onNavigate={onNavigate} />);
  expect(markSocialSeen).toHaveBeenCalled();
  expect(screen.getByText(/invites you to Tidewrack Hold/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Level 80+" }).disabled).toBe(true);
  fireEvent.click(screen.getAllByRole("button", { name: "Decline" })[1]);
  expect(declineInvite).toHaveBeenCalledWith("p2");

  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Accept" })[0]));
  expect(acceptInvite).toHaveBeenCalledWith("p1");
  group = { ...group, partyId: "p1", invites: [group.invites[1]] };
  rerender(<SocialScreen player={{ level: 45 }} onNavigate={onNavigate} />);
  fireEvent.click(screen.getByRole("button", { name: "Go to Group Dungeons" }));
  expect(onNavigate).toHaveBeenCalledWith("dungeons");
});

test("friend requests, the add form, presence, party invites and removal", async () => {
  render(<SocialScreen player={{ level: 45 }} />);
  expect(screen.getByText(/wants to be your friend/).textContent).toBe("Cy wants to be your friend.");
  fireEvent.click(screen.getAllByRole("button", { name: "Accept" }).at(-1));
  expect(acceptFriendRequest).toHaveBeenCalledWith("c");
  fireEvent.click(screen.getAllByRole("button", { name: "Decline" }).at(-1));
  expect(declineFriendRequest).toHaveBeenCalledWith("c");

  fireEvent.change(screen.getByLabelText("Character name to add as a friend"), { target: { value: "Eve" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send Request" })));
  expect(sendFriendRequest).toHaveBeenCalledWith("Eve");
  expect(screen.getByLabelText("Character name to add as a friend").value).toBe("");

  expect(screen.getByRole("heading", { name: "Friends (2)" })).toBeTruthy();
  expect(screen.getByText("Online")).toBeTruthy();
  expect(screen.getByText("Offline")).toBeTruthy();
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Invite to Party" })[0]));
  expect(inviteToParty).toHaveBeenCalledWith("Bo");
  expect(screen.getByText("Party invitation sent to Bo.")).toBeTruthy();

  fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirm Remove" })));
  expect(removeFriend).toHaveBeenCalledWith("d");
});

test("party invites are blocked for non-leaders, full parties and low levels", () => {
  group = { ...group, partyId: "p9", party: { leader: "z", members: { a: {}, z: {} } }, isLeader: false };
  const { rerender } = render(<SocialScreen player={{ level: 45 }} />);
  for (const button of screen.getAllByRole("button", { name: "Invite to Party" })) {
    expect(button.disabled).toBe(true);
    expect(button.title).toMatch(/Only your party leader/);
  }
  group = { ...group, partyId: null, party: null };
  rerender(<SocialScreen player={{ level: 20 }} />);
  expect(screen.getAllByRole("button", { name: "Invite to Party" })[0].title).toMatch(/unlock at level 40/);
});
