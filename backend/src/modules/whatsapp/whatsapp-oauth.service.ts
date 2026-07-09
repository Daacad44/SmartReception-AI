import { config } from '../../config';
import { logger } from '../../core/logger';
import { ValidationError } from '../../core/errors';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';

/**
 * Meta WhatsApp Embedded Signup (OAuth) support.
 *
 * This replaces manual "paste your access token" onboarding with the
 * standard Meta flow: the frontend runs Facebook's JS SDK login popup
 * (config_id-based Embedded Signup), gets back a short-lived `code`, and
 * this service exchanges it server-side for a long-lived token, subscribes
 * the app to the business's WABA, and registers the phone number.
 *
 * Requires a Meta App with WhatsApp + Embedded Signup configured
 * (META_APP_ID / META_APP_SECRET / META_WHATSAPP_CONFIG_ID) — that setup
 * happens in Meta's Developer Console and is out of scope for this service.
 */
export class WhatsAppOAuthService {
  isConfigured(): boolean {
    return Boolean(config.whatsapp.appId && config.whatsapp.appSecret && config.whatsapp.embeddedSignupConfigId);
  }

  getClientConfig() {
    return {
      appId: config.whatsapp.appId,
      configId: config.whatsapp.embeddedSignupConfigId,
      apiVersion: config.whatsapp.apiVersion,
      configured: this.isConfigured(),
    };
  }

  /**
   * Exchanges the Embedded Signup `code` for a long-lived access token.
   * Meta's Embedded Signup flow is a popup (not a redirect), so no
   * redirect_uri is sent — matches Meta's documented server-side exchange
   * for config_id-based logins.
   */
  private async exchangeCodeForToken(code: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: config.whatsapp.appId,
      client_secret: config.whatsapp.appSecret,
      code,
    });

    const response = await fetch(`${config.whatsapp.apiUrl}/oauth/access_token?${params.toString()}`);
    const data = (await response.json().catch(() => null)) as
      | { access_token?: string; error?: { message?: string } }
      | null;

    if (!response.ok || !data?.access_token) {
      logger.error('WhatsApp OAuth code exchange failed', {
        status: response.status,
        error: data?.error?.message,
      });
      throw new ValidationError(
        data?.error?.message || 'Failed to exchange WhatsApp authorization code with Meta'
      );
    }

    return data.access_token;
  }

  /**
   * Exchanges the Embedded Signup `code` for a long-lived access token.
   */
  async exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: config.whatsapp.appId,
      client_secret: config.whatsapp.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(`${config.whatsapp.apiUrl}/oauth/access_token?${params.toString()}`);
    const data = (await response.json().catch(() => null)) as
      | { access_token?: string; error?: { message?: string } }
      | null;

    if (!response.ok || !data?.access_token) {
      logger.warn('WhatsApp long-lived token exchange failed — using short-lived token', {
        status: response.status,
        error: data?.error?.message,
      });
      return shortLivedToken;
    }

    return data.access_token;
  }

  /**
   * Subscribes this app to the business's WABA so inbound webhook events
   * (messages, statuses) start flowing for numbers connected via Embedded
   * Signup. Idempotent on Meta's side — safe to call on every connect.
   */
  private async subscribeAppToWaba(wabaId: string, accessToken: string): Promise<void> {
    try {
      const response = await fetch(`${config.whatsapp.apiUrl}/${wabaId}/subscribed_apps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        logger.warn('WhatsApp OAuth: failed to subscribe app to WABA', { wabaId, body });
      }
    } catch (error) {
      logger.warn('WhatsApp OAuth: subscribe-to-WABA request failed', { wabaId, error });
    }
  }

  /**
   * Registers the phone number on the Cloud API if it isn't already.
   * Best-effort: numbers that are already registered return an error from
   * Meta that we log and ignore rather than fail the whole connect flow on.
   */
  private async registerPhoneNumber(phoneNumberId: string, accessToken: string): Promise<void> {
    try {
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      const response = await fetch(`${config.whatsapp.apiUrl}/${phoneNumberId}/register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        logger.info('WhatsApp OAuth: phone register skipped (likely already registered)', {
          phoneNumberId,
          body,
        });
      }
    } catch (error) {
      logger.warn('WhatsApp OAuth: phone register request failed', { phoneNumberId, error });
    }
  }

  /**
   * Full Embedded Signup completion: exchange code, subscribe to WABA,
   * register the number, and fetch display info to hand back an object
   * shaped exactly like the manual-connect input so callers can pass it
   * straight into whatsappModuleService.connectAccount().
   */
  async completeSignup(params: { code: string; wabaId: string; phoneNumberId: string }) {
    if (!this.isConfigured()) {
      throw new ValidationError(
        'WhatsApp OAuth is not configured on this server (missing META_APP_ID / META_APP_SECRET / META_WHATSAPP_CONFIG_ID)'
      );
    }

    const shortLivedToken = await this.exchangeCodeForToken(params.code);
    const accessToken = await this.exchangeForLongLivedToken(shortLivedToken);

    await this.subscribeAppToWaba(params.wabaId, accessToken);
    await this.registerPhoneNumber(params.phoneNumberId, accessToken);

    const info = await whatsappService.getPhoneNumberInfo(params.phoneNumberId, accessToken);

    return {
      phoneNumberId: params.phoneNumberId,
      phoneNumber: info?.displayPhoneNumber ?? params.phoneNumberId,
      displayName: info?.verifiedName,
      wabaId: params.wabaId,
      accessToken,
    };
  }
}

export const whatsappOAuthService = new WhatsAppOAuthService();
