import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { log } from 'console';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } })
const PORT = process.env.PORT || 5000;

let invitePlayers = [];
let waitingPlayers = [];
let tournamentPlayers = [];
let games = [];
let pendingInvites = {};

io.on("connection", (socket) => {
    log(`User connected on server port socket: ${socket.id}`);
    log("active Games Length:" + games.length);

    // Find all Quick Play Players
    socket.on("quickPlayFind", (name) => {
        const id = generateId();
        const quickPlayerName = `Player_${name}_${id}`;
        log(`Player ${name}_${id} with socketId "${socket.id}" is interested in a Quick Game.`);
        waitingPlayers.push({ name: quickPlayerName, socketId: socket.id });

        // Notify the client about their player name
        socket.emit('playerName', waitingPlayers);

        // Pair Players for a Quick Game
        if (waitingPlayers.length >= 2) {
            const player1 = waitingPlayers.shift();
            const player2 = waitingPlayers.shift();

            const game = {
                players: [player1, player2],
                currentTurn: 0,
            };

            // check game object
            log(game);

            // Notify players about the start of the game
            game.players.forEach(player => {
                io.to(player.socketId).emit('gameStart', game.players.map(p => p.name));
            });

            games.push(game);

            // Handle end turn event for the paired players
            game.players.forEach(player => {
                socket.on('endTurn', () => {
                    handleEndTurn(player.socketId, game);
                });
            });

            // Emit the initial turn to the paired players
            game.players.forEach(player => {
                io.to(player.socketId).emit('turn', game.currentTurn);
            });
        }
        log("waiting Players Length:" + waitingPlayers.length);
    });

    // Find all Invite Play Players
    socket.on("invitePlayFind", (name) => {
        const id = generateId();
        const invitePlayerName = `Player_${name}_${id}`;
        log(`Player ${name}_${id} with socketId "${socket.id}" is interested in a Game Invite.`);
        invitePlayers.push({ name: invitePlayerName, socketId: socket.id });

        // Notify the client about their player name
        socket.emit('playerName', invitePlayers);
    });
    log("invite Players Length:" + invitePlayers.length);

    // Find All Waiting Tournament Players
    socket.on("tournamentFind", (name) => {
        const id = generateId();
        const tournamentPlayerName = `Player_${name}_${id}`;
        log(`Player ${name}_${id} with socketId "${socket.id}" is interested in the tournament.`);
        tournamentPlayers.push({ name: tournamentPlayerName, socketId: socket.id });

        // Notify all tournament players about the new participant
        io.to('tournamentRoom').emit('newTournamentPlayer', tournamentPlayerName);

        // Join the player to a dedicated room for tournament players
        socket.join('tournamentRoom');

        // Notify the client about their player name
        socket.emit('playerName', tournamentPlayers);
    });
    log("tournament Players Length:" + tournamentPlayers.length);

    /******* Start of Invite player  **********************/
    // Listen for an invitation to play with another player
    socket.on('invitePlayer', (invitedPlayerId) => {
        // Check if the invited player is available
        const invitedPlayer = invitePlayers.find(player => player.socketId === invitedPlayerId);
        if (invitedPlayer) {
            // Store the pending invite
            pendingInvites[socket.id] = invitedPlayerId;

            // Notify the invited player about the invitation
            io.to(invitedPlayerId).emit('invitationReceived', socket.id, playerName);
        }
    });

    // Listen for an acceptance of the invitation
    socket.on('acceptInvite', (invitingPlayerId) => {
        // Check if the inviting player is still waiting
        const invitingPlayer = invitePlayers.find(player => player.socketId === invitingPlayerId);
        if (invitingPlayer) {
            // Remove the pending invite
            delete pendingInvites[invitingPlayerId];

            // Notify both players about the accepted invitation
            io.to(invitingPlayerId).emit('invitationAccepted', socket.id, playerName);
            io.to(socket.id).emit('invitationAccepted', invitingPlayerId, invitingPlayer.name);

            // Create a game for the two players
            const game = {
                players: [
                    { socketId: invitingPlayerId, name: invitingPlayer.name },
                    { socketId: socket.id, name: playerName }
                ],
                currentTurn: 0,
            };

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

    // Listen for a decline of the invitation
    socket.on('declineInvite', (invitingPlayerId) => {
        // Remove the pending invite
        delete pendingInvites[invitingPlayerId];

        // Notify the inviting player about the declined invitation
        io.to(invitingPlayerId).emit('invitationDeclined', socket.id, playerName);
    });

    /******* End of Invite player  ************************/


    /******* Start of Quick Game  ************************/

    /******* End of Quick Game  ************************/

    // Try to pair players when at least eight players are waiting for a Tournament Game
    if (tournamentPlayers.length >= 8) {
        const groups = createGroups(tournamentPlayers.slice(0, 8));
        console.log(groups + " from createGroups");

        // Notify players about the start of the group stage
        groups.forEach((group, groupIndex) => {
            group.forEach((player, playerIndex) => {
                io.to(player.socketId).emit('groupStart', group.map(p => p.name), groupIndex + 1, playerIndex + 1);
            });

            const groupGames = createBracket(group);
            console.log(groupGames + " from groupGames");
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

        tournamentPlayers = tournamentPlayers.slice(8);
    }

    // Disconnect Players that Exited or Lost Connection to the Game Server
    socket.on('disconnect', () => {
        log(`User disconnected: ${socket.id}`);
        handlePlayerDisconnect(socket.id);

        // Remove any pending invites involving the disconnected player
        removeInvites(socket.id);
    });
});



/** ************************Game Logic and Functions****************************** */
const genRoomId = () => {
    var result = '';
    var hexChars = '0123456789abcdef';
    for (var i = 0; i < 6; i += 1) {
        result += hexChars[Math.floor(Math.random() * 16)];
    }
    return result;
}

const generateId = () => {
    const id = Math.floor(Math.random() * 2000);
    return id;
}

function checkWinner(game) {
    // Implement your winning condition here
    // For example, if a player meets a certain condition, they are the winner
    if (game.currentTurn >= 5 && someWinningCondition(game.players[0]) === true) {
        return game.players[0];
    } else if (game.currentTurn >= 5 && someWinningCondition(game.players[1]) === true) {
        return game.players[1];
    }

    return null;
}

function someWinningCondition(player) {
    // Implement your specific winning condition logic here
    return true; // Placeholder, replace with actual winning condition logic
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

        // Check for a winner
        const winner = checkWinner(game);
        if (winner) {
            // Notify players about the winner and eliminate losers
            game.players.forEach(player => {
                io.to(player.socketId).emit('gameEnd', winner.name, game.players.filter(p => p !== winner).map(p => p.name));
            });

            // Remove the game from the active games list
            games = games.filter(g => g !== game);

            // Check if there's a single winner (regroup the winners)
            if (games.length === 1 && games[0].players.length === 1) {
                const tournamentWinner = games[0].players[0];
                io.to(tournamentWinner.socketId).emit('tournamentWinner', tournamentWinner.name);
            }
        }
    }
}

function removeInvites(disconnectedSocketId) {
    for (const invitingPlayerId in pendingInvites) {
        if (pendingInvites[invitingPlayerId] === disconnectedSocketId) {
            // Notify the inviting player about the declined invitation
            io.to(invitingPlayerId).emit('invitationDeclined', disconnectedSocketId, playerName);

            // Remove the pending invite
            delete pendingInvites[invitingPlayerId];
        }
    }
}

export function createGroups(players) {
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

export function createBracket(players) {
    const bracket = [];
    for (let i = 0; i < players.length; i += 2) {
        const game = {
            players: [players[i], players[i + 1]],
            currentTurn: 0,
        };
        bracket.push(game);
        console.log(game + " from Bracket");
    }
    return bracket;
}

server.listen(5000, () =>
    log(`Server running on port ${5000} => http://localhost:5000`)
);