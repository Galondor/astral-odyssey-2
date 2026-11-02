import { render, screen } from "@testing-library/react";
import RoadmapScreen from "../../ui/RoadmapScreen";

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => "# Roadmap\n\nMore updates are planned.",
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("loads and renders roadmap markdown", async () => {
  render(<RoadmapScreen />);

  expect(screen.getByRole("heading", { name: "Roadmap" })).toBeTruthy();
  expect(await screen.findByRole("heading", { name: "Roadmap", level: 1 })).toBeTruthy();
  expect(screen.getByText("More updates are planned.")).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith("/roadmap.md", expect.objectContaining({ signal: expect.any(AbortSignal) }));
});
