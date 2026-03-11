'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import PanelPage from '@/app/components/PanelPage';

function ConfigView() {
  const [ebsBaseUrl, setEbsBaseUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Twitch?.ext) return;
    try {
      const content = window.Twitch.ext.configuration?.broadcaster?.content;
      if (content) {
        const c = JSON.parse(content);
        if (c.ebsBaseUrl) setEbsBaseUrl(c.ebsBaseUrl);
      }
    } catch (_) {}
  }, []);

  const handleSave = () => {
    if (typeof window === 'undefined' || !window.Twitch?.ext?.configuration?.set) {
      setError('Extensão Twitch não disponível.');
      return;
    }
    setError('');
    try {
      const content = JSON.stringify({ ebsBaseUrl: ebsBaseUrl.trim() || undefined });
      window.Twitch.ext.configuration.set('broadcaster', '1', content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e?.message || 'Erro ao salvar.');
    }
  };

  return (
    <div className="panel-root config-view">
      <div className="panel-header">
        <img src="/assets/icon_100x100.png" alt="" className="panel-header-icon" />
        <h1>Configuração da extensão</h1>
      </div>
      <p className="config-desc">Configure a URL do backend (EBS) se o painel e a API estiverem em origens diferentes. Deixe em branco para usar a mesma origem.</p>
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
        <button type="button" onClick={handleSave} className="config-save-btn">
          Salvar
        </button>
      </div>
      {saved && <p className="config-saved">Configuração salva.</p>}
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}

function IndexContent() {
  const searchParams = useSearchParams();
  const isConfigView =
    searchParams.get('view') === 'config' || searchParams.get('mode') === 'config';

  if (isConfigView) return <ConfigView />;
  return <PanelPage />;
}

export default function IndexPage() {
  return (
    <Suspense fallback={<div className="loading">Carregando...</div>}>
      <IndexContent />
    </Suspense>
  );
}
