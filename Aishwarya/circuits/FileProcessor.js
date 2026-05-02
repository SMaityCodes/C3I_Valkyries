const fs          = require("fs");
const path        = require("path");
const circomlibjs = require("circomlibjs");

async function run() {

    // Load raw input
    const input = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, "input.json"),
            "utf8"
        )
    );

    const poseidon = await circomlibjs.buildPoseidon();
    const F        = poseidon.F; // finite field — must use this to match circom

    const alpha = BigInt(input.alpha);
    const block = input.File.map(row => row.map(x => BigInt(x)));
    const r     = block.length;
    const c     = block[0].length;

    // Hash alpha
    const hashAlpha = F.toString(poseidon([alpha]));

    const hashBlock = [];
    const sigma     = [];

    for (let j = 0; j < r; j++) {
        const row = block[j];

        // Hash this block row using Poseidon
        hashBlock.push(F.toString(poseidon(row)));

        // Polynomial inside finite field — must match circom exactly
        // sigma = block[0]*alpha^1 + block[1]*alpha^2 + ... + block[c-1]*alpha^c
        let result = F.zero;
        let power  = F.e(alpha);

        for (let i = 0; i < c; i++) {
            const term = F.mul(F.e(row[i]), power);
            result     = F.add(result, term);
            power      = F.mul(power, F.e(alpha));
        }

        sigma.push(F.toString(result));
    }

    // Write output.json — this is what the witness generator reads (command 5)
    const output = {
        File:     input.File.map(row => row.map(x => x.toString())),
        alpha:     alpha.toString(),
        sigma:     sigma,
        hashFile: hashBlock,
        hashAlpha: hashAlpha
    };

    fs.writeFileSync(
        path.join(__dirname, "output.json"),
        JSON.stringify(output, null, 2)
    );

    console.log("✅ output.json written to inputs/");
    console.log("hashAlpha :", hashAlpha);
    console.log("hashBlock :", hashBlock);
    console.log("sigma     :", sigma);
}

run().catch(console.error);
