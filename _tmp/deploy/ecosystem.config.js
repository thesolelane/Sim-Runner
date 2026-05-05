module.exports = {
  apps: [
    {
      name: 'traydbook-api',
      script: 'server/index.js',
      cwd: '/var/www/traydbook',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_file: '/var/www/traydbook/.env',
      error_file: '/var/log/traydbook/api-error.log',
      out_file: '/var/log/traydbook/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      node_args: '--experimental-vm-modules',
    },
  ],
}
