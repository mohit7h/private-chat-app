const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const axios = require('axios');

// 7-अंकीय रैंडम नंबर जनरेट करने का फंक्शन
function generateNumericId() {
    return Math.floor(1000000 + Math.random() * 9000000).toString();
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// यूजर्स और उनकी यूनिक ID को स्टोर करने के लिए ऑब्जेक्ट
const users = {};

// डिफॉल्ट रूट जोड़ें
app.get('/', (req, res) => {
    console.log('Serving index.html to client');
    res.sendFile(__dirname + '/index.html');
});

// सेल्फ-पिंगिंग हर 14 मिनट में
const pingUrl = 'https://private-chat-app-45vp.onrender.com';
setInterval(() => {
    axios.get(pingUrl)
        .then(response => {
            console.log(`Pinged server at ${new Date().toISOString()}: Status ${response.status}`);
        })
        .catch(error => {
            console.error(`Ping failed at ${new Date().toISOString()}:`, error.message);
        });
}, 14 * 60 * 1000); // 14 मिनट

wss.on('connection', (ws) => {
    const userId = generateNumericId();
    users[userId] = ws;

    console.log('New user connected with ID:', userId); // डीबग लॉग
    ws.send(JSON.stringify({ type: 'userId', userId: userId }));

    ws.on('message', (message) => {
        console.log('Received message data:', message.toString()); // डीबग लॉग
        try {
            const data = JSON.parse(message);

            if (data.type === 'connect') {
                const targetId = data.targetId;
                console.log(`Attempting to connect ${userId} to ${targetId}`);
                if (users[targetId]) {
                    ws.send(JSON.stringify({ type: 'connected', message: `Connected to ${targetId}` }));
                    users[targetId].send(JSON.stringify({ type: 'connected', message: `Connected to ${userId}` }));
                    users[targetId].partner = userId;
                    ws.partner = targetId;
                    console.log(`Successfully connected ${userId} to ${targetId}`);
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'User not found' }));
                    console.log(`Target ID ${targetId} not found`);
                }
            }

            if (data.type === 'message') {
                const targetId = ws.partner;
                if (targetId && users[targetId]) {
                    users[targetId].send(JSON.stringify({ 
                        type: 'message', 
                        message: data.message, 
                        fromName: data.fromName 
                    }));
                    console.log(`Message from ${userId} (${data.fromName}) to ${targetId}: ${data.message}`);
                } else {
                    console.log(`Target ID ${targetId} not found for message`);
                }
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        const partnerId = ws.partner;
        if (partnerId && users[partnerId]) {
            users[partnerId].send(JSON.stringify({ type: 'disconnected', message: 'User disconnected' }));
            delete users[partnerId].partner;
            console.log(`User ${userId} disconnected, notified partner ${partnerId}`);
        }
        delete users[userId];
        console.log(`User ${userId} removed from users list`);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});