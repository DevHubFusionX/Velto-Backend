const Joi = require('joi');

const userSchemas = {
    updateProfile: Joi.object({
        name: Joi.string().min(2).max(50),
        phone: Joi.string(),
        location: Joi.string()
    }),

    deposit: Joi.object({
        amount: Joi.number().positive().required(),
        method: Joi.string().optional(),
        currency: Joi.string().valid('USD').default('USD')
    }),

    withdraw: Joi.object({
        amount: Joi.number().positive().required(),
        currency: Joi.string().valid('USD').default('USD')
    }),

    invest: Joi.object({
        productId: Joi.string().required().messages({
            'string.empty': 'Product/Plan ID is required'
        }),
        amount: Joi.number().positive().required().messages({
            'number.base': 'Amount must be a number',
            'number.positive': 'Amount must be greater than zero'
        }),
        currency: Joi.string().valid('USD').default('USD')
    })
};

module.exports = userSchemas;
