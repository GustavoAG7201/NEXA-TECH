import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mergeCart, removeCartItem, setCartItem, setFavorite } from '../lib/account-api.js';
import { useLocalStorage } from '../hooks/userlocalstorage.js';
import { useResource } from '../hooks/useResource.js';
import { legacySku, loadProducts, productSlug } from '../lib/catalog.js';
import { checkSession, CommerceError, loadCart, loadFavorites, resultId, runCommand } from '../lib/commerce.js';
import { storeId } from '../lib/api.js';
import { activeUid } from '../lib/session.js';
import { useAuthSession } from './auth-session.js';
import { Basket } from './basket.js';

const storageKey = 'nexa-cart';
const emptyDraft = { lines: [], pending: null };
const emptyFavorites = [];
const lineId = (slug, sku) => slug + ':' + sku;

function storedCart(value) {
  const lines = new Map();
  if (!Array.isArray(value)) return [];
  for (const line of value) {
    const slug = productSlug(line?.slug ?? line?.id);
    const sku = line?.sku ?? legacySku(line?.id);
    const quantity = Number(line?.quantity ?? line?.qty);
    if (!/^[a-z0-9-]+$/.test(slug) || typeof sku !== 'string' || !Number.isSafeInteger(quantity) || quantity <= 0) continue;
    const id = lineId(slug, sku);
    lines.set(id, { id, slug, sku, quantity });
  }
  return [...lines.values()];
}

function readDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    const pending = saved?.pending?.project === storeId ? saved.pending : null;
    return { lines: storedCart(saved?.lines ?? saved), pending };
  } catch {
    return emptyDraft;
  }
}

function storedFavorites(value) {
  return Array.isArray(value) ? [...new Set(value.map(productSlug).filter(slug => /^[a-z0-9-]+$/.test(slug)))] : [];
}

function withDraftLock(task) {
  return navigator.locks ? navigator.locks.request(storageKey, task) : Promise.resolve().then(task);
}

async function mergeDraft(uid, saveDraft) {
  await withDraftLock(async () => {
    checkSession(uid);
    const draft = readDraft();
    if (!draft.lines.length || (draft.pending && draft.pending.uid !== uid)) return;
    let pending = draft.pending;
    if (!pending) {
      const products = await loadProducts([...new Set(draft.lines.map(line => line.slug))]);
      const variants = new Map(products.filter(Boolean).flatMap(product =>
        product.variants.map(variant => [lineId(product.slug, variant.sku), variant.id])));
      const items = draft.lines.map(line => {
        const variantId = variants.get(line.id);
        if (!variantId) throw new CommerceError('VARIANT_UNAVAILABLE');
        return { variantId, quantity: line.quantity };
      });
      checkSession(uid);
      pending = { project: storeId, uid, key: crypto.randomUUID(), items };
      saveDraft({ ...draft, pending });
    }
    const result = await runCommand(uid, mergeCart, { key: pending.key, items: pending.items });
    if (result.status === 'REJECTED') saveDraft({ ...draft, pending: null });
    resultId(result);
    saveDraft(emptyDraft);
  });
}

function cartLines(cart) {
  return (cart?.cartItems_on_cart ?? []).map(({ variant, variantId, quantity }) => {
    const { sku, product } = variant;
    return { id: lineId(product.slug, sku), slug: product.slug, sku, quantity, variantId };
  });
}

function BasketSession({ children, user, sessionPending, draft, saveDraft, common }) {
  const uid = user?.uid;
  const [remote, setRemote] = useState(null);
  const [busy, setBusy] = useState(Boolean(uid));
  const [feedback, setFeedback] = useState(null);
  const [mergeError, setMergeError] = useState(null);
  const running = useRef(false);
  const retryAction = useRef(null);
  const favoriteWrite = useRef(false);
  const [favoriteError, setFavoriteError] = useState(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const readFavorites = useCallback(() => loadFavorites(uid), [uid]);
  const favoriteList = useResource(readFavorites, Boolean(uid));
  const storedSlugs = useMemo(() => favoriteList.data?.map(item => item.product.slug) ?? emptyFavorites, [favoriteList.data]);
  const refresh = useCallback(async () => {
    const current = await loadCart(uid);
    setRemote({ cart: current, lines: cartLines(current) });
  }, [uid]);

  const synchronize = useCallback(async () => {
    let mergeFailure = null;
    try {
      await mergeDraft(uid, saveDraft);
    } catch (error) {
      mergeFailure = error;
    }
    setMergeError(mergeFailure);
    await refresh();
  }, [refresh, saveDraft, uid]);

  const perform = useCallback(async task => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setFeedback(null);
    retryAction.current = task;
    try {
      await task();
      retryAction.current = null;
      return true;
    } catch (error) {
      setFeedback(error);
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (uid) Promise.resolve().then(() => perform(synchronize));
  }, [perform, synchronize, uid]);

  const ownDraft = !draft.pending || draft.pending.uid === uid;
  const lines = uid ? remote?.lines ?? [] : ownDraft ? draft.lines : [];
  const guestBlocked = !uid && Boolean(draft.pending);
  const locked = busy || sessionPending || Boolean(feedback) || guestBlocked;

  async function editDraft(id, update) {
    await withDraftLock(() => {
      const current = readDraft();
      if (current.pending || (activeUid() ?? undefined) !== uid) return;
      const previous = current.lines.find(line => line.id === id);
      const next = update(previous);
      const items = current.lines.filter(line => line.id !== id);
      if (next) items.push(next);
      if (items.length > 50) throw new CommerceError('CART_LIMIT');
      saveDraft({ lines: items, pending: null });
    });
  }

  function updateItem(variantId, quantity) {
    const variables = { key: crypto.randomUUID(), variantId };
    const mutation = quantity === 0 ? removeCartItem : setCartItem;
    if (quantity > 0) variables.quantity = quantity;
    return perform(async () => {
      resultId(await runCommand(uid, mutation, variables));
      await refresh();
    });
  }

  async function add(product, variant, quantity = 1) {
    if (locked || running.current || variant.stockOnHand < 1) return;
    const id = lineId(product.slug, variant.sku);
    const limit = Math.min(variant.stockOnHand, 100);
    common.setDrawer(true);
    if (uid) {
      const previous = lines.find(line => line.id === id)?.quantity ?? 0;
      await updateItem(variant.id, previous + quantity);
    } else {
      await perform(() => editDraft(id, previous => ({
        id, slug: product.slug, sku: variant.sku, quantity: Math.min((previous?.quantity ?? 0) + quantity, limit),
      })));
    }
  }

  function change(id, quantity) {
    if (locked) return;
    if (uid) return updateItem(lines.find(line => line.id === id).variantId, quantity);
    return perform(() => editDraft(id, line => line && { ...line, quantity }));
  }

  function remove(id) {
    if (locked) return;
    if (uid) return updateItem(lines.find(line => line.id === id).variantId, 0);
    return perform(() => editDraft(id, () => null));
  }

  async function toggleFavorite(slug, productId) {
    if (sessionPending || favoriteWrite.current || favoriteList.pending || favoriteList.error) return;
    if (!uid) {
      common.toggle(slug);
      return;
    }
    const saved = favoriteList.data.find(item => item.product.slug === slug);
    const id = saved?.productId ?? productId;
    if (!id) return;
    favoriteWrite.current = true;
    setFavoriteBusy(true);
    setFavoriteError(null);
    try {
      resultId(await runCommand(uid, setFavorite, { key: crypto.randomUUID(), productId: id, enabled: !saved }));
      favoriteList.retry();
    } catch (error) {
      setFavoriteError(error);
      favoriteList.retry();
    } finally {
      favoriteWrite.current = false;
      setFavoriteBusy(false);
    }
  }

  return <Basket.Provider value={{
    ...common, cart: lines, cartRecord: remote?.cart, signedIn: Boolean(uid), pending: sessionPending || (!remote && busy && Boolean(uid)),
    favorites: uid ? storedSlugs : common.favorites, toggle: toggleFavorite, favoriteList, favoriteError,
    favoritesLocked: sessionPending || favoriteBusy || favoriteList.pending || Boolean(favoriteList.error),
    locked, busy, feedback, mergeError, guestBlocked, guestLines: uid && ownDraft ? draft.lines : [],
    guestLocked: Boolean(draft.pending), add, change, remove, refresh,
    retry: () => retryAction.current && perform(retryAction.current),
    dismiss: () => setFeedback(null),
    retryMerge: () => perform(synchronize),
    editGuest: (line, quantity) => perform(() => editDraft(line.id, () => quantity ? { ...line, quantity } : null)),
  }}>{children}</Basket.Provider>;
}

export function BasketProvider({ children }) {
  const { user, pending } = useAuthSession();
  const [draft, setDraft] = useState(readDraft);
  const [favorites, setFavorites] = useLocalStorage('nexa-favs', storedFavorites);
  const [drawer, setDrawer] = useState(false);
  const saveDraft = useCallback(value => {
    localStorage.setItem(storageKey, JSON.stringify(value));
    setDraft(value);
  }, []);
  useEffect(() => {
    const sync = event => { if (event.key === storageKey || event.key === null) setDraft(readDraft()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  function toggle(slug) {
    setFavorites(items => items.includes(slug) ? items.filter(item => item !== slug) : [...items, slug]);
  }
  return <BasketSession key={user?.uid ?? 'guest'} user={user} sessionPending={pending} draft={draft}
    saveDraft={saveDraft} common={{ favorites, drawer, setDrawer, toggle }}>{children}</BasketSession>;
}
