// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': '*/*'
};

app.get('/api/get-stream', async (req, res) => {
  const { id, type = 'movie', season = 1, episode = 1 } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'TMDB ID is required' });
  }

  // ১. স্যান্ডবক্সড অ্যাড-ফ্রি এম্বেড প্লেয়ার URL (Fallback)
  const embedFallback = type === 'tv' || type === 'series' 
    ? `https://vidsrc.icu/embed/tv/${id}/${season}/${episode}`
    : `https://vidsrc.icu/embed/movie/${id}`;

  try {
    // ২. সরাসরি m3u8 লিংক এক্সট্র্যাক্ট করার চেষ্টা
    const response = await axios.get(embedFallback, { headers: HEADERS, timeout: 7000 });
    const htmlData = response.data;

    let m3u8Match = htmlData.match(/(https?:\/\/[^"'\s]+\.m3u8[^\s"']*)/i) 
                 || htmlData.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);

    if (m3u8Match && m3u8Match[1]) {
      return res.json({
        success: true,
        mode: 'm3u8',
        streamUrl: m3u8Match[1].replace(/\\/g, ''),
        headers: { 'Referer': 'https://vidsrc.icu/' }
      });
    }

    // ৩. m3u8 ব্লক থাকলে সেফ এম্বেড প্লেয়ার পাঠানো
    return res.json({
      success: true,
      mode: 'embed',
      embedUrl: embedFallback,
      message: 'Direct m3u8 blocked, playing via clean embed.'
    });

  } catch (error) {
    // যেকোনো এররে এম্বেড ফলব্যাক
    return res.json({
      success: true,
      mode: 'embed',
      embedUrl: embedFallback
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Scraper active on port ${PORT}`);
});
