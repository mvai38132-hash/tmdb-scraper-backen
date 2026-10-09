// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Multi-provider streaming endpoint based on movie-scraper pattern
app.get('/api/get-stream', async (req, res) => {
  const { id, type = 'movie', season = 1, episode = 1, provider = 'vidsrc' } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'TMDB ID required' });
  }

  // প্রোভাইডার এন্ডপয়েন্ট ম্যাপিং
  const providerUrls = {
    vidsrc: type === 'tv' ? `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${season}&episode=${episode}` : `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
    vidlink: type === 'tv' ? `https://vidlink.pro/tv/${id}/${season}/${episode}` : `https://vidlink.pro/movie/${id}`,
    autoembed: type === 'tv' ? `https://player.autoembed.cc/embed/tv/${id}/${season}/${episode}` : `https://player.autoembed.cc/embed/movie/${id}`,
    embedsu: type === 'tv' ? `https://embed.su/embed/tv/${id}/${season}/${episode}` : `https://embed.su/embed/movie/${id}`
  };

  const targetEmbedUrl = providerUrls[provider] || providerUrls['vidsrc'];

  try {
    // সোর্স ফেচ করা
    const response = await axios.get(targetEmbedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://google.com'
      },
      timeout: 8000
    });

    const htmlData = response.data;

    // m3u8 এক্সট্র্যাক্ট করার Regex
    let m3u8Match = htmlData.match(/(https?:\/\/[^"'\s]+\.m3u8[^\s"']*)/i) ||
                    htmlData.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);

    if (m3u8Match && m3u8Match[1]) {
      return res.json({
        success: true,
        mode: 'm3u8',
        streamUrl: m3u8Match[1].replace(/\\/g, ''),
        headers: {
          'Referer': targetEmbedUrl,
          'User-Agent': USER_AGENT
        }
      });
    }

    // Direct HLS না পাওয়া গেলে Clean Embed Fallback
    return res.json({
      success: true,
      mode: 'embed',
      embedUrl: targetEmbedUrl,
      provider: provider
    });

  } catch (error) {
    // ব্যাকএন্ড ফেল করলে পরবর্তী সেরা অটো-ফলব্যাক
    return res.json({
      success: true,
      mode: 'embed',
      embedUrl: providerUrls['autoembed'],
      provider: 'autoembed'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Movie Scraper Server active on port ${PORT}`);
});
