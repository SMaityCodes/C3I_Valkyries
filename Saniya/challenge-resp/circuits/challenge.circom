pragma circom 2.0.0;
include "circomlib/circuits/poseidon.circom";
include "AsigCal.circom";

template ResponseTagVerification(n, s) {

    // Private inputs — only the prover knows these
    signal input mu[n][s];     // previously File
    signal input alpha;

    // Public inputs — known to verifier
    signal input tau[n];       // previously sigma
    signal input hashmu[n];    // previously hashFile
    signal input hashAlpha;

    // Step 1: Verify hash(alpha)
    component posVerifier1 = Poseidon(1);
    posVerifier1.inputs[0] <== alpha;
    hashAlpha === posVerifier1.out;

    // Step 2: Verify hash(mu block)
    component blockHasher[n];
    for (var i = 0; i < n; i++) {
        blockHasher[i] = Poseidon(s);
        for (var j = 0; j < s; j++) {
            blockHasher[i].inputs[j] <== mu[i][j];
        }
        hashmu[i] === blockHasher[i].out;
    }

    // Step 3: Verify polynomial tau from mu using alpha
    component ASig[n];
    for (var i = 0; i < n; i++) {
        ASig[i] = AsigCal(s);
        ASig[i].alpha <== alpha;
        for (var j = 0; j < s; j++) {
            ASig[i].Sector[j] <== mu[i][j];
        }
        tau[i] === ASig[i].out;
    }

}

component main {public [tau, hashmu, hashAlpha]} = ResponseTagVerification(1, 10);