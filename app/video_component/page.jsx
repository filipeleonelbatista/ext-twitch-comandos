'use client';

import { useEffect, useState } from 'react';

export default function VideoComponentPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Twitch?.ext) {
      window.Twitch.ext.onAuthorized(() => setReady(true));
    }
  }, []);

  return (
    <div className="video-component-root">
      <img src="/assets/icon_100x100.png" alt="" className="video-component-icon" />
      {ready && <span className="video-component-label">Comandos de áudio</span>}
    </div>
  );
}
