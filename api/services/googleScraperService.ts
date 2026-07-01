import { chromium } from 'playwright';

export interface ScrapedReview {
  guestName: string;
  rating: number;
  reviewText: string;
  relativeDate: string;
}

export async function scrapeGoogleMapsReviews(googleMapsUrl: string): Promise<ScrapedReview[]> {
  // Validate URL format
  if (!googleMapsUrl || (!googleMapsUrl.includes('google.com/maps') && !googleMapsUrl.includes('goo.gl/maps'))) {
    throw new Error('invalid_url');
  }

  let browser;
  try {
    // Launch headless browser
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
  } catch (err: any) {
    console.error('Playwright browser launch failed:', err);
    throw new Error('scraper_failed');
  }

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US'
    });
    const page = await context.newPage();

    // Direct to the review page tab in Google Maps by appending parameters
    let targetUrl = googleMapsUrl;
    if (!targetUrl.includes('!9m1!1b1') && !targetUrl.includes('/reviews')) {
      if (targetUrl.includes('?')) {
        targetUrl = targetUrl.replace('?', '?hl=en&') + (targetUrl.endsWith('&') ? '' : '&') + 'data=!9m1!1b1';
      } else {
        targetUrl = targetUrl + (targetUrl.endsWith('/') ? '' : '/') + 'data=!9m1!1b1';
      }
    }

    console.log('[Google Scraper] Navigating to:', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Handle Google Consent Page if displayed
    const acceptCookiesButton = page.locator('form[action*="consent.google.com"] button').first();
    if (await acceptCookiesButton.isVisible()) {
      console.log('[Google Scraper] Accept Cookies form found. Clicking...');
      await acceptCookiesButton.click();
      await page.waitForLoadState('domcontentloaded');
    }

    // Check if Google blocks us or shows Captcha
    const captchaElement = page.locator('iframe[src*="recaptcha"], div#recaptcha, input#recaptcha-token');
    if (await captchaElement.count() > 0 || (await page.title()).includes('Captcha') || (await page.title()).includes('Attention Required')) {
      throw new Error('captcha_or_blocked');
    }

    // Wait for review items selector to render (.jftiEf is the class for Google Maps review block)
    try {
      await page.waitForSelector('.jftiEf', { timeout: 15000 });
    } catch (_) {
      throw new Error('no_reviews_found');
    }

    // Scroll to load reviews
    for (let scrollIdx = 0; scrollIdx < 3; scrollIdx++) {
      await page.evaluate(() => {
        const pane = document.querySelector('.m6QErb[aria-label*="Reviews"], .m6QErb[aria-label*="yorum"], .m6QErb[styles*="overflow-y: scroll"]');
        if (pane) {
          pane.scrollTop = pane.scrollHeight;
        } else {
          window.scrollTo(0, document.body.scrollHeight);
        }
      });
      await page.waitForTimeout(1000);
    }

    const reviewElements = page.locator('.jftiEf');
    const totalCount = await reviewElements.count();
    if (totalCount === 0) {
      throw new Error('no_reviews_found');
    }

    const reviews: ScrapedReview[] = [];
    for (let idx = 0; idx < totalCount; idx++) {
      const el = reviewElements.nth(idx);

      // Guest Name
      const guestName = await el.locator('.d4r55').first().innerText().catch(() => 'Anonymous Guest');

      // Rating score
      const starRatingElement = el.locator('.kvwZbc').first();
      let rating = 5;
      const ariaLabelText = await starRatingElement.getAttribute('aria-label').catch(() => '');
      if (ariaLabelText) {
        const match = ariaLabelText.match(/(\d+)/);
        if (match) {
          rating = parseInt(match[1], 10);
        }
      }

      // Expand review text if it has a "More" button to avoid truncated comments
      const moreButton = el.locator('button:has-text("More"), button:has-text("Daha fazla")').first();
      if (await moreButton.isVisible()) {
        await moreButton.click().catch(() => {});
        await page.waitForTimeout(150);
      }

      // Review text
      const reviewText = await el.locator('.wiI7Te').first().innerText().catch(() => '');

      // Relative review date
      const relativeDate = await el.locator('.rsq5A').first().innerText().catch(() => 'recently');

      reviews.push({
        guestName: guestName.trim(),
        rating,
        reviewText: reviewText.trim(),
        relativeDate: relativeDate.trim()
      });
    }

    return reviews;

  } catch (err: any) {
    const msg = err.message;
    if (['invalid_url', 'captcha_or_blocked', 'no_reviews_found', 'scraper_failed'].includes(msg)) {
      throw err;
    }
    console.error('[Google Scraper] Runtime error:', err);
    throw new Error('scraper_failed');
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
