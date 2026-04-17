const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static('public'));

// Serve CSS from output.css
app.use('/css', express.static('public/css'));

// Parse JSON bodies
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/study-log', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'study-log.html'));
});

app.get('/timer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'timer.html'));
});

app.get('/progress', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'progress.html'));
});

app.get('/reminders', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reminders.html'));
});

app.get('/firebase', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'firebase.html'));
});

// Build CSS on startup
console.log('Building Tailwind CSS...');
exec('npm run build', (error, stdout, stderr) => {
  if (error) {
    console.error('Error building CSS:', error);
    return;
  }
  console.log('CSS built successfully');
  console.log(stdout);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Available pages:`);
  console.log(`  Home: http://localhost:${PORT}/`);
  console.log(`  Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`  Study Log: http://localhost:${PORT}/study-log`);
  console.log(`  Timer: http://localhost:${PORT}/timer`);
  console.log(`  Progress: http://localhost:${PORT}/progress`);
  console.log(`  Reminders: http://localhost:${PORT}/reminders`);
  console.log(`  Firebase: http://localhost:${PORT}/firebase`);
});
