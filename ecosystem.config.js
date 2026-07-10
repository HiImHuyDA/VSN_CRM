module.exports = {
  apps : [
    {
      name   : 'csr-backend',
      script : './backend/server.js',
      cwd    : './backend',
      env    : { NODE_ENV: 'development' }
    },
    {
      name   : 'csr-frontend',
      script : './node_modules/vite/bin/vite.js',
      args   : 'preview --host 0.0.0.0 --port 4173',
      cwd    : './frontend',
      env    : { NODE_ENV: 'production' }
    }
  ]
};

