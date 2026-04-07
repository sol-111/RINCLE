const { chromium } = require("playwright");
require("dotenv").config();

const BASE_URL = "https://rincle.co.jp/version-test/shop_admin_login";
const STORE_EMAIL = process.env.STORE_EMAIL;
const STORE_PASSWORD = process.env.STORE_PASSWORD;

// Bubble SPA: click sidebar menu using jQuery handler pattern
async function clickSidebarMenu(page, text) {
  const clicked = await page.evaluate((searchText) => {
    let el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.textContent?.trim() === searchText;
    });
    if (!el) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent?.trim() === searchText) {
          el = node.parentElement?.closest(".clickable-element");
          if (!el) el = node.parentElement;
          break;
        }
      }
    }
    if (!el) return false;
    const events = window.jQuery?._data?.(el, "events");
    const handler = events?.click?.[0]?.handler;
    if (handler) {
      const e = window.jQuery.Event("click");
      e.target = el; e.currentTarget = el;
      handler.call(el, e);
      return true;
    }
    el.click();
    return true;
  }, text);

  if (!clicked) {
    await page.getByText(text, { exact: true }).first().click();
  }
  await page.waitForLoadState("networkidle", { timeout: 15000 });
  await page.waitForTimeout(3000);
}

// Click a bubble clickable-element by text (partial match)
async function clickBubbleElement(page, text) {
  return page.evaluate((searchText) => {
    const el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.textContent?.trim().includes(searchText);
    });
    if (!el) return false;
    const events = window.jQuery?._data?.(el, "events");
    const handler = events?.click?.[0]?.handler;
    if (handler) {
      const e = window.jQuery.Event("click");
      e.target = el; e.currentTarget = el;
      handler.call(el, e);
      return true;
    }
    el.click();
    return true;
  }, text);
}

async function storeLogin(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Check if already logged in
  const alreadyLoggedIn = await page.evaluate(() => {
    return document.body.textContent?.includes("顧客管理") ?? false;
  });
  if (alreadyLoggedIn) {
    console.log("--- Already logged in, skipping login ---");
    return;
  }

  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 8000 });
  await page.locator('input[type="email"]').fill(STORE_EMAIL);
  await page.locator('input[type="password"]').fill(STORE_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();

  await page.waitForLoadState("networkidle", { timeout: 20000 });
  await page.waitForTimeout(3000);

  await page.getByText("顧客管理").first().waitFor({ state: "visible", timeout: 10000 });
  console.log("--- Login successful ---");
}

// Dump all form elements on the current page
async function dumpFormElements(page, label) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"=".repeat(60)}`);

  const elements = await page.evaluate(() => {
    const results = [];

    // 1. Input fields
    document.querySelectorAll("input:not([type=hidden])").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const s = window.getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none") return;
      results.push({
        category: "INPUT",
        tag: el.tagName,
        type: el.getAttribute("type") || "text",
        name: el.getAttribute("name") || "",
        placeholder: el.placeholder || "",
        value: el.value || "",
        className: el.className?.toString().substring(0, 80) || "",
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
      });
    });

    // 2. Textareas
    document.querySelectorAll("textarea").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      results.push({
        category: "TEXTAREA",
        tag: el.tagName,
        name: el.getAttribute("name") || "",
        placeholder: el.placeholder || "",
        value: el.value?.substring(0, 100) || "",
        className: el.className?.toString().substring(0, 80) || "",
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
      });
    });

    // 3. Select / Dropdown elements
    document.querySelectorAll("select, .bubble-element.Dropdown").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const options = [];
      if (el.tagName === "SELECT") {
        el.querySelectorAll("option").forEach(o => options.push(o.textContent?.trim()));
      }
      results.push({
        category: "SELECT/DROPDOWN",
        tag: el.tagName,
        name: el.getAttribute("name") || "",
        className: el.className?.toString().substring(0, 80) || "",
        selectedValue: el.value || "",
        options: options.slice(0, 20),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
      });
    });

    // 4. Checkboxes and radios (already covered above, but let's be explicit)
    document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      // Find nearest label text
      let labelText = "";
      const label = el.closest("label") || el.parentElement;
      if (label) labelText = label.textContent?.trim().substring(0, 80) || "";
      results.push({
        category: el.type.toUpperCase(),
        checked: el.checked,
        labelText,
        name: el.getAttribute("name") || "",
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
      });
    });

    // 5. File upload
    document.querySelectorAll('input[type="file"]').forEach(el => {
      const r = el.getBoundingClientRect();
      results.push({
        category: "FILE_UPLOAD",
        accept: el.getAttribute("accept") || "",
        multiple: el.multiple,
        className: el.className?.toString().substring(0, 80) || "",
        visible: r.width > 0 && r.height > 0,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
      });
    });

    // 6. Buttons
    document.querySelectorAll("button, [role=button], .clickable-element").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const s = window.getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none") return;
      const text = el.textContent?.trim().substring(0, 60) || "";
      if (!text) return;
      // Filter to likely action buttons
      if (text.match(/新規登録|追加|編集|登録|保存|削除|更新|キャンセル|閉じる|変更|アップロード|CSV|ダウンロード|検索/)) {
        results.push({
          category: "BUTTON",
          tag: el.tagName,
          text,
          className: el.className?.toString().substring(0, 80) || "",
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
        });
      }
    });

    // 7. Labels / text near form elements
    const labels = [];
    document.querySelectorAll("label, .bubble-element").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const text = el.textContent?.trim();
      if (text && text.length < 50 && text.length > 0 && el.children.length <= 3) {
        // Look for label-like text near inputs
        const nearbyInput = el.querySelector("input, select, textarea");
        if (nearbyInput || el.tagName === "LABEL") {
          labels.push({ text, tag: el.tagName, y: Math.round(r.y) });
        }
      }
    });

    return { formElements: results, labels: labels.slice(0, 30) };
  });

  if (elements.formElements.length === 0) {
    console.log("  (No visible form elements found)");
  } else {
    elements.formElements.forEach(el => {
      console.log(`  [${el.category}] ${JSON.stringify(el)}`);
    });
  }

  if (elements.labels.length > 0) {
    console.log(`\n  --- Nearby Labels ---`);
    elements.labels.forEach(l => console.log(`    ${JSON.stringify(l)}`));
  }

  return elements;
}

// Try to click a button by text to open a form, then dump the new form elements
async function openFormAndDump(page, buttonText, formLabel) {
  console.log(`\n  >>> Attempting to click: "${buttonText}" ...`);
  const clicked = await clickBubbleElement(page, buttonText);
  if (clicked) {
    console.log(`  >>> Clicked "${buttonText}" successfully`);
    await page.waitForTimeout(3000);
    await dumpFormElements(page, formLabel);
  } else {
    console.log(`  >>> Button "${buttonText}" not found or not clickable`);
  }
  return clicked;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  try {
    // ================================================================
    // 1. Bicycle List -> New/Edit Form
    // ================================================================
    await storeLogin(page);
    await clickSidebarMenu(page, "自転車一覧");
    await dumpFormElements(page, "1. 自転車一覧 (list page)");

    // Try to open new registration form
    let opened = await openFormAndDump(page, "新規登録", "1a. 自転車 新規登録フォーム");
    if (!opened) {
      opened = await openFormAndDump(page, "追加", "1a. 自転車 追加フォーム");
    }

    // Close form if opened, try edit
    if (opened) {
      // Try closing via cancel/close button
      await clickBubbleElement(page, "キャンセル");
      await page.waitForTimeout(2000);
      await clickBubbleElement(page, "閉じる");
      await page.waitForTimeout(2000);
    }

    // Try clicking first edit button
    const editClicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.textContent?.trim().includes("編集");
      });
      if (els.length > 0) {
        const el = els[0];
        const events = window.jQuery?._data?.(el, "events");
        const handler = events?.click?.[0]?.handler;
        if (handler) {
          const e = window.jQuery.Event("click");
          e.target = el; e.currentTarget = el;
          handler.call(el, e);
          return true;
        }
        el.click();
        return true;
      }
      return false;
    });
    if (editClicked) {
      console.log("  >>> Clicked edit button on first bicycle");
      await page.waitForTimeout(3000);
      await dumpFormElements(page, "1b. 自転車 編集フォーム");
      await clickBubbleElement(page, "キャンセル");
      await page.waitForTimeout(2000);
      await clickBubbleElement(page, "閉じる");
      await page.waitForTimeout(2000);
    }

    // ================================================================
    // 2. Option Management -> New/Edit Form
    // ================================================================
    await storeLogin(page);
    await clickSidebarMenu(page, "オプション管理");
    await dumpFormElements(page, "2. オプション管理 (list page)");

    opened = await openFormAndDump(page, "新規登録", "2a. オプション 新規登録フォーム");
    if (!opened) {
      opened = await openFormAndDump(page, "追加", "2a. オプション 追加フォーム");
    }
    if (opened) {
      await clickBubbleElement(page, "キャンセル");
      await page.waitForTimeout(2000);
      await clickBubbleElement(page, "閉じる");
      await page.waitForTimeout(2000);
    }

    // Try edit
    const optEditClicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.textContent?.trim().includes("編集");
      });
      if (els.length > 0) {
        const el = els[0];
        const events = window.jQuery?._data?.(el, "events");
        const handler = events?.click?.[0]?.handler;
        if (handler) {
          const e = window.jQuery.Event("click");
          e.target = el; e.currentTarget = el;
          handler.call(el, e);
          return true;
        }
        el.click();
        return true;
      }
      return false;
    });
    if (optEditClicked) {
      console.log("  >>> Clicked edit button on first option");
      await page.waitForTimeout(3000);
      await dumpFormElements(page, "2b. オプション 編集フォーム");
      await clickBubbleElement(page, "キャンセル");
      await page.waitForTimeout(2000);
      await clickBubbleElement(page, "閉じる");
      await page.waitForTimeout(2000);
    }

    // ================================================================
    // 3. Business Hours Settings
    // ================================================================
    await storeLogin(page);
    await clickSidebarMenu(page, "営業時間設定");
    await dumpFormElements(page, "3. 営業時間設定フォーム");

    // ================================================================
    // 4. Business Calendar
    // ================================================================
    await storeLogin(page);
    await clickSidebarMenu(page, "営業カレンダー");
    await dumpFormElements(page, "4. 営業カレンダー");

    // Check for calendar-specific elements
    const calendarInfo = await page.evaluate(() => {
      const results = [];
      // Look for date cells, calendar controls
      document.querySelectorAll(".clickable-element, [class*='calendar'], [class*='Calendar']").forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        const text = el.textContent?.trim().substring(0, 60);
        if (text) {
          results.push({
            tag: el.tagName,
            text,
            className: el.className?.toString().substring(0, 80),
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
          });
        }
      });
      return results.slice(0, 40);
    });
    console.log("\n  --- Calendar Elements ---");
    calendarInfo.forEach(el => console.log(`    ${JSON.stringify(el)}`));

    // ================================================================
    // 5. Store Information Edit Form
    // ================================================================
    await storeLogin(page);
    await clickSidebarMenu(page, "店舗情報");
    await dumpFormElements(page, "5. 店舗情報ページ");

    // Try clicking edit button
    const storeEditClicked = await openFormAndDump(page, "編集", "5a. 店舗情報 編集フォーム");
    if (!storeEditClicked) {
      // Maybe the page is already in edit mode - dump what we see
      console.log("  >>> No separate edit button found - page may already show form fields");
    }

    console.log("\n" + "=".repeat(60));
    console.log("  INSPECTION COMPLETE");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("ERROR:", error.message);
    console.error(error.stack);
  } finally {
    await page.waitForTimeout(5000);
    await browser.close();
  }
})();
