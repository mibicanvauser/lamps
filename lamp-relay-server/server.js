const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 10000;
const wss = new WebSocketServer({ port: PORT});

console.log(`[Relay Server] Active on port ${PORT}...`);

function broadcastLampCount() {
    let lampCount = 0;
    wss.clients.forEach((client) => {
        if (client.isLamp && client.readyState === WebSocket.OPEN) {
            lampCount++;
        }
    });

    const statusPacket = JSON.stringify({ type: "STATUS", count: lampCount });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(statusPacket);
        }
    });
}

// Sweep for dead lamps every 4 seconds based on activity
setInterval(() => {
    const now = Date.now();
    let changed = false;
    wss.clients.forEach((ws) => {
        if (ws.isLamp) {
            // If the lamp hasn't sent a message or heartbeat in 7 seconds, terminate it!
            if (now - ws.lastSeen > 15000) {
                console.log('[Sweep] Lamp timed out. Terminating ghost connection.');
                ws.terminate();
                changed = true;
            }
        }
    });
    if (changed) {
        broadcastLampCount();
    }
}, 5000);

wss.on('connection', (ws, req) => {
    ws.isLamp = req.url.includes('/lamp');
    ws.lastSeen = Date.now(); // Initialize timestamp

    const clientIp = req.socket.remoteAddress;
    console.log(`[Connected] New ${ws.isLamp ? 'LAMP' : 'APP'} joined.`);
    
    broadcastLampCount();

    ws.on('message', (message) => {
        const messageStr = message.toString();
        if (messageStr.includes("HEARTBEAT")) {
        // Update the timestamp every single time the lamp sends anything
        ws.lastSeen = Date.now();
        return; 
        }
        
        wss.clients.forEach((client) => {
            if(client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    });

    ws.on('close', () => {
        console.log(`[Disconnected] Client left.`);
        broadcastLampCount();
    });

    ws.on('error', (err) => {
        console.error('[Socket Error]:', err.message);
    });
});
