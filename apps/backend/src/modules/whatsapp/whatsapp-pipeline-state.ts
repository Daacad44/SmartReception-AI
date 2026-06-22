interface PipelineState {
  lastInboundMessage: string | null;
  lastOutboundAttempt: string | null;
  lastOutboundSuccess: string | null;
  lastGraphApiResponse: string | null;
  lastGraphApiError: string | null;
}

const stateByBusiness = new Map<string, PipelineState>();

function getState(businessId: string): PipelineState {
  let state = stateByBusiness.get(businessId);
  if (!state) {
    state = {
      lastInboundMessage: null,
      lastOutboundAttempt: null,
      lastOutboundSuccess: null,
      lastGraphApiResponse: null,
      lastGraphApiError: null,
    };
    stateByBusiness.set(businessId, state);
  }
  return state;
}

export function recordInboundMessage(businessId: string, content: string): void {
  getState(businessId).lastInboundMessage = content;
}

export function recordOutboundAttempt(businessId: string, content: string): void {
  getState(businessId).lastOutboundAttempt = content;
}

export function recordOutboundSuccess(businessId: string, content: string): void {
  getState(businessId).lastOutboundSuccess = content;
}

export function recordGraphApiResponse(businessId: string, response: unknown): void {
  getState(businessId).lastGraphApiResponse = JSON.stringify(response);
  getState(businessId).lastGraphApiError = null;
}

export function recordGraphApiError(businessId: string, error: unknown): void {
  getState(businessId).lastGraphApiError = JSON.stringify(error);
}

export function getPipelineState(businessId: string): PipelineState {
  return { ...getState(businessId) };
}
