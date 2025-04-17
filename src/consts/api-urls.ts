export const API_URLS = {
  server: {
    base: '/api/server',
    create: '/create',
    delete: '/:id',
    update: '/:id',
  },
  notification: {
    base: '/api/notifications',
  },
} as const;
