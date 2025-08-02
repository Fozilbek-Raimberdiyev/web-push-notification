import express from 'express'
const PORT = 3000
import webPush from 'web-push'
import cors from 'cors'

const vapidKeys = webPush.generateVAPIDKeys()

webPush.setVapidDetails(
  'mailto:fl.raimberdiyev@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey,
)

const app = express()

// Middleware
app.use(cors())
app.use(express.json()) // JSON body parser qo'shish kerak

// Subscriptions ni saqlash uchun array (production da database ishlatish kerak)
let subscriptions = []

// VAPID public key endpoint
app.get('/api/vapidPublicKey', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey })
})

// Subscription saqlash endpoint
app.post('/api/subscribe', (req, res) => {
  try {
    const subscription = req.body.subscription

    // Subscription validation
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        error: 'Invalid subscription object',
      })
    }

    // Mavjud subscription borligini tekshirish (duplicate avoid qilish)
    const existingIndex = subscriptions.findIndex((sub) => sub.endpoint === subscription.endpoint)

    if (existingIndex !== -1) {
      // Mavjud subscription ni yangilash
      subscriptions[existingIndex] = subscription
      console.log('Subscription updated:', subscription.endpoint)
    } else {
      // Yangi subscription qo'shish
      subscriptions.push(subscription)
      console.log('New subscription added:', subscription.endpoint)
    }

    console.log(`Total subscriptions: ${subscriptions.length}`)

    res.status(200).json({
      success: true,
      message: 'Subscription saved successfully',
      totalSubscriptions: subscriptions.length,
    })
  } catch (error) {
    console.error('Error saving subscription:', error)
    res.status(500).json({
      error: 'Failed to save subscription',
    })
  }
})

// Push notification jo'natish endpoint
app.post('/api/send-notification', async (req, res) => {
  try {
    const { title, message, url } = req.body

    if (!title || !message) {
      return res.status(400).json({
        error: 'Title and message are required',
      })
    }

    if (subscriptions.length === 0) {
      return res.status(400).json({
        error: 'No subscriptions found',
      })
    }

    const notificationPayload = {
      title: title,
      body: message,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      url: url || '/',
      timestamp: Date.now(),
    }

    console.log(`Sending notification to ${subscriptions.length} subscribers`)

    // Barcha subscriptions ga notification jo'natish
    const promises = subscriptions.map(async (subscription, index) => {
      try {
        await webPush.sendNotification(subscription, JSON.stringify(notificationPayload))
        console.log(`✅ Notification sent to subscriber ${index + 1}`)
        return { success: true, index }
      } catch (error) {
        console.error(`❌ Failed to send to subscriber ${index + 1}:`, error.message)

        // Agar subscription invalid bo'lsa, uni o'chirish
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`Removing invalid subscription ${index + 1}`)
          return { success: false, index, remove: true }
        }

        return { success: false, index, error: error.message }
      }
    })

    const results = await Promise.all(promises)

    // Invalid subscriptions ni o'chirish
    const invalidIndices = results
      .filter((result) => result.remove)
      .map((result) => result.index)
      .sort((a, b) => b - a) // Reverse order da o'chirish

    invalidIndices.forEach((index) => {
      subscriptions.splice(index, 1)
    })

    const successful = results.filter((result) => result.success).length
    const failed = results.filter((result) => !result.success).length

    res.status(200).json({
      success: true,
      message: 'Notifications sent',
      results: {
        total: subscriptions.length + invalidIndices.length,
        successful,
        failed,
        removed: invalidIndices.length,
      },
    })
  } catch (error) {
    console.error('Error sending notifications:', error)
    res.status(500).json({
      error: 'Failed to send notifications',
    })
  }
})

// Barcha subscriptions ni ko'rish (debug uchun)
app.get('/api/subscriptions', (req, res) => {
  res.json({
    total: subscriptions.length,
    subscriptions: subscriptions.map((sub, index) => ({
      id: index,
      endpoint: sub.endpoint.substring(0, 50) + '...',
      keys: !!sub.keys,
    })),
  })
})

// Subscription o'chirish
app.delete('/api/subscribe/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)

    if (id >= 0 && id < subscriptions.length) {
      subscriptions.splice(id, 1)
      res.json({
        success: true,
        message: 'Subscription removed',
        remaining: subscriptions.length,
      })
    } else {
      res.status(404).json({ error: 'Subscription not found' })
    }
  } catch (error) {
    console.error('Error removing subscription:', error)
    res.status(500).json({ error: 'Failed to remove subscription' })
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
  console.log('VAPID Keys generated:')
  console.log('Public Key:', vapidKeys.publicKey)
  console.log('Private Key:', vapidKeys.privateKey)
})
