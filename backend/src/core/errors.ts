export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, message, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(400, message, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(409, message, 'CONFLICT');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(503, message, 'SERVICE_UNAVAILABLE');
  }
}

export class EmailNotVerifiedError extends AppError {
  constructor(message = 'Please verify your email before signing in') {
    super(403, message, 'EMAIL_NOT_VERIFIED');
  }
}

export class SubscriptionExpiredError extends AppError {
  constructor(message = 'Subscription expired') {
    super(403, message, 'SUBSCRIPTION_EXPIRED');
  }
}

export class ApplicationPendingError extends AppError {
  constructor(
    message = 'Your business application is under review. You will be notified once it is approved.'
  ) {
    super(403, message, 'APPLICATION_PENDING');
  }
}

export class ApplicationAwaitingCodeError extends AppError {
  constructor(
    message = 'Your application was approved. Enter the activation code sent to your email to continue.'
  ) {
    super(403, message, 'APPLICATION_AWAITING_CODE');
  }
}

export class ApplicationRejectedError extends AppError {
  constructor(
    message = 'Your business application was declined. Please contact SmartReception support.'
  ) {
    super(403, message, 'APPLICATION_REJECTED');
  }
}

export class WhatsAppDeliveryError extends AppError {
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(502, message, 'WHATSAPP_DELIVERY_FAILED');
  }
}

export class GovernanceApprovalRequiredError extends AppError {
  constructor(
    message = 'Administrator approval required',
    public requestId?: string
  ) {
    super(202, message, 'GOVERNANCE_APPROVAL_REQUIRED');
  }
}
