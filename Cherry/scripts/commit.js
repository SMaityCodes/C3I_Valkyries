const fs          = require("fs");
const path        = require("path");
const circomlibjs = require("circomlibjs");

// Set your maximums here to match the Circom template
const MAX_N = 10;
const MAX_S = 10;

async function run() {

    // Load raw input
    const input = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, "initial.json"),
            "utf8"
        )
    );

    const poseidon = await circomlibjs.buildPoseidon();
    const F        = poseidon.F; // finite field

    const alpha = BigInt(input.alpha);
    const block = input.block.map(row => row.map(x => BigInt(x)));
    const r     = block.length;
    const c     = block[0].length; // Should be MAX_S (10)

    // Hash alpha
    const hashAlpha = F.toString(poseidon([alpha]));

    const hashFile = [];
    const sigma    = [];
    const fileOut  = []; // This will store the stringified, padded blocks

    // 1. Process the ACTUAL data rows
    for (let j = 0; j < r; j++) {
        const row = block[j];
        fileOut.push(row.map(x => x.toString()));

        // Hash this block row using Poseidon
        hashFile.push(F.toString(poseidon(row)));

        // Polynomial inside finite field
        let result = F.zero;
        let power  = F.e(alpha);

        for (let i = 0; i < c; i++) {
            const term = F.mul(F.e(row[i]), power);
            result     = F.add(result, term);
            power      = F.mul(power, F.e(alpha));
        }

        sigma.push(F.toString(result));
    }

    // 2. Pre-calculate the zero-padding values
    const zeroRow  = Array(MAX_S).fill(BigInt(0));
    const zeroHash = F.toString(poseidon(zeroRow));
    const zeroSig  = "0"; // Math on zeros results in 0

    // 3. Apply padding until we hit MAX_N
    while (fileOut.length < MAX_N) {
        fileOut.push(Array(MAX_S).fill("0"));
        hashFile.push(zeroHash);
        sigma.push(zeroSig);
    }

    // 4. Format output strictly to match Circom signal names
    // block -> File, hashBlock -> hashFile
    const output = {
        File:      fileOut,
        alpha:     alpha.toString(),
        sigma:     sigma,
        hashFile:  hashFile,
        hashAlpha: hashAlpha
    };

    // Write to output.json (or directly to your circom inputs folder)
    fs.writeFileSync(
        path.join(__dirname, "output.json"),
        JSON.stringify(output, null, 2)
    );

    console.log(`✅ output.json written. Padded to ${MAX_N} blocks.`);
    console.log("hashAlpha :", hashAlpha);
    console.log(`File length : ${output.File.length} blocks`);
    console.log(`hashFile len: ${output.hashFile.length}`);
    console.log(`sigma len   : ${output.sigma.length}`);
}

run().catch(console.error);