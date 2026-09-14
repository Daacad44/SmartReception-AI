import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  handoffNotificationUrl,
  showHandoffOsNotification,
} from './showHandoffOsNotification.ts';

type ShowNotificationCall = { title: string; options: NotificationOptions };

const originalNotification = globalThis.Notification;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

function restoreGlobals() {
  if (originalNotification) {
    globalThis.Notification = originalNotification;
  } else {
    Reflect.deleteProperty(globalThis, 'Notification');
  }

  if (originalNavigator) {
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
  } else {
    Reflect.deleteProperty(globalThis, 'navigator');
  }

  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

afterEach(() => {
  restoreGlobals();
});

function stubWindow() {
  const location = { href: 'https://omreception.com/dashboard' };
  const windowStub = {
    focus() {},
    location,
    setTimeout: globalThis.setTimeout.bind(globalThis),
  };
  Object.defineProperty(globalThis, 'window', { value: windowStub, configurable: true, writable: true });
  return { location, windowStub };
}

function stubNotification(options: {
  permission: NotificationPermission;
  construct?: (title: string, init?: NotificationOptions) => void;
  throwOnConstruct?: Error;
}) {
  const instances: Array<{ title: string; init?: NotificationOptions; onclick: (() => void) | null }> = [];

  class FakeNotification {
    static permission = options.permission;
    static requestPermission = async () => options.permission;
    onclick: (() => void) | null = null;
    title: string;
    init?: NotificationOptions;

    constructor(title: string, init?: NotificationOptions) {
      if (options.throwOnConstruct) throw options.throwOnConstruct;
      options.construct?.(title, init);
      this.title = title;
      this.init = init;
      instances.push(this);
    }
  }

  Object.defineProperty(globalThis, 'Notification', {
    value: FakeNotification,
    configurable: true,
    writable: true,
  });

  return { instances, FakeNotification };
}

function stubNavigator(serviceWorker?: {
  getRegistration: () => Promise<ServiceWorkerRegistration | undefined>;
  ready: Promise<ServiceWorkerRegistration>;
}) {
  Object.defineProperty(globalThis, 'navigator', {
    value: serviceWorker ? { serviceWorker } : {},
    configurable: true,
    writable: true,
  });
}

describe('handoffNotificationUrl', () => {
  it('includes the conversation query when an id is present', () => {
    assert.equal(
      handoffNotificationUrl('conv-123'),
      '/conversations?conversation=conv-123'
    );
  });

  it('falls back to the inbox when no id is present', () => {
    assert.equal(handoffNotificationUrl(), '/conversations');
    assert.equal(handoffNotificationUrl(undefined), '/conversations');
  });
});

describe('showHandoffOsNotification', () => {
  const payload = {
    title: 'Human support needed',
    body: 'Amina: customer asked for a person',
    tag: 'notif-1',
    url: '/conversations?conversation=conv-123',
  };

  it('uses ServiceWorkerRegistration.showNotification when a registration exists', async () => {
    stubWindow();
    stubNotification({ permission: 'granted' });
    const calls: ShowNotificationCall[] = [];
    const registration = {
      showNotification: async (title: string, options: NotificationOptions) => {
        calls.push({ title, options });
      },
    } as unknown as ServiceWorkerRegistration;

    stubNavigator({
      getRegistration: async () => registration,
      ready: Promise.resolve(registration),
    });

    await showHandoffOsNotification(payload);

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.title, payload.title);
    assert.equal(calls[0]?.options.body, payload.body);
    assert.equal(calls[0]?.options.tag, payload.tag);
    assert.equal(calls[0]?.options.icon, '/brand/pwa-192.png');
    assert.deepEqual(calls[0]?.options.data, { url: payload.url });
  });

  it('falls back to new Notification when no service worker is registered', async () => {
    stubWindow();
    const { instances } = stubNotification({ permission: 'granted' });
    stubNavigator();

    await showHandoffOsNotification(payload);

    assert.equal(instances.length, 1);
    assert.equal(instances[0]?.title, payload.title);
    assert.equal(instances[0]?.init?.body, payload.body);
    assert.equal(instances[0]?.init?.tag, payload.tag);
    assert.deepEqual(instances[0]?.init?.data, { url: payload.url });
  });

  it('wires constructor onclick to the conversation url when there is no SW', async () => {
    const { location } = stubWindow();
    const { instances } = stubNotification({ permission: 'granted' });
    stubNavigator();

    await showHandoffOsNotification(payload);
    instances[0]?.onclick?.();

    assert.equal(location.href, payload.url);
  });

  it('swallows Illegal constructor and does not throw (mobile Chrome / PWA)', async () => {
    stubWindow();
    stubNotification({
      permission: 'granted',
      throwOnConstruct: new TypeError(
        "Failed to construct 'Notification': Illegal constructor. Use ServiceWorkerRegistration.showNotification() instead."
      ),
    });
    stubNavigator();

    await assert.doesNotReject(() => showHandoffOsNotification(payload));
  });

  it('swallows showNotification failures and does not throw', async () => {
    stubWindow();
    stubNotification({ permission: 'granted' });
    const registration = {
      showNotification: async () => {
        throw new Error('no active worker');
      },
    } as unknown as ServiceWorkerRegistration;

    stubNavigator({
      getRegistration: async () => registration,
      ready: Promise.resolve(registration),
    });

    await assert.doesNotReject(() => showHandoffOsNotification(payload));
  });

  it('skips silently when permission is not granted', async () => {
    stubWindow();
    const { instances } = stubNotification({ permission: 'denied' });
    const calls: ShowNotificationCall[] = [];
    const registration = {
      showNotification: async (title: string, options: NotificationOptions) => {
        calls.push({ title, options });
      },
    } as unknown as ServiceWorkerRegistration;

    stubNavigator({
      getRegistration: async () => registration,
      ready: Promise.resolve(registration),
    });

    await showHandoffOsNotification(payload);

    assert.equal(instances.length, 0);
    assert.equal(calls.length, 0);
  });

  it('times out waiting for serviceWorker.ready and falls back to the constructor', async () => {
    stubWindow();
    const { instances } = stubNotification({ permission: 'granted' });
    stubNavigator({
      getRegistration: async () => undefined,
      ready: new Promise<ServiceWorkerRegistration>(() => {
        /* never resolves */
      }),
    });

    await showHandoffOsNotification(payload);

    assert.equal(instances.length, 1);
    assert.equal(instances[0]?.title, payload.title);
  });
});
