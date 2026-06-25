/** @type {import('next').NextConfig} */
const nextConfig = {
  // 端末内完結（サーバー無し）＆ Capacitor で iOS アプリ化するため静的書き出し
  output: "export",
  images: { unoptimized: true },
  webpack: (config) => {
    // pdf.js が Node 用に optional require する 'canvas' をブラウザビルドから除外
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

module.exports = nextConfig;
