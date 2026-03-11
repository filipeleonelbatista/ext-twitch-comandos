'use client';

export default function LoadingOverlay() {
  return (
    <div className="loading-overlay" role="status" aria-label="Carregando">
      <div className="loading-overlay__content">
        <img
          src="/assets/icon_100x100.png"
          alt=""
          className="loading-overlay__logo"
        />
        <span className="loading-overlay__text">Carregando</span>
      </div>
    </div>
  );
}
