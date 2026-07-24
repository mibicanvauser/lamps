const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 10000;
const wss = new WebSocketServer({ port: PORT});

console.log(`[Relay Server] Active on port ${PORT}...`);

// Only counts connections tagged as lamps
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

wss.on('connection', (ws, req) => {
    // Tag the connection based on the URL they used!
    ws.isLamp = req.url.includes('/lamp');

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
