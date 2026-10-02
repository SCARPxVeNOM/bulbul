const preset = require("jest-expo/jest-preset");

// Expo inlines EXPO_PUBLIC_* at transform time, so tests get fixed values here
// instead of whatever the developer's local .env points at.
Object.assign(process.env, {
  EXPO_PUBLIC_RPC_URL: "http://127.0.0.1:8899",
  EXPO_PUBLIC_SOLANA_CHAIN: "solana:devnet",
  EXPO_PUBLIC_TX_SUBMIT: "app",
  EXPO_PUBLIC_API_URL: "http://127.0.0.1:8787",
  EXPO_PUBLIC_APP_URL: "bulbul://app",
});

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
