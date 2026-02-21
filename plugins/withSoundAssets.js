const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SOUND_DIR = "assets/sounds";

function withSoundAssets(config) {
  // Android: copy sound files to res/raw/
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const soundsDir = path.join(projectRoot, SOUND_DIR);
      const rawDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "raw"
      );

      if (!fs.existsSync(soundsDir)) return config;
      if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });

      const files = fs.readdirSync(soundsDir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) {
          fs.copyFileSync(
            path.join(soundsDir, file),
            path.join(rawDir, file.toLowerCase().replace(/[^a-z0-9_.]/g, "_"))
          );
        }
      }

      return config;
    },
  ]);

  // iOS: copy sound files to the iOS project and add to Xcode build
  config = withXcodeProject(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const soundsDir = path.join(projectRoot, SOUND_DIR);
    const iosProjectRoot = config.modRequest.platformProjectRoot;
    const projectName = config.modRequest.projectName;
    const targetDir = path.join(iosProjectRoot, projectName);

    if (!fs.existsSync(soundsDir)) return config;

    const project = config.modResults;
    const files = fs.readdirSync(soundsDir);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) {
        const src = path.join(soundsDir, file);
        const dest = path.join(targetDir, file);
        fs.copyFileSync(src, dest);
        // Add to Xcode project resources if not already present
        const firstTarget = project.getFirstTarget();
        if (!project.hasFile(file) && firstTarget) {
          try {
            project.addResourceFile(file, { target: firstTarget.uuid });
          } catch {
            // tvOS projects may lack a Resources group; file is still copied
          }
        }
      }
    }

    return config;
  });

  return config;
}

module.exports = withSoundAssets;
