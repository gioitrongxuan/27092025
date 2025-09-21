const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files

// Routes - Public stats only (no actual guest messages)
app.get('/api/guests', async (req, res) => {
  try {
    const guests = await pool.query('SELECT * FROM guestbook ORDER BY timestamp DESC');
    const stats = await pool.query('SELECT * FROM stats WHERE id = 1');

    res.json({
      totalGuests: guests.rowCount,
      stats: stats.rows[0] || { confirmed: 0, declined: 0 },
      recentCount: guests.rows.filter(
        g => new Date(g.timestamp) > new Date(Date.now() - 24*60*60*1000)
      ).length
    });
  } catch (error) {
    console.error('Error reading guests:', error);
    res.status(500).json({ error: 'Failed to read guests' });
  }
});

// Save guestbook entry
app.post('/api/rsvp', async (req, res) => {
  try {
    const { name, message, status } = req.body;
    if (!name || !message) {
      return res.status(400).json({ error: 'Name and message are required' });
    }

    // Insert guest
    const result = await pool.query(
      `INSERT INTO guestbook (name, message, status, ip) 
       VALUES ($1, $2, $3, $4) RETURNING id, name, timestamp`,
      [name.trim(), message.trim(), status || 'confirmed', req.ip]
    );

    // Update stats
    if (status === 'confirmed') {
      await pool.query('UPDATE stats SET confirmed = confirmed + 1 WHERE id = 1');
    } else if (status === 'declined') {
      await pool.query('UPDATE stats SET declined = declined + 1 WHERE id = 1');
    }

    console.log(`📝 New guestbook entry saved: ${name.trim()} - ID: ${result.rows[0].id}`);

    res.json({
      success: true,
      message: 'Lưu bút đã được lưu thành công!',
      guest: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving RSVP:', error);
    res.status(500).json({ error: 'Failed to save RSVP' });
  }
});

// Public route to get stats
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stats WHERE id = 1');
    res.json(result.rows[0] || { confirmed: 0, declined: 0 });
  } catch (error) {
    console.error('Error reading stats:', error);
    res.status(500).json({ error: 'Failed to read stats' });
  }
});

// Admin route to view all guestbook entries (password protected)
app.get('/api/admin/guestbook', async (req, res) => {
  const { password } = req.query;
  
  if (password !== process.env.ADMIN_PASSWORD && password !== 'graduation2025') {
    return res.status(401).json({ error: 'Unauthorized access' });
  }
  
  try {
    const guests = await pool.query('SELECT * FROM guestbook ORDER BY timestamp DESC');
    const stats = await pool.query('SELECT * FROM stats WHERE id = 1');
    
    const guestData = guests.rows;
    const statsData = stats.rows[0] || { confirmed: 0, declined: 0 };
    
    // Create HTML view for easy reading
    const htmlView = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>🎓 Guestbook Admin - Lễ Tốt nghiệp TNM</title>
        <meta charset="UTF-8">
        <style>
            body { 
                background: #000; color: #00ff00; font-family: 'Courier New', monospace; 
                padding: 20px; line-height: 1.6;
            }
            .header { color: #ffff00; text-align: center; margin-bottom: 30px; }
            .stats { 
                background: #111; padding: 15px; border: 1px solid #333; 
                margin-bottom: 20px; border-radius: 5px;
            }
            .guest-entry { 
                background: #001100; border-left: 4px solid #00ff00; 
                padding: 15px; margin: 15px 0; border-radius: 5px;
            }
            .guest-name { color: #00ffff; font-weight: bold; font-size: 18px; }
            .guest-time { color: #666; font-size: 12px; }
            .guest-message { 
                color: #ffffff; background: #222; padding: 10px; 
                margin: 10px 0; border-radius: 3px; font-style: italic;
            }
            .guest-meta { color: #888; font-size: 11px; }
            .export-btn {
                background: #00aa00; color: white; border: none; 
                padding: 10px 20px; margin: 10px; border-radius: 5px; cursor: pointer;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎓 Lưu bút Lễ Tốt nghiệp TNM</h1>
            <p>Admin Dashboard - Tất cả lưu bút đã nhận</p>
        </div>
        
        <div class="stats">
            <h3>📊 Thống kê:</h3>
            <p>📝 Tổng số lưu bút: <strong>${guestData.length}</strong></p>
            <p>✅ Tham dự: <strong>${statsData.confirmed}</strong></p>
            <p>❌ Từ chối: <strong>${statsData.declined}</strong></p>
            <p>📅 Cập nhật cuối: <strong>${new Date().toLocaleString('vi-VN')}</strong></p>
        </div>
        
        <button class="export-btn" onclick="exportToJSON()">📥 Export JSON</button>
        <button class="export-btn" onclick="window.print()">🖨️ In trang</button>
        <button class="export-btn" onclick="location.reload()">🔄 Refresh</button>
        
        <div id="guestbook">
            ${guestData.map((guest, index) => `
                <div class="guest-entry">
                    <div class="guest-name">#${index + 1} - ${guest.name}</div>
                    <div class="guest-time">⏰ ${new Date(guest.timestamp).toLocaleString('vi-VN')}</div>
                    <div class="guest-message">"${guest.message}"</div>
                    <div class="guest-meta">ID: ${guest.id} | Status: ${guest.status} | IP: ${guest.ip || 'N/A'}</div>
                </div>
            `).join('')}
        </div>
        
        <script>
            function exportToJSON() {
                const data = ${JSON.stringify(guestData, null, 2)};
                const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'guestbook_graduation_' + new Date().toISOString().split('T')[0] + '.json';
                a.click();
                URL.revokeObjectURL(url);
            }
            
            // Auto refresh every 60 seconds
            setTimeout(() => location.reload(), 60000);
        </script>
    </body>
    </html>`;
    
    res.send(htmlView);
    
  } catch (error) {
    console.error('Error reading guestbook data:', error);
    res.status(500).json({ error: 'Failed to read guestbook data' });
  }
});

// Live Location Routes
app.get('/api/live-location', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM live_location WHERE id = 1');
    const locationData = result.rows[0] || { is_active: false };
    
    res.json({
      isActive: locationData.is_active,
      description: locationData.description,
      mapUrl: locationData.map_url,
      phone: locationData.phone,
      note: locationData.note,
      timestamp: locationData.timestamp
    });
  } catch (error) {
    console.error('Error reading location:', error);
    res.status(500).json({ error: 'Failed to read location' });
  }
});

app.post('/api/share-location', async (req, res) => {
  try {
    const { adminKey, isActive, description, mapUrl, phone, note } = req.body;
    
    // Simple admin authentication
    if (adminKey !== 'graduation_admin_2025' && adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await pool.query(
      `UPDATE live_location 
       SET is_active = $1, description = $2, map_url = $3, phone = $4, note = $5, 
           timestamp = CURRENT_TIMESTAMP, last_updated_by = $6
       WHERE id = 1`,
      [isActive, description, mapUrl, phone, note, req.ip]
    );

    const result = await pool.query('SELECT * FROM live_location WHERE id = 1');
    const updatedLocation = result.rows[0];
    
    res.json({ 
      success: true, 
      message: 'Location updated successfully',
      location: {
        isActive: updatedLocation.is_active,
        description: updatedLocation.description,
        mapUrl: updatedLocation.map_url,
        phone: updatedLocation.phone,
        note: updatedLocation.note,
        timestamp: updatedLocation.timestamp
      }
    });
    
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
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
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`🎓 Graduation invitation server running on port ${PORT}`);
      console.log(`💾 Using PostgreSQL database`);
      console.log(`🌐 Visit: http://localhost:${PORT}`);
      console.log(`🔐 Admin panel: http://localhost:${PORT}/api/admin/guestbook?password=graduation2025`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();