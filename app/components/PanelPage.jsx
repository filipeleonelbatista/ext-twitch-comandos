'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSheetsConfig, getPollingIntervalMs, getSubCheckUrl, getChannelSettingsUrl } from '@/lib/config';
import { fetchAllSheets, getUniqueCategories } from '@/lib/sheets';
import { sendChatMessage } from '@/lib/twitch';
import LoadingOverlay from '@/app/components/LoadingOverlay';

const USER_PROFILE_STORAGE_KEY = 'usermetadata:ext:cololono:profile';

function loadStoredProfile() {
  try {
    const raw = sessionStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && (data.displayName || data.profileImageUrl)) return data;
  } catch (_) {}
  return null;
}

function saveProfileToStorage(displayName, profileImageUrl) {
  try {
    sessionStorage.setItem(
      USER_PROFILE_STORAGE_KEY,
      JSON.stringify({ displayName: displayName || '', profileImageUrl: profileImageUrl || '' })
    );
  } catch (_) {}
}
const DEFAULT_RATE_LIMIT = 12;
const CHAT_RATE_WINDOW_MS = 60 * 1000;
const ITEMS_PER_PAGE = 12;

function matchSearch(row, query) {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();
  const cmd = (row.command || '').toLowerCase();
  const cat = (row.category || '').toLowerCase();
  return cmd.includes(q) || cat.includes(q);
}

export default function PanelPage() {
  const [auth, setAuth] = useState(null);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [followerPage, setFollowerPage] = useState(1);
  const [subscriberPage, setSubscriberPage] = useState(1);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [rateLimitMsg, setRateLimitMsg] = useState('');
  const [isChatEnabled, setIsChatEnabled] = useState(false);
  const [broadcasterDisplayName, setBroadcasterDisplayName] = useState('');
  const [userDisplayName, setUserDisplayName] = useState('');
  const [userProfileImageUrl, setUserProfileImageUrl] = useState('');
  const [channelSettings, setChannelSettings] = useState(null);
  const [customCommands, setCustomCommands] = useState([]);
  const chatTimestamps = useRef([]);
  const rateLimitCooldownUntil = useRef(0);
  const pollTimer = useRef(null);

  const rateLimit = channelSettings?.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT;

  const canSendChat = useCallback(() => {
    const now = Date.now();
    if (now < rateLimitCooldownUntil.current) return false;
    const recent = chatTimestamps.current.filter((t) => now - t < CHAT_RATE_WINDOW_MS);
    return recent.length < rateLimit;
  }, [rateLimit]);

  const callSubCheck = useCallback(async (token) => {
    const url = getSubCheckUrl();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return data.isSubscriber === true;
  }, []);

  const loadCommands = useCallback(async () => {
    const { followers: fUrl, subscribers: sUrl } = getSheetsConfig();
    const { followers: f, subscribers: s } = await fetchAllSheets(fUrl, sUrl);
    setFollowers(f);
    setSubscribers(s);
    setCategories(getUniqueCategories(f, s));
  }, []);

  const commandsUrl = getChannelSettingsUrl().replace(/\/channel-settings\/?$/, '') + '/channel-settings/commands';

  const filterCommands = useCallback(
    (list, subsOnly = false) => {
      let out = list;
      const allowed = channelSettings?.allowedCategories;
      if (Array.isArray(allowed) && allowed.length > 0) {
        const allowedSet = new Set(allowed.map((c) => c.trim().toLowerCase()));
        out = out.filter((row) => allowedSet.has((row.category || '').trim().toLowerCase()));
      }
      if (subsOnly) {
        const subsCat = channelSettings?.subsOnlyCategories;
        if (Array.isArray(subsCat) && subsCat.length > 0) {
          const subsSet = new Set(subsCat.map((c) => c.trim().toLowerCase()));
          out = out.filter((row) => subsSet.has((row.category || '').trim().toLowerCase()));
        }
      }
      if (selectedCategory && selectedCategory !== 'Todas') {
        out = out.filter((row) => row.category === selectedCategory);
      }
      if (searchQuery && searchQuery.trim()) {
        out = out.filter((row) => matchSearch(row, searchQuery));
      }
      return out;
    },
    [channelSettings, selectedCategory, searchQuery]
  );

  const showRateLimit = useCallback((seconds, customMsg) => {
    if (customMsg) {
      setRateLimitMsg(customMsg);
      return;
    }
    setRateLimitMsg(`Aguarde ${seconds} segundos para enviar outro comando.`);
    if (seconds > 0) {
      const interval = setInterval(() => {
        const left = Math.ceil((rateLimitCooldownUntil.current - Date.now()) / 1000);
        if (left <= 0) {
          clearInterval(interval);
          setRateLimitMsg('');
          return;
        }
        setRateLimitMsg(`Aguarde ${left} segundos para enviar outro comando.`);
      }, 1000);
    }
  }, []);

  const handleCommandClick = useCallback(
    async (commandText) => {
      if (!auth) return;
      if (!isChatEnabled) return;
      const now = Date.now();
      if (now < rateLimitCooldownUntil.current) {
        showRateLimit(Math.ceil((rateLimitCooldownUntil.current - now) / 1000));
        return;
      }
      if (!canSendChat()) {
        const idx = chatTimestamps.current.length - rateLimit;
        const oldest = idx >= 0 ? chatTimestamps.current[idx] : Date.now();
        const elapsed = Date.now() - oldest;
        const s = Math.ceil((CHAT_RATE_WINDOW_MS - elapsed) / 1000);
        rateLimitCooldownUntil.current = Date.now() + s * 1000;
        showRateLimit(s);
        return;
      }
      const result = await sendChatMessage(auth, commandText, broadcasterDisplayName, userDisplayName);
      if (result.ok) {
        chatTimestamps.current.push(Date.now());
        if (chatTimestamps.current.length > rateLimit) chatTimestamps.current.shift();
        return;
      }
      if (result.status === 429) {
        rateLimitCooldownUntil.current = Date.now() + 60000;
        showRateLimit(60);
        return;
      }
      if (result.status === 401) {
        showRateLimit(0, 'Ative "Chat in Extensions" na versão da extensão no Twitch Developer Console.');
        return;
      }
      showRateLimit(0, result.error || `Erro ${result.status}`);
    },
    [auth, isChatEnabled, broadcasterDisplayName, userDisplayName, canSendChat, showRateLimit, rateLimit]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Twitch?.ext) {
      setStatus('error');
      setErrorMsg('Extensão Twitch não disponível.');
      return;
    }

    window.Twitch.ext.onAuthorized(async (a) => {
      setAuth(a);
      setIsChatEnabled(!!window.Twitch.ext?.features?.isChatEnabled);
      const stored = loadStoredProfile();
      if (stored) {
        setUserDisplayName(stored.displayName || '');
        setUserProfileImageUrl(stored.profileImageUrl || '');
      } else {
        setUserDisplayName('');
        setUserProfileImageUrl('');
      }
      try {
        sessionStorage.setItem('usermetadata:ext:cololono', JSON.stringify(a));
      } catch (_) {}
      if (a.helixToken && a.clientId) {
        try {
          const res = await fetch('https://api.twitch.tv/helix/users', {
            headers: {
              Authorization: `Extension ${a.helixToken}`,
              'Client-Id': a.clientId,
            },
          });
          if (res.ok) {
            const json = await res.json();
            const user = json.data?.[0];
            if (user) {
              const name = user.display_name || user.login || '';
              const img = user.profile_image_url || '';
              setUserDisplayName(name);
              setUserProfileImageUrl(img);
              saveProfileToStorage(name, img);
            }
          }
        } catch (_) {}
        try {
          const broadcasterRes = await fetch(
            `https://api.twitch.tv/helix/users?id=${encodeURIComponent(a.channelId || '')}`,
            {
              headers: {
                Authorization: `Extension ${a.helixToken}`,
                'Client-Id': a.clientId,
              },
            }
          );
          if (broadcasterRes.ok) {
            const broadcasterJson = await broadcasterRes.json();
            const broadcaster = broadcasterJson.data?.[0];
            if (broadcaster) {
              setBroadcasterDisplayName(broadcaster.display_name || broadcaster.login || '');
            }
          }
        } catch (_) {}
      }
      setStatus('loading');
      try {
        const settingsUrl = getChannelSettingsUrl();
        const [settingsRes, commandsRes] = await Promise.all([
          fetch(settingsUrl, { headers: { Authorization: `Bearer ${a.token}` } }),
          fetch(commandsUrl, { headers: { Authorization: `Bearer ${a.token}` } }),
        ]);
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setChannelSettings(settingsData);
        } else {
          setChannelSettings({ rateLimitPerMinute: DEFAULT_RATE_LIMIT, allowedCategories: [], subsOnlyCategories: [] });
        }
        if (commandsRes.ok) {
          const commandsData = await commandsRes.json();
          setCustomCommands(Array.isArray(commandsData) ? commandsData : []);
        } else {
          setCustomCommands([]);
        }
      } catch {
        setChannelSettings({ rateLimitPerMinute: DEFAULT_RATE_LIMIT, allowedCategories: [], subsOnlyCategories: [] });
        setCustomCommands([]);
      }
      try {
        const sub = await callSubCheck(a.token);
        setIsSubscriber(sub);
      } catch {
        setIsSubscriber(false);
      }
      try {
        await loadCommands();
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setErrorMsg('Falha ao carregar comandos. Verifique as planilhas.');
        console.error(err);
      }
    });
    if (window.Twitch.ext?.features?.onChanged) {
      window.Twitch.ext.features.onChanged((changes) => {
        if (Array.isArray(changes) && changes.includes('isChatEnabled')) {
          setIsChatEnabled(!!window.Twitch.ext?.features?.isChatEnabled);
        }
      });
    }
  }, [callSubCheck, loadCommands, commandsUrl]);

  useEffect(() => {
    if (status !== 'ready') return;
    const ms = getPollingIntervalMs();
    pollTimer.current = setInterval(() => {
      loadCommands();
    }, ms);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [status, loadCommands]);

  if (status === 'error') {
    return <div className="error-msg">{errorMsg}</div>;
  }

  if (status === 'loading') {
    return <LoadingOverlay />;
  }

  const customForAll = customCommands.filter((c) => !c.subsOnly).map((c) => ({ command: c.command, category: c.category || 'Geral' }));
  const customForSubs = customCommands.filter((c) => c.subsOnly).map((c) => ({ command: c.command, category: c.category || 'Geral' }));
  const mergedFollowers = [...followers, ...customForAll];
  const mergedSubscribers = [...subscribers, ...customForSubs];
  const mergedCategories = getUniqueCategories(mergedFollowers, mergedSubscribers);
  const filteredFollowers = filterCommands(mergedFollowers, false);
  const filteredSubscribers = filterCommands(mergedSubscribers, true);
  const allCategories = ['Todas', ...mergedCategories];
  const disabled =
    !isChatEnabled || !canSendChat() || Date.now() < rateLimitCooldownUntil.current;

  const totalFollowerPages = Math.max(1, Math.ceil(filteredFollowers.length / ITEMS_PER_PAGE));
  const totalSubscriberPages = Math.max(1, Math.ceil(filteredSubscribers.length / ITEMS_PER_PAGE));
  const safeFollowerPage = Math.min(followerPage, totalFollowerPages) || 1;
  const safeSubscriberPage = Math.min(subscriberPage, totalSubscriberPages) || 1;
  const paginatedFollowers = filteredFollowers.slice(
    (safeFollowerPage - 1) * ITEMS_PER_PAGE,
    safeFollowerPage * ITEMS_PER_PAGE
  );
  const paginatedSubscribers = filteredSubscribers.slice(
    (safeSubscriberPage - 1) * ITEMS_PER_PAGE,
    safeSubscriberPage * ITEMS_PER_PAGE
  );

  const handleClearSearch = () => {
    setSearchQuery('');
    setFollowerPage(1);
    setSubscriberPage(1);
  };

  return (
    <div className="panel-root panel-root--mobile">
      <header className="panel-header">
        {(userDisplayName || userProfileImageUrl) && (
          <div className="panel-header-user">
            <img
              src={userProfileImageUrl || '/assets/icon_100x100.png'}
              alt=""
              className="panel-header-user-avatar"
              width={28}
              height={28}
            />
            <span className="panel-header-user-name">{userDisplayName || 'Twitch'}</span>
          </div>
        )}
        <div className="panel-header-top">
          <img src="/assets/icon_100x100.png" alt="" className="panel-header-icon" />
          <h1>Comandos de áudio</h1>
          {searchQuery.trim() ? (
            <button type="button" className="panel-header-clear" onClick={handleClearSearch}>
              Limpar
            </button>
          ) : null}
        </div>
        <div className="panel-header-search">
          <input
            type="search"
            placeholder="Pesquisar por comando ou categoria..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setFollowerPage(1);
              setSubscriberPage(1);
            }}
            className="panel-search-input"
            aria-label="Pesquisar"
          />
        </div>
        <div className="panel-header-category">
          <label htmlFor="category-select" className="panel-category-label">
            Categoria
          </label>
          <select
            id="category-select"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setFollowerPage(1);
              setSubscriberPage(1);
            }}
            className="panel-category-select"
          >
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="panel-content">
        {rateLimitMsg ? <div className="rate-limit-msg">{rateLimitMsg}</div> : null}

        {!isChatEnabled && (
          <div className="authorize-prompt">
            <p>
              O chat da extensão está desativado. Ative em Capabilities no Twitch Developer Console
              ou peça ao streamer para permitir.
            </p>
          </div>
        )}

        {!isSubscriber && (
          <div className="subs-unlock subs-unlock--promo">
            {filteredSubscribers.length > 0
              ? `Desbloqueie mais ${filteredSubscribers.length} ${filteredSubscribers.length === 1 ? 'comando' : 'comandos'} sendo inscrito no canal.`
              : 'Desbloqueie os áudios sendo inscrito no canal.'}
          </div>
        )}

        <div className="section-title">Comandos (todos) — {filteredFollowers.length} {filteredFollowers.length === 1 ? 'comando' : 'comandos'}</div>
        <div className="commands-grid">
          {paginatedFollowers.map(({ command }, i) => (
            <button
              key={`f-${i}-${command}`}
              type="button"
              className="command-btn"
              disabled={disabled}
              onClick={() => handleCommandClick(command)}
            >
              {command}
            </button>
          ))}
        </div>
        {filteredFollowers.length > ITEMS_PER_PAGE && (
          <div className="pagination">
            <button
              type="button"
              className="pagination-btn"
              disabled={safeFollowerPage <= 1}
              onClick={() => setFollowerPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span className="pagination-info">
              Página {safeFollowerPage} de {totalFollowerPages}
            </span>
            <button
              type="button"
              className="pagination-btn"
              disabled={safeFollowerPage >= totalFollowerPages}
              onClick={() => setFollowerPage((p) => Math.min(totalFollowerPages, p + 1))}
            >
              Próxima
            </button>
          </div>
        )}

        {isSubscriber ? (
          <>
            <div className="section-title">Áudios (inscritos) — {filteredSubscribers.length} {filteredSubscribers.length === 1 ? 'comando' : 'comandos'}</div>
            <div className="commands-grid">
              {paginatedSubscribers.map(({ command }, i) => (
                <button
                  key={`s-${i}-${command}`}
                  type="button"
                  className="command-btn"
                  disabled={disabled}
                  onClick={() => handleCommandClick(command)}
                >
                  {command}
                </button>
              ))}
            </div>
            {filteredSubscribers.length > ITEMS_PER_PAGE && (
              <div className="pagination">
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={safeSubscriberPage <= 1}
                  onClick={() => setSubscriberPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <span className="pagination-info">
                  Página {safeSubscriberPage} de {totalSubscriberPages}
                </span>
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={safeSubscriberPage >= totalSubscriberPages}
                  onClick={() => setSubscriberPage((p) => Math.min(totalSubscriberPages, p + 1))}
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>

      <footer className="panel-footer">
        Feito pelo maior exemplo dessa live ·{' '}
        <a
          href="https://www.linkedin.com/in/filipeleonelbatista"
          target="_blank"
          rel="noopener noreferrer"
        >
          Filipe Leonel Batista
        </a>{' '}
        (LinkedIn)
      </footer>
    </div>
  );
}
