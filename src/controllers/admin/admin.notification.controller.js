const Notification = require('../../models/Notification');

const notificationController = {
    getAdminNotifications: async (req, res) => {
        try {
            const notifications = await Notification.find({ role: 'admin' })
                .sort({ createdAt: -1 })
                .limit(50);

            const unreadCount = await Notification.countDocuments({ role: 'admin', read: false });

            res.json({ success: true, notifications, unreadCount });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching admin notifications' });
        }
    },

    markAdminNotificationRead: async (req, res) => {
        try {
            const notification = await Notification.findByIdAndUpdate(
                req.params.id,
                { read: true },
                { new: true }
            );

            if (!notification) {
                return res.status(404).json({ message: 'Notification not found' });
            }

            res.json({ success: true, notification });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error marking notification read' });
        }
    },

    markAllAdminNotificationsRead: async (req, res) => {
        try {
            await Notification.updateMany(
                { role: 'admin', read: false },
                { read: true }
            );
            res.json({ success: true, message: 'All admin notifications marked as read' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error marking all notifications read' });
        }
    }
};

module.exports = notificationController;
