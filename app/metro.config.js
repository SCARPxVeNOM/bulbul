const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// The program IDL lives at the repo root (idl/), shared with the server and SDK.
const idlDir = path.resolve(__dirname, "../idl");
config.watchFolders = [...(config.watchFolders ?? []), idlDir];
config.resolver.extraNodeModules = { ...(config.resolver.extraNodeModules ?? {}), "@idl": idlDir };

module.exports = config;
