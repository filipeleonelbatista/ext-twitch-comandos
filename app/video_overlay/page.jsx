'use client';

import { useEffect, useState } from 'react';

export default function VideoOverlayPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Twitch?.ext) {
      window.Twitch.ext.onAuthorized(() => setReady(true));
    }
  }, []);

  return (
    <div className="video-overlay-root">
      <img src="/assets/icon_100x100.png" alt="" className="video-overlay-icon" />
      {ready && <span className="video-overlay-label">Comandos de áudio</span>}
    </div>
  );
}
