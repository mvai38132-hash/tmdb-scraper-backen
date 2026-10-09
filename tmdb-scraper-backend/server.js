// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// প্রোভাইডার হেডার ডিফাইন করা
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9'
};

// API Endpoint for Movies & TV Series
// Movie Example: /api/get-stream?type=movie&id=550
// TV Series Example: /api/get-stream?type=tv&id=1399&season=1&episode=1
app.get('/api/get-stream', async (req, res) => {
  const { id, type = 'movie', season = 1, episode = 1 } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'TMDB ID required' });
  }

  try {
    let embedUrl = '';
    
    // ১. টাইপ অনুযায়ী থার্ড-পার্টি এম্বেড URL তৈরি
    if (type === 'tv' || type === 'series') {
      embedUrl = `https://vidsrc.net/embed/tv/${id}/${season}/${episode}`;
    } else {
      embedUrl = `https://vidsrc.net/embed/movie/${id}`;
    }

    // ২. থার্ড-পার্টি পেজ ফেচ করা
    const pageResponse = await axios.get(embedUrl, { headers: HEADERS });
    const htmlData = pageResponse.data;

    // ৩. Regex দিয়ে সিক্রেট .m3u8 বা স্ট্রিম লিংক এক্সট্র্যাক্ট করা
    const m3u8Match = htmlData.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i) 
                   || htmlData.match(/(https?:\/\/[^"'\s]+\.m3u8\?[^"'\s]+)/i);

    if (m3u8Match && m3u8Match[1]) {
      let rawM3u8Url = m3u8Match[1];

      return res.json({
        success: true,
        type: type,
        tmdbId: id,
        season: type === 'tv' ? season : null,
        episode: type === 'tv' ? episode : null,
        streamUrl: rawM3u8Url,
        headers: {
          'Referer': 'https://vidsrc.net/',
          'User-Agent': HEADERS['User-Agent']
        }
      });
    }

    res.status(404).json({ success: false, message: 'Clean m3u8 stream not found' });

  } catch (error) {
    console.error('Extraction error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to extract stream' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Scraper server active on port ${PORT}`);
});