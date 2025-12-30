const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const Settings = require('../../models/Settings');

/**
 * Finance Controller - Crypto Only Platform
 * Fiat methods (card, bank transfer) have been removed
 * All deposits and withdrawals are handled via crypto controller
 */
const financeController = {
    getTransactions: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            const { type, search } = req.query;

            const query = { user: req.user.id };

            if (type && type !== 'all') {
                query.type = type;
            }

            if (search) {
                query.$or = [
                    { reference: { $regex: search, $options: 'i' } },
                    { method: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            const total = await Transaction.countDocuments(query);
            const transactions = await Transaction.find(query)
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit);

            const normalizedTransactions = transactions.map(tx => ({
                ...tx._doc,
                id: tx._id,
                date: tx.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            }));

            res.json({
                success: true,
                data: normalizedTransactions,
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching transactions' });
        }
    },

    // Legacy deposit endpoint - redirect info for crypto
    deposit: async (req, res) => {
        return res.status(400).json({
            message: 'Fiat deposits are no longer supported. Please use crypto deposits.',
            redirectTo: '/deposit/crypto'
        });
    },

    // Legacy withdraw endpoint - redirect info for crypto
    withdraw: async (req, res) => {
        return res.status(400).json({
            message: 'Fiat withdrawals are no longer supported. Please use crypto withdrawals.',
            redirectTo: '/withdraw/crypto'
        });
    }
};

module.exports = financeController;
