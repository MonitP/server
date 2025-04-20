export const API_URLS = {
  server: {
    base: '/api/server',
    create: '/create',
    delete: '/:id',
    update: '/:id',
    deleteProcess: '/:code/processes/:processName',
  },
  notification: {
    base: '/api/notifications',
  },
} as const;
