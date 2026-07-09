import { resolveStoredToken } from '../../infrastructure/crypto/token-crypto';
import { whatsappRepository } from './whatsapp.repository';

export type WhatsAppTokenCheck =
  | { ok: true; token: string }
  | { ok: false; error: { code: number | string; message: string } };

export async function resolveOutboundWhatsAppToken(params: {
  phoneNumberId: string;
  accessToken?: string;
  validate?: boolean;
}): Promise<WhatsAppTokenCheck> {
  const token = resolveStoredToken(params.accessToken) ?? params.accessToken?.trim();
  if (!token) {
    return {
      ok: false,
      error: { code: 'NO_TOKEN', message: 'WhatsApp access token not configured' },
    };
  }

  if (params.validate !== false) {
    const valid = await whatsappRepository.validateAccessToken(params.phoneNumberId, token);
    if (!valid) {
      return {
        ok: false,
        error: { code: 190, message: 'Authentication Error' },
      };
    }
  }

  return { ok: true, token };
}
