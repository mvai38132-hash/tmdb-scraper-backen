// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive'
};

app.get('/api/get-stream', async (req, res) => {
  const { id, type = 'movie', season = 1, episode = 1 } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'TMDB ID path missing' });
  }

  try {
    // ১. প্রোভাইডার সোর্স URL গঠন
    let targetUrl = '';
    if (type === 'tv' || type === 'series') {
      targetUrl = `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`;
    } else {
      targetUrl = `https://vidsrc.to/embed/movie/${id}`;
    }

    // ২. প্রথম রিকোয়েস্ট ফেচ করা
    const response = await axios.get(targetUrl, { 
      headers: HEADERS,
      timeout: 10000 
    });

    const html = response.data;

    // ৩. m3u8 ফরম্যাট ম্যাচ করা (Direct & Obfuscated Patterns)
    let m3u8Match = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^\s"']*)/i) ||
                    html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                    html.match(/src\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);

    // ৪. যদি সরাসরি না পাওয়া যায়, তবে ইনার সোর্স আইফ্রেম খোঁজা
    if (!m3u8Match) {
      const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframeMatch && iframeMatch[1]) {
        let iframeUrl = iframeMatch[1].startsWith('//') ? 'https:' + iframeMatch[1] : iframeMatch[1];
        
        const iframeRes = await axios.get(iframeUrl, { 
          headers: { ...HEADERS, 'Referer': targetUrl },
          timeout: 10000 
        });

        m3u8Match = iframeRes.data.match(/(https?:\/\/[^"'\s]+\.m3u8[^\s"']*)/i) ||
                    iframeRes.data.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
      }
    }

    if (m3u8Match && m3u8Match[1]) {
      const cleanUrl = m3u8Match[1].replace(/\\/g, ''); // Escape backslashes
      return res.json({
        success: true,
        type: type,
        tmdbId: id,
        streamUrl: cleanUrl,
        headers: {
          'Referer': 'https://vidsrc.to/',
          'User-Agent': HEADERS['User-Agent']
        }
      });
    }

    // ৫. ব্যাকআপ ফলব্যাক সার্ভিস (যদি VidSrc ব্লক করে)
    const fallbackUrl = `https://vidsrc.cc/v2/embed/movie/${id}`;
    const fbRes = await axios.get(fallbackUrl, { headers: HEADERS, timeout: 8000 });
    const fbMatch = fbRes.data.match(/(https?:\/\/[^"'\s]+\.m3u8[^\s"']*)/i);

    if (fbMatch && fbMatch[1]) {
      return res.json({
        success: true,
        type: type,
        tmdbId: id,
        streamUrl: fbMatch[1],
        headers: {
          'Referer': 'https://vidsrc.cc/',
          'User-Agent': HEADERS['User-Agent']
        }
      });
    }

    return res.status(404).json({ 
      success: false, 
      message: 'Stream not found from providers' 
    });

  } catch (error) {
    console.error('Server error:', error.message);
    res.status(500).json({ success: false, error: 'Extraction service failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Scraper active on port ${PORT}`);
});
