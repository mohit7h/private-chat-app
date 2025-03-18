const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// यूजर्स और उनकी यूनिक ID को स्टोर करने के लिए ऑब्जेक्ट
const users = {};

// डिफॉल्ट रूट जोड़ें (हेल्थ चेक के लिए)
app.get('/', (req, res) => {
    console.log('Serving index.html to client'); // डीबग लॉग
    res.sendFile(__dirname + '/index.html');
});

wss.on('connection', (ws) => {
    const userId = uuidv4();
    users[userId] = ws;

    console.log('New user connected with ID:', userId); // डीबग लॉग
    ws.send(JSON.stringify({ type: 'userId', userId: userId }));

    ws.on('message', (message) => {
        console.log('Received message:', message.toString()); // डीबग लॉग
        const data = JSON.parse(message);

        if (data.type === 'connect') {
            const targetId = data.targetId;
            console.log(`Attempting to connect ${userId} to ${targetId}`); // डीबग लॉग
            if (users[targetId]) {
                ws.send(JSON.stringify({ type: 'connected', message: `Connected to ${targetId}` }));
                users[targetId].send(JSON.stringify({ type: 'connected', message: `Connected to ${userId}` }));
                users[targetId].partner = userId;
                ws.partner = targetId;
                console.log(`Successfully connected ${userId} to ${targetId}`); // डीबग लॉग
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'User not found' }));
                console.log(`Target ID ${targetId} not found`); // डीबग लॉग
            }
        }

        if (data.type === 'message') {
            const targetId = ws.partner;
            if (targetId && users[targetId]) {
                users[targetId].send(JSON.stringify({ type: 'message', message: data.message, from: userId }));
                console.log(`Message from ${userId} to ${targetId}: ${data.message}`); // डीबग लॉग
            } else {
                console.log(`Target ID ${targetId} not found for message`); // डीबग लॉग
            }
        }
    });

    ws.on('close', () => {
        const partnerId = ws.partner;
        if (partnerId && users[partnerId]) {
            users[partnerId].send(JSON.stringify({ type: 'disconnected', message: 'User disconnected' }));
            delete users[partnerId].partner;
            console.log(`User ${userId} disconnected, notified partner ${partnerId}`); // डीबग लॉग
        }
        delete users[userId];
        console.log(`User ${userId} removed from users list`); // डीबग लॉग
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error); // डीबग लॉग
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});