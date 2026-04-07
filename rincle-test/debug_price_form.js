const { chromium } = require("playwright");
const dotenv = require("dotenv");
dotenv.config();

const BASE_URL = "https://rincle.co.jp/version-test/admin_login";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
console.log("Using:", ADMIN_EMAIL);

// -------------------------------------------------------------------
// Helper: click sidebar menu using jQuery handler pattern
// -------------------------------------------------------------------
async function clickSidebarMenu(page, text) {
  const clicked = await page.evaluate((searchText) => {
    let el = Array.from(document.querySelectorAll(".clickable-element")).find((el) => {
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
      e.target = el;
      e.currentTarget = el;
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

// -------------------------------------------------------------------
// Helper: click a bubble element by text
// -------------------------------------------------------------------
async function clickBubbleElement(page, text) {
  return page.evaluate((searchText) => {
    const el = Array.from(document.querySelectorAll(".clickable-element")).find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.textContent?.trim().includes(searchText);
    });
    if (!el) return false;
    const events = window.jQuery?._data?.(el, "events");
    const handler = events?.click?.[0]?.handler;
    if (handler) {
      const e = window.jQuery.Event("click");
      e.target = el;
      e.currentTarget = el;
      handler.call(el, e);
      return true;
    }
    el.click();
    return true;
  }, text);
}

// -------------------------------------------------------------------
// Helper: login to admin panel
// -------------------------------------------------------------------
async function adminLogin(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const emailField = page.locator('input[type="email"]');
  const isLoginPage = await emailField.isVisible().catch(() => false);

  if (isLoginPage) {
    await emailField.fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.waitForLoadState("networkidle", { timeout: 20000 });
    await page.waitForTimeout(3000);
  }

  await page.getByText("顧客管理").first().waitFor({ state: "visible", timeout: 10000 });
  console.log("[LOGIN] Admin login successful");
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 1) Login
  console.log("\n=== Step 1: Admin Login ===");
  await adminLogin(page);
  console.log("Current URL:", page.url());

  // 2) Navigate to 料金表管理 via sidebar
  console.log("\n=== Step 2: Click 料金表管理 in sidebar ===");
  await clickSidebarMenu(page, "料金表管理");
  console.log("Current URL:", page.url());

  // 3) Click 新規追加 button
  console.log("\n=== Step 3: Click 新規追加 ===");
  const addClicked = await clickBubbleElement(page, "新規追加");
  console.log("新規追加 clicked:", addClicked);
  if (!addClicked) {
    try {
      await page.getByText("新規追加").first().click({ timeout: 5000 });
      console.log("Clicked 新規追加 via getByText fallback");
    } catch (e) {
      console.log("Failed to click 新規追加:", e.message.substring(0, 100));
    }
  }

  // 4) Wait 3 seconds for form/popup to appear
  console.log("\n=== Step 4: Waiting 3 seconds for form to load ===");
  await page.waitForTimeout(3000);

  // 5) Dump ALL form-related elements
  console.log("\n========================================");
  console.log("=== DUMPING ALL FORM ELEMENTS ===");
  console.log("========================================\n");

  const dump = await page.evaluate(() => {
    const result = {};

    function getRect(el) {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
    }

    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && style.opacity !== "0"
        && rect.width > 0
        && rect.height > 0;
    }

    // input elements
    result.inputs = [];
    document.querySelectorAll("input").forEach((el) => {
      result.inputs.push({
        type: el.type,
        placeholder: el.placeholder,
        value: el.value,
        name: el.name,
        id: el.id,
        visible: isVisible(el),
        className: el.className.toString().substring(0, 150),
        rect: getRect(el),
      });
    });

    // textarea elements
    result.textareas = [];
    document.querySelectorAll("textarea").forEach((el) => {
      result.textareas.push({
        placeholder: el.placeholder,
        value: el.value.substring(0, 100),
        name: el.name,
        id: el.id,
        visible: isVisible(el),
        className: el.className.toString().substring(0, 150),
        rect: getRect(el),
      });
    });

    // select elements
    result.selects = [];
    document.querySelectorAll("select").forEach((el) => {
      const options = [];
      el.querySelectorAll("option").forEach((opt) => {
        options.push({ value: opt.value, text: opt.textContent.trim() });
      });
      result.selects.push({
        name: el.name,
        id: el.id,
        visible: isVisible(el),
        className: el.className.toString().substring(0, 150),
        rect: getRect(el),
        selectedValue: el.value,
        options,
      });
    });

    // Bubble custom inputs (.bubble-element.Input)
    result.bubbleInputs = [];
    document.querySelectorAll(".bubble-element.Input").forEach((el) => {
      const innerInput = el.querySelector("input, textarea");
      result.bubbleInputs.push({
        id: el.id,
        className: el.className.toString().substring(0, 150),
        visible: isVisible(el),
        rect: getRect(el),
        innerTag: innerInput ? innerInput.tagName : null,
        innerType: innerInput ? innerInput.type : null,
        innerPlaceholder: innerInput ? innerInput.placeholder : null,
        innerValue: innerInput ? innerInput.value : null,
      });
    });

    // contenteditable elements
    result.contentEditables = [];
    document.querySelectorAll("[contenteditable]").forEach((el) => {
      result.contentEditables.push({
        tag: el.tagName,
        contentEditable: el.contentEditable,
        textContent: el.textContent.substring(0, 100),
        visible: isVisible(el),
        className: el.className.toString().substring(0, 150),
        rect: getRect(el),
      });
    });

    // Popup / modal overlays
    result.popupsAndModals = [];
    document.querySelectorAll('[class*="popup"], [class*="Popup"], [class*="modal"], [class*="Modal"], [class*="overlay"], [class*="Overlay"], [class*="dialog"], [class*="Dialog"]').forEach((el) => {
      const style = window.getComputedStyle(el);
      result.popupsAndModals.push({
        tag: el.tagName,
        id: el.id,
        visible: style.display !== "none" && style.visibility !== "hidden",
        display: style.display,
        className: el.className.toString().substring(0, 200),
        rect: getRect(el),
        childCount: el.children.length,
      });
    });

    // Bubble dropdowns
    result.bubbleDropdowns = [];
    document.querySelectorAll('.bubble-element.Dropdown, [class*="Dropdown"]').forEach((el) => {
      const sel = el.querySelector("select");
      result.bubbleDropdowns.push({
        id: el.id,
        className: el.className.toString().substring(0, 150),
        visible: getRect(el).width > 0,
        rect: getRect(el),
        hasSelect: !!sel,
        selectOptions: sel ? Array.from(sel.options).map((o) => o.textContent.trim()) : [],
      });
    });

    return result;
  });

  console.log("--- INPUTS (" + dump.inputs.length + ") ---");
  console.log(JSON.stringify(dump.inputs, null, 2));

  console.log("\n--- TEXTAREAS (" + dump.textareas.length + ") ---");
  console.log(JSON.stringify(dump.textareas, null, 2));

  console.log("\n--- SELECTS (" + dump.selects.length + ") ---");
  console.log(JSON.stringify(dump.selects, null, 2));

  console.log("\n--- BUBBLE INPUTS (" + dump.bubbleInputs.length + ") ---");
  console.log(JSON.stringify(dump.bubbleInputs, null, 2));

  console.log("\n--- CONTENT EDITABLES (" + dump.contentEditables.length + ") ---");
  console.log(JSON.stringify(dump.contentEditables, null, 2));

  console.log("\n--- POPUPS / MODALS (" + dump.popupsAndModals.length + ") ---");
  console.log(JSON.stringify(dump.popupsAndModals, null, 2));

  console.log("\n--- BUBBLE DROPDOWNS (" + dump.bubbleDropdowns.length + ") ---");
  console.log(JSON.stringify(dump.bubbleDropdowns, null, 2));

  console.log("\n=== Done. Closing in 5 seconds... ===");
  await page.waitForTimeout(5000);
  await browser.close();
})();
