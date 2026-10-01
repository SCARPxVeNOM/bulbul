import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const STAGES = ["curious", "focused", "evolving", "legendary"] as const;
export type StageSlug = (typeof STAGES)[number];

export const ART_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "companion");

const DESCRIPTIONS: Record<StageSlug, string> = {
  curious: "Just hatched. Ready to grow with you.",
  focused: "Shaped by your first kept commitments.",
  evolving: "Built from verified savings and streaks.",
  legendary: "Earned through sustained, verified commitment.",
};

export function isStage(s: string): s is StageSlug {
  return (STAGES as readonly string[]).includes(s);
}

export function artPath(stage: StageSlug): string {
  return join(ART_DIR, `${stage}.png`);
}

export function missingArt(): StageSlug[] {
  return STAGES.filter((s) => !existsSync(artPath(s)));
}

/** Metaplex-standard JSON for the companion URI the program writes on-chain. */
export function companionMetadata(baseUrl: string, stage: StageSlug) {
  const name = stage[0]!.toUpperCase() + stage.slice(1);
  const image = `${baseUrl}/companion/${stage}.png`;
  return {
    name: `bulbul · ${name}`,
    symbol: "BULBUL",
    description: `${DESCRIPTIONS[stage]} A soulbound companion that evolves only from verified on-chain commitments.`,
    image,
    external_url: baseUrl,
    attributes: [{ trait_type: "stage", value: name }],
    properties: { category: "image", files: [{ uri: image, type: "image/png" }] },
  };
}
