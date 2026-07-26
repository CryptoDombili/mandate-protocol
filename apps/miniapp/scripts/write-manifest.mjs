import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const fallbackOrigin = "https://mandate-protocol-3pk.pages.dev";
const origin = (process.env.VITE_APP_ORIGIN || fallbackOrigin).replace(/\/+$/, "");

const manifest = {
  frame: {
    version: "1",
    name: "Mandate",
    tagline: "Membership rails with limits",
    iconUrl: `${origin}/icon.webp`,
    homeUrl: origin,
    splashImageUrl: `${origin}/splash.webp`,
    splashBackgroundColor: "#202126",
    heroImageUrl: `${origin}/hero.webp`,
    imageUrl: `${origin}/preview.webp`,
    primaryCategory: "finance",
    tags: ["memberships", "payments", "soneium", "startale", "mini-apps"]
  },
  startale: {
    manifestVersion: "2.3",
    screenCompatibility: {
      desktop: true,
      landscapeOnly: false
    },
    featuredBannerImageUrl: `${origin}/banner.webp`,
    projectWebsite: origin,
    socialLinks: {
      website: origin
    }
  }
};

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(scriptDirectory, "../dist/.well-known");
const outputFile = path.join(outputDirectory, "farcaster.json");
const body = `${JSON.stringify(manifest, null, 2)}\n`;

if (Buffer.byteLength(body, "utf8") > 10_000) {
  throw new Error("Manifest exceeds Startale's 10 KB limit.");
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputFile, body, "utf8");

console.log(`Generated ${outputFile}`);
