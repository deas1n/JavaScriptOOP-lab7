const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let nextClientId = 1;
const clients = new Map();

let price = 100; 

function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function broadcastPrice() {
  const msg = JSON.stringify({ type: 'price_update', price });
  for (const { ws } of clients.values()) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

function sendAllStates() {
  for (const [id, client] of clients.entries()) {
    const { ws, usd, crypto } = client;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'state_update', clientId: id, usd, crypto }));
    }
  }
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

setInterval(() => {
  const delta = randInt(-5, 5);
  price = Math.max(1, price + delta); 
  broadcastPrice();
}, 3000);

wss.on('connection', (ws) => {
  const clientId = nextClientId++;
  const initialUsd = 1000;
  const initialCrypto = 0;

  clients.set(clientId, { ws, usd: initialUsd, crypto: initialCrypto });

  send(ws, { type: 'welcome', clientId, price, state: { usd: initialUsd, crypto: initialCrypto } });

  send(ws, { type: 'state_update', clientId, usd: initialUsd, crypto: initialCrypto });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      send(ws, { type: 'error', message: 'Invalid JSON' });
      return;
    }

    const client = clients.get(clientId);
    if (!client) {
      send(ws, { type: 'error', message: 'Unknown client' });
      return;
    }

    if (msg.type === 'buy') {
      if (client.usd >= price) {
        client.usd = Number((client.usd - price).toFixed(2));
        client.crypto += 1;
        sendAllStates();
      } else {
        send(ws, { type: 'error', message: 'Insufficient USD balance to buy' });
      }
    } else if (msg.type === 'sell') {
      if (client.crypto >= 1) {
        client.crypto -= 1;
        client.usd = Number((client.usd + price).toFixed(2));
        sendAllStates();
      } else {
        send(ws, { type: 'error', message: 'No crypto to sell' });
      }
    } else {
      send(ws, { type: 'error', message: 'Unknown action type' });
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
  });

  ws.on('error', () => {
    clients.delete(clientId);
  });
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`Open http://localhost:${port}/exchange.html`);
});


