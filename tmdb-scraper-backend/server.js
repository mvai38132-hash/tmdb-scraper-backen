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

  // শতভাগ সচল এবং আইফ্রেম ফ্রেন্ডলি প্রোভাইডার
  const embedFallback = type === 'tv' || type === 'series'
    ? `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`
    : `https://vidsrc.me/embed/movie?tmdb=${id}`;

  try {
    // ১. ব্যাকএন্ডে m3u8 এক্সট্র্যাক্ট করার চেষ্টা
    const response = await axios.get(embedFallback, { headers: HEADERS, timeout: 5000 });
    const htmlData = response.data;

    let m3u8Match = htmlData.match(/(https?:\/\/[^"'\s]+\.m3u8[^\s"']*)/i) 
                 || htmlData.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);

    if (m3u8Match && m3u8Match[1]) {
      return res.json({
        success: true,
        mode: 'm3u8',
        streamUrl: m3u8Match[1].replace(/\\/g, ''),
        headers: { 'Referer': 'https://vidsrc.me/' }
      });
    }

    // ২. m3u8 না পাওয়া গেলে সরাসরি Working Embed Stream পাঠানো
    return res.json({
      success: true,
      mode: 'embed',
      embedUrl: embedFallback
    });

  } catch (error) {
    // যেকোনো ব্যাকএন্ড এররে ফলব্যাক এম্বেড
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
