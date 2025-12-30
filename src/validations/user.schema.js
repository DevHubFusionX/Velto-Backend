const Joi = require('joi');

const userSchemas = {
    updateProfile: Joi.object({
        name: Joi.string().min(2).max(50),
        phone: Joi.string(),
        location: Joi.string()
    }),

    deposit: Joi.object({
        amount: Joi.number().positive().required().messages({
            'number.base': 'Amount must be a number',
            'number.positive': 'Amount must be greater than zero',
            'any.required': 'Amount is required'
        }),
        method: Joi.string().required().messages({
            'string.empty': 'Payment method is required'
        }),
        currency: Joi.string().valid('USD', 'NGN').required().messages({
            'any.only': 'Currency must be either USD or NGN'
        }),
        proofUrl: Joi.string().optional().allow(null, '').messages({
            'string.base': 'Proof URL must be a string'
        })
    }),

    withdraw: Joi.object({
        amount: Joi.number().positive().required(),
        currency: Joi.string().valid('USD', 'NGN').required(),
        bankDetails: Joi.object({
            bankName: Joi.string().required(),
            accountNumber: Joi.string().required(),
            accountName: Joi.string().required()
        }).required()
    }),

    invest: Joi.object({
        productId: Joi.string().required().messages({
            'string.empty': 'Product/Plan ID is required'
        }),
        amount: Joi.number().positive().required().messages({
            'number.base': 'Amount must be a number',
            'number.positive': 'Amount must be greater than zero'
        }),
        currency: Joi.string().valid('USD', 'NGN').required()
    })
};

module.exports = userSchemas;
