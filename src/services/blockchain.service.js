const axios = require('axios');

const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const USDT_ERC20_CONTRACT = '0xdac17f958d2ee523a2206206994597c13d831ec7';

// Retry wrapper — tries up to 2 times with 2s delay
async function fetchWithRetry(fn) {
    try {
        return await fn();
    } catch (err) {
        await new Promise(r => setTimeout(r, 2000));
        return await fn();
    }
}

/**
 * Verify USDT TRC20 via Tronscan (primary) with fallback endpoint
 */
async function verifyTRC20(txHash, expectedToAddress, expectedAmountUsd) {
    try {
        const endpoints = [
            `https://apilist.tronscan.org/api/transaction-info?hash=${txHash}`,
            `https://api.tronscan.org/api/transaction-info?hash=${txHash}`
        ];

        let data = null;
        for (const url of endpoints) {
            try {
                const res = await fetchWithRetry(() => axios.get(url, { timeout: 12000 }));
                data = res.data;
                if (data) break;
            } catch {
                continue;
            }
        }

        if (!data) return { valid: false, error: 'Tronscan API unreachable. Try again in a moment.' };

        // TX must exist and succeed
        if (!data.hash && !data.txID) {
            return { valid: false, error: 'Transaction not found on Tron network' };
        }
        if (data.contractRet && data.contractRet !== 'SUCCESS') {
            return { valid: false, error: `Transaction failed on-chain (status: ${data.contractRet})` };
        }

        // Find USDT transfer in trc20TransferInfo
        const transfers = data.trc20TransferInfo || [];
        const usdtTransfer = transfers.find(t =>
            t.contract_address?.toLowerCase() === USDT_TRC20_CONTRACT.toLowerCase()
        );

        if (!usdtTransfer) {
            return { valid: false, error: 'No USDT TRC20 transfer found in this transaction' };
        }

        // Tronscan returns amount_str as human-readable (e.g. "100.5") OR raw integer string
        // amount_str with decimals = already human readable; pure integer = raw (divide by 1e6)
        let actualAmount;
        const rawStr = usdtTransfer.amount_str || String(usdtTransfer.amount || '0');
        if (rawStr.includes('.')) {
            actualAmount = parseFloat(rawStr);
        } else {
            actualAmount = parseInt(rawStr) / 1e6;
        }

        const toAddress = usdtTransfer.to_address || usdtTransfer.to;
        const fromAddress = usdtTransfer.from_address || usdtTransfer.from;
        const confirmed = data.confirmed === true || (data.confirmations && data.confirmations > 0);

        if (!confirmed) {
            return { valid: false, error: 'Transaction is not yet confirmed. Please wait for block confirmation.' };
        }
        if (toAddress?.toLowerCase() !== expectedToAddress?.toLowerCase()) {
            return { valid: false, error: `USDT sent to wrong address. Expected our wallet, got: ${toAddress}` };
        }
        if (actualAmount < expectedAmountUsd * 0.99) {
            return { valid: false, error: `Amount mismatch: on-chain is ${actualAmount.toFixed(2)} USDT, claimed ${expectedAmountUsd} USDT` };
        }

        return { valid: true, actualAmount, from: fromAddress, to: toAddress, confirmed };
    } catch (err) {
        console.error('[TRC20 Verify]', err.message);
        return { valid: false, error: `Verification error: ${err.message}` };
    }
}

/**
 * Verify USDT ERC20 via Etherscan — uses TX receipt log parsing
 */
async function verifyERC20(txHash, expectedToAddress, expectedAmountUsd) {
    try {
        const apiKey = process.env.ETHERSCAN_API_KEY;
        if (!apiKey || apiKey === 'YOUR_ETHERSCAN_API_KEY_HERE') {
            return { valid: false, error: 'Etherscan API key not configured. Add ETHERSCAN_API_KEY to .env' };
        }

        // Step 1: Get TX receipt to check status and logs
        const receiptUrl = `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${apiKey}`;
        const { data: receiptData } = await fetchWithRetry(() => axios.get(receiptUrl, { timeout: 12000 }));

        const receipt = receiptData?.result;
        if (!receipt) return { valid: false, error: 'Transaction not found on Ethereum network' };
        if (receipt.status === '0x0') return { valid: false, error: 'Transaction failed on-chain' };

        const confirmed = parseInt(receipt.blockNumber, 16) > 0;
        if (!confirmed) return { valid: false, error: 'Transaction not yet confirmed' };

        // Step 2: Parse ERC20 Transfer logs
        // Transfer(address,address,uint256) topic
        const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        const usdtLogs = (receipt.logs || []).filter(log =>
            log.address?.toLowerCase() === USDT_ERC20_CONTRACT.toLowerCase() &&
            log.topics?.[0] === TRANSFER_TOPIC
        );

        if (!usdtLogs.length) {
            return { valid: false, error: 'No USDT ERC20 transfer found in this transaction' };
        }

        // Decode the transfer log
        const log = usdtLogs[0];
        const toAddress = '0x' + log.topics[2].slice(26); // last 20 bytes of topic[2]
        const fromAddress = '0x' + log.topics[1].slice(26);
        const rawAmount = parseInt(log.data, 16);
        const actualAmount = rawAmount / 1e6; // USDT has 6 decimals on ERC20

        if (toAddress?.toLowerCase() !== expectedToAddress?.toLowerCase()) {
            return { valid: false, error: `USDT sent to wrong address. Expected our wallet, got: ${toAddress}` };
        }
        if (actualAmount < expectedAmountUsd * 0.99) {
            return { valid: false, error: `Amount mismatch: on-chain is ${actualAmount.toFixed(2)} USDT, claimed ${expectedAmountUsd} USDT` };
        }

        return { valid: true, actualAmount, from: fromAddress, to: toAddress, confirmed: true };
    } catch (err) {
        console.error('[ERC20 Verify]', err.message);
        return { valid: false, error: `Verification error: ${err.message}` };
    }
}

async function verifyUSDTTransaction({ txHash, network, depositWalletAddress, expectedAmountUsd }) {
    if (network === 'TRC20') return verifyTRC20(txHash, depositWalletAddress, expectedAmountUsd);
    if (network === 'ERC20') return verifyERC20(txHash, depositWalletAddress, expectedAmountUsd);
    return { valid: false, error: `Unsupported network: ${network}` };
}

module.exports = { verifyUSDTTransaction };
