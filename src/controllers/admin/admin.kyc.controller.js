const KYC = require('../../models/KYC');

const kycController = {
    getPendingKYC: async (req, res) => {
        try {
            const kyc = await KYC.find({ status: 'Pending' }).populate('user', 'name email');
            res.json(kyc);
        } catch (err) {
            res.status(500).json({ message: 'Error fetching KYC' });
        }
    },

    approveKYC: async (req, res) => {
        const { kycId } = req.params;
        try {
            const kyc = await KYC.findById(kycId);
            if (!kyc) return res.status(404).json({ message: 'KYC not found' });

            kyc.status = 'Approved';
            kyc.approvedAt = new Date();
            await kyc.save();
            res.json({ message: 'KYC Approved', record: kyc });
        } catch (err) {
            res.status(500).json({ message: 'Error approving KYC' });
        }
    },

    rejectKYC: async (req, res) => {
        const { kycId } = req.params;
        try {
            const kyc = await KYC.findById(kycId);
            if (!kyc) return res.status(404).json({ message: 'KYC not found' });

            kyc.status = 'Rejected';
            kyc.rejectedAt = new Date();
            await kyc.save();
            res.json({ message: 'KYC Rejected', record: kyc });
        } catch (err) {
            res.status(500).json({ message: 'Error rejecting KYC' });
        }
    }
};

module.exports = kycController;
