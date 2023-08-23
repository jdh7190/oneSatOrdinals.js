const MAP_PREFIX = "1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5";
const P2PKH_SIGSCRIPT_SIZE = 1 + 73 + 1 + 33;
const P2PKH_OUTPUT_SIZE = 8 + 1 + 1 + 1 + 1 + 20 + 1 + 1;
const P2PKH_INPUT_SIZE = 36 + 1 + P2PKH_SIGSCRIPT_SIZE + 4;
const PUB_KEY_SIZE = 66;
const FEE_PER_KB = 1;
const FEE_FACTOR = (FEE_PER_KB / 1000);
const SIGHASH_ALL_FORKID = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID;
const SIGHASH_SINGLE_ANYONECANPAY_FORKID = bsv.crypto.Signature.SIGHASH_SINGLE | bsv.crypto.Signature.SIGHASH_ANYONECANPAY | bsv.crypto.Signature.SIGHASH_FORKID;
const SIGHASH_ALL_ANYONECANPAY_FORKID = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_ANYONECANPAY | bsv.crypto.Signature.SIGHASH_FORKID;
const ORD_LOCK_PREFIX = '2097dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff0262102ba79df5f8ae7604a9830f03c7933028186aede0675a16f025dc4f8be8eec0382201008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266c0000';
const ORD_LOCK_SUFFIX = '615179547a75537a537a537a0079537a75527a527a7575615579008763567901c161517957795779210ac407f0e4bd44bfc207355a778b046225a7068fc59ee7eda43ad905aadbffc800206c266b30e6a1319c66dc401e5bd6b432ba49688eecd118297041da8074ce081059795679615679aa0079610079517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01007e81517a75615779567956795679567961537956795479577995939521414136d08c5ed2bf3ba048afe6dcaebafeffffffffffffffffffffffffffffff00517951796151795179970079009f63007952799367007968517a75517a75517a7561527a75517a517951795296a0630079527994527a75517a6853798277527982775379012080517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01205279947f7754537993527993013051797e527e54797e58797e527e53797e52797e57797e0079517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a756100795779ac517a75517a75517a75517a75517a75517a75517a75517a75517a7561517a75517a756169587951797e58797eaa577961007982775179517958947f7551790128947f77517a75517a75618777777777777777777767557951876351795779a9876957795779ac777777777777777767006868';
const base64ToArrayBuffer = base64 => {
    const binary_string = atob(base64);
    const bytes = new Uint8Array(binary_string.length);
    for (let i = 0; i < binary_string.length; i++)  { bytes[i] = binary_string.charCodeAt(i) }
    return bytes;
}
const dataToBuf = arr => {
    const bufferWriter = bsv.encoding.BufferWriter();
    arr.forEach(a => { bufferWriter.writeUInt8(a) });
    return bufferWriter.toBuffer();
}
const getScriptPushData = data => {
    const b64 = btoa(data);
    const abuf = base64ToArrayBuffer(b64);
    return dataToBuf(abuf);
}
const getUTXOs = async address => {
    const r = await fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent`);
    const res = await r.json();
    return res;
}
const getRawtx = async txid => {
    const r = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`);
    const raw = await r.text();
    return raw;
}
const between = (x, min, max) => { return x >= min && x <= max }
const getPaymentUTXOs = async(address, amount) => {
    const utxos = await getUTXOs(address);
    const addr = bsv.Address.fromString(address);
    const script = bsv.Script.fromAddress(addr);
    let cache = [], satoshis = 0;
    for (let utxo of utxos) {
        if (utxo.value > 1) {
            const foundUtxo = utxos.find(utxo => utxo.value + 2 > amount);
            if (foundUtxo) {
                return [{ satoshis: foundUtxo.value, vout: foundUtxo.tx_pos, txid: foundUtxo.tx_hash, script: script.toHex() }]
            }
            cache.push(utxo);
            if (amount) {
                satoshis = cache.reduce((a, curr) => { return a + curr.value }, 0);
                if (satoshis >= amount) {
                    return cache.map(utxo => {
                        return { satoshis: utxo.value, vout: utxo.tx_pos, txid: utxo.tx_hash, script: script.toHex() }
                    });
                }
                else if (satoshis === amount || between(amount, satoshis - P2PKH_INPUT_SIZE, satoshis + P2PKH_INPUT_SIZE)) {
                    return cache.map(utxo => {
                        return { satoshis: utxo.value, vout: utxo.tx_pos, txid: utxo.tx_hash, script: script.toHex() }
                    })
                }
            } else {
                return utxos.map(utxo => {
                    return { satoshis: utxo.value, vout: utxo.tx_pos, txid: utxo.tx_hash, script: script.toHex() }
                });
            }
        }
    }
    return [];
}
const payForRawTx = async(rawtx, payPkWIF) => {
    const bsvtx = bsv.Transaction(rawtx);
    const satoshis = bsvtx.outputs.reduce(((t, e) => t + e._satoshis), 0);
    const txFee = parseInt(((bsvtx._estimateSize() + P2PKH_INPUT_SIZE) * FEE_FACTOR)) + 1;
    const paymentAddress = getAddressFromPrivateKey(payPkWIF);
    const utxos = await getPaymentUTXOs(paymentAddress, satoshis + txFee);
    bsvtx.from(utxos);
    const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
    bsvtx.to(paymentAddress, inputSatoshis - satoshis - txFee);
    bsvtx.sign(bsv.PrivateKey.fromWIF(payPkWIF));
    return bsvtx.toString();
}
const broadcast = async txhex => {
    const r = await (await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/raw`, {
        method: 'post',
        body: JSON.stringify({ txhex })
    })).json();
    return r;
}