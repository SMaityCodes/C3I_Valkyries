pragma circom 2.0.0;
include "circuits/poseidon.circom";
include "AsigCal.circom";

template TagVerify(n, s) {

    // Private inputs — only the prover knows these
    signal input File[n][s];
    signal input alpha;

    // Public inputs — known to verifier / stored in Solidity
    signal input sigma[n];
    signal input hashFile[n];
    signal input hashAlpha;

    // Step 1: Verify hash(alpha)
    component posVerifier1 = Poseidon(1);
    posVerifier1.inputs[0] <== alpha;
    hashAlpha === posVerifier1.out;

    // Step 2: Verify hash(each block)
    component blockHasher[n];
    for (var i = 0; i < n; i++) {
        blockHasher[i] = Poseidon(s);
        for (var j = 0; j < s; j++) {
            blockHasher[i].inputs[j] <== File[i][j];
    	}
    	hashFile[i] === blockHasher[i].out;
    }
    
    // Step 3: Verify polynomial sigma for each block
    component ASig[n];
    for (var i = 0; i < n; i++) {
        ASig[i] = AsigCal(s);
        ASig[i].alpha <== alpha;
        for (var j = 0; j < s; j++) {
            ASig[i].Sector[j] <== File[i][j];
        }
        sigma[i] === ASig[i].out;        
    }	
    
}

component main {public [sigma, hashFile, hashAlpha]} = TagVerify(2, 10);
