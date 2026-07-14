const cloudinary = require('cloudinary').v2;

// CLOUDINARY_URL env var is auto-picked up by the SDK
// Format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
cloudinary.config();

/**
 * Upload a file buffer to Cloudinary as AVIF
 * @param {Buffer} fileBuffer - The image buffer from multer memoryStorage
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<{url: string, publicId: string}>}
 */
const uploadToCloudinary = (fileBuffer, folder = 'products') => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                // Hapus format: 'avif' di sini agar upload tidak gagal jika gambar terlalu besar (> 30M pixels)
                // Kita akan menggunakan transformation untuk konversi saat delivery
                transformation: [
                    { width: 2500, height: 2500, crop: 'limit' }, // Batasi ukuran agar tidak raksasa
                    { quality: 'auto:good' },
                    { fetch_format: 'avif' }
                ],
                resource_type: 'image'
            },
            (error, result) => {
                if (error) return reject(error);
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id
                });
            }
        );
        stream.end(fileBuffer);
    });
};

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - The public ID of the image
 */
const deleteFromCloudinary = async (publicId) => {
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error('Cloudinary delete error:', error.message);
    }
};

module.exports = { cloudinary, uploadToCloudinary, deleteFromCloudinary };
