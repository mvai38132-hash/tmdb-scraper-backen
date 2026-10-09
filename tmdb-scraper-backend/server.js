// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
};

app.get('/api/get-stream', async (req, res) => {
  const { id, type = 'movie', season = 1, episode = 1 } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'TMDB ID required' });
  }

  // সচল প্রোভাইডারগুলোর লিস্ট (vidsrc.cc & vidsrc.me)
  const providers = type === 'tv' || type === 'series'
    ? [
        `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`,
        `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
        `https://player.autoembed.cc/embed/tv/${id}/${season}/${episode}`
      ]
    : [
        `https://vidsrc.cc/v2/embed/movie/${id}`,
        `https://vidsrc.me/embed/movie?tmdb=${id}`,
        `https://player.autoembed.cc/embed/movie/${id}`
      ];

  // ১. প্রোভাইডার টেস্ট করে ব্যাকএন্ড m3u8 লিংক এক্সট্র্যাক্ট করার চেষ্টা করবে
  for (const embedUrl of providers) {
    try {
      const response = await axios.get(embedUrl, { headers: HEADERS, timeout: 5000 });
      const htmlData = response.data;

      let m3u8Match = htmlData.match(/(https?:\/\/[^"'\s]+\.m3u8[^\s"']*)/i) 
                   || htmlData.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);

      if (m3u8Match && m3u8Match[1]) {
        return res.json({
          success: true,
          mode: 'm3u8',
          streamUrl: m3u8Match[1].replace(/\\/g, ''),
          headers: { 'Referer': embedUrl }
        });
      }
    } catch (e) {
      // সোর্স ডাউন থাকলে পরবর্তী সোর্সে যাবে
      continue;
    }
  }

  // ২. যদি m3u8 ব্লক থাকে, তবে প্রথম সচল প্রোভাইডারের Clean Embed দিয়ে দেবে
  return res.json({
    success: true,
    mode: 'embed',
    embedUrl: providers[0],
    message: 'Playing via working provider embed.'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Scraper active on port ${PORT}`);
});
