const Joi = require('joi');

/**
 * Middleware to validate request data against a Joi schema
 * @param {Object} schema - Joi schema object
 * @param {string} source - Request object property to validate (body, query, or params)
 */
const validateRequest = (schema, source = 'body') => {
    return (req, res, next) => {
        const { error } = schema.validate(req[source], {
            abortEarly: false,
            errors: {
                label: 'key',
                wrap: {
                    label: false
                }
            }
        });

        if (error) {
            const errorMessages = error.details.map(detail => detail.message);
            console.log(`[VALIDATION ERROR] ${req.method} ${req.url}:`, errorMessages);
            return res.status(400).json({
                message: 'Validation Error',
                errors: errorMessages
            });
        }

        next();
    };
};

module.exports = validateRequest;
