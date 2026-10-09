// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
};

app.get('/api/get-stream', async (req, res) => {
  const { id, type = 'movie', season = 1, episode = 1 } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'TMDB ID required' });
  }

  try {
    // ১. ব্যাকআপ স্ট্রিমিং প্রোভাইডার্স তালিকা
    let embedUrls = [];
    if (type === 'tv' || type === 'series') {
      embedUrls = [
        `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`,
        `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
        `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`
      ];
    } else {
      embedUrls = [
        `https://vidsrc.cc/v2/embed/movie/${id}`,
        `https://vidsrc.me/embed/movie?tmdb=${id}`,
        `https://vidsrc.xyz/embed/movie?tmdb=${id}`
      ];
    }

    let streamUrl = null;
    let usedReferer = '';

    // ২. প্রতিটি প্রোভাইডার থেকে সোর্স বের করার চেষ্টা করা
    for (const url of embedUrls) {
      try {
        const response = await axios.get(url, { headers: HEADERS, timeout: 5000 });
        const html = response.data;

        // m3u8 লিংক খোঁজার Regex
        const match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^\s"']*)/i) ||
                      html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                      html.match(/src\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);

        if (match && match[1]) {
          streamUrl = match[1].replace(/\\/g, '');
          usedReferer = url;
          break;
        }
      } catch (err) {
        continue; // পরবর্তী প্রোভাইডারে চেষ্টা করবে
      }
    }

    // ৩. রেসপন্স পাঠানো
    if (streamUrl) {
      return res.json({
        success: true,
        type: type,
        tmdbId: id,
        streamUrl: streamUrl,
        headers: {
          'Referer': usedReferer,
          'User-Agent': HEADERS['User-Agent']
        }
      });
    }

    // ৪. যদি কোনো সরাসরি .m3u8 না পাওয়া যায় তবে এম্বেড প্লেয়ার লিংক পাঠানো
    const fallbackEmbed = type === 'tv' 
      ? `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`
      : `https://vidsrc.cc/v2/embed/movie/${id}`;

    return res.json({
      success: true,
      isEmbedFallback: true,
      embedUrl: fallbackEmbed,
      message: 'Direct m3u8 blocked, fallback to clean embed'
    });

  } catch (error) {
    console.error('Extraction error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to process request' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Scraper active on port ${PORT}`);
});
