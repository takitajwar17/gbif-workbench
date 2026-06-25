// Verify demo prompts hide during analysis and reappear only after Clear.
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

    // Step 1: Prompts should be visible on initial load.
    await new Promise(r => setTimeout(r, 800));
    const initialState = await page.evaluate(() => {
      const prompts = document.querySelectorAll('[aria-label="Example research prompts"] button');
      const clearBtn = Array.from(document.querySelectorAll('button')).find(
        b => /Clear current results/i.test(b.textContent)
      );
      return {
        promptCount: prompts.length,
        clearVisible: Boolean(clearBtn),
        hasInterpretedScope: /Interpreted scope/i.test(document.body.innerText),
      };
    });
    console.log('Initial:', JSON.stringify(initialState));
    await page.screenshot({ path: '/tmp/gbif-screenshots/prompts-initial.png' });

    // Step 2: Type a question and click Analyze.
    await page.click('#question');
    await page.type('#question', 'Where are the GBIF record hotspots for fire salamanders (Salamandra salamandra) in Western Europe?', { delay: 10 });
    await new Promise(r => setTimeout(r, 200));
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => /Analyze study/i.test(b.textContent) && !b.disabled
      );
      if (btn) btn.click();
    });

    // Right after click: isBusy=true → prompts hide, Clear hidden (no results yet).
    await new Promise(r => setTimeout(r, 200));
    const afterClick = await page.evaluate(() => {
      const prompts = document.querySelectorAll('[aria-label="Example research prompts"] button');
      const clearBtn = Array.from(document.querySelectorAll('button')).find(
        b => /Clear current results/i.test(b.textContent)
      );
      return {
        promptCount: prompts.length,
        clearVisible: Boolean(clearBtn),
        isAnalyzing: /Analyzing/i.test(document.body.innerText),
      };
    });
    console.log('After Analyze click:', JSON.stringify(afterClick));

    // Step 3: Wait for analysis to complete. Prompts should still be hidden,
    // Clear button should be visible (hasResults=true).
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const ok = await page.evaluate(() => /Matching records/i.test(document.body.innerText));
      if (ok) break;
    }
    await new Promise(r => setTimeout(r, 1500));
    const afterDone = await page.evaluate(() => {
      const prompts = document.querySelectorAll('[aria-label="Example research prompts"] button');
      const clearBtn = Array.from(document.querySelectorAll('button')).find(
        b => /Clear current results/i.test(b.textContent)
      );
      return {
        promptCount: prompts.length,
        clearVisible: Boolean(clearBtn),
        hasInterpretedScope: /Interpreted scope/i.test(document.body.innerText),
      };
    });
    console.log('After analysis:', JSON.stringify(afterDone));
    await page.screenshot({ path: '/tmp/gbif-screenshots/prompts-after-analyze.png' });

    // Step 4: Click Clear. Prompts should reappear.
    const cleared = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => /Clear current results/i.test(b.textContent)
      );
      if (btn) { btn.click(); return true; }
      return false;
    });
    console.log('Clear clicked:', cleared);
    await new Promise(r => setTimeout(r, 500));

    const afterClear = await page.evaluate(() => {
      const prompts = document.querySelectorAll('[aria-label="Example research prompts"] button');
      const clearBtn = Array.from(document.querySelectorAll('button')).find(
        b => /Clear current results/i.test(b.textContent)
      );
      return {
        promptCount: prompts.length,
        clearVisible: Boolean(clearBtn),
        hasInterpretedScope: /Interpreted scope/i.test(document.body.innerText),
      };
    });
    console.log('After Clear:', JSON.stringify(afterClear));
    await page.screenshot({ path: '/tmp/gbif-screenshots/prompts-after-clear.png' });

    // Step 5: Click a demo prompt → prompts should hide immediately.
    const demoClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('[aria-label="Example research prompts"] button'))[0];
      if (btn) { btn.click(); return true; }
      return false;
    });
    console.log('Demo clicked:', demoClicked);
    await new Promise(r => setTimeout(r, 200));
    const afterDemoClick = await page.evaluate(() => {
      const prompts = document.querySelectorAll('[aria-label="Example research prompts"] button');
      return {
        promptCount: prompts.length,
        isAnalyzing: /Analyzing/i.test(document.body.innerText),
      };
    });
    console.log('After demo click (immediately):', JSON.stringify(afterDemoClick));

    console.log('done');
  } catch (e) {
    console.error('err', e.message);
  } finally {
    await browser.close();
  }
})();