// Generates a brand-new, zero-history keypair for a disposable test
// identity. Prints ONLY the address - the raw private key is written to
// a local file that is never read back out loud, so it never appears in
// any visible output.
import { createAccount, generatePrivateKey } from "genlayer-js";
import { writeFileSync } from "fs";

const label = process.argv[2] || "key";
const pk = generatePrivateKey();
const account = createAccount(pk);

writeFileSync(`./.scratch-${label}.txt`, pk, { mode: 0o600 });
console.log(`${label} address: ${account.address}`);
