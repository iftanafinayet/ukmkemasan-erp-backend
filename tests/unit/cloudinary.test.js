const { uploadToCloudinary, deleteFromCloudinary } = require('../../config/cloudinary');
const cloudinary = require('cloudinary').v2;

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

describe('Cloudinary Config Unit Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadToCloudinary', () => {
    it('should upload a file buffer and return url and publicId', async () => {
      const mockResult = {
        secure_url: 'https://cdn.test/img.avif',
        public_id: 'products/img123',
      };
      
      // Mock the upload_stream to trigger the callback
      cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        callback(null, mockResult);
        return { end: jest.fn() };
      });

      const fileBuffer = Buffer.from('fake-image-data');
      const result = await uploadToCloudinary(fileBuffer, 'test-folder');

      expect(result).toEqual({
        url: 'https://cdn.test/img.avif',
        publicId: 'products/img123',
      });
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'test-folder',
          format: 'avif',
        }),
        expect.any(Function)
      );
    });

    it('should reject if upload_stream returns an error', async () => {
      const mockError = new Error('Upload failed');
      
      cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        callback(mockError, null);
        return { end: jest.fn() };
      });

      const fileBuffer = Buffer.from('fake-image-data');
      await expect(uploadToCloudinary(fileBuffer)).rejects.toThrow('Upload failed');
    });
  });

  describe('deleteFromCloudinary', () => {
    it('should call cloudinary.uploader.destroy with publicId', async () => {
      cloudinary.uploader.destroy.mockResolvedValue({});

      await deleteFromCloudinary('products/img123');

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('products/img123');
    });

    it('should log an error if destroy fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Delete failed');
      cloudinary.uploader.destroy.mockRejectedValue(mockError);

      await deleteFromCloudinary('products/img123');

      expect(consoleSpy).toHaveBeenCalledWith('Cloudinary delete error:', 'Delete failed');
      consoleSpy.mockRestore();
    });
  });
});
