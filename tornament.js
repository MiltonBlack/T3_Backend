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

    // Try to pair players when at least eight players are waiting
    if (waitingPlayers.length >= 8) {
        const bracket = createBracket(waitingPlayers.slice(0, 8));

        // Notify players about the start of the tournament
        bracket.forEach((game, index) => {
            const playerNames = game.players.map(player => player.name);
            game.players.forEach(player => {
                io.to(player.socketId).emit('gameStart', playerNames, index + 1);
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
        });

        waitingPlayers = waitingPlayers.slice(8);
    }
});

function createBracket(players) {
    const bracket = [];
    for (let i = 0; i < players.length; i += 2) {
        const game = {
            players: [players[i], players[i + 1]],
            currentTurn: 0,
        };
        bracket.push(game);
    }
    return bracket;
}

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
