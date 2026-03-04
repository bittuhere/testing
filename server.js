const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// 1. CORS Fix: Ye line GitHub Pages ko allow karegi
app.use(cors({ origin: "*" })); 

app.use(express.json());

// 2. "Cannot GET /" Fix: Ab link kholne par message dikhega
app.get('/', (req, res) => {
    res.send("<h1>Server is Running!</h1><p>Socket.io logic is active.</p>");
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
    console.log('New User:', socket.id);

    socket.on('joinRoom', ({ roomId, playerName }) => {
        socket.join(roomId);
        if (!rooms[roomId]) {
            rooms[roomId] = { board: Array(9).fill(""), players: {}, turn: 'X', status: 'playing' };
        }
        
        const symbol = Object.keys(rooms[roomId].players).length === 0 ? 'X' : 'O';
        rooms[roomId].players[socket.id] = { name: playerName, symbol };
        
        // 3. Emit Logic: Ye frontend ka "Waiting" hatayega
        socket.emit('init', { symbol, board: rooms[roomId].board });
        console.log(`${playerName} joined room ${roomId} as ${symbol}`);
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
