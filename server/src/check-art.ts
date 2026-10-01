import { ART_DIR, STAGES, missingArt } from "./metadata.js";

const missing = missingArt();
if (missing.length === 0) {
  console.log(`All ${STAGES.length} companion stages have art in ${ART_DIR}`);
} else {
  console.error(`Missing companion art in ${ART_DIR}:\n${missing.map((s) => `  - ${s}.png`).join("\n")}`);
  process.exit(1);
}
