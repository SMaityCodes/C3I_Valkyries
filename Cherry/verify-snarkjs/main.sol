// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "./verifier.sol";
contract Auditor is Groth16Verifier{
    // =======================
    // Structures
    // =======================

    struct DeviceInfo {
        address dAdd;
        uint256 hAlpha;
        bool exists;
    }

    struct FileInfo {
        uint256[] hash_M;
        uint256[] tags;   // ✅ Added for tag storage
        bool exists;
    }
    // =======================
    // State Variables
    // =======================

    mapping(uint256 dID => DeviceInfo) public devices;

    // dID => fID => FileInfo
    mapping(uint256 dID => mapping(uint256 fID => FileInfo)) public fileHashes;

    address public Admin;

    // =======================
    // Events
    // =======================

    event DeviceUpdated(uint256 dID, address dAdd, bool exists);
    event FileHashUpdated(uint256 dID, uint256 fID, bool exists);
    event FileTagsUpdated(uint256 dID, uint256 fID);

    // =======================
    // Modifiers
    // =======================

    modifier isAdmin() {
        require(msg.sender == Admin, "Caller is not Admin");
        _;
    }

    // =======================
    // Constructor
    // =======================

    constructor() {
        Admin = msg.sender;
    }

    // =======================
    // Device Management
    // =======================

    function updateDevices(
        uint256 dID,
        address dAdd,
        uint256 hAlpha
    ) public isAdmin {

        devices[dID] = DeviceInfo({
            dAdd: dAdd,
            hAlpha: hAlpha,
            exists: true
        });

        emit DeviceUpdated(dID, dAdd, true);
    }

    // =======================
    // File Hash Storage
    // =======================

    function updateFileHashes(
        uint256 dID,
        uint256 fID,
        uint256[] memory h_M
    ) public isAdmin {

        require(devices[dID].exists, "Device doesn't exist");
        require(h_M.length > 0, "Empty array not allowed");
        require(h_M.length <= 100, "Array too large");

        fileHashes[dID][fID] = FileInfo({
            hash_M: h_M,
             tags: new uint256[](0), // initialize empty tags
            exists: true
        });

        emit FileHashUpdated(dID, fID, true);
    }

    // =======================
    // Tag Update Function (Option 1: Padding)
    // =======================

    // Let's define the max blocks so it's easy to read
    uint256 constant MAX_N = 10; 

    function updateFileTags(
        uint256 dID,
        uint256 fID,
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[21] calldata _pubSignals // max Array size is now 21 (10 sigmas + 10 hashes + 1 alpha)
    ) public {
        require(devices[dID].exists, "Device does not exist");
        require(msg.sender == devices[dID].dAdd, "Unauthorized device");
        require(fileHashes[dID][fID].exists, "File does not exist");

        // 1. Get the ACTUAL size of the file being processed
        uint256 actual_n = fileHashes[dID][fID].hash_M.length;
        require(actual_n <= MAX_N, "File exceeds maximum circuit capacity");

        // 2. Check hashAlpha (It's the very last element at index 20)
        require(_pubSignals[20] == devices[dID].hAlpha, "Invalid hashAlpha");

        // 3. Dynamically check ONLY the actual file hashes
        // _pubSignals[10] starts the hashFile array
        for (uint256 i = 0; i < actual_n; i++) {
            require(_pubSignals[10 + i] == fileHashes[dID][fID].hash_M[i], "Invalid hashFile block");
        }

        bool isValid = this.verifyProof(_pA, _pB, _pC, _pubSignals);
        require(isValid, "Invalid ZKP proof");

        // ✅ 5. Dynamically store ONLY the sigmas for the actual file
        // _pubSignals[0] starts the sigma array
        fileHashes[dID][fID].tags = new uint256[](actual_n);
        for (uint256 i = 0; i < actual_n; i++) {
            fileHashes[dID][fID].tags[i] = _pubSignals[i];
        }

        emit FileTagsUpdated(dID, fID);
    }

    // =======================
    // Array Access Functions
    // =======================

    function getHashLength(
        uint256 dID,
        uint256 fID
    ) public view returns (uint256) {

        require(fileHashes[dID][fID].exists, "File does not exist");

        return fileHashes[dID][fID].hash_M.length;
    }

    function getHashAtIndex(
        uint256 dID,
        uint256 fID,
        uint256 index
    ) public view returns (uint256) {

        require(fileHashes[dID][fID].exists, "File does not exist");
        require(index < fileHashes[dID][fID].hash_M.length, "Index out of bounds");

        return fileHashes[dID][fID].hash_M[index];
    }

    function getFullHashArray(
        uint256 dID,
        uint256 fID
    ) public view returns (uint256[] memory) {

        require(fileHashes[dID][fID].exists, "File does not exist");

        return fileHashes[dID][fID].hash_M;
    }

    // =======================
    // Tag Access (optional but useful)
    // =======================

    function getTagAtIndex(
        uint256 dID,
        uint256 fID,
        uint256 index
    ) public view returns (uint256) {

        require(fileHashes[dID][fID].exists, "File does not exist");
        require(index < fileHashes[dID][fID].tags.length, "Index out of bounds");

        return fileHashes[dID][fID].tags[index];
    }

    function getTagLength(
        uint256 dID,
        uint256 fID
    ) public view returns (uint256) {

        require(fileHashes[dID][fID].exists, "File does not exist");

        return fileHashes[dID][fID].tags.length;
    }

    function getHashes(uint256[] memory p1Array, uint256 p2) public pure returns (uint256[] memory)
    {
        uint256[] memory results = new uint256[](p1Array.length);

        for (uint256 i = 0; i < p1Array.length; i++) {
            results[i] = uint256(
                keccak256(abi.encodePacked(p1Array[i], p2))
            );
        }

        return results;
    }
}