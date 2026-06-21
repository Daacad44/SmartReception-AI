# SmartReception AI — Workflows

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant DB as PostgreSQL

    U->>F: Register / Login
    F->>A: POST /auth/register or /auth/login
    A->>DB: Validate credentials
    A->>DB: Create refresh token
    A-->>F: accessToken (15m) + refreshToken (7d)
    F->>F: Store tokens in Zustand

    Note over F,A: On API call
    F->>A: Request + Bearer accessToken
    A->>A: Verify JWT, load permissions
    A-->>F: Response

    Note over F,A: Token expired
    F->>A: POST /auth/refresh
    A->>DB: Validate & rotate refresh token
    A-->>F: New token pair
```

### Token Lifecycle

1. **Access Token** — JWT, 15-minute expiry, contains `userId`, `email`, `businessId`, `role`
2. **Refresh Token** — Stored in DB, 7-day expiry, rotated on each refresh
3. **Logout** — Revokes refresh token in DB
4. **Switch Business** — Issues new tokens scoped to selected business

---

## WhatsApp Message Flow

```mermaid
sequenceDiagram
    participant C as Customer
    participant WA as WhatsApp Cloud API
    participant W as Webhook
    participant Q as BullMQ
    participant AI as OpenAI
    participant DB as PostgreSQL

    C->>WA: Send message
    WA->>W: POST /api/v1/webhooks/whatsapp
    W->>W: Identify business by phoneNumberId
    W->>DB: Find/create customer & conversation
    W->>DB: Save inbound message
    W->>Q: Queue AI processing job
    W-->>WA: 200 OK

    Q->>DB: Load conversation history
    Q->>DB: Load knowledge base
    Q->>AI: Generate response (intent + context)
    AI-->>Q: AI response + actions
    Q->>DB: Save outbound message
    Q->>WA: Send WhatsApp reply
    Q->>DB: Update conversation
```

### Webhook Processing Steps

1. **Verify** — Meta sends GET with `hub.verify_token`; respond with `hub.challenge`
2. **Receive** — POST with message payload
3. **Identify Business** — Match `phone_number_id` to `WhatsAppAccount`
4. **Upsert Customer** — Find by phone or create new
5. **Load Conversation** — Find open conversation or create new
6. **Save Message** — Store inbound message with `whatsappMsgId`
7. **Queue AI** — If `isAiEnabled`, enqueue `ai-processing` job
8. **Mark Read** — Send read receipt to WhatsApp

---

## AI Processing Flow

```mermaid
flowchart TD
    A[Customer Message] --> B[Intent Detection]
    B --> C{Intent Type}
    C -->|support| D[Knowledge Retrieval]
    C -->|booking| E[Check Availability]
    C -->|lead| F[Lead Qualification]
    C -->|general| D
    D --> G[Response Generation]
    E --> G
    F --> G
    G --> H{Actions}
    H -->|book_appointment| I[Create Appointment]
    H -->|qualify_lead| J[Update Lead Score]
    H -->|escalate| K[Disable AI + Notify Agent]
    H -->|none| L[Send Response]
    I --> L
    J --> L
    K --> L
    L --> M[Save to Database]
    M --> N[Send WhatsApp Response]
```

### AI Context Assembly

1. **System Prompt** — From `AIConfiguration.systemPrompt` or default
2. **Knowledge Base** — Top 20 indexed documents/FAQs for the business
3. **Conversation History** — Last 10 messages for context
4. **Business Rules** — Booking enabled, languages, fallback messages

### Response Format

```json
{
  "content": "Your appointment is confirmed for May 20 at 10:00 AM.",
  "intent": "booking",
  "actions": [{ "type": "book_appointment", "data": { "date": "2024-05-20" } }],
  "confidence": 0.92
}
```

---

## Appointment Booking Flow

```mermaid
sequenceDiagram
    participant C as Customer (WhatsApp)
    participant AI as AI Assistant
    participant DB as Database
    participant Q as Reminder Queue

    C->>AI: "I need an appointment"
    AI->>C: "What date works for you?"
    C->>AI: "Next Monday at 10am"
    AI->>DB: Check availability
    DB-->>AI: Slot available
    AI->>C: "Confirm: Mon May 20, 10:00 AM?"
    C->>AI: "Yes, confirm"
    AI->>DB: Create appointment
    AI->>Q: Schedule reminder (24h before)
    AI->>C: "Booked! See you Monday."
```

### Availability Check

- Query existing appointments for the date range
- Check against business hours (from settings)
- Respect service duration for slot calculation
- Prevent double-booking

### Reminder System

- BullMQ delayed job scheduled 24 hours before appointment
- Worker sends WhatsApp reminder message
- Marks `reminderSent = true` on appointment

---

## CRM Workflow

### Customer Lifecycle

1. **Creation** — Auto-created from WhatsApp message or manual entry
2. **Tagging** — Assign tags (VIP, New Lead, etc.)
3. **Notes** — Team members add interaction notes
4. **Lead Scoring** — AI updates score based on qualification intent
5. **History** — All conversations and appointments linked

### Customer Data Model

```
Customer
├── Profile (name, phone, email, whatsappId)
├── Tags (many-to-many via CustomerTagAssignment)
├── Notes (CustomerNote[])
├── Conversations (Conversation[])
└── Appointments (Appointment[])
```

---

## Knowledge Base Workflow

```mermaid
flowchart LR
    A[Upload Document] --> B[Save to R2]
    B --> C[Queue Processing]
    C --> D{Document Type}
    D -->|PDF| E[pdf-parse]
    D -->|DOCX| F[mammoth]
    D -->|TXT| G[Direct read]
    E --> H[Extract Text]
    F --> H
    G --> H
    H --> I[Store Content]
    I --> J[Status: INDEXED]
    J --> K[Available for AI]
```

### FAQ Management

- FAQs stored directly as `KnowledgeDocument` with `type: FAQ`
- Question/answer pairs indexed immediately (no processing queue)
- AI retrieves FAQs alongside document content during response generation

---

## Multi-Tenant Data Isolation

Every API request follows this pattern:

```
JWT → businessId → Repository.filter({ businessId }) → Response
```

Cross-tenant access is prevented at three levels:
1. **JWT** — Contains scoped `businessId`
2. **Middleware** — `requireBusiness()` + `tenantScope()`
3. **Repository** — Every query includes `where: { businessId }`
