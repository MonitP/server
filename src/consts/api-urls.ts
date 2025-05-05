export const API_URLS = {
  server: {
    base: '/api/server',
    create: '/create',
    delete: '/:id',
    update: '/:id',
    deleteProcess: '/:code/processes/:processName',
  },
  log: {
    base: '/api/logs',
  },
  notification: {
    base: '/api/notifications',
  },
} as const;
