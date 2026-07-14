const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

const create = async (req, res) => {
  try {
    const { productId, orderId, subject, message } = req.body;

    const conversation = await Conversation.create({
      customer: req.user._id,
      product: productId || null,
      order: orderId || null,
      subject,
    });

    await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      text: message,
    });

    conversation.lastMessageAt = new Date();
    conversation.lastMessagePreview = message.slice(0, 100);
    await conversation.save();

    const populated = await Conversation.findById(conversation._id)
      .populate('customer', 'name email')
      .populate('product', 'name');

    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const list = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role !== 'admin') {
      filter.customer = req.user._id;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const conversations = await Conversation.find(filter)
      .populate('customer', 'name email')
      .populate('product', 'name images')
      .sort({ lastMessageAt: -1, updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('customer', 'name email')
      .populate('product', 'name images');

    if (!conversation) {
      return res.status(404).json({ message: 'Percakapan tidak ditemukan' });
    }

    if (req.user.role !== 'admin' && conversation.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Tidak memiliki akses' });
    }

    const messages = await Message.find({ conversation: conversation._id })
      .populate('sender', 'name email role')
      .sort({ createdAt: 1 });

    res.json({ conversation, messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const sendMsg = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({ message: 'Percakapan tidak ditemukan' });
    }

    if (req.user.role !== 'admin' && conversation.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Tidak memiliki akses' });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      text: req.body.text,
    });

    conversation.lastMessageAt = new Date();
    conversation.lastMessagePreview = req.body.text.slice(0, 100);
    if (req.user.role !== 'admin') {
      conversation.status = 'Open';
    } else {
      conversation.status = 'Replied';
    }
    await conversation.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'name email role');

    try {
      const io = req.app.get('io');
      if (io) {
        const convId = conversation._id.toString();
        io.to(`conv:${convId}`).emit('new:message', populated);
        io.to(`conv:${convId}`).emit('conversation:updated', conversation);

        const isAdmin = req.user.role === 'admin';
        if (isAdmin) {
          const customerId = conversation.customer.toString();
          const unreadCount = await Message.countDocuments({
            conversation: conversation._id,
            readAt: null,
            sender: { $ne: customerId },
          });
          io.to(`user:${customerId}`).emit('unread:count', { conversationId: convId, count: unreadCount });
        } else {
          const admins = await User.find({ role: 'admin' }).select('_id');
          const unreadCount = await Message.countDocuments({
            conversation: conversation._id,
            readAt: null,
            sender: req.user._id.toString(),
          });
          for (const admin of admins) {
            io.to(`user:${admin._id.toString()}`).emit('unread:count', { conversationId: convId, count: unreadCount });
          }
        }
      }
    } catch (socketError) {
      console.error('Socket emit gagal:', socketError.message);
    }

    res.status(201).json({ message: populated, conversation });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const markRead = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({ message: 'Percakapan tidak ditemukan' });
    }

    if (req.user.role !== 'admin' && conversation.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Tidak memiliki akses' });
    }

    await Message.updateMany(
      { conversation: conversation._id, readAt: null, sender: { $ne: req.user._id } },
      { readAt: new Date() }
    );

    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`conv:${conversation._id}`).emit('read:updated', {
          conversationId: conversation._id.toString(),
          readBy: req.user._id.toString(),
          readAt: new Date().toISOString(),
        });
      }
    } catch (socketError) {
      console.error('Socket emit gagal:', socketError.message);
    }

    res.json({ message: 'Pesan telah dibaca' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['Open', 'Replied', 'Closed'].includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid' });
    }

    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate('customer', 'name email')
      .populate('product', 'name');

    if (!conversation) {
      return res.status(404).json({ message: 'Percakapan tidak ditemukan' });
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { create, list, getById, sendMsg, markRead, updateStatus };
