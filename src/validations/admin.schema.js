const Joi = require('joi');

const adminSchemas = {
    approveWithdrawal: Joi.object({
        transactionId: Joi.string().required()
    }),

    rejectWithdrawal: Joi.object({
        reason: Joi.string().required().messages({
            'string.empty': 'Reason for rejection is required'
        })
    }),

    createPlan: Joi.object({
        name: Joi.string().required(),
        minAmount: Joi.number().positive().required(),
        maxAmount: Joi.number().positive().required().greater(Joi.ref('minAmount')),
        durationDays: Joi.number().integer().positive().required(),
        dailyPayout: Joi.number().positive().required(),
        isPercentage: Joi.boolean().default(true),
        description: Joi.string().required(),
        category: Joi.string().valid('Real Estate', 'Agriculture', 'Technology', 'Others').required()
    }),

    updateUserStatus: Joi.object({
        status: Joi.string().valid('Active', 'Suspended').required(),
        reason: Joi.string().when('status', {
            is: 'Suspended',
            then: Joi.required(),
            otherwise: Joi.optional()
        })
    })
};

module.exports = adminSchemas;
