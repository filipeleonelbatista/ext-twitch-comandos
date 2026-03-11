'use client';

import { useSearchParams } from 'next/navigation';

export default function AuthSuccessPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const type = searchParams.get('type');

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
        {type === 'viewer'
          ? 'Você já pode fechar esta aba e voltar à extensão para enviar comandos no chat com seu nick.'
          : 'Conta vinculada. Você já pode fechar esta aba.'}
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
