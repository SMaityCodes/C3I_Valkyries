pragma circom 2.0.0;

template AsigCal(s) {
    signal input alpha;
    signal input Sector[s];
    signal output out;

    signal powers[s];
    signal sum[s+1];

    powers[0] <== alpha;
    sum[0] <== 0;
    
    for (var i = 0; i < s; i++) {
    	if(i>0) powers[i] <== powers[i-1] * alpha;
        sum[i+1] <== sum[i] + (Sector[i] * powers[i]);
    }

    out <== sum[s];
}
