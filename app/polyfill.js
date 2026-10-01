import { install } from "react-native-quick-crypto";
import { Buffer as RnBuffer } from "@craftzdog/react-native-buffer";
import { Buffer as NpmBuffer } from "buffer";

install();

// Hermes ignores Symbol.species on typed arrays, so Buffer#subarray returns a plain
// Uint8Array. Anchor's Borsh decoder slices account data with subarray and then calls
// Buffer methods (readUIntLE, …) on the result. Keep subarray returning a Buffer for both
// implementations in the bundle: quick-crypto's global Buffer and the `buffer` package
// that @solana/web3.js and Anchor import.
for (const B of [RnBuffer, NpmBuffer]) {
  B.prototype.subarray = function subarray(start, end) {
    const view = Uint8Array.prototype.subarray.call(this, start, end);
    Object.setPrototypeOf(view, B.prototype);
    return view;
  };
}
