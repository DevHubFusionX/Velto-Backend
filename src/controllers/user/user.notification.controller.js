const Notification = require('../../models/Notification');

const notificationController = {
    getNotifications: async (req, res) => {
        try {
            const notifications = await Notification.find({ user: req.user.id })
                .sort({ createdAt: -1 });

            const formatRelativeTime = (date) => {
                const now = new Date();
                const diffMs = now - new Date(date);
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);

                if (diffMins < 1) return 'Just now';
                if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
                if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

                return new Date(date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
            };

            const formattedNotifications = notifications.map(notification => ({
                id: notification._id,
                title: notification.title,
                message: notification.message,
                type: notification.type,
                read: notification.read,
                time: formatRelativeTime(notification.createdAt)
            }));

            res.json(formattedNotifications);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            res.status(500).json({ message: 'Error fetching notifications' });
        }
    },

    markNotificationRead: async (req, res) => {
        try {
            const { id } = req.params;

            const notification = await Notification.findOneAndUpdate(
                { _id: id, user: req.user.id },
                { read: true },
                { new: true }
            );

            if (!notification) {
                return res.status(404).json({ message: 'Notification not found' });
            }

            res.json({
                message: 'Notification marked as read',
                notification: {
                    id: notification._id,
                    read: notification.read
                }
            });
        } catch (err) {
            console.error('Error marking notification as read:', err);
            res.status(500).json({ message: 'Error updating notification' });
        }
    }
};

module.exports = notificationController;
