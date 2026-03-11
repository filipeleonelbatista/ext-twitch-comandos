'use client';

export default function AuthSuccessPage() {
  return (
    <div className="panel-root" style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
      <h1 style={{ marginBottom: 12 }}>Autorização concluída</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        Você já pode fechar esta aba e voltar à extensão para enviar comandos no chat com seu nick.
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
