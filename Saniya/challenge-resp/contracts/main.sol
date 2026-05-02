// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./verifier.sol";

contract Auditor is Groth16Verifier {

    struct DeviceInfo {
        address dAdd;
        uint256 hAlpha;
        bool exists;
    }

    struct FileInfo {
        uint256[] hash_M;
        uint256[] tags; // sigma
        bool exists;
    }

    mapping(uint256 => DeviceInfo) public devices;
    mapping(uint256 => mapping(uint256 => FileInfo)) public fileHashes;

    address public Admin;

    // 🔥 BN128 FIELD (same as circom)
    uint256 constant FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    constructor() {
        Admin = msg.sender;
    }

    modifier isAdmin() {
        require(msg.sender == Admin, "Not Admin");
        _;
    }

    // ================= DEVICE =================
    function updateDevices(uint256 dID, address dAdd, uint256 hAlpha) public isAdmin {
        devices[dID] = DeviceInfo(dAdd, hAlpha, true);
    }

    // ================= FILE HASH =================
    function updateFileHashes(uint256 dID, uint256 fID, uint256[] memory h_M) public isAdmin {
        require(devices[dID].exists, "Device missing");

        fileHashes[dID][fID] = FileInfo({
            hash_M: h_M,
            tags: new uint256[](0),
            exists: true
        });
    }

    // ================= MANUAL SIGMA STORE =================
    function setSigma(
        uint256 dID,
        uint256 fID,
        uint256[] memory _sigma
    ) public {
        require(devices[dID].exists, "Device missing");
        require(fileHashes[dID][fID].exists, "File missing");

        fileHashes[dID][fID].tags = _sigma;
    }

    // ================= 🔥 CHALLENGE RESPONSE =================
    function respVerify(
        uint256 dID,
        uint256 fID,
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint256[3] calldata _pubSignals, // [tau, hashmu, hashAlpha]
        uint256[] calldata index,
        uint256[] calldata v
    ) public view returns (bool) {

        require(devices[dID].exists, "Device missing");
        require(fileHashes[dID][fID].exists, "File missing");

        // 1. hashAlpha check
        require(_pubSignals[2] == devices[dID].hAlpha, "hashAlpha mismatch");

        // 2. ZKP verify
        bool ok = this.verifyProof(_pA, _pB, _pC, _pubSignals);
        require(ok, "Invalid proof");

        // 3. recompute tau using FIELD arithmetic
        uint256 tau_sol = 0;
        uint256[] memory sigma = fileHashes[dID][fID].tags;

        require(index.length == v.length, "Length mismatch");

        for (uint256 i = 0; i < index.length; i++) {
            require(index[i] < sigma.length, "Index OOB");

            // 🔥 CRITICAL FIX: field-safe arithmetic
            tau_sol = addmod(
                tau_sol,
                mulmod(v[i], sigma[index[i]], FIELD),
                FIELD
            );
        }

        // 4. compare tau
        require(tau_sol == _pubSignals[0], "Tau mismatch");

        return true;
    }
}