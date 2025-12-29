const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Sometimes events happen without a logged-in user (failed login)
    },
    action: {
        type: String,
        required: true,
        enum: [
            'LOGIN_SUCCESS', 
            'LOGIN_FAILED', 
            'LOGOUT', 
            'SETTINGS_UPDATE', 
            'MAINTENANCE_TOGGLE', 
            'WITHDRAWAL_APPROVE', 
            'WITHDRAWAL_REJECT',
            'KYC_APPROVE',
            'KYC_REJECT',
            'PASSWORD_CHANGE',
            'SUSPICIOUS_ACTIVITY'
        ]
    },
    details: {
        type: String,
        required: true
    },
    ip: String,
    userAgent: String,
    status: {
        type: String,
        enum: ['success', 'warning', 'error', 'info'],
        default: 'info'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Index for fast querying in the Vault
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ user: 1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
