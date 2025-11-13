export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    sentinelHosts: process.env.REDIS_SENTINEL_HOSTS
      ? process.env.REDIS_SENTINEL_HOSTS.split(',')
      : [],
    masterName: process.env.REDIS_MASTER_NAME || 'mymaster',
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },
});
