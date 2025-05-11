module.exports = {
  apps: [
    {
      name: 'monitor-server',
      script: 'npm',
      args: 'run start',
      instances: 1,
      autorestart: true,
      watch: true,
      ignore_watch: ['dist', 'node_modules'],
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}; 