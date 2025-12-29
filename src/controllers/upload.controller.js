const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadController = {
    uploadImage: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            // Upload to Cloudinary
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'velto-deposits',
                resource_type: 'image'
            });

            // Remove file from local server
            fs.unlinkSync(req.file.path);

            res.status(200).json({
                message: 'Image uploaded successfully',
                url: result.secure_url,
                publicId: result.public_id
            });
        } catch (error) {
            console.error('Upload Error:', error);
            // Cleanup if file exists
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).json({ message: 'Image upload failed' });
        }
    }
};

module.exports = uploadController;
