// Verify scrollbars are hidden but scrolling still works.
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle0', timeout: 30000 });

    await page.click('#question');
    await page.type('#question', 'Are kingfisher populations shifting northward in Europe since 2000?');

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => /Analyze study/i.test(b.textContent) && !b.disabled
      );
      if (btn) btn.click();
    });
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const ready = await page.evaluate(
        () =>
          document.body.innerText.includes('workflow ready') ||
          document.body.innerText.includes('usable records')
      );
      if (ready) break;
    }
    await new Promise((r) => setTimeout(r, 1500));

    // 1) Inspect computed scrollbar widths.
    const barWidths = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:absolute;top:-9999px;left:-9999px;width:100px;height:100px;overflow:scroll;';
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe);
      const widths = { offset: probe.offsetWidth, client: probe.clientWidth, diff: probe.offsetWidth - probe.clientWidth };
      probe.remove();
      const html = getComputedStyle(document.documentElement);
      return { probe: widths, scrollbarWidth: html.getPropertyValue('scrollbar-width') };
    });
    console.log('scrollbar metrics:', JSON.stringify(barWidths, null, 2));

    // 2) Confirm the inner panes still scroll.
    const r = await page.evaluate(() => {
      const panes = document.querySelectorAll('[data-pane-scroll]');
      const scope = panes[0];
      const results = panes[1];
      return {
        scope: { sh: scope.scrollHeight, ch: scope.clientHeight, can: scope.scrollHeight > scope.clientHeight },
        results: { sh: results.scrollHeight, ch: results.clientHeight, can: results.scrollHeight > results.clientHeight },
      };
    });
    console.log('pane metrics:', JSON.stringify(r, null, 2));

    // 3) Take a screenshot to visually confirm no scrollbars.
    await page.screenshot({ path: '/tmp/gbif-screenshots/no-scrollbar.png' });
    console.log('screenshot saved');
  } catch (e) {
    console.error('err', e.message);
  } finally {
    await browser.close();
  }
})();