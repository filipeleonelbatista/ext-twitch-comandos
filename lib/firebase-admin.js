/**
 * Firebase Admin SDK – EBS only. Used for per-channel settings and history.
 * Initialize with:
 * - FIREBASE_SERVICE_ACCOUNT (JSON string), or
 * - GOOGLE_APPLICATION_CREDENTIALS (path to JSON file), or
 * - Default file at project root: comandololono-firebase-adminsdk-fbsvc-bf315109fb.json
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_RATE_LIMIT = 12;
const DEFAULT_SERVICE_ACCOUNT_FILE = 'comandololono-firebase-adminsdk-fbsvc-bf315109fb.json';

const DEFAULT_SETTINGS = {
  rateLimitPerMinute: DEFAULT_RATE_LIMIT,
  allowedCategories: [],
  subsOnlyCategories: [],
  ebsBaseUrl: '',
};

function loadServiceAccountFromFile(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('[firebase-admin] Error reading service account file:', e?.message);
    return null;
  }
}

function getFirebaseApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) {
    try {
      const credentials = typeof json === 'string' ? JSON.parse(json) : json;
      return initializeApp({ credential: cert(credentials) });
    } catch (e) {
      console.error('[firebase-admin] Invalid FIREBASE_SERVICE_ACCOUNT:', e?.message);
      return null;
    }
  }
  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    join(process.cwd(), DEFAULT_SERVICE_ACCOUNT_FILE);
  const credentials = loadServiceAccountFromFile(credPath);
  if (credentials) {
    try {
      return initializeApp({ credential: cert(credentials) });
    } catch (e) {
      console.error('[firebase-admin] Failed to initialize with file:', e?.message);
      return null;
    }
  }
  try {
    return initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  } catch (e) {
    console.error('[firebase-admin] No credentials:', e?.message);
    return null;
  }
}

let _db = null;

export function getDb() {
  if (_db) return _db;
  const app = getFirebaseApp();
  if (!app) return null;
  _db = getFirestore(app);
  return _db;
}

export function getDefaultSettings() {
  return { ...DEFAULT_SETTINGS };
}

/**
 * Get channel settings from Firestore. Returns defaults when doc does not exist.
 */
export async function getChannelSettings(channelId) {
  const db = getDb();
  if (!db) return getDefaultSettings();
  const ref = db.collection('channels').doc(String(channelId));
  const snap = await ref.get();
  if (!snap.exists) return getDefaultSettings();
  const data = snap.data()?.settings ?? {};
  return { ...getDefaultSettings(), ...data };
}

/**
 * Update channel settings (merge). Writes history entry. Returns new settings.
 */
export async function updateChannelSettings(channelId, patch, meta) {
  const db = getDb();
  if (!db) throw new Error('Firebase not configured');
  const ref = db.collection('channels').doc(String(channelId));
  const current = await getChannelSettings(channelId);
  const next = { ...current, ...patch };
  const batch = db.batch();
  batch.set(ref, { settings: next, updatedAt: new Date() }, { merge: true });
  const historyRef = ref.collection('history').doc();
  batch.set(historyRef, {
    at: new Date(),
    userId: meta.userId,
    userLogin: meta.userLogin ?? '',
    change: meta.change ?? describeChange(current, next),
  });
  await batch.commit();
  return next;
}

function describeChange(prev, next) {
  const parts = [];
  if (prev.rateLimitPerMinute !== next.rateLimitPerMinute) {
    parts.push(`rateLimitPerMinute: ${prev.rateLimitPerMinute} → ${next.rateLimitPerMinute}`);
  }
  if (JSON.stringify(prev.allowedCategories) !== JSON.stringify(next.allowedCategories)) {
    parts.push(`allowedCategories: ${next.allowedCategories?.length ? next.allowedCategories.join(', ') : 'todas'}`);
  }
  if (JSON.stringify(prev.subsOnlyCategories) !== JSON.stringify(next.subsOnlyCategories)) {
    parts.push(`subsOnlyCategories: ${next.subsOnlyCategories?.length ? next.subsOnlyCategories.join(', ') : 'nenhuma'}`);
  }
  if ((prev.ebsBaseUrl || '') !== (next.ebsBaseUrl || '')) {
    parts.push(`ebsBaseUrl: ${next.ebsBaseUrl ? 'definida' : 'removida'}`);
  }
  return parts.length ? parts.join('; ') : 'Configurações atualizadas';
}

const HISTORY_LIMIT = 100;

/**
 * Get recent history entries for a channel. Optionally trim to last N in DB.
 */
export async function getChannelSettingsHistory(channelId, limit = 20) {
  const db = getDb();
  if (!db) return [];
  const ref = db.collection('channels').doc(String(channelId)).collection('history');
  const snap = await ref.orderBy('at', 'desc').limit(limit).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      at: data.at?.toDate?.()?.toISOString?.() ?? (data.at && new Date(data.at).toISOString()) ?? null,
      userId: data.userId,
      userLogin: data.userLogin ?? '',
      change: data.change ?? '',
    };
  });
}

/**
 * Trim history to last HISTORY_LIMIT entries (call periodically or on write).
 */
export async function trimChannelHistory(channelId, keep = HISTORY_LIMIT) {
  const db = getDb();
  if (!db) return;
  const col = db.collection('channels').doc(String(channelId)).collection('history');
  const snap = await col.orderBy('at', 'desc').get();
  if (snap.docs.length <= keep) return;
  const toDelete = snap.docs.slice(keep);
  const batch = db.batch();
  toDelete.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ---- Command usage log (who sent, when, which channel) ----

/**
 * Append a command send log. Call after successful chat send.
 */
export async function appendCommandLog(channelId, { userId, userLogin, command }) {
  const db = getDb();
  if (!db) return;
  const ref = db.collection('channels').doc(String(channelId)).collection('commandLogs').doc();
  await ref.set({
    channelId: String(channelId),
    userId: String(userId ?? ''),
    userLogin: String(userLogin ?? ''),
    command: String(command ?? '').trim(),
    sentAt: new Date(),
  });
}

/**
 * Get recent command send logs for a channel (for config page).
 */
export async function getCommandLogs(channelId, limit = 50) {
  const db = getDb();
  if (!db) return [];
  const ref = db.collection('channels').doc(String(channelId)).collection('commandLogs');
  const snap = await ref.orderBy('sentAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId,
      userLogin: data.userLogin ?? '',
      command: data.command ?? '',
      channelId: data.channelId ?? channelId,
      sentAt: data.sentAt?.toDate?.()?.toISOString?.() ?? (data.sentAt && new Date(data.sentAt).toISOString()) ?? null,
    };
  });
}

const METRICS_LOGS_LIMIT = 2000;
const METRICS_TOP_LIMIT = 20;

/**
 * Get usage metrics: who uses most commands, which commands are most used.
 * Based on last METRICS_LOGS_LIMIT logs.
 */
export async function getCommandMetrics(channelId) {
  const db = getDb();
  if (!db) return { topUsers: [], topCommands: [], totalLogs: 0 };
  const ref = db.collection('channels').doc(String(channelId)).collection('commandLogs');
  const snap = await ref.orderBy('sentAt', 'desc').limit(METRICS_LOGS_LIMIT).get();
  const byUser = new Map();
  const byCommand = new Map();
  snap.docs.forEach((d) => {
    const data = d.data();
    const userKey = data.userId || data.userLogin || 'unknown';
    const userLabel = data.userLogin || data.userId || '—';
    byUser.set(userKey, { userId: data.userId ?? '', userLogin: userLabel, count: (byUser.get(userKey)?.count ?? 0) + 1 });
    const cmd = (data.command ?? '').trim() || '—';
    byCommand.set(cmd, (byCommand.get(cmd) ?? 0) + 1);
  });
  const topUsers = Array.from(byUser.entries())
    .map(([k, v]) => ({ ...v, key: k }))
    .sort((a, b) => b.count - a.count)
    .slice(0, METRICS_TOP_LIMIT);
  const topCommands = Array.from(byCommand.entries())
    .map(([command, count]) => ({ command, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, METRICS_TOP_LIMIT);
  return { topUsers, topCommands, totalLogs: snap.docs.length };
}

// ---- Custom categories (CRUD) ----

/**
 * Get custom category names for a channel. Stored in channel doc.
 */
export async function getCustomCategories(channelId) {
  const db = getDb();
  if (!db) return [];
  const ref = db.collection('channels').doc(String(channelId));
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};
  const list = data.customCategories;
  return Array.isArray(list) ? [...list] : [];
}

/**
 * Set custom category names (replaces entire list).
 */
export async function setCustomCategories(channelId, categories) {
  const db = getDb();
  if (!db) throw new Error('Firebase not configured');
  const ref = db.collection('channels').doc(String(channelId));
  const list = Array.isArray(categories)
    ? categories.map((c) => String(c).trim()).filter(Boolean)
    : [];
  await ref.set({ customCategories: list }, { merge: true });
  return list;
}

// ---- Custom commands (CRUD) ----

/**
 * Get all custom commands for a channel.
 */
export async function getCustomCommands(channelId) {
  const db = getDb();
  if (!db) return [];
  const ref = db.collection('channels').doc(String(channelId)).collection('customCommands');
  const snap = await ref.get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      command: data.command ?? '',
      category: data.category ?? 'Geral',
      subsOnly: !!data.subsOnly,
    };
  });
}

/**
 * Add a custom command.
 */
export async function addCustomCommand(channelId, { command, category, subsOnly }) {
  const db = getDb();
  if (!db) throw new Error('Firebase not configured');
  const ref = db.collection('channels').doc(String(channelId)).collection('customCommands').doc();
  const data = {
    command: String(command ?? '').trim(),
    category: String(category ?? 'Geral').trim() || 'Geral',
    subsOnly: !!subsOnly,
  };
  await ref.set(data);
  return { id: ref.id, ...data };
}

/**
 * Update a custom command by id.
 */
export async function updateCustomCommand(channelId, cmdId, patch) {
  const db = getDb();
  if (!db) throw new Error('Firebase not configured');
  const ref = db.collection('channels').doc(String(channelId)).collection('customCommands').doc(cmdId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const current = snap.data();
  const next = {
    command: patch.command !== undefined ? String(patch.command).trim() : current.command,
    category: patch.category !== undefined ? (String(patch.category).trim() || 'Geral') : current.category,
    subsOnly: patch.subsOnly !== undefined ? !!patch.subsOnly : current.subsOnly,
  };
  await ref.update(next);
  return { id: ref.id, ...next };
}

/**
 * Delete a custom command by id.
 */
export async function deleteCustomCommand(channelId, cmdId) {
  const db = getDb();
  if (!db) throw new Error('Firebase not configured');
  const ref = db.collection('channels').doc(String(channelId)).collection('customCommands').doc(cmdId);
  await ref.delete();
  return true;
}
