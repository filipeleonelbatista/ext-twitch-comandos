/** @type {import('next').NextConfig} */
const nextConfig = {
  // Panel is loaded in Twitch iframe; same origin for API
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/video_overlay.html', destination: '/video_overlay' },
      { source: '/video_component.html', destination: '/video_component' },
    ];
  },
};

export default nextConfig;
