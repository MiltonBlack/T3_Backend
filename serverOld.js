const { log } = require("console");
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server, { cors: { origin: "*" } });

// players that just joined the server
let waitingPlayers = [];
let tournamentPlayers = [];
let games = [];
const boardState = {};

io.on("connection", (socket) => {
  console.log("User Connected");

  // Find all waiting Quick Players
  socket.on("quickPlayFind", (name) => {
    const quickPlayerName = `Player_${name}_${id}`;
    waitingPlayers.push({ name: quickPlayerName, socketId: socket.id });
    socket.emit('playerName', waitingPlayers);
  });

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



  // Find All Waiting Tournament Players
  socket.on("tournamentFind", (name) => {
    const id = generateId();
    const tournamentPlayerName = `Player_${name}_${id}`;
    tournamentPlayers.push({ name: tournamentPlayerName, socketId: socket.id });
    socket.emit('playerName', tournamentPlayers);
  });


  socket.on("joinRoom", (roomId) => {
    console.log(`A user joined the room ${roomId}`);
    socket.join(roomId);
  });

  // Quick Start/Free Game
  socket.on("qfind", ({ roomId, name }) => {
    console.log(name)
    if (name != null) {
      TPM.push(name);
      if (TPM.length >= 2) {
        let P1 = {
          P1Name: TPM[0],
          P1Val: "X",
          P1Move: ""
        }
        let P2 = {
          P2Name: TPM[1],
          P2Val: "O",
          P2Move: ""
        }
        let Play = {
          p1: P1,
          p2: P2,
          turn: currentTurn,
          roomId: roomId,
          currentPlayer
        }
        TPMPlaying.push(Play);
        TPM.splice(0, 2);
        Quick = TPMPlaying
        io.emit("qfind", TPMPlaying);
      }
    }
  });

  socket.on("playing", async ({ name }) => {
    players = await TPMPlaying.find(item => item.p1.P1Name === name);
    console.log(players);
    // io.emit('nextTurn', players.currentPlayer);
    // players.currentPlayer = 3 - players.currentPlayer; // Switch to the other player
    // console.log(players.currentPlayer);
  });

  io.emit('turn', currentTurn);

  socket.on('drop', ({ data, dropzoneId }) => {
    console.log({ data, dropzoneId });
    io.emit('drop', { data, dropzoneId });
  });

  socket.on('endTurn', () => {
    // Only allow the current player to end their turn
    if (socket.id === players[currentTurn % 2]) {
      // Increment the turn and broadcast the new turn to all clients
      currentTurn++;
      console.log(currentTurn);
      io.emit('turn', currentTurn);
    }
  });

  // socket.emit('playerNumber', players.indexOf(socket.id));
  // socket.emit('playerNumber', players.indexOf(socket.id));
  // Emit the current turn to the connected clients

  socket.on('movePiece', (data) => {
    // Update the board state with the moved piece
    boardState[data.pieceId] = data.newPosition;

    // Broadcast the updated board state to all connected clients
    io.emit('updateBoardState', boardState);
    console.log(boardState);
  });

  console.log(TPM);
  io.emit("players", Quick);

  socket.on("info", (content) => {
    console.log(content);
  })

  const generateId = () => {
    const id = Math.floor(Math.random() * 2000);
    return id;
  }

  socket.on("disconnect", () => {
    console.log("User Disconnected");
    if (players.length === 0) {
      currentTurn = 0;
    }
  });
});

server.listen(5000, () =>
  console.log("server running => http://localhost:5000")
);