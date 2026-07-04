export function parseClientInfo(userAgent?: string): { browser?: string; operatingSystem?: string } {
  if (!userAgent) return {};

  let browser: string | undefined;
  if (userAgent.includes('Edg/')) browser = 'Edge';
  else if (userAgent.includes('Chrome/')) browser = 'Chrome';
  else if (userAgent.includes('Firefox/')) browser = 'Firefox';
  else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) browser = 'Safari';

  let operatingSystem: string | undefined;
  if (userAgent.includes('Windows')) operatingSystem = 'Windows';
  else if (userAgent.includes('Mac OS')) operatingSystem = 'macOS';
  else if (userAgent.includes('Linux')) operatingSystem = 'Linux';
  else if (userAgent.includes('Android')) operatingSystem = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) operatingSystem = 'iOS';

  return { browser, operatingSystem };
}
