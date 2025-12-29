const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    verificationTokenExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false // Don't return password by default
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    location: String,
    phone: String,
    joinDate: {
        type: Date,
        default: Date.now
    },
    // Financials
    totalBalance: {
        type: Number,
        default: 0
    },
    lockedBalance: {
        type: Number,
        default: 0
    },
    totalInvested: {
        type: Number,
        default: 0
    },
    totalReturns: {
        type: Number,
        default: 0
    },
    suspended: {
        type: Boolean,
        default: false
    },
    suspendedAt: Date,
    suspensionReason: String,
    // Referrals
    referralCode: {
        type: String,
        unique: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    referralBalance: { // Rewards that are pending/unlocking
        type: Number,
        default: 0
    },
    lifetimeReferralEarnings: {
        type: Number,
        default: 0
    },
    referralCount: {
        type: Number,
        default: 0
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    twoFactorSecret: {
        type: String,
        select: false
    },
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    sessionRevokedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Optimization Indexes
userSchema.index({ referredBy: 1 });
userSchema.index({ isEmailVerified: 1 });

// Encrypt password using bcrypt
userSchema.pre('save', async function() {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Increment login attempts and lock account if max attempts reached
userSchema.methods.incLoginAttempts = async function() {
    // If account is already locked and lock has expired, reset attempts
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }

    // Otherwise increment attempts
    const updates = { $inc: { loginAttempts: 1 } };
    
    // Lock account if 5 failed attempts reached
    if (this.loginAttempts + 1 >= 5) {
        updates.$set = { lockUntil: Date.now() + 15 * 60 * 1000 }; // Lock for 15 mins
    }
    
    return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
    return this.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 }
    });
};

module.exports = mongoose.model('User', userSchema);
