const { Server } = require('socket.io');

let io;

const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN || "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        // Join a room based on user ID for private updates
        socket.on('join', (userId) => {
            socket.join(userId);
            console.log(`User ${userId} joined their private room`);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    return io;
};

const getIo = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

// Helper to emit events to specific users
const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(userId.toString()).emit(event, data);
    }
};

module.exports = { initializeSocket, getIo, emitToUser };
