const Joi = require('joi');

const authSchemas = {
    register: Joi.object({
        name: Joi.string().min(2).max(50).required().messages({
            'string.empty': 'Name is required',
            'string.min': 'Name must be at least 2 characters long',
            'string.max': 'Name cannot exceed 50 characters'
        }),
        email: Joi.string().email().required().messages({
            'string.email': 'Please provide a valid email address',
            'string.empty': 'Email is required'
        }),
        password: Joi.string().min(8).max(30).required().messages({
                'string.min': 'Password must be at least 8 characters long',
                'string.empty': 'Password is required'
            }),
        phone: Joi.string().allow('', null),
        location: Joi.string().allow('', null),
        referralCode: Joi.string().allow('', null)
    }),

    login: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Please provide a valid email address',
            'string.empty': 'Email is required'
        }),
        password: Joi.string().required().messages({
            'string.empty': 'Password is required'
        })
    }),

    verifyEmail: Joi.object({
        email: Joi.string().email().required(),
        code: Joi.string().length(6).required().messages({
            'string.length': 'Verification code must be 6 digits'
        })
    }),

    forgotPassword: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Please provide a valid email address',
            'string.empty': 'Email is required'
        })
    }),

    resetPassword: Joi.object({
        token: Joi.string().required(),
        newPassword: Joi.string().min(8).max(30).required().messages({
                'string.min': 'Password must be at least 8 characters long',
                'string.empty': 'Password is required'
            })
    })
};

module.exports = authSchemas;
