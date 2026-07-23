const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT});

console.log(`[Relay Server] Active on port ${PORT}...`);

wss.on('connection', (ws, req) => {
	const clientIp = req.socket.remoteAddress;
	console.log(`[Connected] New client joined from ${clientIp}. Total connected: ${wss.clients.size}`);

ws.on('message', (message, isBinary) => {

wss.clients.forEach((client) => {
	if(client !== ws && client.readyState === WebSocket.OPEN) {
		client.send(message, { binary: isBinary });
		}
	});
});

ws.on('close', () => {
	console.log(`[Disconnected] Client left. Total remaining: ${wss.clients.size}`);
});

ws.on('error', (err) => {
	console.error('[Socket Error]:', err.message);
	});
});
