/**
 * realtimeMetrics.js — Tracks real-time metrics for the WebSocket Gateway (Module 18)
 */

class RealtimeMetrics {
    constructor() {
        this.connectedClients = 0;
        this.messagesSent = 0;
        this.bytesSent = 0;
        this.droppedMessages = 0;
        this.startTime = Date.now();
    }

    clientConnected() {
        this.connectedClients++;
    }

    clientDisconnected() {
        this.connectedClients = Math.max(0, this.connectedClients - 1);
    }

    messageSent(byteSize = 0) {
        this.messagesSent++;
        this.bytesSent += byteSize;
    }

    messageDropped() {
        this.droppedMessages++;
    }

    getSnapshot() {
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        return {
            connectedClients: this.connectedClients,
            messagesSent: this.messagesSent,
            bytesSent: this.bytesSent,
            droppedMessages: this.droppedMessages,
            messagesPerSecond: uptimeSeconds > 0 ? (this.messagesSent / uptimeSeconds).toFixed(2) : 0,
            uptimeSeconds
        };
    }
}

module.exports = new RealtimeMetrics();
