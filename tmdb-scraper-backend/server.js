const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

app.get('/api/get-stream', async (req, res) => {
  const { id, type = 'movie', season = 1, episode = 1 } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'TMDB ID required' });
  }

  const targetUrl = type === 'tv' || type === 'series'
    ? `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`
    : `https://vidsrc.me/embed/movie?tmdb=${id}`;

  let browser;
  try {
    // Puppeteer Headless Browser Launch
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    let capturedStreamUrl = null;

    // Real-time Network Request Monitor
    page.on('request', request => {
      const url = request.url();
      if (url.includes('.m3u8') && !capturedStreamUrl) {
        capturedStreamUrl = url;
      }
    });

    // Page Load & Wait for HLS traffic
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 15000 });

    if (!capturedStreamUrl) {
      // Background click simulation to trigger video load
      await page.click('body').catch(() => {});
      await page.waitForTimeout(2000);
    }

    await browser.close();

    if (capturedStreamUrl) {
      return res.json({
        success: true,
        streamUrl: capturedStreamUrl,
        headers: {
          'Referer': 'https://vidsrc.me/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
    } else {
      return res.status(404).json({ success: false, message: 'm3u8 request not intercepted' });
    }

  } catch (error) {
    if (browser) await browser.close();
    console.error('Puppeteer Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to extract stream using browser automation' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Scraper active on port ${PORT}`);
});
