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

describe("PlayerHelper.manualSlideSeconds", () => {
  const clip = { url: "https://x/title.mp4", seconds: 50 } as any;

  it("gives a looping video no countdown so it repeats until the teacher moves on", () => {
    expect(PlayerHelper.manualSlideSeconds({ ...clip, loopVideo: true })).toBe(0);
  });

  it("keeps the clip's own length when it does not loop", () => {
    expect(PlayerHelper.manualSlideSeconds({ ...clip, loopVideo: false })).toBe(50);
  });

  it("keeps the timer on an image, even one flagged to loop", () => {
    expect(PlayerHelper.manualSlideSeconds({ url: "https://x/slide.png", seconds: 8, loopVideo: true } as any)).toBe(8);
  });
});
