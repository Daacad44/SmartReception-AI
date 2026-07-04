import { buildDynamicBusinessWelcome } from './business-welcome.service';
import { buildDefaultGreetingMessage } from './smartreception-tenant';

/** @deprecated Use buildDynamicBusinessWelcome — kept for backward compatibility. */
export async function buildBusinessGreetingMenu(businessId: string): Promise<string> {
  return buildDynamicBusinessWelcome(businessId);
}

export function resolveBusinessGreetingFallback(businessName: string): string {
  return buildDefaultGreetingMessage(businessName);
}

export { buildDynamicBusinessWelcome, buildTenantMenuOptionReply } from './business-welcome.service';
