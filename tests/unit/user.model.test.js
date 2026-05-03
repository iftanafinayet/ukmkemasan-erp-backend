const bcrypt = require('bcryptjs');
const User = require('../../models/User');

describe('User Model Logic Tests', () => {
  describe('matchPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'Password123!';
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = new User({
        password: hashedPassword,
      });

      const isMatch = await user.matchPassword(password);
      expect(isMatch).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'Password123!';
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = new User({
        password: hashedPassword,
      });

      const isMatch = await user.matchPassword('WrongPassword');
      expect(isMatch).toBe(false);
    });
  });
});
