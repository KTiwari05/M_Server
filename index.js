const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

// Global objects to store room and user data
let rooms = {};
let users = {}; // This stores user information like name, language, and roomId

function generateRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit ID
}

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  // Handle creating a room
  socket.on("create-room", ({ name, language }) => {
    const roomId = generateRoomId();
    rooms[roomId] = []; // Create an empty room
    users[socket.id] = { name, language, roomId }; // Store user info with language
    socket.join(roomId); // Join the room
    console.log(
      `${name} created room ${roomId} and selected language ${language}`,
    );
    socket.emit("room-created", { roomId });
  });

  // Handle joining a room
  socket.on("join-room", ({ roomId, name, language }) => {
    if (rooms[roomId]) {
      users[socket.id] = { name, language, roomId }; // Store user info with language
      socket.join(roomId); // Join the room
      console.log(
        `${name} joined room ${roomId} and selected language ${language}`,
      );
      io.to(roomId).emit("message", {
        sender: "system",
        message: `${name} has joined the room`,
      });
      socket.emit("room-joined", { roomId });
    } else {
      socket.emit("error", "Room does not exist.");
      console.log(`Failed join attempt: Room ${roomId} does not exist.`);
    }
  });

  // Handle sending messages to a room
  socket.on("send-message", ({ roomId, message }) => {
    if (users[socket.id]) {
      const senderName = users[socket.id].name; // Get the user's name
      const senderLanguage = users[socket.id].language; // Get the sender's language

      // Emit the original message to the room
      io.to(roomId).emit("receive-message", {
        message,
        sender: senderName,
        senderLanguage,
      });
    }
  });

  // Handle user speaking start
  socket.on("user-speaking-start", () => {
    if (users[socket.id]) {
      const { name, roomId } = users[socket.id];
      socket.to(roomId).emit("user-speaking-start", { sender: name });
    }
  });

  // Handle user speaking stop
  socket.on("user-speaking-stop", () => {
    if (users[socket.id]) {
      const { name, roomId } = users[socket.id];
      socket.to(roomId).emit("user-speaking-stop", { sender: name });
    }
  });

  // Handle leaving a room
  socket.on("leave-room", (roomId) => {
    if (users[socket.id] && users[socket.id].roomId === roomId) {
      socket.leave(roomId);
      const { name } = users[socket.id];
      delete users[socket.id]; // Remove user info when they leave
      io.to(roomId).emit("message", {
        sender: "system",
        message: `${name} has left the room`,
      });
      console.log(`${name} left room: ${roomId}`);
    } else {
      console.log(`Leave room attempt failed: User not in room ${roomId}`);
    }
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    if (users[socket.id]) {
      const { name, roomId } = users[socket.id];
      io.to(roomId).emit("message", {
        sender: "system",
        message: `${name} has left the room`,
      });
      delete users[socket.id]; // Clean up user data
      console.log(`${name} disconnected from room: ${roomId}`);
    }
    console.log("User disconnected:", socket.id);
  });
});

// Basic route for server status
app.get("/", (req, res) => {
  res.send("Chat server is running");
});

// Start the server
const PORT = process.env.PORT || 3000; // Allow for dynamic port assignment
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});