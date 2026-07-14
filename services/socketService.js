const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

const setupSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('Token tidak tersedia'));
      }

      const cleanToken = token.replace(/"/g, '');
      const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return next(new Error('User tidak ditemukan'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Token tidak valid'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    socket.join(`user:${userId}`);

    socket.on('join:conversation', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on('leave:conversation', (conversationId) => {
      socket.leave(`conv:${conversationId}`);
    });

    socket.on('send:message', async (data, callback) => {
      try {
        const { conversationId, text, _tempId } = data;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return callback({ error: 'Percakapan tidak ditemukan' });
        }

        if (socket.user.role !== 'admin' && conversation.customer.toString() !== userId) {
          return callback({ error: 'Tidak memiliki akses' });
        }

        const message = await Message.create({
          conversation: conversation._id,
          sender: socket.user._id,
          text,
        });

        conversation.lastMessageAt = new Date();
        conversation.lastMessagePreview = text.slice(0, 100);
        if (socket.user.role !== 'admin') {
          conversation.status = 'Open';
        } else {
          conversation.status = 'Replied';
        }
        await conversation.save();

        const populated = await Message.findById(message._id)
          .populate('sender', 'name email role');

        const emittedMsg = _tempId ? { ...populated.toObject(), _tempId } : populated;

        io.to(`conv:${conversationId}`).emit('new:message', emittedMsg);

        const isAdmin = socket.user.role === 'admin';
        const customerId = conversation.customer.toString();

        if (isAdmin) {
          const unreadCount = await Message.countDocuments({
            conversation: conversation._id,
            readAt: null,
            sender: { $ne: customerId },
          });
          io.to(`user:${customerId}`).emit('unread:count', { conversationId, count: unreadCount });
        } else {
          const unreadCount = await Message.countDocuments({
            conversation: conversation._id,
            readAt: null,
            sender: userId,
          });
          const admins = await User.find({ role: 'admin' }).select('_id');
          for (const admin of admins) {
            io.to(`user:${admin._id.toString()}`).emit('unread:count', { conversationId, count: unreadCount });
          }
        }

        io.to(`conv:${conversationId}`).emit('conversation:updated', conversation);

        if (callback) {
          callback({ message: _tempId ? { ...populated.toObject(), _tempId } : populated, conversation });
        }
      } catch (error) {
        if (callback) {
          callback({ error: error.message });
        }
      }
    });

    socket.on('mark:read', async (data, callback) => {
      try {
        const { conversationId } = data;

        await Message.updateMany(
          {
            conversation: conversationId,
            readAt: null,
            sender: { $ne: socket.user._id },
          },
          { readAt: new Date() }
        );

        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
          const isAdmin = socket.user.role === 'admin';

          if (isAdmin) {
            const customerId = conversation.customer.toString();
            const unreadCount = await Message.countDocuments({
              conversation: conversationId,
              readAt: null,
              sender: { $ne: customerId },
            });
            io.to(`user:${customerId}`).emit('unread:count', { conversationId, count: unreadCount });
          } else {
            const unreadCount = await Message.countDocuments({
              conversation: conversationId,
              readAt: null,
              sender: userId,
            });
            const admins = await User.find({ role: 'admin' }).select('_id');
            for (const admin of admins) {
              io.to(`user:${admin._id.toString()}`).emit('unread:count', { conversationId, count: unreadCount });
            }
          }
        }

        if (callback) {
          callback({ success: true });
        }
      } catch (error) {
        if (callback) {
          callback({ error: error.message });
        }
      }
    });

    socket.on('disconnect', () => {
      const rooms = [...socket.rooms].filter((room) => room.startsWith('conv:'));
      rooms.forEach((room) => socket.leave(room));
    });
  });
};

module.exports = setupSocket;
