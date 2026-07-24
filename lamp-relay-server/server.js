const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 10000;
const wss = new WebSocketServer({ port: PORT});

console.log(`[Relay Server] Active on port ${PORT}...`);

// Helper to count only active, responsive lamps
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

// Heartbeat check: Automatically detect ghost/unplugged clients every 30 seconds
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('[Heartbeat] Terminating dead/unplugged connection.');
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

wss.on('connection', (ws, req) => {
    ws.isLamp = req.url.includes('/lamp');
    ws.isAlive = true;

    // Mark client as alive when it responds to server pings
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    const clientIp = req.socket.remoteAddress;
    console.log(`[Connected] New ${ws.isLamp ? 'LAMP' : 'APP'} joined. Total connected: ${wss.clients.size}`);
    
    broadcastLampCount();

    ws.on('message', (message) => {
        const messageStr = message.toString();
        wss.clients.forEach((client) => {
            if(client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    });

    ws.on('close', () => {
        console.log(`[Disconnected] Client left. Total remaining: ${wss.clients.size}`);
        broadcastLampCount();
    });

    ws.on('error', (err) => {
        console.error('[Socket Error]:', err.message);
    });
});
