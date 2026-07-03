import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    FB?: {
      init: (options: {
        appId: string;
        autoLogAppEvents?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } | null; status?: string }) => void,
        options: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';

interface EmbeddedSignupSessionInfo {
  wabaId?: string;
  phoneNumberId?: string;
}

/**
 * Loads the Facebook JS SDK and drives WhatsApp Embedded Signup
 * (config_id-based FB.login popup). Meta's flow returns the auth `code`
 * via the login callback, but which WABA/phone number the merchant picked
 * only arrives via a separate `window.postMessage` event — both have to be
 * combined before the backend can complete the connection.
 * See: https://developers.facebook.com/docs/whatsapp/embedded-signup
 */
export function useFacebookEmbeddedSignup(appId: string | undefined, apiVersion: string) {
  const [sdkReady, setSdkReady] = useState(false);
  const sessionInfoRef = useRef<EmbeddedSignupSessionInfo>({});

  useEffect(() => {
    if (!appId) return;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') {
        return;
      }
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data?.data) {
          sessionInfoRef.current = {
            wabaId: data.data.waba_id ?? sessionInfoRef.current.wabaId,
            phoneNumberId: data.data.phone_number_id ?? sessionInfoRef.current.phoneNumberId,
          };
        }
      } catch {
        // Not a JSON embedded-signup message — ignore.
      }
    }
    window.addEventListener('message', handleMessage);

    if (window.FB) {
      setSdkReady(true);
      return () => window.removeEventListener('message', handleMessage);
    }

    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: apiVersion });
      setSdkReady(true);
    };

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = SDK_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [appId, apiVersion]);

  const launchSignup = useCallback(
    (configId: string): Promise<{ code: string; wabaId: string; phoneNumberId: string }> => {
      return new Promise((resolve, reject) => {
        if (!window.FB) {
          reject(new Error('Facebook SDK not loaded yet'));
          return;
        }
        sessionInfoRef.current = {};

        window.FB.login(
          (response) => {
            const code = response.authResponse?.code;
            if (!code) {
              reject(new Error('Facebook login was cancelled or did not return an authorization code'));
              return;
            }
            // The WA_EMBEDDED_SIGNUP postMessage can arrive a beat after the
            // login callback fires — give it a short grace window.
            setTimeout(() => {
              const { wabaId, phoneNumberId } = sessionInfoRef.current;
              if (!wabaId || !phoneNumberId) {
                reject(
                  new Error(
                    'Facebook did not report which WhatsApp Business Account/number was selected'
                  )
                );
                return;
              }
              resolve({ code, wabaId, phoneNumberId });
            }, 500);
          },
          {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
          }
        );
      });
    },
    []
  );

  return { sdkReady, launchSignup };
}
