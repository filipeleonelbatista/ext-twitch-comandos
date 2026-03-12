'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  if (error) {
    return (
      <div className="panel-root" style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
        <h1 style={{ marginBottom: 12, color: 'var(--error)' }}>Autorização não concluída</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{error}</p>
        <button
          type="button"
          className="command-btn"
          onClick={() => window.close()}
          style={{ padding: '10px 24px' }}
        >
          Fechar janela
        </button>
      </div>
    );
  }

  return (
    <div className="panel-root" style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
      <h1 style={{ marginBottom: 12 }}>Autorização concluída</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        Conta vinculada. Você já pode fechar esta janela.
      </p>
      <button
        type="button"
        className="command-btn"
        onClick={() => window.close()}
        style={{ padding: '10px 24px' }}
      >
        Fechar janela
      </button>
    </div>
  );
}

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={
      <div className="panel-root" style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
      </div>
    }>
      <AuthSuccessContent />
    </Suspense>
  );
}
