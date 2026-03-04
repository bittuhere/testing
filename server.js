const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors({ origin: "*" })); 
app.use(express.json());

// Status check ke liye
app.get('/', (req, res) => {
    res.send("<h1>Tic-Tac-Toe Server is Running!</h1>");
});

const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] } 
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected!"))
  .catch(err => console.error("DB Error:", err));

let rooms = {};

io.on('connection', (socket) => {
    // Agar ye logs mein aaye, matlab Naya Code chal raha hai
    console.log('--- NEW CONNECTION DETECTED ---');
    console.log('ID:', socket.id);

    socket.on('joinRoom', ({ roomId, playerName }) => {
        socket.join(roomId);
        if (!rooms[roomId]) {
            rooms[roomId] = { board: Array(9).fill(""), players: {}, turn: 'X', status: 'playing' };
        }
        
        const symbol = Object.keys(rooms[roomId].players).length === 0 ? 'X' : 'O';
        rooms[roomId].players[socket.id] = { name: playerName, symbol };
        
        // Frontend ko signal bhejna taaki "Waiting" hat jaye
        socket.emit('init', { symbol, board: rooms[roomId].board });
        console.log(`PLAYER JOINED: ${playerName} (Room: ${roomId}, Symbol: ${symbol})`);
    });

    socket.on('makeMove', ({ roomId, index }) => {
        const room = rooms[roomId];
        if (room && room.board[index] === "") {
            const player = room.players[socket.id];
            if (player && room.turn === player.symbol) {
                room.board[index] = player.symbol;
                room.turn = room.turn === 'X' ? 'O' : 'X';
                io.to(roomId).emit('updateBoard', { board: room.board, turn: room.turn, status: 'playing' });
            }
        }
    });

    socket.on('chatMessage', ({ roomId, msg, sender }) => {
        io.to(roomId).emit('newChatMessage', { text: msg, sender });
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server live on port ${PORT}`));
