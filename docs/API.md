# SmartReception AI — REST API Documentation

Base URL: `http://localhost:3001/api/v1`

All authenticated endpoints require: `Authorization: Bearer <access_token>`

Business-scoped endpoints require a JWT with `businessId` set (use `/auth/switch-business`).

---

## Authentication

### POST /auth/register
Register a new user and create their first business.

```json
{
  "email": "owner@clinic.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe",
  "businessName": "NovaCare Clinic",
  "industry": "CLINIC"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "...", "firstName": "...", "lastName": "..." },
    "business": { "id": "uuid", "name": "...", "slug": "..." },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### POST /auth/login
```json
{ "email": "owner@clinic.com", "password": "SecurePass123" }
```

### POST /auth/refresh
```json
{ "refreshToken": "eyJ..." }
```

### POST /auth/logout
Requires auth. Revokes refresh token.

### POST /auth/forgot-password
```json
{ "email": "owner@clinic.com" }
```

### POST /auth/verify-otp
```json
{ "email": "owner@clinic.com", "code": "123456" }
```

### POST /auth/resend-otp
```json
{ "email": "owner@clinic.com" }
```

### POST /auth/reset-password
```json
{ "email": "owner@clinic.com", "code": "123456", "password": "NewSecurePass123" }
```

### GET /auth/profile
Returns user profile and business memberships.

### POST /auth/switch-business
```json
{ "businessId": "uuid" }
```
Returns new token pair scoped to the selected business.

---

## Business

### GET /business
Get current business details. **Permission:** `business:read`

### PATCH /business
Update business profile. **Permission:** `business:write`

```json
{
  "name": "NovaCare Clinic",
  "description": "Premium healthcare",
  "industry": "CLINIC",
  "phone": "+1234567890",
  "email": "info@novacare.com",
  "timezone": "America/New_York"
}
```

### GET /business/settings
Get business settings including WhatsApp and AI config.

### PATCH /business/settings
Update business settings.

---

## Customers (CRM)

### GET /customers
List customers with pagination.

**Query:** `page`, `limit`, `search`, `sortBy`, `sortOrder`

### POST /customers
Create customer. **Permission:** `customers:write`

```json
{
  "name": "Jane Smith",
  "phone": "+1234567890",
  "email": "jane@email.com",
  "notes": "VIP patient",
  "tagIds": ["uuid"]
}
```

### GET /customers/:id
Get customer with tags, notes, and recent conversations.

### PATCH /customers/:id
Update customer.

### DELETE /customers/:id
Soft-delete customer.

### GET /customers/tags
List all customer tags.

### POST /customers/tags
```json
{ "name": "VIP", "color": "#651147" }
```

### POST /customers/:id/notes
```json
{ "content": "Called about appointment" }
```

---

## Conversations

### GET /conversations
List conversations. **Query:** `status`, `page`, `limit`, `search`

### GET /conversations/:id
Get conversation with messages.

### POST /conversations/:id/messages
Send a message (human agent). **Permission:** `conversations:write`

```json
{ "content": "Hello, how can I help?", "type": "TEXT" }
```

### POST /conversations/:id/takeover
Disable AI and assign to current user.

### POST /conversations/:id/read
Mark conversation as read.

### PATCH /conversations/:id/ai
Toggle AI on/off for conversation.
```json
{ "isAiEnabled": true }
```

---

## Appointments

### GET /appointments
List appointments. **Query:** `status`, `startDate`, `endDate`, `page`, `limit`

### GET /appointments/calendar
Calendar view. **Query:** `month`, `year`

### GET /appointments/availability
Check slot availability. **Query:** `date`, `serviceId`, `duration`

### POST /appointments
```json
{
  "customerId": "uuid",
  "serviceId": "uuid",
  "title": "General Consultation",
  "startTime": "2024-05-20T10:00:00Z",
  "endTime": "2024-05-20T10:30:00Z"
}
```

### PATCH /appointments/:id
Update appointment.

### DELETE /appointments/:id
Cancel appointment.

---

## Services

### GET /services
List business services.

### POST /services
```json
{
  "name": "General Consultation",
  "description": "30-minute consultation",
  "duration": 30,
  "price": 150.00
}
```

### PATCH /services/:id
### DELETE /services/:id

---

## Knowledge Base

### GET /knowledge/bases
List knowledge bases.

### POST /knowledge/bases
```json
{ "name": "FAQ", "description": "Frequently asked questions" }
```

### GET /knowledge/bases/:id/documents
List documents in a knowledge base.

### POST /knowledge/bases/:id/documents/upload
Upload document (multipart/form-data). Fields: `file`, `title`

Supported: PDF, DOCX, TXT

### POST /knowledge/bases/:id/faqs
```json
{
  "question": "What are your hours?",
  "answer": "Mon-Fri 9am-5pm",
  "category": "General"
}
```

### DELETE /knowledge/documents/:id
Delete document.

---

## AI Configuration

### GET /ai/config
Get AI assistant configuration.

### PUT /ai/config
**Permission:** `ai:configure`

```json
{
  "systemPrompt": "You are a helpful clinic assistant...",
  "temperature": 0.7,
  "maxTokens": 500,
  "enableAutoReply": true,
  "enableBooking": true,
  "enableLeadQualification": true,
  "languages": ["en", "es"],
  "greetingMessage": "Hello! How can I help you today?",
  "fallbackMessage": "Let me connect you with a team member."
}
```

---

## Analytics

### GET /analytics/dashboard
Dashboard KPIs: conversations, customers, appointments, AI resolution rate.

**Query:** `startDate`, `endDate`

### GET /analytics/conversations/trends
Daily conversation volume.

### GET /analytics/revenue
Monthly revenue overview.

### GET /analytics/team-performance
Team member conversation stats.

### GET /analytics/top-services
Most booked services.

---

## Team

### GET /team
List team members.

### POST /team/invite
**Permission:** `team:write`

```json
{ "email": "agent@clinic.com", "role": "AGENT" }
```

### PATCH /team/:memberId
```json
{ "role": "MANAGER" }
```

### DELETE /team/:memberId
Remove team member.

### GET /team/invitations
List pending invitations.

---

## Billing

### GET /billing
Subscription overview, usage, invoices. **Permission:** `billing:read`

### POST /billing/checkout
Create Stripe Checkout session. **Permission:** `billing:write`

```json
{ "plan": "PROFESSIONAL" }
```

### POST /billing/portal
Open Stripe Customer Portal. **Permission:** `billing:write`

### POST /billing/change-plan
Admin plan change (no payment). **Permission:** `billing:write`

### POST /billing/webhook
Stripe webhook (public, raw body). Configure in Stripe Dashboard.

---

## Knowledge Base

### GET /knowledge/search?q=...
Semantic + keyword document search. **Permission:** `knowledge:read`

---

## WhatsApp

### GET /whatsapp/accounts
List connected WhatsApp accounts. **Permission:** `settings:read`

### POST /whatsapp/accounts
Connect a WhatsApp Business account. **Permission:** `settings:write`

### DELETE /whatsapp/accounts/:id
Disconnect account. **Permission:** `settings:write`

### GET /whatsapp/webhook-info
Returns webhook URL and verify token for Meta setup.

## WhatsApp Webhook

### GET /whatsapp/webhook
Meta webhook verification.

**Query:** `hub.mode`, `hub.verify_token`, `hub.challenge`

### POST /whatsapp/webhook
Receive incoming WhatsApp messages. Processes asynchronously via BullMQ.

---

## Error Responses

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid input |
| 401 | UNAUTHORIZED | Missing/invalid token |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Duplicate resource |
| 429 | — | Rate limit exceeded |
| 500 | — | Internal server error |
