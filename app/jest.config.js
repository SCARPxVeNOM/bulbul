const preset = require("jest-expo/jest-preset");

// @solana/* and @anchor-lang/* ship ESM .mjs builds; run them through the same
// Babel transform the preset uses for .js/.ts.
const transform = Object.fromEntries(
  Object.entries(preset.transform).map(([pattern, t]) => [pattern === "\\.[jt]sx?$" ? "\\.m?[jt]sx?$" : pattern, t]),
);

module.exports = {
  preset: "jest-expo",
  transform,
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|react-native-svg|@solana/.*|@solana-mobile/.*|@anchor-lang/.*|@noble/.*|@wallet-ui/.*|superstruct|uuid|jayson|rpc-websockets)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@idl/(.*)$": "<rootDir>/../idl/$1",
    // Only exports "browser"/"node" conditions; use the browser build, as Metro does.
    "^rpc-websockets$": "<rootDir>/node_modules/rpc-websockets/dist/index.browser.cjs",
  },
};
