interface PipelineState {
  lastInboundMessage: string | null;
  lastOutboundAttempt: string | null;
  lastOutboundSuccess: string | null;
}

const stateByBusiness = new Map<string, PipelineState>();

function getState(businessId: string): PipelineState {
  let state = stateByBusiness.get(businessId);
  if (!state) {
    state = {
      lastInboundMessage: null,
      lastOutboundAttempt: null,
      lastOutboundSuccess: null,
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

export function getPipelineState(businessId: string): PipelineState {
  return { ...getState(businessId) };
}
