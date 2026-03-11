'use client';

import { useEffect, useState } from 'react';
import LoadingOverlay from '@/app/components/LoadingOverlay';

export default function LiveConfigPage() {
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Twitch?.ext) return;
    window.Twitch.ext.onAuthorized((a) => {
      setAuth(a);
      try {
        sessionStorage.setItem('usermetadata:ext:cololono', JSON.stringify(a));
      } catch (_) {}
    });
  }, []);

  return (
    <div className="panel-root live-config-root">
      <div className="panel-header">
        <img src="/assets/icon_100x100.png" alt="" className="panel-header-icon" />
        <h1>Configuração ao vivo</h1>
      </div>
      {auth && (
        <p className="config-desc">
          Ações executadas pelo streamer durante a live (ex.: criar enquete, ajustes rápidos). Esta página pode ser expandida com mais opções.
        </p>
      )}
      {!auth && <LoadingOverlay />}
    </div>
  );
}
