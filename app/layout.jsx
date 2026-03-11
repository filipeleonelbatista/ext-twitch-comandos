import './globals.css';

export const metadata = {
  title: 'Comandos de Áudio – colonogamer',
  description: 'Extensão Twitch – comandos de áudio para o canal colonogamer',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <script src="https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js" async />
      </head>
      <body>{children}</body>
    </html>
  );
}
