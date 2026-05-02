const fs = require('fs');
const circomlib = require('circomlibjs');

// --- Seeded Random Generator ---
function seededRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function generateRandomIntArray(seed, size, max) {
    let arr = [];
    for (let i = 0; i < size; i++) {
        arr.push(Math.floor(seededRandom(seed + i) * max));
    }
    return arr;
}

// --- Parameters ---
const seed1 = 111;
const seed2 = 222;
const SIZE = 10;
const BLOCK_SIZE = 10;

(async () => {
    // --- Load Files ---
    const blockData = JSON.parse(fs.readFileSync('input.json'));
    const metadata = JSON.parse(fs.readFileSync('metadata.json'));

    const blocks = blockData.blocks;   // ✅ correct key
    const alpha = blockData.alpha;
    const sigma = metadata.sigma;

    // --- Step 1: Generate index[i] and v[i] ---
    const index = generateRandomIntArray(seed1, SIZE, blocks.length); // ✅ safe
    const v = generateRandomIntArray(seed2, SIZE, 100);

    // --- Step 2: Compute resultBlock (μ) ---
    let resultBlock = Array(BLOCK_SIZE).fill(0);

    for (let i = 0; i < SIZE; i++) {
        const blockRow = blocks[index[i]].map(x => Number(x)); // ✅ convert
        for (let j = 0; j < BLOCK_SIZE; j++) {
            resultBlock[j] += blockRow[j] * v[i];
        }
    }

    // --- Step 3: Compute resultSigma (τ) ---
    let resultSigma = 0;
    for (let i = 0; i < SIZE; i++) {
        resultSigma += Number(sigma[index[i]]) * v[i];
    }

    // --- Step 4: Poseidon Setup ---
    const poseidon = await circomlib.buildPoseidon();
    const F = poseidon.F;

    const hashAlpha = F.toString(poseidon([BigInt(alpha)]));

    const resultBlockBigInt = resultBlock.map(x => BigInt(x));
    const resultHash = F.toString(poseidon(resultBlockBigInt));

    // --- Step 5: Output ---
    const output = {
        resultBlock,
        resultSigma,
        alpha,
        hashalpha: hashAlpha,
        resulthash: resultHash
    };

    fs.writeFileSync('output.json', JSON.stringify(output, null, 2));
    console.log("✅ Output written to output.json");

})();