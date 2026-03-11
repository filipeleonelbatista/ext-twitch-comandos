'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSheetsConfig, getPollingIntervalMs, getSubCheckUrl } from '@/lib/config';
import { fetchAllSheets, getUniqueCategories } from '@/lib/sheets';
import { sendChatMessage } from '@/lib/twitch';

const CHAT_RATE_LIMIT = 12;
const CHAT_RATE_WINDOW_MS = 60 * 1000;

export default function PanelPage() {
  const [auth, setAuth] = useState(null);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [rateLimitMsg, setRateLimitMsg] = useState('');
  const chatTimestamps = useRef([]);
  const rateLimitCooldownUntil = useRef(0);
  const pollTimer = useRef(null);

  const canSendChat = useCallback(() => {
    const now = Date.now();
    if (now < rateLimitCooldownUntil.current) return false;
    const recent = chatTimestamps.current.filter((t) => now - t < CHAT_RATE_WINDOW_MS);
    return recent.length < CHAT_RATE_LIMIT;
  }, []);

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

  const filterCommands = useCallback(
    (list) => {
      if (!selectedCategory || selectedCategory === 'Todas') return list;
      return list.filter((row) => row.category === selectedCategory);
    },
    [selectedCategory]
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
      const now = Date.now();
      if (now < rateLimitCooldownUntil.current) {
        showRateLimit(Math.ceil((rateLimitCooldownUntil.current - now) / 1000));
        return;
      }
      if (!canSendChat()) {
        const oldest = chatTimestamps.current[chatTimestamps.current.length - CHAT_RATE_LIMIT];
        const elapsed = Date.now() - oldest;
        const s = Math.ceil((CHAT_RATE_WINDOW_MS - elapsed) / 1000);
        rateLimitCooldownUntil.current = Date.now() + s * 1000;
        showRateLimit(s);
        return;
      }
      const result = await sendChatMessage(auth, commandText);
      if (result.ok) {
        chatTimestamps.current.push(Date.now());
        if (chatTimestamps.current.length > CHAT_RATE_LIMIT) chatTimestamps.current.shift();
        return;
      }
      if (result.status === 429) {
        rateLimitCooldownUntil.current = Date.now() + 60000;
        showRateLimit(60);
        return;
      }
      showRateLimit(0, result.error || `Erro ${result.status}`);
    },
    [auth, canSendChat, showRateLimit]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Twitch?.ext) {
      setStatus('error');
      setErrorMsg('Extensão Twitch não disponível.');
      return;
    }

    window.Twitch.ext.onAuthorized(async (a) => {
      setAuth(a);
      setStatus('loading');
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
  }, [callSubCheck, loadCommands]);

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
    return <div className="loading">Carregando...</div>;
  }

  const filteredFollowers = filterCommands(followers);
  const filteredSubscribers = filterCommands(subscribers);
  const allCategories = ['Todas', ...categories];
  const disabled = !canSendChat() || Date.now() < rateLimitCooldownUntil.current;

  return (
    <div className="panel-root">
      <div className="panel-header">
        <h1>Comandos de áudio</h1>
      </div>

      <div className="filters">
        {allCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {rateLimitMsg ? <div className="rate-limit-msg">{rateLimitMsg}</div> : null}

      <div className="section-title">Comandos (todos)</div>
      <div className="commands-grid">
        {filteredFollowers.map(({ command }, i) => (
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

      {isSubscriber ? (
        <>
          <div className="section-title">Áudios (inscritos)</div>
          <div className="commands-grid">
            {filteredSubscribers.map(({ command }, i) => (
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
        </>
      ) : (
        <div className="subs-unlock">Desbloqueie os áudios sendo inscrito no canal.</div>
      )}

      <div className="footer">
        Feito pelo maior exemplo dessa live ·{' '}
        <a
          href="https://www.linkedin.com/in/filipeleonelbatista"
          target="_blank"
          rel="noopener noreferrer"
        >
          Filipe Leonel Batista
        </a>{' '}
        (LinkedIn)
      </div>
    </div>
  );
}
