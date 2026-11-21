import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

export async function until(callback, description, timeout = 15000) {
  const end = Date.now() + timeout;
  do {
    const result = await callback();
    if (result) return result;
    await setTimeout(100);
  } while (Date.now() < end);
  assert.fail('Timed out: ' + description);
}

export async function openBrowser(executable, work, name) {
  const profile = join(work, name);
  const sandbox = process.env.NEXATECH_TEST_BROWSER_NO_SANDBOX === '1' ? ['--no-sandbox'] : [];
  const child = spawn(executable, [
    '--headless', '--disable-gpu', '--disable-background-networking', '--no-first-run',
    ...sandbox,
    '--no-default-browser-check', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  const stopped = once(child, 'close');
  let socket;
  const awaiting = new Map();
  function send(method, params = {}) {
    const id = send.next++;
    return new Promise((resolve, reject) => {
      const timer = globalThis.setTimeout(() => {
        awaiting.delete(id);
        reject(new Error('CDP timed out: ' + method));
      }, 10000);
      awaiting.set(id, outcome => {
        clearTimeout(timer);
        if (outcome.error) reject(new Error(JSON.stringify(outcome.error)));
        else resolve(outcome.result);
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  send.next = 1;
  async function close() {
    if (socket?.readyState === WebSocket.OPEN) {
      await send('Browser.close').catch(() => {});
      socket.close();
    }
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await stopped;
  }
  try {
    await once(child, 'spawn');
    const port = await until(async () => {
      if (child.exitCode !== null) throw new Error(name + ' exited: ' + child.exitCode);
      return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).split(/\s/)[0];
    }, name + ' DevTools port');
    const tabs = await fetch('http://127.0.0.1:' + port + '/json/list', { signal: AbortSignal.timeout(5000) }).then(response => response.json());
    socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    const errors = [];
    const requests = [];
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        awaiting.get(message.id)?.(message);
        awaiting.delete(message.id);
      }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
    });
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    await Promise.all(['Runtime.enable', 'Page.enable', 'Network.enable'].map(method => send(method)));
    async function evaluate(fn, value) {
      const { result, exceptionDetails } = await send('Runtime.evaluate', {
        expression: '(' + fn.toString() + ')(' + JSON.stringify(value) + ')',
        returnByValue: true, awaitPromise: true,
      });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    }
    return {
      send, evaluate, close, errors, requests,
      async go(url) {
        const { errorText } = await send('Page.navigate', { url });
        assert.equal(errorText, undefined, url);
        await until(() => evaluate(expected => location.href === expected && document.readyState !== 'loading', url), 'navigation to ' + url);
      },
      click: selector => evaluate(query => {
        const element = document.querySelector(query);
        if (!element || element.disabled) throw new Error('Unavailable element: ' + query);
        element.focus();
        element.click();
      }, selector),
      async press(key) {
        const virtualCode = { Tab: 9, Escape: 27, Enter: 13 }[key];
        const args = { key, code: key, windowsVirtualKeyCode: virtualCode, nativeVirtualKeyCode: virtualCode };
        await send('Input.dispatchKeyEvent', { ...args, type: 'keyDown' });
        await send('Input.dispatchKeyEvent', { ...args, type: 'keyUp' });
      },
      text: selector => evaluate(query => document.querySelector(query)?.textContent.trim(), selector),
      waitText: (selector, text) => until(() => evaluate(
        ({ query, value }) => document.querySelector(query)?.textContent.includes(value),
        { query: selector, value: text },
      ), selector + ' contains ' + text),
      viewport: (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }),
    };
  } catch (error) {
    await close().catch(() => {});
    throw error;
  }
}
