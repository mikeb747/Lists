import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Set headers to prevent stale asset caching on mobile and desktop
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (req.path === '/sw.js') {
    res.setHeader('Service-Worker-Allowed', '/');
  }
  next();
});

// Serve static assets from the current directory
app.use(express.static(__dirname));

// Single page / static fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lists server listening on http://0.0.0.0:${PORT}`);
});
