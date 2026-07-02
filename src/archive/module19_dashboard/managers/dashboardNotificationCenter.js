/**
 * dashboardNotificationCenter.js — Bridges gateway and persistent DB notifications.
 */

const DashboardNotification = require('../../models/DashboardNotification');
const gatewayServer = require('../../gateway/gatewayServer');

class DashboardNotificationCenter {
    /**
     * Pushes a persistent notification to a user and broadcasts it via Gateway.
     */
    async push(userId, type, title, message, actionUrl = null) {
        const notif = new DashboardNotification({
            userId,
            type,
            title,
            message,
            actionUrl
        });

        await notif.save();

        // Broadcast directly to user's active sockets
        gatewayServer.send(userId, 'dashboard.notification', notif.toObject());
        
        return notif;
    }

    /**
     * Retrieves unread notifications for a user.
     */
    async getUnread(userId, limit = 20) {
        return await DashboardNotification.find({ userId, isRead: false })
            .sort({ createdAt: -1 })
            .limit(limit);
    }

    /**
     * Marks a notification as read.
     */
    async markAsRead(userId, notificationId) {
        await DashboardNotification.updateOne(
            { _id: notificationId, userId },
            { $set: { isRead: true } }
        );
    }
    
    /**
     * Marks all notifications as read.
     */
    async markAllAsRead(userId) {
        await DashboardNotification.updateMany(
            { userId, isRead: false },
            { $set: { isRead: true } }
        );
    }
}

module.exports = new DashboardNotificationCenter();
