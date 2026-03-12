'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import PanelPage from '@/app/components/PanelPage';
import LoadingOverlay from '@/app/components/LoadingOverlay';
import { getChannelSettingsUrl } from '@/lib/config';

function parseCategoriesStr(s) {
  if (!s || typeof s !== 'string') return [];
  return s
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

function categoriesToStr(arr) {
  return Array.isArray(arr) ? arr.join(', ') : '';
}

function ConfigView() {
  const [auth, setAuth] = useState(null);
  const [ebsBaseUrl, setEbsBaseUrl] = useState('');
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState(12);
  const [allowedCategoriesStr, setAllowedCategoriesStr] = useState('');
  const [subsOnlyCategoriesStr, setSubsOnlyCategoriesStr] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const baseUrl = getChannelSettingsUrl();
  const historyUrl = baseUrl.replace(/\/channel-settings\/?$/, '') + '/channel-settings/history';
  const categoriesUrl = baseUrl.replace(/\/channel-settings\/?$/, '') + '/channel-settings/categories';
  const commandsUrl = baseUrl.replace(/\/channel-settings\/?$/, '') + '/channel-settings/commands';
  const commandLogsUrl = baseUrl.replace(/\/channel-settings\/?$/, '') + '/channel-settings/command-logs';
  const metricsUrl = baseUrl.replace(/\/channel-settings\/?$/, '') + '/channel-settings/metrics';

  const [customCategories, setCustomCategories] = useState([]);
  const [customCommands, setCustomCommands] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCommand, setNewCommand] = useState({ command: '', category: 'Geral', subsOnly: false });
  const [editingCategoryIdx, setEditingCategoryIdx] = useState(-1);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');
  const [editingCommandId, setEditingCommandId] = useState(null);
  const [editCommandForm, setEditCommandForm] = useState({ command: '', category: 'Geral', subsOnly: false });
  const [crudError, setCrudError] = useState('');
  const [commandLogs, setCommandLogs] = useState([]);
  const [commandLogsLoading, setCommandLogsLoading] = useState(false);
  const [metrics, setMetrics] = useState({ topUsers: [], topCommands: [], totalLogs: 0 });
  const [metricsLoading, setMetricsLoading] = useState(false);

  const loadSettings = useCallback(
    async (token) => {
      if (!token) return;
      setError('');
      try {
        const res = await fetch(baseUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (res.status === 403) {
            setError('Apenas o broadcaster ou moderadores podem alterar as configurações.');
            return;
          }
          throw new Error(res.statusText);
        }
        const data = await res.json();
        setRateLimitPerMinute(data.rateLimitPerMinute ?? 12);
        setAllowedCategoriesStr(categoriesToStr(data.allowedCategories));
        setSubsOnlyCategoriesStr(categoriesToStr(data.subsOnlyCategories));
        setEbsBaseUrl(data.ebsBaseUrl ?? '');
      } catch (e) {
        setError(e?.message || 'Erro ao carregar configurações.');
      } finally {
        setLoading(false);
      }
    },
    [baseUrl]
  );

  const loadHistory = useCallback(
    async (token) => {
      if (!token) return;
      setHistoryLoading(true);
      try {
        const res = await fetch(historyUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setHistory(Array.isArray(data) ? data : []);
        }
      } catch (_) {}
      setHistoryLoading(false);
    },
    [historyUrl]
  );

  const loadCategories = useCallback(
    async (token) => {
      if (!token) return;
      setCategoriesLoading(true);
      setCrudError('');
      try {
        const res = await fetch(categoriesUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setCustomCategories(Array.isArray(data) ? data : []);
        }
      } catch (_) {}
      setCategoriesLoading(false);
    },
    [categoriesUrl]
  );

  const loadCommands = useCallback(
    async (token) => {
      if (!token) return;
      setCommandsLoading(true);
      setCrudError('');
      try {
        const res = await fetch(commandsUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setCustomCommands(Array.isArray(data) ? data : []);
        }
      } catch (_) {}
      setCommandsLoading(false);
    },
    [commandsUrl]
  );

  const loadCommandLogs = useCallback(
    async (token) => {
      if (!token) return;
      setCommandLogsLoading(true);
      try {
        const res = await fetch(commandLogsUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setCommandLogs(Array.isArray(data) ? data : []);
        }
      } catch (_) {}
      setCommandLogsLoading(false);
    },
    [commandLogsUrl]
  );

  const loadMetrics = useCallback(
    async (token) => {
      if (!token) return;
      setMetricsLoading(true);
      try {
        const res = await fetch(metricsUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setMetrics({
            topUsers: Array.isArray(data.topUsers) ? data.topUsers : [],
            topCommands: Array.isArray(data.topCommands) ? data.topCommands : [],
            totalLogs: typeof data.totalLogs === 'number' ? data.totalLogs : 0,
          });
        }
      } catch (_) {}
      setMetricsLoading(false);
    },
    [metricsUrl]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Twitch?.ext) {
      setLoading(false);
      return;
    }
    try {
      const content = window.Twitch.ext.configuration?.broadcaster?.content;
      if (content) {
        const c = JSON.parse(content);
        if (c.ebsBaseUrl) setEbsBaseUrl(c.ebsBaseUrl);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Twitch?.ext) return;
    const handler = (a) => {
      setAuth(a);
      if (a?.token) {
        loadSettings(a.token);
        loadHistory(a.token);
        loadCategories(a.token);
        loadCommands(a.token);
        loadCommandLogs(a.token);
        loadMetrics(a.token);
      } else {
        setLoading(false);
      }
    };
    if (window.Twitch.ext.onAuthorized) {
      window.Twitch.ext.onAuthorized(handler);
    }
  }, [loadSettings, loadHistory, loadCategories, loadCommands, loadCommandLogs, loadMetrics]);

  const handleSave = async () => {
    if (!auth?.token) {
      setError('Extensão Twitch não autorizada.');
      return;
    }
    setError('');
    try {
      if (typeof window !== 'undefined' && window.Twitch?.ext?.configuration?.set) {
        const content = JSON.stringify({ ebsBaseUrl: ebsBaseUrl.trim() || undefined });
        window.Twitch.ext.configuration.set('broadcaster', '1', content);
      }

      const rateLimit = parseInt(rateLimitPerMinute, 10);
      const body = {
        rateLimitPerMinute: Number.isFinite(rateLimit) && rateLimit >= 1 && rateLimit <= 60 ? rateLimit : 12,
        allowedCategories: parseCategoriesStr(allowedCategoriesStr),
        subsOnlyCategories: parseCategoriesStr(subsOnlyCategoriesStr),
        ebsBaseUrl: ebsBaseUrl.trim() || '',
      };

      const res = await fetch(baseUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 403) {
        setError('Apenas o broadcaster ou moderadores podem alterar as configurações.');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      const updated = await res.json();
      setRateLimitPerMinute(updated.rateLimitPerMinute ?? 12);
      setAllowedCategoriesStr(categoriesToStr(updated.allowedCategories));
      setSubsOnlyCategoriesStr(categoriesToStr(updated.subsOnlyCategories));
      setEbsBaseUrl(updated.ebsBaseUrl ?? '');
      loadHistory(auth.token);
    } catch (e) {
      setError(e?.message || 'Erro ao salvar.');
    }
  };

  const handleAddCategory = async () => {
    if (!auth?.token || !newCategoryName.trim()) return;
    setCrudError('');
    const name = newCategoryName.trim();
    const next = [...customCategories, name];
    try {
      const res = await fetch(categoriesUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ categories: next }),
      });
      if (res.status === 403) {
        setCrudError('Apenas o broadcaster ou moderadores podem alterar.');
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      setCustomCategories(next);
      setNewCategoryName('');
    } catch (e) {
      setCrudError(e?.message || 'Erro ao salvar categoria.');
    }
  };

  const handleSaveCategoryEdit = async () => {
    if (!auth?.token || editingCategoryIdx < 0) return;
    const name = editingCategoryValue.trim();
    if (!name) return;
    const next = customCategories.map((c, i) => (i === editingCategoryIdx ? name : c));
    setCrudError('');
    try {
      const res = await fetch(categoriesUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ categories: next }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCustomCategories(next);
      setEditingCategoryIdx(-1);
      setEditingCategoryValue('');
    } catch (e) {
      setCrudError(e?.message || 'Erro ao salvar.');
    }
  };

  const handleDeleteCategory = async (idx) => {
    if (!auth?.token) return;
    const next = customCategories.filter((_, i) => i !== idx);
    setCrudError('');
    try {
      const res = await fetch(categoriesUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ categories: next }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCustomCategories(next);
      if (editingCategoryIdx === idx) {
        setEditingCategoryIdx(-1);
        setEditingCategoryValue('');
      } else if (editingCategoryIdx > idx) {
        setEditingCategoryIdx(editingCategoryIdx - 1);
      }
    } catch (e) {
      setCrudError(e?.message || 'Erro ao excluir.');
    }
  };

  const handleAddCommand = async () => {
    if (!auth?.token || !newCommand.command.trim()) return;
    setCrudError('');
    try {
      const res = await fetch(commandsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          command: newCommand.command.trim(),
          category: newCommand.category.trim() || 'Geral',
          subsOnly: newCommand.subsOnly,
        }),
      });
      if (res.status === 403) {
        setCrudError('Apenas o broadcaster ou moderadores podem alterar.');
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setCustomCommands((prev) => [...prev, created]);
      setNewCommand({ command: '', category: 'Geral', subsOnly: false });
    } catch (e) {
      setCrudError(e?.message || 'Erro ao adicionar comando.');
    }
  };

  const handleEditCommand = (cmd) => {
    setEditingCommandId(cmd.id);
    setEditCommandForm({ command: cmd.command, category: cmd.category, subsOnly: cmd.subsOnly });
  };

  const handleSaveCommandEdit = async () => {
    if (!auth?.token || !editingCommandId) return;
    setCrudError('');
    try {
      const res = await fetch(`${commandsUrl}/${editingCommandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          command: editCommandForm.command.trim(),
          category: editCommandForm.category.trim() || 'Geral',
          subsOnly: editCommandForm.subsOnly,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setCustomCommands((prev) => prev.map((c) => (c.id === editingCommandId ? updated : c)));
      setEditingCommandId(null);
      setEditCommandForm({ command: '', category: 'Geral', subsOnly: false });
    } catch (e) {
      setCrudError(e?.message || 'Erro ao salvar comando.');
    }
  };

  const handleDeleteCommand = async (id) => {
    if (!auth?.token) return;
    setCrudError('');
    try {
      const res = await fetch(`${commandsUrl}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setCustomCommands((prev) => prev.filter((c) => c.id !== id));
      if (editingCommandId === id) {
        setEditingCommandId(null);
        setEditCommandForm({ command: '', category: 'Geral', subsOnly: false });
      }
    } catch (e) {
      setCrudError(e?.message || 'Erro ao excluir comando.');
    }
  };

  if (loading && !auth) {
    return (
      <div className="panel-root config-view">
        <LoadingOverlay />
      </div>
    );
  }

  return (
    <div className="panel-root config-view">
      <div className="panel-header">
        <img src="/assets/icon_100x100.png" alt="" className="panel-header-icon" />
        <h1>Configuração da extensão</h1>
      </div>
      <p className="config-desc">
        Configure a URL do backend (EBS) e as regras por canal. As alterações são salvas por canal e os viewers leem as regras ao abrir o painel.
      </p>
      <div className="config-form">
        <label htmlFor="ebs-base-url">URL do EBS (base)</label>
        <input
          id="ebs-base-url"
          type="url"
          placeholder="https://seu-dominio.vercel.app"
          value={ebsBaseUrl}
          onChange={(e) => setEbsBaseUrl(e.target.value)}
          className="config-input"
        />
        <label htmlFor="rate-limit">Mensagens por minuto (rate limit)</label>
        <input
          id="rate-limit"
          type="number"
          min={1}
          max={60}
          value={rateLimitPerMinute}
          onChange={(e) => setRateLimitPerMinute(parseInt(e.target.value, 10) || 12)}
          className="config-input"
        />
        <label htmlFor="allowed-categories">Categorias permitidas (vazio = todas). Separe por vírgula.</label>
        <input
          id="allowed-categories"
          type="text"
          placeholder="Ex: Jogos, Musica"
          value={allowedCategoriesStr}
          onChange={(e) => setAllowedCategoriesStr(e.target.value)}
          className="config-input"
        />
        <label htmlFor="subs-only-categories">Categorias só para inscritos. Separe por vírgula.</label>
        <input
          id="subs-only-categories"
          type="text"
          placeholder="Ex: Comandos VIP"
          value={subsOnlyCategoriesStr}
          onChange={(e) => setSubsOnlyCategoriesStr(e.target.value)}
          className="config-input"
        />
        <button type="button" onClick={handleSave} className="config-save-btn" disabled={loading}>
          Salvar
        </button>
      </div>
      {saved && <p className="config-saved">Configuração salva.</p>}
      {error && <p className="error-msg">{error}</p>}
      {crudError && <p className="error-msg">{crudError}</p>}

      <section className="config-crud-section">
        <h2 className="config-history-title">Categorias (para comandos)</h2>
        <p className="config-desc">Adicione categorias para organizar os comandos. Use ao criar comandos abaixo.</p>
        {categoriesLoading ? (
          <p className="config-desc">Carregando…</p>
        ) : (
          <>
            <ul className="config-crud-list">
              {customCategories.map((name, idx) => (
                <li key={`cat-${idx}`} className="config-crud-item">
                  {editingCategoryIdx === idx ? (
                    <>
                      <input
                        type="text"
                        className="config-input config-input--inline"
                        value={editingCategoryValue}
                        onChange={(e) => setEditingCategoryValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveCategoryEdit()}
                        autoFocus
                      />
                      <button type="button" className="config-crud-btn" onClick={handleSaveCategoryEdit}>
                        Salvar
                      </button>
                      <button type="button" className="config-crud-btn config-crud-btn--danger" onClick={() => { setEditingCategoryIdx(-1); setEditingCategoryValue(''); }}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="config-crud-label">{name}</span>
                      <button type="button" className="config-crud-btn" onClick={() => { setEditingCategoryIdx(idx); setEditingCategoryValue(name); }}>
                        Editar
                      </button>
                      <button type="button" className="config-crud-btn config-crud-btn--danger" onClick={() => handleDeleteCategory(idx)}>
                        Excluir
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="config-form config-form--inline">
              <input
                type="text"
                placeholder="Nova categoria"
                className="config-input"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              />
              <button type="button" className="config-save-btn" onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
                Adicionar categoria
              </button>
            </div>
          </>
        )}
      </section>

      <section className="config-crud-section">
        <h2 className="config-history-title">Comandos (listagem na ferramenta)</h2>
        <p className="config-desc">Comandos adicionados aqui aparecem no painel junto com os da planilha. Use o checkbox <strong>Somente para inscritos</strong>: se marcado, o comando só aparece na seção &quot;Áudios (inscritos)&quot; para quem é inscrito; se desmarcado, aparece em &quot;Comandos (todos)&quot; para todos.</p>
        {commandsLoading ? (
          <p className="config-desc">Carregando…</p>
        ) : (
          <>
            <ul className="config-crud-list">
              {customCommands.map((cmd) => (
                <li key={cmd.id} className="config-crud-item config-crud-item--command">
                  {editingCommandId === cmd.id ? (
                    <>
                      <input
                        type="text"
                        className="config-input config-input--inline"
                        placeholder="Comando"
                        value={editCommandForm.command}
                        onChange={(e) => setEditCommandForm((f) => ({ ...f, command: e.target.value }))}
                      />
                      <input
                        type="text"
                        className="config-input config-input--inline"
                        placeholder="Categoria"
                        value={editCommandForm.category}
                        onChange={(e) => setEditCommandForm((f) => ({ ...f, category: e.target.value }))}
                        list="edit-category-list"
                      />
                      <datalist id="edit-category-list">
                        {customCategories.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                      <label className="config-crud-check config-crud-check--highlight">
                        <input type="checkbox" checked={editCommandForm.subsOnly} onChange={(e) => setEditCommandForm((f) => ({ ...f, subsOnly: e.target.checked }))} />
                        Somente para inscritos
                      </label>
                      <button type="button" className="config-crud-btn" onClick={handleSaveCommandEdit}>
                        Salvar
                      </button>
                      <button type="button" className="config-crud-btn config-crud-btn--danger" onClick={() => { setEditingCommandId(null); setEditCommandForm({ command: '', category: 'Geral', subsOnly: false }); }}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="config-crud-label config-crud-label--command">{cmd.command}</span>
                      <span className="config-crud-meta">{cmd.category}</span>
                      {cmd.subsOnly && <span className="config-crud-badge" title="Visível apenas para inscritos">Somente inscritos</span>}
                      <button type="button" className="config-crud-btn" onClick={() => handleEditCommand(cmd)}>
                        Editar
                      </button>
                      <button type="button" className="config-crud-btn config-crud-btn--danger" onClick={() => handleDeleteCommand(cmd.id)}>
                        Excluir
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="config-form config-form--block">
              <input
                type="text"
                placeholder="Nome do comando (ex: !meucomando)"
                className="config-input"
                value={newCommand.command}
                onChange={(e) => setNewCommand((f) => ({ ...f, command: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Categoria"
                className="config-input"
                value={newCommand.category}
                onChange={(e) => setNewCommand((f) => ({ ...f, category: e.target.value }))}
                list="new-category-list"
              />
              <datalist id="new-category-list">
                {customCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <label className="config-crud-check config-crud-check--highlight">
                <input type="checkbox" checked={newCommand.subsOnly} onChange={(e) => setNewCommand((f) => ({ ...f, subsOnly: e.target.checked }))} />
                Somente para inscritos (exibe na seção &quot;Áudios (inscritos)&quot;)
              </label>
              <button type="button" className="config-save-btn" onClick={handleAddCommand} disabled={!newCommand.command.trim()}>
                Adicionar comando
              </button>
            </div>
          </>
        )}
      </section>

      <section className="config-history-section">
        <h2 className="config-history-title">Histórico de alterações</h2>
        {historyLoading ? (
          <p className="config-desc">Carregando…</p>
        ) : history.length === 0 ? (
          <p className="config-desc">Nenhuma alteração registrada.</p>
        ) : (
          <ul className="config-history-list">
            {history.map((entry) => (
              <li key={entry.id} className="config-history-item">
                <span className="config-history-date">
                  {entry.at ? new Date(entry.at).toLocaleString('pt-BR') : '—'}
                </span>
                <span className="config-history-user">{entry.userLogin || entry.userId || '—'}</span>
                <span className="config-history-change">{entry.change || '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="config-history-section">
        <h2 className="config-history-title">Últimos envios de comandos</h2>
        <p className="config-desc">Quem enviou, hora e canal (registrado ao clicar em um comando no painel).</p>
        {commandLogsLoading ? (
          <p className="config-desc">Carregando…</p>
        ) : commandLogs.length === 0 ? (
          <p className="config-desc">Nenhum envio registrado.</p>
        ) : (
          <ul className="config-history-list config-crud-list">
            {commandLogs.map((entry) => (
              <li key={entry.id} className="config-history-item">
                <span className="config-history-date">
                  {entry.sentAt ? new Date(entry.sentAt).toLocaleString('pt-BR') : '—'}
                </span>
                <span className="config-history-user">{entry.userLogin || entry.userId || '—'}</span>
                <span className="config-history-change">{entry.command ? `!${entry.command}` : '—'}</span>
                <span className="config-crud-meta">Canal: {entry.channelId || '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="config-history-section">
        <h2 className="config-history-title">Métricas de uso</h2>
        <p className="config-desc">Quem mais usa comandos e quais comandos são mais usados (últimos envios considerados).</p>
        {metricsLoading ? (
          <p className="config-desc">Carregando…</p>
        ) : metrics.totalLogs === 0 ? (
          <p className="config-desc">Nenhum dado de uso ainda.</p>
        ) : (
          <>
            <p className="config-desc config-metrics-total">Total de envios considerados: {metrics.totalLogs}</p>
            <div className="config-metrics-grid">
              <div className="config-metrics-block">
                <h3 className="config-metrics-subtitle">Quem mais usa comandos</h3>
                <ul className="config-metrics-list">
                  {metrics.topUsers.map((u, i) => (
                    <li key={u.key || i} className="config-metrics-item">
                      <span className="config-metrics-rank">{i + 1}.</span>
                      <span className="config-metrics-user">{u.userLogin || u.userId || '—'}</span>
                      <span className="config-metrics-count">{u.count} envios</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="config-metrics-block">
                <h3 className="config-metrics-subtitle">Comandos mais usados</h3>
                <ul className="config-metrics-list">
                  {metrics.topCommands.map((c, i) => (
                    <li key={c.command || i} className="config-metrics-item">
                      <span className="config-metrics-rank">{i + 1}.</span>
                      <span className="config-metrics-cmd">!{c.command}</span>
                      <span className="config-metrics-count">{c.count}×</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function IndexContent() {
  const searchParams = useSearchParams();
  // Twitch extension URLs: ?mode=config (configuração) | ?mode=viewer (painel com botões). Também aceita view=config.
  const mode = searchParams.get('mode') ?? searchParams.get('view') ?? '';
  const isConfigView = mode === 'config';

  console.log("QUAL PAGINA ABRIR", mode) 

  if (isConfigView) return <ConfigView />;
  return <PanelPage />;
}

export default function IndexPage() {
  return (
    <Suspense fallback={<LoadingOverlay />}>
      <IndexContent />
    </Suspense>
  );
}
