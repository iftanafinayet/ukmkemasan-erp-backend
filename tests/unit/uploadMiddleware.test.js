const { checkFileType } = require('../../middleware/uploadMiddleware');

describe('Upload Middleware Unit Tests', () => {
  describe('checkFileType', () => {
    it('should allow allowed mimetypes', () => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
      
      allowedMimes.forEach(mime => {
        const file = { mimetype: mime };
        const cb = jest.fn();
        
        checkFileType(file, cb);
        
        expect(cb).toHaveBeenCalledWith(null, true);
      });
    });

    it('should reject disallowed mimetypes', () => {
      const disallowedMimes = ['application/pdf', 'text/plain', 'image/svg+xml'];
      
      disallowedMimes.forEach(mime => {
        const file = { mimetype: mime };
        const cb = jest.fn();
        
        checkFileType(file, cb);
        
        expect(cb).toHaveBeenCalledWith(expect.any(Error));
        expect(cb.mock.calls[0][0].message).toBe('Hanya file gambar (JPEG, PNG, WebP, AVIF, GIF) yang diizinkan!');
      });
    });
  });
});
