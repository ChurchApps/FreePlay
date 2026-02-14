const { spawnSync } = require("child_process");

const result = spawnSync("npx", ["expo", "prebuild", "--clean"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, EXPO_TV: "1" },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
