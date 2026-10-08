# AI Agent Studio — Phase 9 Confirmation-led Business Actions

## Outcome

Phase 9 introduces a durable action ledger and a customer-confirmed appointment
workflow. Model output is treated as a proposal, never as authority to perform a
write operation.

## Appointment lifecycle

1. The active agent proposes a valid future appointment.
2. The system stores an `AWAITING_CONFIRMATION` action with a 15-minute deadline.
3. WhatsApp asks the customer to explicitly confirm or cancel.
4. A strict Somali/English confirmation parser rejects ambiguous replies.
5. Confirmation is claimed once, then appointment creation and completion are
   committed in one transaction.
6. Retries reuse the action idempotency key and cannot create a second booking.

## Safety

- Invalid, past or inverted appointment times are rejected.
- One pending appointment confirmation is allowed per conversation.
- Confirmation expiry creates no appointment.
- Cancellation creates no appointment.
- Database failures move the action to `FAILED` with a durable reason.
- The runtime no longer forwards a proposed appointment action to the legacy
  direct-write path; it replaces it with a confirmation prompt.

Completed AI lead captures are also written idempotently to the action ledger and
linked to the resulting customer. The schema reserves a governed action type for
orders. `ORDER_CREATE` has no executor until a real tenant-owned order domain and
compensating workflow exist; the system must not pretend an order was created.

## Audit API

- `GET /conversations/:id/agent-actions`

The action ledger exposes proposal, confirmation, execution, cancellation,
expiry, result and failure evidence to authorized conversation operators.

## Next phase

Phase 10 should add Agent Studio quality and operations analytics across runtime
executions, handoffs, action conversion, latency, grounding and cost.
