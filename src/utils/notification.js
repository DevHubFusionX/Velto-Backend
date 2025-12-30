const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToUser, getIo } = require('../socket');
const { sendEmail } = require('../services/emailService');

/**
 * Centrally send a notification to a user.
 * Saves to DB, emits via Socket.io, and sends email if applicable.
 */
const sendNotification = async (userId, title, message, type = 'info', priority = 'normal', metadata = {}) => {
    try {
        // 1. Save to Database
        const notification = await Notification.create({
            user: userId,
            title,
            message,
            type,
            priority,
            metadata,
            role: 'user'
        });

        // 2. Emit via Socket.io for real-time update
        emitToUser(userId, 'notification', {
            id: notification._id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            priority: notification.priority,
            metadata: notification.metadata,
            read: notification.read,
            time: 'Just now'
        });

        // 3. Send Email (non-blocking)
        // Only for high priority or specific types like deposit/withdrawal
        if (priority === 'high' || ['deposit', 'withdrawal', 'success'].includes(type)) {
            const user = await User.findById(userId).select('email');
            if (user && user.email) {
                sendEmail({
                    to: user.email,
                    subject: title,
                    html: `<h3>${title}</h3><p>${message}</p>`
                });
            }
        }

        return notification;
    } catch (error) {
        console.error('Error sending notification:', error);
        return null;
    }
};

/**
 * Send a notification to all administrators.
 */
const sendAdminNotification = async (title, message, type = 'admin', priority = 'normal', metadata = {}) => {
    try {
        // 1. Save to Database (user is null for admin-wide alerts)
        const notification = await Notification.create({
            user: null,
            title,
            message,
            type,
            priority,
            metadata,
            role: 'admin'
        });

        // 2. Emit via Socket.io to admins room
        const io = getIo();
        if (io) {
            io.to('admins').emit('admin_notification', {
                id: notification._id,
                title: notification.title,
                message: notification.message,
                type: notification.type,
                priority: notification.priority,
                metadata: notification.metadata,
                read: notification.read,
                time: 'Just now'
            });
        }

        return notification;
    } catch (error) {
        console.error('Error sending admin notification:', error);
        return null;
    }
};

module.exports = { sendNotification, sendAdminNotification };
