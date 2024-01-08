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

    // Try to organize players into groups when at least 8 players are waiting
    if (waitingPlayers.length >= 8) {
        const groups = createGroups(waitingPlayers.slice(0, 8));

        // Notify players about the start of the group stage
        groups.forEach((group, groupIndex) => {
            group.forEach((player, playerIndex) => {
                io.to(player.socketId).emit('groupStart', group.map(p => p.name), groupIndex + 1, playerIndex + 1);
            });

            const groupGames = createBracket(group);
            games.push(...groupGames);

            // Handle end turn event for the paired players
            groupGames.forEach(game => {
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
        });

        waitingPlayers = waitingPlayers.slice(8);
    }
});

function createGroups(players) {
    const groups = [];
    const groupNames = ['A', 'B', 'C', 'D']; // Customize as needed

    // Shuffle players to ensure random grouping
    players.sort(() => Math.random() - 0.5);

    for (let i = 0; i < groupNames.length; i++) {
        const group = players.splice(0, 2);
        groups.push(group.map(player => ({ ...player, groupName: groupNames[i] })));
    }

    return groups;
}

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
