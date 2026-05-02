const snarkjs = require("snarkjs");
const fs = require("fs");
const { ethers } = require("ethers");
const circomlib = require("circomlibjs");

// ================= CONFIG =================
const RPC_URL = "http://127.0.0.1:8545";
const PRIVATE_KEY = "YOUR ACCOUNT PRIVATE KEY";
const CONTRACT_ADDRESS = "YOUR CONTRACT ADDRESS";

const dID = 1;
const fID = 1;

// SAME SEEDS (must match μ, τ computation)
const seed1 = 111;
const seed2 = 222;
const SIZE = 10;
const BLOCKS_LENGTH = 10;

// ================= ABI =================
// 🔥 PASTE YOUR ABI HERE (must include respVerify with uint256[3])
const ABI = [
  //YOU abi
];

// ================= PRF =================
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

// ================= MAIN =================
async function main() {

    console.log("⚙️ Recomputing challenge...");
    const index = generateRandomIntArray(seed1, SIZE, BLOCKS_LENGTH);
    const v = generateRandomIntArray(seed2, SIZE, 100);

    console.log("Index:", index);
    console.log("v:", v);

    // ================= GENERATE PROOF =================

      console.log("📥 Reading input.json...");
        const input = JSON.parse(fs.readFileSync("input.json"));
    
        console.log("⚙️ Generating proof...");
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            "challenge.wasm",
            "circuit_final.zkey"
        );
    

    // Save for debugging (optional)
    fs.writeFileSync("proof.json", JSON.stringify(proof, null, 2));
    fs.writeFileSync("public.json", JSON.stringify(publicSignals, null, 2));

    // ================= DEBUG =================
    console.log("\n=== DEBUG ===");
    console.log("publicSignals:", publicSignals);

    // ================= FIXED PUBLIC SIGNALS =================
    // 🔥 MUST be fixed array of size 3
    const pubSignalsFixed = [
        publicSignals[0],
        publicSignals[1],
        publicSignals[2]
    ];

    // ================= FORMAT PROOF =================
    const a = [proof.pi_a[0], proof.pi_a[1]];
    const b = [
        [proof.pi_b[0][1], proof.pi_b[0][0]], // swap
        [proof.pi_b[1][1], proof.pi_b[1][0]]
    ];
    const c = [proof.pi_c[0], proof.pi_c[1]];

    // ================= CONTRACT =================
    console.log("\n🔗 Connecting to contract...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    try {
        console.log("\n📤 Calling contract...");

        const result = await contract.respVerify(
            dID,
            fID,
            a,
            b,
            c,
            pubSignalsFixed,   // ✅ FIXED ARRAY
            index,
            v
        );

        if (result) {
            console.log("\n🎉 FINAL RESULT: ✅ OK");
        } else {
            console.log("\n❌ FINAL RESULT: NOT OK");
        }

    } catch (err) {
        console.log("\n❌ FINAL RESULT: NOT OK (reverted)");
        console.error(err.reason || err.message);
    }
}

main();