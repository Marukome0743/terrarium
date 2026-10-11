import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(
  new URL('../../../web/coi-serviceworker.js', import.meta.url),
  'utf8',
);

async function pageState(
  controlled = false,
  isolated = false,
  retried = false,
) {
  let reloads = 0;
  let registrations = 0;
  const listeners = new Map<string, () => void>();
  const registrationListeners = new Map<string, () => void>();
  const messages: unknown[] = [];
  const controller = {
    postMessage: (message: unknown) => messages.push(message),
  };
  const stored = new Map(
    retried ? [['coi-serviceworker-reloaded', 'true']] : [],
  );
  const worker = {
    controller: controlled ? controller : null,
    addEventListener: (name: string, listener: () => void) =>
      listeners.set(name, listener),
    register: async () => {
      registrations++;
      return {
        active: null,
        scope: '/terrarium/',
        addEventListener: (name: string, listener: () => void) =>
          registrationListeners.set(name, listener),
      };
    },
  };
  const window = {
    sessionStorage: {
      getItem: (key: string) => stored.get(key),
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    },
    crossOriginIsolated: isolated,
    isSecureContext: true,
    document: { currentScript: { src: '/terrarium/coi-serviceworker.js' } },
    coi: {
      quiet: true,
      doReload: () => {
        reloads++;
      },
    },
  };
  runInNewContext(source, { window, navigator: { serviceWorker: worker } });
  await Promise.resolve();
  return {
    messages,
    stored,
    worker,
    window,
    listeners,
    registrationListeners,
    controller,
    reloads: () => reloads,
    registrations: () => registrations,
  };
}

test('first installation waits for control instead of reloading on updatefound', async () => {
  const page = await pageState();
  page.registrationListeners.get('updatefound')?.();
  expect(page.reloads()).toBe(0);
  page.worker.controller = page.controller;
  page.listeners.get('controllerchange')!();
  expect(page.reloads()).toBe(1);
  page.listeners.get('controllerchange')!();
  expect(page.reloads()).toBe(1);
});

test('an existing non-isolated controller retries with the Safari-compatible policy', async () => {
  const page = await pageState(true);
  expect(page.messages).toEqual([{ type: 'coepCredentialless', value: false }]);
  expect(page.reloads()).toBe(1);
});

test('a failed isolation reload cannot loop across navigations', async () => {
  const page = await pageState(true, false, true);
  page.listeners.get('controllerchange')!();
  expect(page.reloads()).toBe(0);
});

test('a controllerchange without a controller cannot reload the page', async () => {
  const page = await pageState();
  page.listeners.get('controllerchange')!();
  expect(page.reloads()).toBe(0);
});

test('an already isolated page neither registers nor reloads', async () => {
  const page = await pageState(true, true);
  expect(page.stored.has('coi-serviceworker-reloaded')).toBe(false);
  expect(page.registrations()).toBe(0);
  expect(page.reloads()).toBe(0);
});

test('Pages navigation stays require-corp while the worker module graph remains loadable', async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  runInNewContext(source, {
    self: {
      addEventListener: (name: string, listener: (event: unknown) => void) =>
        listeners.set(name, listener),
    },
    fetch: async () => new Response('module source'),
    Headers,
    Response,
    Request,
  });
  for (const destination of ['document', 'worker', 'script']) {
    let response: Promise<Response> | undefined;
    listeners.get('fetch')!({
      request: { destination, cache: 'default', mode: 'same-origin' },
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
    });
    const result = await response!;
    expect(result.headers.get('Cross-Origin-Embedder-Policy')).toBe(
      destination === 'document' ? 'require-corp' : 'credentialless',
    );
    expect(result.headers.get('Cross-Origin-Resource-Policy')).toBe(
      'cross-origin',
    );
    expect(await result.text()).toBe('module source');
  }
});
