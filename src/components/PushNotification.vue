<template>
  <div class="notification-container">
    <div class="status-section">
      <h2>Push Notifications</h2>
      <div class="status-info">
        <p>
          <strong>Browser Support:</strong> {{ isSupported ? '✅ Supported' : '❌ Not Supported' }}
        </p>
        <p><strong>Permission:</strong> {{ permissionStatus }}</p>
        <p><strong>Subscription:</strong> {{ subscriptionStatus }}</p>
        <p><strong>Total Subscribers:</strong> {{ totalSubscriptions }}</p>
      </div>
    </div>

    <div class="action-buttons">
      <button
        @click="requestPermission"
        :disabled="!isSupported || permissionStatus === 'granted'"
        class="btn btn-primary"
      >
        {{ permissionStatus === 'granted' ? 'Permission Granted' : 'Enable Notifications' }}
      </button>

      <button
        @click="sendLocalNotification"
        :disabled="permissionStatus !== 'granted'"
        class="btn btn-secondary"
      >
        Test Local Notification
      </button>

      <button @click="sendPushNotification" :disabled="!isSubscribed" class="btn btn-success">
        Send Push Notification
      </button>

      <button @click="unsubscribe" :disabled="!isSubscribed" class="btn btn-danger">
        Unsubscribe
      </button>

      <button @click="refreshSubscriptions" class="btn btn-info">Refresh Status</button>
    </div>

    <div class="test-section">
      <h3>Send Custom Notification</h3>
      <div class="form-group">
        <label>Title:</label>
        <input
          v-model="customNotification.title"
          type="text"
          placeholder="Notification title"
          class="form-input"
        />
      </div>
      <div class="form-group">
        <label>Message:</label>
        <textarea
          v-model="customNotification.message"
          placeholder="Notification message"
          class="form-textarea"
        ></textarea>
      </div>
      <div class="form-group">
        <label>URL (optional):</label>
        <input v-model="customNotification.url" type="text" placeholder="/" class="form-input" />
      </div>
      <button
        @click="sendCustomNotification"
        :disabled="!customNotification.title || !customNotification.message"
        class="btn btn-primary"
      >
        Send Custom Notification
      </button>
    </div>

    <div class="logs-section">
      <h3>Logs</h3>
      <div class="logs-container">
        <div v-for="(log, index) in logs" :key="index" :class="['log-item', `log-${log.type}`]">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
      <button @click="clearLogs" class="btn btn-outline">Clear Logs</button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'

// State variables
const isSupported = ref(false)
const subscription = ref<PushSubscription | null>(null)
const totalSubscriptions = ref(0)
const permissionStatus = ref(Notification.permission)

// Custom notification form
const customNotification = ref({
  title: 'Test Notification',
  message: 'Bu test xabari!',
  url: '/',
})

// Logs
const logs = ref<Array<{ type: string; message: string; time: string }>>([])

// Computed properties
const subscriptionStatus = computed(() => {
  return subscription.value ? '✅ Subscribed' : '❌ Not Subscribed'
})

const isSubscribed = computed(() => {
  return !!subscription.value
})

// Base URL for API
const API_BASE = 'http://localhost:3000/api'

// Lifecycle
onMounted(async () => {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    isSupported.value = true
    await registerServiceWorker()
    await refreshSubscriptions()
  } else {
    addLog('error', 'Push notifications are not supported in this browser')
  }
})

// Service Worker registration
async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    addLog('success', 'Service Worker registered successfully')

    // Check existing subscription
    subscription.value = await registration.pushManager.getSubscription()

    if (subscription.value) {
      addLog('info', 'Existing subscription found')
    }
  } catch (error) {
    addLog('error', `Service Worker registration failed: ${error.message}`)
  }
}

// Request notification permission
async function requestPermission() {
  if (!isSupported.value) {
    addLog('error', 'Push notifications are not supported')
    return
  }

  try {
    const permission = await Notification.requestPermission()
    permissionStatus.value = permission

    if (permission === 'granted') {
      addLog('success', 'Notification permission granted')
      await subscribeUser()
    } else {
      addLog('error', 'Notification permission denied')
    }
  } catch (error) {
    addLog('error', `Permission request failed: ${error.message}`)
  }
}

// Subscribe user for push notifications
async function subscribeUser() {
  try {
    const registration = await navigator.serviceWorker.ready

    // Get VAPID public key from server
    const vapidPublicKey = await fetchVapidPublicKey()

    if (!vapidPublicKey) {
      throw new Error('VAPID public key not found')
    }

    // Convert VAPID key
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)

    // Subscribe to push notifications
    subscription.value = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    })

    // Send subscription to server
    await sendSubscriptionToServer(subscription.value)

    addLog('success', 'Successfully subscribed to push notifications')
    await refreshSubscriptions()
  } catch (error) {
    addLog('error', `Failed to subscribe: ${error.message}`)
  }
}

// Fetch VAPID public key from server
async function fetchVapidPublicKey(): Promise<string> {
  try {
    addLog('info', 'Fetching VAPID public key...')

    const response = await fetch(`${API_BASE}/vapidPublicKey`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (!data.publicKey) {
      throw new Error('Public key not found in response')
    }

    addLog('success', 'VAPID public key fetched successfully')
    return data.publicKey
  } catch (error) {
    addLog('error', `Failed to fetch VAPID key: ${error.message}`)
    throw error
  }
}

// Send subscription to server
async function sendSubscriptionToServer(subscription: PushSubscription) {
  try {
    const response = await fetch(`${API_BASE}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription: subscription,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    addLog('success', `Subscription saved: ${result.message}`)
  } catch (error) {
    addLog('error', `Failed to send subscription: ${error.message}`)
    throw error
  }
}

// Send local test notification
async function sendLocalNotification() {
  if (Notification.permission === 'granted') {
    new Notification('Local Test Notification', {
      body: 'Bu local test xabari!',
      icon: '/icon-192x192.png',
      tag: 'local-test',
    })
    addLog('info', 'Local notification sent')
  } else {
    addLog('error', 'Notification permission not granted')
  }
}

// Send push notification via server
async function sendPushNotification() {
  try {
    const response = await fetch(`${API_BASE}/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Server Push Notification',
        message: "Bu server orqali jo'natilgan xabar!",
        url: '/',
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    addLog(
      'success',
      `Push notification sent: ${result.results.successful} successful, ${result.results.failed} failed`,
    )
  } catch (error) {
    addLog('error', `Failed to send push notification: ${error.message}`)
  }
}

// Send custom notification
async function sendCustomNotification() {
  try {
    const response = await fetch(`${API_BASE}/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customNotification.value),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    addLog('success', `Custom notification sent: ${result.results.successful} recipients`)
  } catch (error) {
    addLog('error', `Failed to send custom notification: ${error.message}`)
  }
}

// Unsubscribe from push notifications
async function unsubscribe() {
  if (!subscription.value) {
    addLog('error', 'No subscription found')
    return
  }

  try {
    await subscription.value.unsubscribe()
    subscription.value = null
    addLog('success', 'Successfully unsubscribed from push notifications')
    await refreshSubscriptions()
  } catch (error) {
    addLog('error', `Failed to unsubscribe: ${error.message}`)
  }
}

// Refresh subscriptions count
async function refreshSubscriptions() {
  try {
    const response = await fetch(`${API_BASE}/subscriptions`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    totalSubscriptions.value = data.total
  } catch (error) {
    addLog('error', `Failed to refresh subscriptions: ${error.message}`)
  }
}

// Utility functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  if (!base64String || base64String.length === 0) {
    throw new Error('Invalid base64 string')
  }

  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  try {
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  } catch (error) {
    throw new Error('Failed to decode base64 string')
  }
}

function addLog(type: 'info' | 'success' | 'error', message: string) {
  const time = new Date().toLocaleTimeString()
  logs.value.unshift({ type, message, time })

  // Keep only last 50 logs
  if (logs.value.length > 50) {
    logs.value = logs.value.slice(0, 50)
  }
}

function clearLogs() {
  logs.value = []
}
</script>

<style scoped>
.notification-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.status-section {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.status-section h2 {
  margin-top: 0;
  color: #333;
}

.status-info p {
  margin: 8px 0;
  font-size: 14px;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 30px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #1e7e34;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.btn-info {
  background-color: #17a2b8;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background-color: #138496;
}

.btn-outline {
  background-color: transparent;
  border: 1px solid #ccc;
  color: #333;
}

.btn-outline:hover {
  background-color: #f8f9fa;
}

.test-section {
  background: #fff;
  border: 1px solid #ddd;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.test-section h3 {
  margin-top: 0;
  color: #333;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #555;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.logs-section {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
}

.logs-section h3 {
  margin-top: 0;
  color: #333;
}

.logs-container {
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 10px;
}

.log-item {
  display: flex;
  align-items: center;
  padding: 5px 0;
  border-bottom: 1px solid #eee;
  font-size: 13px;
}

.log-item:last-child {
  border-bottom: none;
}

.log-time {
  font-weight: bold;
  margin-right: 10px;
  min-width: 80px;
  color: #666;
}

.log-message {
  flex: 1;
}

.log-info .log-message {
  color: #17a2b8;
}

.log-success .log-message {
  color: #28a745;
}

.log-error .log-message {
  color: #dc3545;
}

@media (max-width: 600px) {
  .action-buttons {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
