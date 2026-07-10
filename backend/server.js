// server.js
const app = require('./src/app');
const { closePools } = require('./src/config/database');

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`🚀 CSR Backend running on http://localhost:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏳ Shutting down...');
  server.close(async () => {
    await closePools();
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  await closePools();
  process.exit(0);
});
