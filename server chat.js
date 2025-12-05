const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

const clients = [];

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html')); 
});

app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    clients.push(res);

    req.on('close', () => {
        const index = clients.indexOf(res);
        if (index !== -1) {
            clients.splice(index, 1);
        }
    });
});

app.post('/send', express.json(), (req, res) => {
    const { username, message } = req.body;

    const timestamp = new Date().toLocaleTimeString();
    const data = { username, message, timestamp };

    clients.forEach(client => {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    });

    res.send('Message sent');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
