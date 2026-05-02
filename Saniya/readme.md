# 🔐 ZKP-Based File Integrity Verification System

> A Zero-Knowledge Proof system for verifiable, privacy-preserving file integrity auditing on the blockchain.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [How It Works — High-Level](#-how-it-works--high-level)
- [System Architecture](#-system-architecture)
- [Phase-I: Tag Generation](#-phase-i-tag-generation)
- [Phase-II: Verification Pipeline](#-phase-ii-verification-pipeline)
  - [Step-1: Pre-Computation (setup.js)](#-step-1-pre-computation-setupjs)
  - [Step-2: Circuit Execution (challenge.circom)](#-step-2-circuit-execution-challengecircom)
  - [Step-3: Trusted Setup & Key Generation](#-step-3-trusted-setup--key-generation)
  - [Step-4: Smart Contract Deployment](#-step-4-smart-contract-deployment)
  - [Step-5: Proof Generation & On-Chain Verification](#-step-5-proof-generation--on-chain-verification)
- [Full Pipeline at a Glance](#-full-pipeline-at-a-glance)
- [Folder Structure](#-folder-structure)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Key Concepts](#-key-concepts)

---

## 🧠 Overview

This system allows a **verifier (smart contract)** to confirm that a prover (data owner or auditor) has access to a stored file — **without revealing the file itself**.

It uses:
- **Groth16 Zero-Knowledge Proofs** (via `snarkjs` + `circom`)
- **Poseidon Hash** (ZKP-friendly hash function)
- **Solidity Smart Contracts** (on-chain verification)
- **Ganache / EVM-compatible chain** (for deployment)

The core idea:

```
Prover shows: "I computed μ and τ correctly from the stored data"
WITHOUT revealing: the original file or raw blocks
```

---

## 🔭 How It Works — High-Level

```
File (split into blocks)
        │
        ▼
[Phase-I]  Generate sigma (σ) tags for each block
        │
        ▼
[Step-1]  Pre-compute: μ (aggregated block), τ (aggregated tag), hashes
        │
        ▼
[Step-2]  Compile Circom circuit → challenge.wasm + challenge.r1cs
        │
        ▼
[Step-3]  Trusted setup → proving key (zkey) + verification key
        │
        ▼
[Step-4]  Deploy Solidity verifier + main contract; register device + store data
        │
        ▼
[Step-5]  JS generates proof → submits to contract → contract returns OK / NOT OK
```

---

## 🗺 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FILE OWNER / PROVER                      │
│                                                                 │
│  input.json ──► preCompute/setup.js ──► output.json            │
│                       │                                         │
│                  metadata.json (sigma)                          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CIRCOM CIRCUIT LAYER                        │
│                                                                 │
│  challenge.circom ──► compiled ──► challenge.wasm + .r1cs      │
│                   (defines μ, τ, α constraints)                 │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TRUSTED SETUP LAYER                         │
│                                                                 │
│  .r1cs + .ptau ──► circuit_final.zkey + verification_key.json  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BLOCKCHAIN LAYER (EVM)                        │
│                                                                 │
│  chalResp.js ──► groth16.fullProve() ──► contract.respVerify() │
│                                              │                  │
│                                    verifyProof() + tau check    │
│                                              │                  │
│                                         ✅ OK / ❌ NOT OK       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Phase-I: Tag Generation

Before verification can happen, **cryptographic tags (σ)** must be computed for each block of the file during the setup phase.

Each block `B[i]` gets a tag `sigma[i]` computed using the secret value `α (alpha)`:

```
sigma[i] = f(B[i], alpha)
```

These tags are stored in `metadata.json` and are later used by the smart contract to validate the prover's aggregated tag `τ`.

**Output of Phase-I:**

```json
{
  "sigma": [119018555, 241088855, 0, 0, 0, 0, 0, 0, 0, 0]
}
```

---

## 🔷 Phase-II: Verification Pipeline

---

### 📐 Step-1: Pre-Computation (`setup.js`)

**Folder:** `preCompute/`

#### What it does

This step **prepares all cryptographic values** needed downstream for circuit proving and contract verification. It reads the file blocks and secret `α`, then computes aggregated values and their hashes.

#### Inputs

**`input.json`** — file blocks + alpha (10×10 matrix, unused rows are zero-padded):

```json
{
  "blocks": [
    [1,  2,  3,  4,  5,  6,  7,  8,  9,  10],
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    [0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0,  0,  0]
  ],
  "alpha": "5"
}
```

> Each row = one file block (10 elements). The matrix is always 10×10; blocks not present in the file are zero-padded.

**`metadata.json`** — sigma tags from Phase-I:

```json
{
  "sigma": [119018555, 241088855, 0, 0, 0, 0, 0, 0, 0, 0]
}
```

#### Internal Computation

**1. Generate a deterministic challenge:**

```
index[i] → randomly selected block indices  (seeded → reproducible)
v[i]     → random weights for each selected block
```

**2. Compute μ (resultBlock) — aggregated block vector:**

```
mu[j] = Σ ( block[index[i]][j] × v[i] )
```

Result: a single vector of length 10 — the weighted sum of selected blocks.

**3. Compute τ (resultSigma) — aggregated tag:**

```
tau = Σ ( sigma[index[i]] × v[i] )
```

This is the value the smart contract will later verify.

**4. Compute Poseidon hashes:**

```
hashAlpha = Poseidon(alpha)
hashmu    = Poseidon(mu)
```

**5. Write output:**

```json
{
  "resultBlock": [1110, 1280, 1450, 1620, 1790, 1960, 2130, 2300, 2470, 2640],
  "resultSigma": 31707762550,
  "alpha": "5",
  "hashalpha": "19065150524771031435284970883882288895168425523179566388456001105768498065277",
  "resulthash": "19382678633983957337980793306931663521605586905706883108807666963279381298019"
}
```

#### Output Summary

| Field         | Meaning                     |
|---------------|-----------------------------|
| `resultBlock` | μ — aggregated block vector |
| `resultSigma` | τ — aggregated tag          |
| `alpha`       | same alpha (passed through) |
| `hashalpha`   | Poseidon(α)                 |
| `resulthash`  | Poseidon(μ)                 |

#### Commands

```bash
cd preCompute
npm install       # first time only
node setup.js
```

**Output:** `output.json` ✅

---

### ⚡ Step-2: Circuit Execution (`challenge.circom`)

**Folder:** `circuits/`

#### What it does

This step **compiles the Circom circuit** into WebAssembly and generates the constraint system. The circuit defines the cryptographic constraints that μ, τ, and α must satisfy.

> ⚠️ **Note:** The witness is **not generated here**. It is generated automatically by `chalResp.js` in Step-5 using `challenge.wasm` and `input.json` via `snarkjs.groth16.fullProve()`.

#### Input to Circuit

Create `circuits/input.json` using values from Step-1 `output.json`:

```json
{
  "mu": [1110, 1280, 1450, 1620, 1790, 1960, 2130, 2300, 2470, 2640],
  "tau": 31707762550,
  "alpha": "5",
  "hashAlpha": "19065150524771031435284970883882288895168425523179566388456001105768498065277",
  "hashmu": "19382678633983957337980793306931663521605586905706883108807666963279381298019"
}
```

#### What the Circuit Verifies

The `challenge.circom` circuit enforces **3 cryptographic constraints**:

**Constraint 1 — Alpha hash integrity:**

```
hashAlpha == Poseidon(alpha)
```

Ensures α is correct and untampered.

**Constraint 2 — μ integrity:**

```
hashmu == Poseidon(mu)
```

Ensures the aggregated block vector μ is valid.

**Constraint 3 — τ correctness:**

```
tau == Σ ( mu[j] × alpha^j )
```

Ensures that μ and α together correctly produce τ — no cheating in aggregation.

Together these prove:

```
"μ, τ, and α are mutually consistent and correctly computed"
— without revealing the original file blocks
```

#### Commands

```bash
cd circuits
npm install    # first time only

# Compile circuit
circom challenge.circom --r1cs --wasm --sym -l ./node_modules
```

**Compilation outputs:**

| File              | Purpose                                        |
|-------------------|------------------------------------------------|
| `challenge.r1cs`  | Constraint system (used for trusted setup)     |
| `challenge_js/`   | Folder containing WASM + witness generator     |
| `challenge.wasm`  | Compiled circuit — used by `chalResp.js` later |
| `challenge.sym`   | Debug symbols                                  |

> ✅ Copy `challenge.wasm` into the `Verifier/` folder after compilation — it is used by `chalResp.js` to generate the witness internally during proof generation.

**Output:** `challenge.r1cs` + `challenge_js/challenge.wasm` ✅

---

### 🔑 Step-3: Trusted Setup & Key Generation

This step generates the **cryptographic keys** required for Groth16 proof generation and on-chain verification. It is split into two parts.

---

#### 🟣 Part-A: Powers of Tau (Phase-I Setup)

**Folder:** `Phase-I/`

Powers of Tau is a **universal trusted setup** — run once, reusable for any circuit.

```bash
cd Phase-I

snarkjs powersoftau new bn128 18 pot14_0000.ptau -v

snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau \
  --name="Any_Name1" -v -e="random1"

snarkjs powersoftau contribute pot14_0001.ptau pot14_0002.ptau \
  --name="Any_Name2" -v -e="random2"

snarkjs powersoftau contribute pot14_0002.ptau pot14_0003.ptau \
  --name="Any_Name3" -v -e="random3"

snarkjs powersoftau beacon pot14_0003.ptau pot14_beacon.ptau \
  0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f \
  10 -n="Final Beacon"

snarkjs powersoftau prepare phase2 pot14_beacon.ptau pot14_final.ptau -v

snarkjs powersoftau verify pot14_final.ptau
```

**Output:** `pot14_final.ptau` ✅

| File              | Role                               |
|-------------------|------------------------------------|
| `pot14_final.ptau`| Universal trusted randomness for all circuits |

> ⚠️ Run Phase-I **only once** and reuse `pot14_final.ptau` for all future circuits.

---

#### 🟢 Part-B: Circuit-Specific Setup (Phase-II Keys)

**Folder:** `Phase-II/`

**Inputs required:**
- `pot14_final.ptau` (from Part-A)
- `challenge.r1cs` (from Step-2)

```bash
cd ../Phase-II

filename=challenge.r1cs

snarkjs groth16 setup $filename pot14_final.ptau circuit_0000.zkey

snarkjs zkey contribute circuit_0000.zkey circuit_0001.zkey \
  --name="User1" -v -e="rand1"

snarkjs zkey contribute circuit_0001.zkey circuit_0002.zkey \
  --name="User2" -v -e="rand2"

snarkjs zkey contribute circuit_0002.zkey circuit_0003.zkey \
  --name="User3" -v -e="rand3"

snarkjs zkey beacon circuit_0003.zkey circuit_final.zkey \
  0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f \
  10 -n="Final Beacon"

snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

snarkjs zkey verify $filename pot14_final.ptau circuit_final.zkey
```

**Outputs:**

| File                   | Role                                          |
|------------------------|-----------------------------------------------|
| `circuit_final.zkey`   | Proving Key — used by JS to generate proofs   |
| `verification_key.json`| Verification Key — used by Solidity contract  |

> ⚠️ Always ensure `r1cs`, `zkey`, and `wasm` all correspond to the **same circuit version**.

---

### 🏗 Step-4: Smart Contract Deployment

**Folder:** `contracts/`

#### What it does

Deploys the verifier and main auditing contract to the blockchain, then initializes it with device data, file hashes, and sigma tags — making it ready to accept and verify proofs.

---

#### 🟣 Part-A: Generate `verifier.sol`

```bash
cd Phase-II
snarkjs zkey export solidityverifier circuit_final.zkey verifier.sol
```

This generates a Solidity contract containing a `verifyProof()` function that validates Groth16 proofs on-chain.

---

#### 🟢 Part-B: Deploy in Remix IDE

1. Open [https://remix.ethereum.org](https://remix.ethereum.org)
2. Upload **both** files into the same folder:
   - `verifier.sol`
   - `main.sol`
3. Select Solidity version `0.8.x`
4. Compile both files
5. Connect to **Ganache** via Injected Provider / Custom RPC
6. Deploy `Auditor` (`main.sol`)

---

#### 🟡 Part-C: Initialize Contract State

Before any proof can be verified, you **must** initialize the contract with device and file data. All calls use the **admin/deployer account**.

**1. Register the device:**

```
Function: updateDevices(dID, deviceAddress, hashAlpha)

Example:
  dID           = 1
  deviceAddress = <your Ganache wallet address>
  hashAlpha     = <hashalpha from Step-1 output.json>
```

**2. Store file block hashes:**

```
Function: updateFileHashes(dID, fID, hash_M)

hash_M = array of block hashes (one per block)

Example in Remix:
  ["3657500514...", "5150312740...", ...]
```

**3. Store sigma tags:**

```
Function: setSigma(dID, fID, sigmaArray)

Example in Remix:
  [119018555, 241088855, 0, 0, 0, 0, 0, 0, 0, 0]
```

Once all three calls succeed:

```
✅ Device registered
✅ File hashes stored
✅ Sigma stored
→ Contract is ready for proof verification
```

> ⚠️ The `hashAlpha` passed here **must exactly match** the value used in the circuit.  
> ⚠️ The `sigma` array **must exactly match** the values from Step-1.  
> ⚠️ Array **order matters** — do not shuffle.

---

### 🚀 Step-5: Proof Generation & On-Chain Verification

**Folder:** `Verifier/`

#### What it does

This is the **final step** that completes the full pipeline — generating a ZKP and submitting it to the smart contract for on-chain verification.

---

#### Required Files in `Verifier/`

| File                 | Why Needed                                              |
|----------------------|---------------------------------------------------------|
| `circuit_final.zkey` | Proving Key — `snarkjs` uses this to generate the proof |
| `challenge.wasm`     | Compiled circuit — executes the circuit to build witness |
| `input.json`         | Circuit inputs (μ, τ, α, hashes) — what you're proving  |
| `chalResp.js`        | Orchestrator — ties proof generation + contract call together |

**`input.json`** (same values from Step-2):

```json
{
  "mu": [1110, 1280, 1450, 1620, 1790, 1960, 2130, 2300, 2470, 2640],
  "tau": 31707762550,
  "alpha": "5",
  "hashAlpha": "19065150524771031435284970883882288895168425523179566388456001105768498065277",
  "hashmu": "19382678633983957337980793306931663521605586905706883108807666963279381298019"
}
```

---

#### Configure `chalResp.js`

Before running, paste these values into `chalResp.js`:

```js
const CONTRACT_ADDRESS = "<deployed Auditor contract address>";
const CONTRACT_ABI     = [ /* ABI from Remix */ ];
const PRIVATE_KEY      = "<Ganache account private key>";
```

---

#### What Happens Internally

**1. Generate proof (inside JS):**

```js
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  input,
  "challenge.wasm",
  "circuit_final.zkey"
);
```

This internally:
- Runs `challenge.wasm` on `input.json` to compute the witness
- Uses `circuit_final.zkey` to generate the Groth16 proof

**2. Extract public signals:**

```
publicSignals = [tau, hashmu, hashAlpha]
```

**3. Call smart contract:**

```js
contract.respVerify(proof_a, proof_b, proof_c, publicSignals, dID, fID)
```

**4. Contract performs four checks:**

```
① verifyProof()        → ZKP is mathematically valid
② hashAlpha match      → stored hashAlpha == circuit's hashAlpha
③ recompute tau        → Σ(v[i] × sigma[index[i]])
④ compare tau          → computed tau == proof's tau
```

All four must pass for the result to be `OK`.

---

#### Run

```bash
cd Verifier
node chalResp.js
```

---

#### Final Output

```
🎉 FINAL RESULT: OK
```

or

```
❌ FINAL RESULT: NOT OK
```

---

## 🔁 Full Pipeline at a Glance

```
Phase-I
  └─► sigma tags for each block → metadata.json

Phase-II
  Step-1: preCompute/setup.js
    └─► μ (resultBlock), τ (resultSigma), hashAlpha, hashmu → output.json

  Step-2: circuits/challenge.circom
    └─► challenge.r1cs + challenge.wasm (compiled circuit)

  Step-3: Trusted Setup
    ├─► Phase-I: pot14_final.ptau
    └─► Phase-II: circuit_final.zkey + verification_key.json

  Step-4: Smart Contract
    ├─► verifier.sol generated
    ├─► Auditor (main.sol) deployed
    └─► Device + FileHashes + Sigma initialized on-chain

  Step-5: Verifier/chalResp.js
    └─► Proof generated → submitted → ✅ OK / ❌ NOT OK
```

---

## 📁 Folder Structure

The following reflects the actual project layout:

```
challenge-resp/
│
├── circuits/
│   ├── AsigCal.circom        # Helper circuit (assignment/calculation)
│   ├── challenge.circom      # Main ZKP circuit
│   ├── challenge_js/         # Generated: WASM + witness generator
│   │   └── challenge.wasm    # Compiled circuit (copy to Verifier/)
│   ├── challenge.r1cs        # Generated: constraint system
│   ├── challenge.sym         # Generated: debug symbols
│   ├── input.json            # Circuit inputs (μ, τ, α, hashes)
│   ├── witness.wtns          # Generated: witness (for debug only)
│   ├── node_modules/
│   ├── package.json
│   └── package-lock.json
│
├── contracts/
│   ├── main.sol              # Auditor contract (deploy this)
│   └── verifier.sol          # Auto-generated Groth16 verifier
│
├── Phase-I/
│   ├── pot14_0000.ptau       # Initial contribution
│   ├── pot14_0001.ptau       # Contribution 1
│   ├── pot14_0002.ptau       # Contribution 2
│   ├── pot14_0003.ptau       # Contribution 3
│   ├── pot14_beacon.ptau     # After beacon
│   └── pot14_final.ptau      # ✅ Final — used in Phase-II setup
│
├── Phase-II/
│   ├── challenge.r1cs        # Constraint system (copied from circuits/)
│   ├── circuit_0000.zkey     # Initial zkey
│   ├── circuit_0001.zkey     # Contribution 1
│   ├── circuit_0002.zkey     # Contribution 2
│   ├── circuit_0003.zkey     # Contribution 3
│   ├── circuit_final.zkey    # ✅ Proving Key (copy to Verifier/)
│   ├── pot14_final.ptau      # Reference to Phase-I output
│   └── verification_key.json # ✅ Verification Key (for contract)
│
├── preCompute/
│   ├── setup.js              # Pre-computation script
│   ├── input.json            # File blocks (10×10) + alpha
│   ├── metadata.json         # Sigma tags from Phase-I
│   ├── output.json           # Generated: μ, τ, hashes
│   ├── node_modules/
│   ├── package.json
│   └── package-lock.json
│
└── Verifier/
    ├── chalResp.js           # ✅ Final orchestrator — generates proof + calls contract
    ├── challenge.wasm        # Compiled circuit (copied from circuits/challenge_js/)
    ├── circuit_final.zkey    # Proving Key (copied from Phase-II/)
    ├── input.json            # Circuit inputs (same as circuits/input.json)
    ├── proof.json            # Generated: ZKP proof
    ├── public.json           # Generated: public signals
    ├── node_modules/
    ├── package.json
    └── package-lock.json
```

---

## 🛠 Prerequisites

| Tool        | Version    | Install                          |
|-------------|------------|----------------------------------|
| Node.js     | ≥ 16.x     | https://nodejs.org               |
| snarkjs     | latest     | `npm install -g snarkjs`         |
| circom      | 2.x        | https://docs.circom.io/getting-started/installation/ |
| Remix IDE   | web        | https://remix.ethereum.org       |
| Ganache     | latest     | https://trufflesuite.com/ganache |

---

## ⚡ Quick Start

```bash
# 1. Pre-compute aggregated values
cd preCompute && npm install && node setup.js

# 2. Compile circuit (no witness generation here — done automatically in Step-5)
cd ../circuits && npm install
circom challenge.circom --r1cs --wasm --sym -l ./node_modules
# Copy wasm to Verifier/
cp challenge_js/challenge.wasm ../Verifier/

# 3. Trusted setup (run once)
cd ../Phase-I
snarkjs powersoftau new bn128 18 pot14_0000.ptau -v
# ... (contribute + beacon + prepare phase2 + verify — see Step-3)

cd ../Phase-II
snarkjs groth16 setup challenge.r1cs pot14_final.ptau circuit_0000.zkey
# ... (contribute + beacon + export verificationkey + verify — see Step-3)
snarkjs zkey export solidityverifier circuit_final.zkey verifier.sol

# 4. Deploy contracts in Remix, call updateDevices + updateFileHashes + setSigma

# 5. Run final verification
cd ../Verifier
# (paste contract address, ABI, private key into chalResp.js)
node chalResp.js
```

---

## 🧩 Key Concepts

| Term           | Meaning                                                                 |
|----------------|-------------------------------------------------------------------------|
| **α (alpha)**  | Secret value used to compute sigma tags and verify τ                    |
| **σ (sigma)**  | Per-block cryptographic tag computed during Phase-I                     |
| **μ (mu)**     | Aggregated block vector — weighted sum of selected blocks               |
| **τ (tau)**    | Aggregated tag — weighted sum of selected sigma values                  |
| **Poseidon**   | ZKP-friendly hash function used inside Circom circuits                  |
| **Groth16**    | Efficient ZKP proving system — small proofs, fast on-chain verification |
| **ptau**       | Powers of Tau — universal trusted setup parameters                      |
| **zkey**       | Circuit-specific proving key generated from ptau + r1cs                 |
| **witness**    | All circuit signal values satisfying the constraints                    |
| **r1cs**       | Rank-1 Constraint System — mathematical encoding of the circuit         |

---

## 🎯 What This System Proves

```
"I computed μ and τ correctly from the committed file blocks and their sigma tags"
```

**Without revealing:**
- The original file contents
- Individual raw block values
- The secret α

This is the essence of **Zero-Knowledge**: proving knowledge without disclosure.

---

## 📜 License

MIT

---

*Built with [snarkjs](https://github.com/iden3/snarkjs) · [circom](https://github.com/iden3/circom) · [Solidity](https://soliditylang.org)*
