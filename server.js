const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files

// Data storage (in production, use database)
const DATA_FILE = 'guestbook.json';

// Initialize data file
async function initDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify({ guests: [], stats: { confirmed: 0, declined: 0 } }));
    }
}

// Read data
async function readData() {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

// Write data
async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// Routes
app.get('/api/guests', async (req, res) => {
    try {
        const data = await readData();
        res.json(data.guests);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read guests' });
    }
});

app.post('/api/rsvp', async (req, res) => {
    try {
        const { name, message, status, timestamp } = req.body;
        
        if (!name || !message) {
            return res.status(400).json({ error: 'Name and message are required' });
        }

        const data = await readData();
        
        const newGuest = {
            id: Date.now(),
            name: name.trim(),
            message: message.trim(),
            status: status || 'confirmed',
            timestamp: timestamp || new Date().toISOString(),
            ip: req.ip
        };

        data.guests.push(newGuest);
        
        // Update stats
        if (status === 'confirmed') {
            data.stats.confirmed++;
        } else if (status === 'declined') {
            data.stats.declined++;
        }

        await writeData(data);
        
        res.json({ 
            success: true, 
            message: 'RSVP saved successfully!',
            guest: newGuest 
        });
        
    } catch (error) {
        console.error('Error saving RSVP:', error);
        res.status(500).json({ error: 'Failed to save RSVP' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const data = await readData();
        res.json(data.stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read stats' });
    }
});

// Admin route to view all responses (password protected)
app.get('/api/admin/guests', async (req, res) => {
    const { password } = req.query;
    
    if (password !== process.env.ADMIN_PASSWORD && password !== 'graduation2025') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const data = await readData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
    await initDataFile();
    app.listen(PORT, () => {
        console.log(`🎓 Graduation invitation server running on port ${PORT}`);
        console.log(`📝 Guestbook data stored in: ${DATA_FILE}`);
        console.log(`🌐 Visit: http://localhost:${PORT}`);
    });
}

startServer().catch(console.error);