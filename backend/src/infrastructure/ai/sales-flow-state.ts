import type { SalesFlowState } from './sales-flow.types';

export const FLOW_META_TYPE = 'sales_flow';

/** Outbound metadata types that mean the customer was just shown a menu, not a sales-flow prompt. */
export const MENU_OUTBOUND_TYPES = new Set([
  'service_menu',
  'tenant_welcome_menu',
  'business_profile_welcome',
  'menu_option',
  'tenant_menu_option',
]);

/**
 * Resolve the active sales flow from outbound messages (newest first).
 *
 * A fresh menu/welcome takes priority over older incomplete flow metadata.
 * The first sales_flow marker wins: completed/null ends the flow instead of
 * falling through to a stickier older state.
 */
export function resolveActiveSalesFlowFromMessages(
  messages: Array<{ metadata: unknown }>
): SalesFlowState | null {
  for (const msg of messages) {
    const meta = msg.metadata as { type?: string; salesFlow?: SalesFlowState | null } | null;
    if (!meta?.type) continue;

    if (MENU_OUTBOUND_TYPES.has(meta.type)) {
      return null;
    }

    if (meta.type === FLOW_META_TYPE) {
      if (meta.salesFlow && meta.salesFlow.phase !== 'completed') {
        return meta.salesFlow;
      }
      return null;
    }
  }

  return null;
}
