import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const allowedBots = [
    '*',
    'OAI-SearchBot',
    'ChatGPT-User',
    'GPTBot',
    'Claude-SearchBot',
    'Claude-User',
    'ClaudeBot',
    'PerplexityBot',
    'Perplexity-User',
    'Googlebot',
    'Google-Extended',
  ];

  return {
    rules: allowedBots.map((userAgent) => ({
      userAgent,
      allow: '/',
    })),
    sitemap: 'https://www.mapmycareer.online/sitemap.xml',
  };
}
