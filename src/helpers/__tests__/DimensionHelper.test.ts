import { DimensionHelper } from "../DimensionHelper";

describe("DimensionHelper", () => {
  it("wp converts a percentage of the 1920px window width", () => {
    expect(DimensionHelper.wp("50%")).toBe(960);
    expect(DimensionHelper.wp("100%")).toBe(1920);
  });

  it("hp converts a percentage of the 1080px window height", () => {
    expect(DimensionHelper.hp("10%")).toBe(108);
  });
});
