const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  let apiCalls = 0;
  const apiLog = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/parse-intent') || req.url().includes('/api/study-plan')) {
      apiCalls++;
      apiLog.push(req.method() + ' ' + req.url());
    }
  });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle0', timeout: 30000 });

  async function setQuestion(q) {
    await page.evaluate((value) => {
      const ta = document.querySelector('#question');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, value);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }, q);
    await new Promise((r) => setTimeout(r, 200));
  }

  async function getState() {
    return page.evaluate(() => ({
      analyzing: /Analyzing/i.test(document.body.innerText),
      error: document.querySelector('[role="alert"]')?.innerText || '',
      question: document.querySelector('#question')?.value,
      hasScope: /Interpreted scope/i.test(document.body.innerText),
      hasResults: /Matching records/i.test(document.body.innerText),
    }));
  }

  // Test 1: Type a question, wait 3s, verify NO API calls.
  apiCalls = 0;
  await page.focus('#question');
  await page.keyboard.type('Where are GBIF records of fire salamanders in Europe?', { delay: 20 });
  await new Promise((r) => setTimeout(r, 3000));
  let state = await getState();
  console.log(`[type-and-wait] apiCalls=${apiCalls} analyzing=${state.analyzing} hasScope=${state.hasScope} hasResults=${state.hasResults}`);
  if (apiCalls > 0) console.log('  unexpected calls:', apiLog);

  // Test 2: Press Cmd+Enter, verify NO API calls.
  apiCalls = 0;
  await page.focus('#question');
  await page.keyboard.down('Meta');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Meta');
  await new Promise((r) => setTimeout(r, 1500));
  state = await getState();
  console.log(`[cmd-enter] apiCalls=${apiCalls} analyzing=${state.analyzing}`);

  // Test 3: Click Analyze study → should fire.
  apiCalls = 0;
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      b => /Analyze study/i.test(b.textContent) && !b.disabled
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  state = await getState();
  console.log(`[click-analyze] apiCalls=${apiCalls} analyzing=${state.analyzing}`);
  if (apiCalls > 0) console.log('  calls:', apiLog);

  // Wait for analysis to finish before next test.
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const done = await page.evaluate(() => /Matching records/i.test(document.body.innerText));
    if (done) break;
  }
  await new Promise((r) => setTimeout(r, 800));

  // Test 4: After results are loaded, type a new question, wait 3s.
  // Old behavior would wipe results immediately and NOT auto-analyze (good).
  apiCalls = 0;
  await setQuestion('How are monarch butterflies changing in North America?');
  await new Promise((r) => setTimeout(r, 3000));
  state = await getState();
  console.log(`[type-after-results] apiCalls=${apiCalls} analyzing=${state.analyzing} hasResults=${state.hasResults} question="${state.question?.substring(0, 50)}..."`);

  // Test 5: Demo prompt click — should NOT fire any API.
  await new Promise((r) => setTimeout(r, 1500));
  apiCalls = 0;
  // Reload to get a clean state for demo prompt test.
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => /Clear current results/i.test(b.textContent));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  apiCalls = 0;
  await page.evaluate(() => {
    const btn = document.querySelector('[aria-label="Example research prompts"] button');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2500));
  state = await getState();
  console.log(`[demo-click] apiCalls=${apiCalls} analyzing=${state.analyzing} question="${state.question?.substring(0, 50)}..."`);

  await browser.close();
})();