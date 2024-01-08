const { log } = require("console");
const express = require("express");
const app = express();
const http = require("http");
// const { setInterval } = require("timers/promises");
const server = http.createServer(app);
const io = require("socket.io")(server, { cors: { origin: "*" } });

// Two Players Mode Array
let TPM = [];
const boardState = {};
// Two Players Game Array
let TPMPlaying = [];
let Quick = [];
let players = [];
let currentTurn = 0;
io.on("connection", (socket) => {
  console.log("User Connected");

  // Check number of users joined and save in an array (Tournament Mode) and match them to play.

  socket.on("joinRoom", (roomId) => {
    console.log(`A user joined the room ${roomId}`);
    socket.join(roomId);
  });

  // socket.on("play", ({ id, roomId }) => {
  //   console.log(`play at ${id} to ${roomId}`);
  //   socket.broadcast.to(roomId).emit("updateGame", id);
  // });

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
          roomId: roomId
        }
        TPMPlaying.push(Play);
        TPM.splice(0, 2);
        Quick = TPMPlaying
        // socket.broadcast.to(roomId).emit("data", TPMPlaying);
        io.emit("qfind", TPMPlaying);
      }
    }
  });

  socket.on("playing", async ({ name, turn }) => {
    players = await TPMPlaying.find(item => item.p1.P1Name === name);

    console.log(players + " players");
    console.log(turn + " before");
    if (turn === "X") {
      turn = "O";
      console.log(turn + " after");
      obj && io.emit("qplay", turn);
    } else if
      (turn === "O") {
      turn = "X";
      console.log(turn + " after");
      obj && io.emit("qplay", turn);
    }
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