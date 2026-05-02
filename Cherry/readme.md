# 🔐 Tag Verification using Zero-Knowledge Proofs (ZKP)

## 📌 Overview

This module is responsible for **verifying data tags using Zero-Knowledge Proofs (ZKP)**.

It ensures that:
- The tag (σ) and hash (Poseidon hash of α) are correctly generated
- The proof is valid **without revealing sensitive data**
- Verification is performed on-chain using a **Solidity smart contract**

---

## 📁 Project Structure

```

Cherry/
│
├── scripts/
│   ├── commit.js              # Generates output.json (α, σ, hashFile, hashα)
│   └── initial.json           # Initial inputs (file, α)
│
├── verify-snarkjs/
│   ├── main.sol               # Smart contract
│
├── js/
│   └── main.js                # Proof generation + blockchain interaction
│

````

---

## ⚙️ Prerequisites

Make sure the following are installed:

- Node.js
- snarkjs
- circom
- Ganache
- Remix IDE (browser)

---

## 🚀 Execution Pipeline

---

### 🧩 Step 1: Generate Tag Data

Run:

```bash
node scripts/commit.js
````

### 📤 Output:

* `output.json` containing:

  * `File` (blocks of original file)
  * `alpha`
  * `sigma` (MAC signature)
  * `hashFile` (Poseidon hash of file)
  * `hashAlpha` (Poseidon hash of alpha)

➡️ Copy/rename:

```
scripts/output.json → Aishwarya/circuits/input.json
```

---

### 🧠 Step 2: Circuit Compilation

Using the Circom circuit (`tagVerifier.circom`):

Generate:

* `.r1cs`
* `.wasm`
* `.wtns`

---

### 🔑 Step 3: ZKP Setup (Phase 1 + Phase 2)

#### 1. Powers of Tau Ceremony

```bash
snarkjs powersoftau new bn128 18 pot14_0000.ptau -v
snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="Any_Name1" -v -e="some random text11"
snarkjs powersoftau contribute pot14_0001.ptau pot14_0002.ptau --name="Any_Name2" -v -e="some random text22"
snarkjs powersoftau contribute pot14_0002.ptau pot14_0003.ptau --name="Any_Name3" -v -e="some random text33"
snarkjs powersoftau beacon pot14_0003.ptau pot14_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"
snarkjs powersoftau prepare phase2 pot14_beacon.ptau pot14_final.ptau -v
snarkjs powersoftau verify pot14_final.ptau
```

#### 2. Phase 2 Preparation

Make sure the following are installed:

- pot14_final.ptau
- tagVerifier.r1cs

```bash
filename=tagVerifier.r1cs
snarkjs groth16 setup $filename pot14_final.ptau circuit_0000.zkey
snarkjs zkey contribute circuit_0000.zkey circuit_0001.zkey --name="1st Contributor Name" -v -e="some random text11"
snarkjs zkey contribute circuit_0001.zkey circuit_0002.zkey --name="2nd Contributor Name" -v -e="some random text22"
snarkjs zkey contribute circuit_0002.zkey circuit_0003.zkey --name="3rd Contributor Name" -v -e="some random text33"
snarkjs zkey beacon circuit_0003.zkey circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
snarkjs zkey verify $filename pot14_final.ptau circuit_final.zkey
```

---

#### 3. Export Solidity Verifier

```bash
snarkjs zkey export solidityverifier circuit_final.zkey verifier.sol
```

---

### ⛓️ Step 4: Blockchain Setup

#### 1. Start Ganache

```bash
ganache
```

---

### 📜 Step 5: Deploy Smart Contract

1. Open **Remix IDE**
2. Upload:

   * `main.sol`
   * `verifier.sol`
3. Compile both contracts
4. Deploy using **Injected Provider (Ganache)**

➡️ Copy:

* Contract Address
* ABI
* Private Key of deployed account (from local terminal)

---

### ⚡ Step 6: Generate Proof & Verify On-Chain

Go to `js/` folder.

Ensure these files are available:

* `.wasm`
* `circuit_final.zkey`
* `input.json`

Update `main.js` with:

* Private key
* Contract address
* ABI

Run:

```bash
node main.js
```

✔️ This will:

* Generate `proof.json` and `public.json`
* Format proof correctly
* Call Solidity verifier contract
* Print verification result

---

## 🔁 Data Flow Summary

```
commit.js → output.json → input.json
        ↓
Circom Circuit → .r1cs/.wasm/.wtns
        ↓
snarkjs → proof.json + public.json
        ↓
main.js → Smart Contract (Solidity)
        ↓
Verification Result
```

---

## ❗ Notes

* Ensure correct file paths across folders
* Regenerate proof if input changes
* Private key must match Ganache account
* Always update ABI & contract address after deployment

---

## 🎯 Purpose

This module ensures **secure and private verification of tags** using:

* Poseidon hashing
* MAC signatures
* Zero-Knowledge Proofs
* On-chain verification

````
