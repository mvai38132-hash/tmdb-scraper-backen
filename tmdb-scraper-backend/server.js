// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors'
};

app.get('/api/get-stream', async (req, res) => {
  const { id, type = 'movie', season = 1, episode = 1 } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'TMDB ID required' });
  }

  try {
    let embedUrl = type === 'tv' || type === 'series' 
      ? `https://vidsrc.net/embed/tv/${id}/${season}/${episode}`
      : `https://vidsrc.net/embed/movie/${id}`;

    // ১. প্রিলিমিনারি এম্বেড পেজ ফেচ করা
    const initialRes = await axios.get(embedUrl, { headers: HEADERS });
    const htmlData = initialRes.data;

    // ২. m3u8 বা মেটাস্ট্রিম লিংক Regex দিয়ে খোঁজা
    let m3u8Match = htmlData.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i) 
                 || htmlData.match(/(https?:\/\/[^"'\s]+\.m3u8\?[^"'\s]+)/i)
                 || htmlData.match(/src\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);

    // ৩. যদি সরাসরি না পাওয়া যায়, তবে ব্যাকআপ আইফ্রেম/সোর্স এক্সট্র্যাক্ট করা
    if (!m3u8Match) {
      const iframeMatch = htmlData.match(/src=["'](\/\/vidsrc[^\s"']+)["']/i) || htmlData.match(/iframe\s+src=["']([^"']+)["']/i);
      if (iframeMatch && iframeMatch[1]) {
        let secondUrl = iframeMatch[1].startsWith('//') ? 'https:' + iframeMatch[1] : iframeMatch[1];
        const secondRes = await axios.get(secondUrl, { 
          headers: { ...HEADERS, 'Referer': embedUrl } 
        });
        m3u8Match = secondRes.data.match(/(https?:\/\/[^"'\s]+\.m3u8\?[^"'\s]+)/i)
                 || secondRes.data.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      }
    }

    if (m3u8Match && m3u8Match[1]) {
      return res.json({
        success: true,
        type: type,
        tmdbId: id,
        streamUrl: m3u8Match[1],
        headers: {
          'Referer': 'https://vidsrc.net/',
          'User-Agent': HEADERS['User-Agent']
        }
      });
    }

    return res.status(404).json({ 
      success: false, 
      message: 'Clean m3u8 stream not found. Please verify TMDB ID & Type.' 
    });

  } catch (error) {
    console.error('Extraction error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to extract stream' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Scraper server active on port ${PORT}`);
});
