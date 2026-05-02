# 🔐 ZK Tag Verifier

> **Prove file integrity without revealing your secret key.**
> A Zero Knowledge Proof system built with Circom + Groth16 + snarkjs.

---

## 🧠 The Idea

A file is split into **n blocks**. A device holds a **secret key α (alpha)** and computes an authentication tag `σᵢ` for each block using an **algebraic signature scheme**.

The device can then generate a **zero-knowledge proof** that convinces any verifier that the tags were computed correctly — **without ever revealing α**.

### What the proof guarantees

| Check | Description |
|---|---|
| `Poseidon(α) == hashAlpha` | Commitment to the secret key |
| `Poseidon(File[i]) == hashFile[i]` | Commitment to each block |
| `Σ File[i][j] · αʲ⁺¹ == σᵢ` | Tags were computed correctly |

---

## ⚙️ How It Works

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  input.json │────▶│ FileProcessor.js │────▶│ output.json  │
│ File + alpha│     │  Poseidon hash   │     │ hashFile     │
└─────────────┘     │  Algebraic Sign. │     │ hashAlpha    │
                    └──────────────────┘     │ sigma        │
                                             └──────┬───────┘
                                                    │
                    ┌──────────────────┐            │
                    │tagVerifier.circom│            │
                    │ (compiled to     │            │
                    │  .wasm + .r1cs)  │            │
                    └────────┬─────────┘            │
                             │                      │
                             ▼                      ▼
                    ┌──────────────────────────────────┐
                    │       generate_witness.js         │
                    │    (checks all constraints)       │
                    └──────────────┬───────────────────┘
                                   │
                                   ▼
                           witness.wtns ✅
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
           circuit_final.zkey             witness.wtns
             (proving key)
                    │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  groth16 prove  │
                          └────────┬────────┘
                                   │
                      ┌────────────┴────────────┐
                      ▼                         ▼
                  proof.json              public.json
                (ZK proof π)           (public signals)
                      │                         │
                      └────────────┬────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ groth16 verify  │◀── verification_key.json
                          └────────┬────────┘
                                   │
                                   ▼
                                ✅ OK!
```

---

## 📁 Project Structure

```
circuits/
├── 📄 AsigCal.circom          — Algebraic signature computation
├── 📄 tagVerifier.circom      — main ZK circuit
├── 📄 FileProcessor.js        — JS preprocessing (hash + sigma)
├── 📄 input.json              — raw input: File blocks + alpha
├── 📄 output.json             — computed: hashFile, hashAlpha, sigma
├── 📄 tagVerifier.r1cs        — compiled circuit constraints
├── 📄 tagVerifier.sym         — symbol table
├── 📁 circomlib/              — Poseidon + utilities
└── 📁 build/                  — compiled wasm + witness generator
```

---

## 🚀 Getting Started

### Prerequisites

<details>
<summary><b>Install Circom</b></summary>

```bash
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom
cd ..
circom --version
```
</details>

<details>
<summary><b>Install Node.js (v16+)</b></summary>

Download from [nodejs.org](https://nodejs.org/en) and verify:
```bash
node --version
```
</details>

---

## 🔧 Setup

```bash
# Enter project folder
cd ~/Downloads/circuits

# Install JS dependencies
npm init -y
npm install circomlibjs snarkjs

# Clone Circomlib (needed for Poseidon hash inside the circuit)
git clone https://github.com/iden3/circomlib.git
```

---

## 🏃 Running the Pipeline

### Step 1 — Compile the circuit
```bash
mkdir -p build
circom tagVerifier.circom \
  -l ./circomlib \
  --r1cs --wasm --sym -o build
```
> Produces `build/tagVerifier.r1cs` and `build/tagVerifier_js/tagVerifier.wasm`

---

### Step 2 — Generate hashes and tags
```bash
node FileProcessor.js
```
> Reads `input.json` → computes Poseidon hashes and polynomial sigma in the **BabyJub finite field** → writes `output.json`

---

### Step 3 — Generate witness
```bash
node build/tagVerifier_js/generate_witness.js \
  build/tagVerifier_js/tagVerifier.wasm \
  output.json \
  build/witness.wtns
```
> Silent exit = all circuit constraints satisfied ✅  
> Any error = mismatch between JS values and circuit expectations

---

### Step 4 — Verify witness (sanity check)
```bash
npx snarkjs wtns check build/tagVerifier.r1cs build/witness.wtns
```

---

## 🔑 Trusted Setup

### Phase 1 — Powers of Tau

```bash
snarkjs powersoftau new bn128 18 pot14_0000.ptau -v
snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="Any_Name1" -v -e="some random text11"
snarkjs powersoftau contribute pot14_0001.ptau pot14_0002.ptau --name="Any_Name2" -v -e="some random text22"
snarkjs powersoftau contribute pot14_0002.ptau pot14_0003.ptau --name="Any_Name3" -v -e="some random text33"
snarkjs powersoftau beacon pot14_0003.ptau pot14_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"
snarkjs powersoftau prepare phase2 pot14_beacon.ptau pot14_final.ptau -v
snarkjs powersoftau verify pot14_final.ptau
```
> Output: `pot14_final.ptau` — carry this into Phase 2

---

### Phase 2 — Groth16 zkey

```bash
filename=tagVerifier.r1cs

snarkjs groth16 setup build/$filename pot14_final.ptau circuit_0000.zkey
snarkjs zkey contribute circuit_0000.zkey circuit_0001.zkey --name="1st Contributor Name" -v -e="some random text11"
snarkjs zkey contribute circuit_0001.zkey circuit_0002.zkey --name="2nd Contributor Name" -v -e="some random text22"
snarkjs zkey contribute circuit_0002.zkey circuit_0003.zkey --name="3rd Contributor Name" -v -e="some random text33"
snarkjs zkey beacon circuit_0003.zkey circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
snarkjs zkey verify build/$filename pot14_final.ptau circuit_final.zkey
```

> **`circuit_final.zkey`** — proving key (used by prover)  
> **`verification_key.json`** — verification key (used by verifier)

---

## 📜 Generate Proof

```bash
snarkjs groth16 prove \
  circuit_final.zkey \
  build/witness.wtns \
  proof.json \
  public.json
```

| Output | Description |
|---|---|
| `proof.json` | The ZK proof π — cryptographic guarantee |
| `public.json` | Public signals: hashAlpha, hashFile, sigma |

---

## ✅ Verify Proof

```bash
snarkjs groth16 verify verification_key.json public.json proof.json
```

```
[INFO]  snarkJS: OK!
```

---

## 📐 Circuit Internals

### `AsigCal.circom`
Algebraic Signature:

```
σ = Σ Sector[j] · α^(j+1)
```

All arithmetic is computed **inside the BabyJub scalar field** (mod p), matching the JS computation exactly.

### `tagVerifier.circom`
Main circuit — instantiates `AsigCal` for each block:

```
Private inputs  →  File[n][s],  alpha
Public inputs   →  sigma[n],  hashFile[n],  hashAlpha

For each block i:
  Poseidon(alpha)     === hashAlpha      ✓
  Poseidon(File[i])   === hashFile[i]    ✓
  AsigCal(File[i], α) === sigma[i]       ✓
```

Current config: **n = 2 blocks**, **s = 10 elements per block**

---

## 📋 input.json Format

```json
{
    "alpha": "2",
    "File": [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    ]
}
```

| Field | Type | Description |
|---|---|---|
| `alpha` | string | Secret key — stays private |
| `File` | number\[\]\[\] | n blocks × s elements each |

---

## 📚 References

- [Circom Documentation](https://docs.circom.io/)
- [snarkjs GitHub](https://github.com/iden3/snarkjs)
- [circomlib GitHub](https://github.com/iden3/circomlib)
- [BabyJub Scalar Field](https://eips.ethereum.org/EIPS/eip-2494)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
