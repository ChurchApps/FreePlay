import { PlayerHelper } from "../PlayerHelper";

describe("PlayerHelper.seekTarget", () => {
  it("moves the position by the delta", () => {
    expect(PlayerHelper.seekTarget(30, 10, 120)).toBe(40);
    expect(PlayerHelper.seekTarget(30, -10, 120)).toBe(20);
  });

  it("never rewinds before the start", () => {
    expect(PlayerHelper.seekTarget(4, -10, 120)).toBe(0);
  });

  it("never fast forwards past the end", () => {
    expect(PlayerHelper.seekTarget(115, 10, 120)).toBe(120);
  });

  it("has no upper bound while the duration is unknown", () => {
    expect(PlayerHelper.seekTarget(115, 10)).toBe(125);
    expect(PlayerHelper.seekTarget(115, 10, 0)).toBe(125);
  });
});
