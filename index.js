const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

let players = [];
let currentTurn = 0;

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle disconnections
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const disconnectedPlayer = players.find(player => player.socketId === socket.id);

        if (disconnectedPlayer) {
            players = players.filter(player => player !== disconnectedPlayer);

            // Notify the other player about the disconnection
            io.emit('playerDisconnected', disconnectedPlayer.name);

            // Reset the game state if no players are connected
            if (players.length === 0) {
                currentTurn = 0;
            }
        }
    });

    // Add the player to the players array
    const playerName = `Player${players.length + 1}`;
    players.push({ name: playerName, socketId: socket.id });

    // Notify the client about their player name
    socket.emit('playerName', playerName);

    // Emit the current turn to the connected clients
    io.emit('turn', currentTurn);

    // Handle end turn event
    socket.on('endTurn', () => {
        // Find the player based on the socket ID
        const currentPlayer = players.find(player => player.socketId === socket.id);

        // Only allow the current player to end their turn
        if (currentPlayer && currentPlayer === players[currentTurn % 2]) {
            // Increment the turn and broadcast the new turn to all clients
            currentTurn++;
            io.emit('turn', currentTurn);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
