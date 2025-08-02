## 1. Har bir qadamda qaysi endpoint ishlaydi

### **Qadamlar va Endpointlar:**

**1-qadami: Permission olish**

```
Endpoint: YO'Q (faqat browser API)
```

```javascript
// Faqat browserni o'zida
await Notification.requestPermission()
```

**2-qadami: VAPID key olish**

```
Endpoint: GET /api/vapidPublicKey
Frontend → Backend
```

```javascript
// Frontend
const response = await fetch('/api/vapidPublicKey')
const { publicKey } = await response.json()
```

**3-qadami: Push Service ga ro'yxatdan o'tish**

```
Endpoint: YO'Q (Push Service bilan to'g'ridan-to'g'ri)
Browser → Google/Mozilla Push Service
```

```javascript
// Browser avtomatik
const subscription = await registration.pushManager.subscribe({
  applicationServerKey: publicKey,
})
```

**4-qadami: Subscription ni backend ga saqlash**

```
Endpoint: POST /api/subscribe
Frontend → Backend
```

```javascript
// Frontend backend ga jo'natadi
await fetch('/api/subscribe', {
  method: 'POST',
  body: JSON.stringify({ subscription }),
})
```

**5-qadami: Xabar jo'natish**

```
Endpoint: POST /api/send-notification
Frontend → Backend → Push Service → Browser
```

```javascript
// 1. Frontend backend ga
await fetch('/api/send-notification', {
  body: JSON.stringify({ title: 'Salom', message: 'Test' }),
})

// 2. Backend Push Service ga
await webPush.sendNotification(subscription, payload)

// 3. Push Service browser ga xabar yetkazadi
```

## 2. VAPID Keys - bir martalik!

**Bir marta generate qiling va hamma uchun ishlatiladi**

```javascript
// ❌ NOTO'G'RI - har user uchun alohida
const user1Keys = webPush.generateVAPIDKeys()
const user2Keys = webPush.generateVAPIDKeys()

// ✅ TO'G'RI - bir marta, barcha users uchun
const vapidKeys = webPush.generateVAPIDKeys()
// Bu kalitlar serveringiz uchun "ID card" kabi
```

**Analogiya:**

- VAPID keys = Do'kon egasining passport raqami
- Har mijoz uchun yangi passport olmaysiz
- Bir passport bilan barcha mijozlarga xizmat ko'rsatasiz

## 3. Push Service browserlarni qanday ajratadi?

### **Unique Subscription Object:**

Har bir browser ro'yxatdan o'tganda unique **subscription** oladi:

```javascript
{
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123xyz789",
  keys: {
    p256dh: "user1_unique_key_123",
    auth: "user1_auth_456"
  }
}
```

**Browser 2:**

```javascript
{
  endpoint: "https://fcm.googleapis.com/fcm/send/def456uvw012",
  keys: {
    p256dh: "user2_unique_key_789",
    auth: "user2_auth_012"
  }
}
```

**Analogiya:**

- **endpoint** = pochta manzili (har uy unique)
- **keys** = kalitlar (har uy uchun alohida kalit)

Push Service bu ma'lumotlar orqali browserlarni ajratadi.
