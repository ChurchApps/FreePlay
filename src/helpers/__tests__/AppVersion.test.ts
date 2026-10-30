// The Providers screen, plan download screen, and ScheduleSync status all read
// package.json's version, while the store build takes branding.json's. Keep them equal.
const pkg = require("../../../package.json");
const branding = require("../../../branding.json");

describe("app version", () => {
  it("package.json version matches the branding.json store version", () => {
    expect(pkg.version).toBe(branding.version);
  });
});
