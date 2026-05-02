const snarkjs = require("snarkjs");
const fs = require("fs");
const { ethers } = require("ethers");

// =========================================
// ⚙️ CONFIGURATION - FILL THESE IN!
// =========================================
const dID = 1; // Your Device ID
const fID = 1; // Your File ID

const RPC_URL = "http://127.0.0.1:8545"; // e.g., Local Hardhat/Ganache node
const PRIVATE_KEY = "0xefe67ddd2914182c011c4eff01d2363c4315d69f8fed39bf6ea43d0f6efb8a31"; // The private key of the device/sender
const CONTRACT_ADDRESS = "0x8433a7b137676c2a25a7622377aFdD507D528029";

// We only need the ABI for the specific function we are calling
const ABI =[
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "dID",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "dAdd",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "exists",
				"type": "bool"
			}
		],
		"name": "DeviceUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "dID",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "fID",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "exists",
				"type": "bool"
			}
		],
		"name": "FileHashUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "dID",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "fID",
				"type": "uint256"
			}
		],
		"name": "FileTagsUpdated",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "dID",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "dAdd",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "hAlpha",
				"type": "uint256"
			}
		],
		"name": "updateDevices",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "dID",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "fID",
				"type": "uint256"
			},
			{
				"internalType": "uint256[]",
				"name": "h_M",
				"type": "uint256[]"
			}
		],
		"name": "updateFileHashes",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "dID",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "fID",
				"type": "uint256"
			},
			{
				"internalType": "uint256[2]",
				"name": "_pA",
				"type": "uint256[2]"
			},
			{
				"internalType": "uint256[2][2]",
				"name": "_pB",
				"type": "uint256[2][2]"
			},
			{
				"internalType": "uint256[2]",
				"name": "_pC",
				"type": "uint256[2]"
			},
			{
				"internalType": "uint256[21]",
				"name": "_pubSignals",
				"type": "uint256[21]"
			}
		],
		"name": "updateFileTags",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "Admin",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "dID",
				"type": "uint256"
			}
		],
		"name": "devices",
		"outputs": [
			{
				"internalType": "address",
				"name": "dAdd",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "hAlpha",
				"type": "uint256"
			},
			{
				"internalType": "bool",
				"name": "exists",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "dID",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "fID",
				"type": "uint256"
			}
		],
		"name": "fileHashes",
		"outputs": [
			{
				"internalType": "bool",
				"name": "exists",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "dID",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "fID",
				"type": "uint256"
			}
		],
		"name": "getFullHashArray",
		"outputs": [
			{
				"internalType": "uint256[]",
				"name": "",
				"type": "uint256[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "dID",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "fID",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "index",
				"type": "uint256"
			}
		],
		"name": "getHashAtIndex",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256[]",
				"name": "p1Array",
				"type": "uint256[]"
			},
			{
				"internalType": "uint256",
				"name": "p2",
				"type": "uint256"
			}
		],
		"name": "getHashes",
		"outputs": [
			{
				"internalType": "uint256[]",
				"name": "",
				"type": "uint256[]"
			}
		],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "dID",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "fID",
				"type": "uint256"
			}
		],
		"name": "getHashLength",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "dID",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "fID",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "index",
				"type": "uint256"
			}
		],
		"name": "getTagAtIndex",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "dID",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "fID",
				"type": "uint256"
			}
		],
		"name": "getTagLength",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256[2]",
				"name": "_pA",
				"type": "uint256[2]"
			},
			{
				"internalType": "uint256[2][2]",
				"name": "_pB",
				"type": "uint256[2][2]"
			},
			{
				"internalType": "uint256[2]",
				"name": "_pC",
				"type": "uint256[2]"
			},
			{
				"internalType": "uint256[21]",
				"name": "_pubSignals",
				"type": "uint256[21]"
			}
		],
		"name": "verifyProof",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];
// =========================================

async function main() {
    console.log("📥 Reading input.json...");
    const input = JSON.parse(fs.readFileSync("input.json"));

    console.log("⚙️ Generating proof...");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "tagVerifier.wasm",
        "circuit_final.zkey"
    );

    console.log("✅ Proof generated!");

    const pA = [proof.pi_a[0], proof.pi_a[1]];
    const pB = [
        [proof.pi_b[0][1], proof.pi_b[0][0]], 
        [proof.pi_b[1][1], proof.pi_b[1][0]]  
    ];
    const pC = [proof.pi_c[0], proof.pi_c[1]];

    console.log("\n🔗 Connecting to Blockchain...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    // =========================================
    // 🔍 PRE-FLIGHT DIAGNOSTICS
    // =========================================
    console.log("\n🛠️ Running Pre-Flight Diagnostics...");
    
    try {
        // 1. Check Device Existence and Address
        const device = await contract.devices(dID);
        console.log(`   - Device Exists: ${device.exists}`);
        if (!device.exists) throw new Error("Contract says Device does not exist. Did the owner deploy and register it?");
        
        console.log(`   - Expected Address: ${device.dAdd}`);
        console.log(`   - Your Wallet Addr: ${wallet.address}`);
        if (device.dAdd.toLowerCase() !== wallet.address.toLowerCase()) {
            throw new Error("msg.sender mismatch! The private key you are using does not match the device address registered by the owner.");
        }

        // 2. Check File Existence
        const fileExists = await contract.fileHashes(dID, fID);
        console.log(`   - File Exists: ${fileExists}`); 
        if (!fileExists) throw new Error("Contract says File does not exist. Did the owner update file hashes?");

        // 3. Check hashAlpha
        console.log(`   - Registered hAlpha: ${device.hAlpha.toString()}`);
        console.log(`   - Proof hAlpha:      ${publicSignals[20]}`);
        if (device.hAlpha.toString() !== publicSignals[20].toString()) {
            throw new Error("hashAlpha mismatch! The hAlpha registered by the owner does not match the proof.");
        }

        // 4. Check File Hashes Array
        const onChainHashes = await contract.getFullHashArray(dID, fID);
        console.log(`   - On-Chain File Blocks count: ${onChainHashes.length}`);
        for(let i = 0; i < onChainHashes.length; i++) {
            if(onChainHashes[i].toString() !== publicSignals[10+i].toString()) {
                throw new Error(`hashFile mismatch at block ${i}! Chain: ${onChainHashes[i]} vs Proof: ${publicSignals[10+i]}`);
            }
        }
        
        console.log("✅ All Pre-Flight Checks Passed! Smart Contract state perfectly matches the Proof.");
        
    } catch (diagnosticError) {
        console.error("\n🚨 PRE-FLIGHT CHECK FAILED:");
        console.error(diagnosticError.message);
        console.log("Aborting transaction so you don't waste gas.");
        return; // Stop execution
    }

    // =========================================
    // 📤 SEND TRANSACTION
    // =========================================
    console.log(`\n📤 Sending Transaction for dID: ${dID}, fID: ${fID}...`);

    try {
        const tx = await contract.updateFileTags(dID, fID, pA, pB, pC, publicSignals);
        console.log(`⏳ Waiting for transaction to be mined... Tx Hash: ${tx.hash}`);
        const receipt = await tx.wait(); 
        console.log(`\n🎉 Success! Transaction mined in block ${receipt.blockNumber}`);
    } catch (error) {
        console.error("\n❌ Transaction Failed during execution!");
        console.error(error.reason || error.message);
    }
}

main().catch(console.error);