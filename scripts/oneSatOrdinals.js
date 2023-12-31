const buildInscription = (address, data, mediaType, metadata) => {
    const bsvAddress = bsv.Address.fromString(address);
    const p2pkhScript = bsv.Script.buildPublicKeyHashOut(bsvAddress);
    const script = bsv.Script(p2pkhScript)
        .add('OP_0')
        .add('OP_IF')
        .add(getScriptPushData('ord'))
        .add('OP_1')
        .add(getScriptPushData(mediaType))
        .add('OP_0')
        .add(getScriptPushData(data))
        .add('OP_ENDIF');
    if (metadata && metadata?.app && metadata?.type) {
        script.add('OP_RETURN').add(getScriptPushData(MAP_PREFIX)).add(getScriptPushData('SET'));
        for (const [key, value] of Object.entries(metadata)) {
            if (key !== "cmd") {
                script.add(getScriptPushData(key)).add(dataToBuf(getScriptPushData(value)))
            }
        }
    }
    return script;
}
const getBSVPublicKey = pk => { return bsv.PublicKey.fromPrivateKey(bsv.PrivateKey.fromWIF(pk)) }
const getAddressFromPrivateKey = pk => { return bsv.PrivateKey.fromWIF(pk).toAddress().toString() }
const getUTXO = (rawtx, idx) => {
    const bsvtx = new bsv.Transaction(rawtx);
    return {
        satoshis: bsvtx.outputs[idx].satoshis,
        vout: idx,
        txid: bsvtx.hash,
        script: bsvtx.outputs[idx].script.toHex()
    }
}
const signInput = (bsvtx, utxo, pkWIF, idx, cancelListing = false) => {
    const script = bsv.Script(utxo.script);
    bsvtx.inputs[0].output = new bsv.Transaction.Output({satoshis: utxo.satoshis, script: utxo.script});
    const bsvPublicKey = getBSVPublicKey(pkWIF);
    const sig = bsv.Transaction.sighash.sign(bsvtx, bsv.PrivateKey.fromWIF(pkWIF), SIGHASH_ALL_FORKID,
        idx, script, new bsv.crypto.BN(utxo.satoshis));
    const unlockingScript = bsv.Script.buildPublicKeyHashIn(bsvPublicKey, sig.toDER(), SIGHASH_ALL_FORKID);
    if (cancelListing) { unlockingScript.add('OP_1') }
    bsvtx.inputs[idx].setScript(unlockingScript);
    return bsvtx;
}
const inscribeTx = async(data, mediaType, metaDataTemplate, toAddress, payPkWIF) => {
    const bsvtx = bsv.Transaction();
    const inscriptionScript = buildInscription(toAddress, data, mediaType, metaDataTemplate);
    bsvtx.addOutput(bsv.Transaction.Output({ script: inscriptionScript, satoshis: 1 }));
    const paidRawTx = await payForRawTx(bsvtx.toString(), payPkWIF);
    return paidRawTx;
}
const sendInscription = async(txid, idx, ordPkWIF, payPkWIF, toAddress) => {
    let bsvtx = bsv.Transaction();
    const prevRawTx = await getRawtx(txid);
    const ordUtxo = getUTXO(prevRawTx, idx);
    const paymentAddress = getAddressFromPrivateKey(payPkWIF);
    const paymentUtxo = await getPaymentUTXOs(paymentAddress, 1);
    const utxos = [ordUtxo, paymentUtxo[0]];
    bsvtx.from(utxos);
    bsvtx.to(toAddress, 1);
    const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
    bsvtx.to(paymentAddress, inputSatoshis - 1 - 1);
    bsvtx = signInput(bsvtx, utxos[0], ordPkWIF, 0);
    bsvtx = signInput(bsvtx, utxos[1], payPkWIF, 1);
    return bsvtx.toString();
}
const listOrdinal = async(txid, idx, payPkWIF, ordPkWIF, payoutAddress, satoshisPayout) => {
    let bsvtx = bsv.Transaction();
    const prevRawTx = await getRawtx(txid);
    const ordUtxo = getUTXO(prevRawTx, idx);
    const paymentAddress = getAddressFromPrivateKey(payPkWIF);
    const paymentUtxo = await getPaymentUTXOs(paymentAddress, 1);
    const utxos = [ordUtxo, paymentUtxo[0]];
    bsvtx.from(utxos);
    const payOutput = new bsv.Transaction.Output({
        script: bsv.Script(bsv.Address.fromString(payoutAddress)),
        satoshis: satoshisPayout
    })
    const hexPayOutput = payOutput.toBufferWriter().toBuffer().toString('hex');
    const ownerOutput = bsv.Transaction.Output({
        script: bsv.Script(bsv.Address.fromString(getAddressFromPrivateKey(ordPkWIF))),
        satoshis: 1
    });
    const addressHex = ownerOutput.script.chunks[2].buf.toString('hex');
    const ordLockHex = `${bsv.Script(ORD_LOCK_PREFIX).toASM()} ${addressHex} ${hexPayOutput} ${bsv.Script(ORD_LOCK_SUFFIX).toASM()}`;
    const ordLockScript = bsv.Script.fromASM(ordLockHex);
    bsvtx.addOutput(new bsv.Transaction.Output({ script: ordLockScript, satoshis: 1 }));
    const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
    bsvtx.to(paymentAddress, inputSatoshis - 1 - 1);
    bsvtx = signInput(bsvtx, ordUtxo, ordPkWIF, 0);
    bsvtx = signInput(bsvtx, utxos[1], payPkWIF, 1);
    return bsvtx.toString();
}
const cancelListing = async(listingTxid, listingIdx, ordPkWIF, payPkWIF, toAddress, changeAddress) => {
    let bsvtx = bsv.Transaction();
    const prevRawTx = await getRawtx(listingTxid);
    const ordUtxo = getUTXO(prevRawTx, listingIdx);
    const paymentAddress = getAddressFromPrivateKey(payPkWIF);
    const paymentUtxo = await getPaymentUTXOs(paymentAddress, 1);
    const utxos = [ordUtxo, paymentUtxo[0]];
    bsvtx.from(utxos);
    bsvtx.to(toAddress, 1);
    const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
    bsvtx.to(changeAddress, inputSatoshis - 1 - 1);
    bsvtx = signInput(bsvtx, ordUtxo, ordPkWIF, 0, true);
    bsvtx = signInput(bsvtx, utxos[1], payPkWIF, 1);
    return bsvtx.toString();
}
const buyListing = async(listingTxid, listingIdx, payPkWIF, toAddress, changeAddress = null, feeAddress = null, marketFeeRate = 0) => {
    let bsvtx = bsv.Transaction();
    const prevRawTx = await getRawtx(listingTxid);
    const ordUtxo = getUTXO(prevRawTx, listingIdx);
    const lockingScriptASM = bsv.Script(ordUtxo.script).toASM();
    const payOutputHex = lockingScriptASM.split(' ')[6];
    const br = bsv.encoding.BufferReader(payOutputHex);
    const payOutput = bsv.Transaction.Output.fromBufferReader(br);
    const paymentAddress = getAddressFromPrivateKey(payPkWIF);
    const paymentUtxos = await getPaymentUTXOs(paymentAddress, payOutput.satoshis);
    if (!paymentUtxos.length) { throw `Not enough satoshis ${payOutput.satoshis} to pay for listing.` }
    const utxos = [ordUtxo, ...paymentUtxos];
    bsvtx.from(ordUtxo);
    bsvtx.to(toAddress, 1);
    bsvtx.addOutput(payOutput);
    const marketFee = parseInt(payOutput.satoshis * marketFeeRate);
    if (changeAddress !== null) {
        const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
        bsvtx.to(changeAddress, inputSatoshis - payOutput.satoshis - 2 - marketFee);
    }
    if (feeAddress !== null && marketFeeRate > 0) { bsvtx.to(feeAddress, marketFee) }
    const preimg = bsv.Transaction.sighash.sighashPreimage(
        bsvtx,
        SIGHASH_ALL_ANYONECANPAY_FORKID,
        listingIdx,
        bsv.Script(ordUtxo.script),
        new bsv.crypto.BN(ordUtxo.satoshis))
    .toString('hex');
    const hexSendOutput = bsvtx.outputs[0].toBufferWriter().toBuffer().toString('hex');
    const hexChangeOutput = changeAddress !== null ? bsvtx.outputs[2].toBufferWriter().toBuffer().toString('hex') : 'OP_0';
    const hexMarketFeeOutput = feeAddress !== null ? bsvtx.outputs[3].toBufferWriter().toBuffer().toString('hex') : '';
    const unlockingScript = bsv.Script.fromASM(`${hexSendOutput} ${hexChangeOutput}${hexMarketFeeOutput} ${preimg} OP_0`);
    bsvtx.inputs[listingIdx].setScript(unlockingScript);
    bsvtx.from(paymentUtxos);
    let curIdx = 1;
    paymentUtxos.forEach(pUtxo => {
        bsvtx = signInput(bsvtx, pUtxo, payPkWIF, curIdx);
        curIdx++;
    });
    return bsvtx.toString();
}