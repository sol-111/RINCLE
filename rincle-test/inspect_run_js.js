const { chromium } = require("playwright");
require("dotenv").config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  await page.goto("https://rincle.co.jp/version-5398j", { waitUntil: "networkidle" });
  
  // Get the run.js URL
  const scripts = await page.evaluate(() =>
    Array.from(document.querySelectorAll("script[src]"))
      .map(s => s.src)
      .filter(s => s.includes("run.js"))
  );
  console.log("run.js scripts:", scripts);

  await browser.close();
})();
