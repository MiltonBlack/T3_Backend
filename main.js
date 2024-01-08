const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

let waitingPlayers = [];
let games = [];

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle disconnections
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        handlePlayerDisconnect(socket.id);
    });

    // Add the player to the waitingPlayers array
    const playerName = `Player${waitingPlayers.length + 1}`;
    waitingPlayers.push({ name: playerName, socketId: socket.id });

    // Notify the client about their player name
    socket.emit('playerName', playerName);

    // Try to pair players when at least two players are waiting
    if (waitingPlayers.length >= 2) {
        const player1 = waitingPlayers.shift();
        const player2 = waitingPlayers.shift();

        const game = {
            players: [player1, player2],
            currentTurn: 0,
        };

        // Notify players about the start of the game
        game.players.forEach(player => {
            io.to(player.socketId).emit('gameStart', game.players.map(p => p.name));
        });

        games.push(game);

        // Handle end turn event for the paired players
        game.players.forEach(player => {
            io.to(player.socketId).on('endTurn', () => {
                handleEndTurn(player.socketId, game);
            });
        });

        // Emit the initial turn to the paired players
        game.players.forEach(player => {
            io.to(player.socketId).emit('turn', game.currentTurn);
        });
    }
});

function handlePlayerDisconnect(disconnectedSocketId) {
    // Remove the player from waitingPlayers
    waitingPlayers = waitingPlayers.filter(player => player.socketId !== disconnectedSocketId);

    // Remove the player from active games and notify the other player
    games.forEach(game => {
        const disconnectedPlayer = game.players.find(player => player.socketId === disconnectedSocketId);
        if (disconnectedPlayer) {
            const otherPlayer = game.players.find(player => player !== disconnectedPlayer);

            io.to(otherPlayer.socketId).emit('opponentDisconnected');
            games = games.filter(g => g !== game);
        }
    });
}

function handleEndTurn(socketId, game) {
    const currentPlayer = game.players.find(player => player.socketId === socketId);

    // Only allow the current player to end their turn
    if (currentPlayer && currentPlayer === game.players[game.currentTurn % 2]) {
        // Increment the turn and broadcast the new turn to all clients
        game.currentTurn++;
        game.players.forEach(player => {
            io.to(player.socketId).emit('turn', game.currentTurn);
        });
    }
}

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
