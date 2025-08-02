// Service Worker - push notifications uchun
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Default notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'explore',
        title: "Ko'rish",
        icon: '/icon-explore.png',
      },
      {
        action: 'close',
        title: 'Yopish',
        icon: '/icon-close.png',
      },
    ],
  }

  event.waitUntil(self.registration.showNotification('Vue App', options))
})

// Notification click hodisasi
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'explore') {
    clients.openWindow('/')
  }
})
