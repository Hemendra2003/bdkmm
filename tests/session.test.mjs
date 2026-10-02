import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { buildSessionBundle, bundledAuth } from '../src/state/build-legacy.mjs';
const api = vm.runInNewContext(buildSessionBundle() + '\nMomentumSession;');
const session = (id) => ({ user: { id } });
const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function controllerHarness(initial = session('A')) {
  let receive,
    subscriptions = 0,
    unsubscriptions = 0;
  const tasks = [],
    boots = [],
    clears = [],
    errors = [],
    published = [];
  const controller = api.createSessionController({
    subscribe: (callback) => {
      subscriptions++;
      receive = callback;
      return () => unsubscriptions++;
    },
    readSession: async () => initial,
    publish: (value) => published.push(value),
    clear: (...value) => clears.push(value),
    boot: (...value) => boots.push(value),
    schedule: (work) => tasks.push(work),
    onError: (error) => errors.push(error),
  });
  return {
    controller,
    boots,
    clears,
    published,
    errors,
    emit: (...args) => receive(...args),
    subscriptions: () => subscriptions,
    unsubscriptions: () => unsubscriptions,
    async flush() {
      while (tasks.length) tasks.shift()();
      await tick();
    },
  };
}

test('session bundle is fresh and initialization creates exactly one auth subscription', async () => {
  const source = readFileSync(new URL('../auth.js', import.meta.url), 'utf8');
  assert.equal(source, bundledAuth(source));
  const h = controllerHarness();
  assert.equal(h.controller.start(), h.controller.start());
  await h.controller.start();
  h.emit('INITIAL_SESSION', session('A'));
  h.emit('SIGNED_IN', session('A'));
  assert.equal(h.subscriptions(), 1);
  assert.equal(h.boots.length, 0);
  await h.flush();
  assert.equal(h.boots.length, 1);
  h.controller.dispose();
  h.controller.dispose();
  assert.equal(h.unsubscriptions(), 1);
});

test('token refresh and duplicate sign-in preserve generation, UI and pending boot', async () => {
  const h = controllerHarness();
  await h.controller.start();
  const before = h.controller.snapshot();
  h.emit('TOKEN_REFRESHED', { ...session('A'), access_token: 'test-token' });
  h.emit('SIGNED_IN', session('A'));
  assert.deepEqual(h.controller.snapshot(), before);
  assert.equal(h.clears.length, 1);
  await h.flush();
  assert.equal(h.boots.length, 1);
  h.emit('TOKEN_REFRESHED', session('A'));
  await h.flush();
  assert.equal(h.boots.length, 1);
});

test('queued A boot is cancelled after A->B, and logout invalidates generation', async () => {
  const h = controllerHarness();
  await h.controller.start();
  const a = h.controller.snapshot();
  h.emit('SIGNED_IN', session('B'));
  assert.equal(h.controller.isCurrent(a), false);
  await h.flush();
  assert.equal(h.boots.length, 1);
  assert.equal(h.boots[0][0].user.id, 'B');
  const b = h.controller.snapshot();
  h.emit('SIGNED_OUT', null);
  assert.equal(h.controller.isCurrent(b), false);
  await h.flush();
  assert.equal(h.controller.snapshot().userId, null);
  assert.equal(h.clears.length, 3);
});

test('late initial getSession snapshot cannot replace a newer auth event', async () => {
  const read = deferred(),
    tasks = [];
  let receive;
  const h = api.createSessionController({
    subscribe: (cb) => {
      receive = cb;
      return () => {};
    },
    readSession: () => read.promise,
    publish() {},
    clear() {},
    boot() {},
    schedule: (work) => tasks.push(work),
    onError: assert.fail,
  });
  const started = h.start();
  receive('SIGNED_IN', session('B'));
  read.resolve(session('A'));
  await started;
  assert.equal(h.snapshot().userId, 'B');
});

function element() {
  const classes = new Set();
  return {
    style: {},
    value: '',
    innerHTML: '',
    textContent: '',
    children: [],
    setAttribute() {},
    appendChild(child) {
      this.children.push(child);
    },
    insertBefore(child) {
      this.children.unshift(child);
    },
    querySelectorAll() {
      return [];
    },
    classList: {
      add: (...values) => values.forEach((v) => classes.add(v)),
      remove: (...values) => values.forEach((v) => classes.delete(v)),
      contains: (v) => classes.has(v),
      toggle() {},
    },
  };
}
function appHarness() {
  let account = 'A',
    generation = 1;
  const elements = new Map(),
    alerts = [],
    data = new Map(),
    resets = [];
  const document = {
    body: element(),
    addEventListener() {},
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: element,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
  };
  const storage = {
    getSettings: async () => ({ legacy_migrated: true }),
    loadQuestions: async () => [],
    loadEntries: async () => [],
    resetReadDiagnostics: () => resets.push(account),
  };
  const window = {
    MomentumData: storage,
    Auth: { getUserId: () => account, getGeneration: () => generation },
    AuthUI: { show() {} },
    addEventListener() {},
    scrollTo() {},
    localStorage: {
      get length() {
        return data.size;
      },
      key: (i) => [...data.keys()][i],
      getItem: (key) => data.get(key),
      setItem: (key, value) => data.set(key, value),
      removeItem: (key) => data.delete(key),
    },
  };
  const context = vm.createContext({
    window,
    document,
    console,
    Date,
    alert: (text) => alerts.push(text),
    confirm: () => true,
    setTimeout,
    clearTimeout,
  });
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  vm.runInContext(
    source.slice(source.indexOf('// STORAGE ADAPTERS'), source.lastIndexOf('(async()=>{')),
    context,
  );
  const run = (code) => vm.runInContext(code, context);
  run('updateSessionAccount("A");');
  return {
    window,
    document,
    storage,
    data,
    alerts,
    resets,
    run,
    switchTo(id) {
      account = id;
      generation++;
      context.next = id;
      run('updateSessionAccount(next);');
    },
  };
}

test('late A question/history reads cannot populate B caches or fragments', async () => {
  const h = appHarness(),
    questions = deferred(),
    entries = deferred();
  h.storage.loadQuestions = () => questions.promise;
  h.storage.loadEntries = () => entries.promise;
  const q = h.run('loadUserQuestions()'),
    habits = h.run('renderHabitsPage()');
  h.switchTo('B');
  questions.resolve([{ key: 'private-A' }]);
  entries.resolve([]);
  await assert.rejects(q, /context changed/);
  await habits;
  assert.equal(h.window.UserQuestions, null);
  assert.equal(h.run('_habitsCache'), null);
  assert.equal(h.document.getElementById('habits-list').innerHTML, '');
});

test('logout centrally clears caches, drafts, diagnostics, fragments, forms and overlays', () => {
  const h = appHarness();
  h.data.set('momentum:draft:v1:A:2026-09-05', '{}');
  h.run(
    '_dataCache={private:true};_habitsCache={private:true};answers={private:3};window.UserQuestions=[{key:"private"}];',
  );
  for (const id of [
    'be-questions',
    'habits-list',
    'mq-root',
    'drawer-body',
    'sh-compare',
    'week-line-svg',
  ])
    h.document.getElementById(id).innerHTML = 'private-A';
  for (const id of [
    'questionnaire',
    'summary-overlay',
    'library-drawer',
    'drawer-backdrop',
    'loading-overlay',
  ])
    h.document.getElementById(id).classList.add('active');
  h.document.getElementById('mq-cust-text').value = 'private-A';
  h.switchTo(null);
  assert.equal(h.run('_dataCache'), null);
  assert.equal(h.run('_habitsCache'), null);
  assert.equal(h.window.UserQuestions, null);
  assert.equal(h.data.size, 0);
  assert.equal(h.resets.at(-1), null);
  for (const id of [
    'be-questions',
    'habits-list',
    'mq-root',
    'drawer-body',
    'sh-compare',
    'week-line-svg',
  ])
    assert.equal(h.document.getElementById(id).innerHTML, '');
  for (const id of [
    'questionnaire',
    'summary-overlay',
    'library-drawer',
    'drawer-backdrop',
    'loading-overlay',
  ])
    assert.equal(h.document.getElementById(id).classList.contains('active'), false);
  assert.equal(h.document.getElementById('mq-cust-text').value, '');
});

test('boot dedupes in-flight work and late A migration never boots B with A results', async () => {
  const h = appHarness(),
    read = deferred();
  let calls = 0;
  h.storage.getSettings = () => {
    calls++;
    return read.promise;
  };
  h.run('renderDashboard=()=>{window.rendered=true;};');
  const first = h.run('bootMomentum()'),
    second = h.run('bootMomentum()');
  assert.equal(first, second);
  assert.equal(calls, 1);
  h.switchTo('B');
  read.resolve({ legacy_migrated: true });
  await first;
  assert.equal(h.window.rendered, undefined);
  assert.equal(h.window.UserQuestions, null);
  assert.equal(h.alerts.length, 0);
});

test('actual auth adapter never invokes boot/DB work inside its auth notification', async () => {
  let callback,
    inCallback = false,
    subscriptions = 0;
  const tasks = [],
    boots = [],
    snapshot = deferred();
  const client = {
    auth: {
      getSession: () => snapshot.promise,
      onAuthStateChange(receive) {
        subscriptions++;
        callback = receive;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };
  const document = { addEventListener() {}, getElementById: () => element() };
  const context = vm.createContext({
    window: {},
    supabase: { createClient: () => client },
    document,
    console,
    setTimeout: (work) => tasks.push(work),
  });
  vm.runInContext(readFileSync(new URL('../auth.js', import.meta.url), 'utf8'), context);
  const boot = async (value) => {
    assert.equal(inCallback, false);
    boots.push(value);
  };
  const init = context.window.Auth.init(boot);
  context.window.Auth.init(boot);
  inCallback = true;
  assert.equal(callback('SIGNED_IN', session('A')), undefined);
  inCallback = false;
  snapshot.resolve({ data: { session: session('A') }, error: null });
  await init;
  assert.equal(boots.length, 0);
  while (tasks.length) tasks.shift()();
  await tick();
  assert.equal(subscriptions, 1);
  assert.equal(boots.length, 1);
  const generation = context.window.Auth.getGeneration();
  callback('TOKEN_REFRESHED', session('A'));
  await tick();
  assert.equal(context.window.Auth.getGeneration(), generation);
  assert.equal(boots.length, 1);
});

test('a synchronous initial auth event also outranks a stale snapshot', async () => {
  const h = api.createSessionController({
    subscribe(receive) {
      receive('INITIAL_SESSION', session('B'));
      return () => {};
    },
    readSession: async () => session('A'),
    publish() {},
    clear() {},
    boot() {},
    schedule() {},
    onError: assert.fail,
  });
  await h.start();
  assert.equal(h.snapshot().userId, 'B');
});

test('late A question mutation cannot reload or render into B', async () => {
  const h = appHarness(),
    write = deferred();
  let reloads = 0;
  h.storage.saveQuestion = () => write.promise;
  h.storage.loadQuestions = async () => {
    reloads++;
    return [];
  };
  const pending = h.run('_addLibRec("wake")');
  h.switchTo('B');
  write.resolve({ key: 'wake' });
  await pending;
  assert.equal(reloads, 0);
  assert.equal(h.window.UserQuestions, null);
  assert.equal(h.document.getElementById('mq-root').innerHTML, '');
  assert.equal(h.alerts.length, 0);
});
