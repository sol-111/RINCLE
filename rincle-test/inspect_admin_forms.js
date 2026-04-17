const { chromium } = require("playwright");
const dotenv = require("dotenv");
dotenv.config();

const BASE_URL = "https://rincle.co.jp/version-5398j/admin_login";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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
// Helper: click a bubble element by partial text match
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

  // Check if already logged in (email field not visible)
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

// -------------------------------------------------------------------
// Helper: dump all form elements on the current page
// -------------------------------------------------------------------
async function dumpFormElements(page, label) {
  const result = await page.evaluate((lbl) => {
    const data = { label: lbl, inputs: [], selects: [], textareas: [], checkboxes: [], radios: [], fileUploads: [], dropdowns: [], buttons: [] };

    // Helper: find a nearby label for an element by looking at preceding siblings / parent text
    function findLabel(el) {
      // Check aria-label
      if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
      // Check associated label
      if (el.id) {
        const lbl = document.querySelector(`label[for="${el.id}"]`);
        if (lbl) return lbl.textContent?.trim() || "";
      }
      // Look at parent bubble element for label text
      let parent = el.parentElement;
      for (let i = 0; i < 5 && parent; i++) {
        // Check previous sibling text elements
        let prev = parent.previousElementSibling;
        for (let j = 0; j < 3 && prev; j++) {
          const txt = prev.textContent?.trim() || "";
          if (txt.length > 0 && txt.length < 60 && !txt.includes("\n")) return txt;
          prev = prev.previousElementSibling;
        }
        parent = parent.parentElement;
      }
      return "";
    }

    // Inputs
    document.querySelectorAll("input").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const info = {
        type: el.type,
        name: el.name || "",
        placeholder: el.placeholder || "",
        value: el.value || "",
        id: el.id || "",
        nearbyLabel: findLabel(el),
        className: (el.className || "").substring(0, 60),
      };
      if (el.type === "checkbox") data.checkboxes.push(info);
      else if (el.type === "radio") data.radios.push(info);
      else if (el.type === "file") data.fileUploads.push(info);
      else data.inputs.push(info);
    });

    // Selects
    document.querySelectorAll("select").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const options = Array.from(el.options).map((o) => ({ value: o.value, text: o.textContent?.trim() || "" }));
      data.selects.push({
        name: el.name || "",
        id: el.id || "",
        nearbyLabel: findLabel(el),
        className: (el.className || "").substring(0, 60),
        options,
      });
    });

    // Textareas
    document.querySelectorAll("textarea").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      data.textareas.push({
        name: el.name || "",
        placeholder: el.placeholder || "",
        id: el.id || "",
        nearbyLabel: findLabel(el),
        className: (el.className || "").substring(0, 60),
      });
    });

    // Bubble Dropdowns (custom elements)
    document.querySelectorAll('[class*="Dropdown"], [class*="dropdown"]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const text = el.textContent?.trim().substring(0, 100) || "";
      data.dropdowns.push({
        className: (el.className || "").substring(0, 80),
        text,
        nearbyLabel: findLabel(el),
      });
    });

    // File upload areas (Bubble style)
    document.querySelectorAll('[class*="file"], [class*="upload"], [class*="FileUploader"]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      data.fileUploads.push({
        className: (el.className || "").substring(0, 80),
        text: el.textContent?.trim().substring(0, 80) || "",
        tagName: el.tagName,
      });
    });

    // Rich text editors (contenteditable divs - Bubble uses these)
    document.querySelectorAll('[contenteditable="true"], .ql-editor, [class*="RichTextEditor"], [class*="rich-text"]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      data.textareas.push({
        name: "(rich-text-editor)",
        placeholder: el.getAttribute("data-placeholder") || "",
        id: el.id || "",
        nearbyLabel: findLabel(el),
        className: (el.className || "").substring(0, 60),
      });
    });

    // Buttons
    document.querySelectorAll(".clickable-element, button, [role='button']").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const txt = el.textContent?.trim() || "";
      if (txt.length > 0 && txt.length < 50) {
        data.buttons.push({ text: txt, className: (el.className || "").substring(0, 60), tagName: el.tagName });
      }
    });

    // Deduplicate buttons by text
    const seen = new Set();
    data.buttons = data.buttons.filter((b) => {
      if (seen.has(b.text)) return false;
      seen.add(b.text);
      return true;
    });

    return data;
  }, label);

  console.log("\n" + "=".repeat(70));
  console.log(`[PAGE] ${result.label}`);
  console.log("=".repeat(70));

  if (result.inputs.length > 0) {
    console.log("\n  [INPUTS]");
    result.inputs.forEach((i) => {
      console.log(`    - type="${i.type}" placeholder="${i.placeholder}" label="${i.nearbyLabel}" name="${i.name}" id="${i.id}"`);
    });
  }
  if (result.selects.length > 0) {
    console.log("\n  [SELECTS]");
    result.selects.forEach((s) => {
      console.log(`    - label="${s.nearbyLabel}" name="${s.name}" id="${s.id}" options=[${s.options.map((o) => `"${o.text}"`).join(", ")}]`);
    });
  }
  if (result.textareas.length > 0) {
    console.log("\n  [TEXTAREAS]");
    result.textareas.forEach((t) => {
      console.log(`    - label="${t.nearbyLabel}" placeholder="${t.placeholder}" name="${t.name}" id="${t.id}"`);
    });
  }
  if (result.checkboxes.length > 0) {
    console.log("\n  [CHECKBOXES]");
    result.checkboxes.forEach((c) => {
      console.log(`    - label="${c.nearbyLabel}" name="${c.name}" id="${c.id}" value="${c.value}"`);
    });
  }
  if (result.radios.length > 0) {
    console.log("\n  [RADIOS]");
    result.radios.forEach((r) => {
      console.log(`    - label="${r.nearbyLabel}" name="${r.name}" id="${r.id}" value="${r.value}"`);
    });
  }
  if (result.fileUploads.length > 0) {
    console.log("\n  [FILE UPLOADS]");
    result.fileUploads.forEach((f) => {
      console.log(`    - class="${f.className}" text="${f.text}"`);
    });
  }
  if (result.dropdowns.length > 0) {
    console.log("\n  [DROPDOWNS (Bubble)]");
    result.dropdowns.forEach((d) => {
      console.log(`    - label="${d.nearbyLabel}" class="${d.className}" text="${d.text}"`);
    });
  }
  if (result.buttons.length > 0) {
    console.log("\n  [BUTTONS]");
    result.buttons.forEach((b) => {
      console.log(`    - "${b.text}" (${b.tagName})`);
    });
  }

  if (
    result.inputs.length === 0 &&
    result.selects.length === 0 &&
    result.textareas.length === 0 &&
    result.checkboxes.length === 0 &&
    result.fileUploads.length === 0 &&
    result.dropdowns.length === 0
  ) {
    console.log("\n  (No form elements found on this page)");
  }
}

// -------------------------------------------------------------------
// Helper: try to click a "新規登録" or "追加" button and dump the form
// -------------------------------------------------------------------
async function tryOpenNewForm(page, pageName) {
  for (const btnText of ["新規登録", "新規追加", "追加", "新規作成"]) {
    const clicked = await clickBubbleElement(page, btnText);
    if (clicked) {
      console.log(`\n  >> Clicked "${btnText}" button`);
      await page.waitForTimeout(3000);
      await dumpFormElements(page, `${pageName} - ${btnText}フォーム`);
      return true;
    }
  }
  console.log("\n  >> No 新規登録/追加 button found on this page");
  return false;
}

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------
(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });

  try {
    // =============================================================
    // 1. お知らせ管理
    // =============================================================
    {
      const page = await context.newPage();
      await adminLogin(page);
      await clickSidebarMenu(page, "お知らせ管理");
      await dumpFormElements(page, "お知らせ管理 - 一覧");
      await tryOpenNewForm(page, "お知らせ管理");
      await page.close();
    }

    // =============================================================
    // 2. Q&A管理
    // =============================================================
    {
      const page = await context.newPage();
      await adminLogin(page);
      await clickSidebarMenu(page, "Q&A管理");
      await dumpFormElements(page, "Q&A管理 - 一覧");
      await tryOpenNewForm(page, "Q&A管理");
      await page.close();
    }

    // =============================================================
    // 3. バナー管理
    // =============================================================
    {
      const page = await context.newPage();
      await adminLogin(page);
      await clickSidebarMenu(page, "バナー管理");
      await dumpFormElements(page, "バナー管理 - 一覧");
      await tryOpenNewForm(page, "バナー管理");
      await page.close();
    }

    // =============================================================
    // 4. FV管理
    // =============================================================
    {
      const page = await context.newPage();
      await adminLogin(page);
      await clickSidebarMenu(page, "FV管理");
      await dumpFormElements(page, "FV管理 - 一覧");
      await tryOpenNewForm(page, "FV管理");
      await page.close();
    }

    // =============================================================
    // 5. 顧客一覧 - 検索/フィルタ機能
    // =============================================================
    {
      const page = await context.newPage();
      await adminLogin(page);
      // Default page after login is customer list
      await page.waitForTimeout(2000);
      await dumpFormElements(page, "顧客一覧 - 検索/フィルタ");

      // Try clicking "詳細" button to see customer detail
      const clickedDetail = await clickBubbleElement(page, "詳細");
      if (clickedDetail) {
        console.log("\n  >> Clicked 詳細 button for customer detail");
        await page.waitForTimeout(3000);
        await dumpFormElements(page, "顧客一覧 - 顧客詳細");
      }
      await page.close();
    }

    // =============================================================
    // 6. 加盟店一覧 - 詳細/編集
    // =============================================================
    {
      const page = await context.newPage();
      await adminLogin(page);
      await clickSidebarMenu(page, "加盟店一覧");
      await dumpFormElements(page, "加盟店一覧");

      // Try clicking "詳細" button for store detail
      const clickedDetail = await clickBubbleElement(page, "詳細");
      if (clickedDetail) {
        console.log("\n  >> Clicked 詳細 button for store detail");
        await page.waitForTimeout(3000);
        await dumpFormElements(page, "加盟店一覧 - 加盟店詳細");

        // Try clicking "編集" button if visible on detail page
        const clickedEdit = await clickBubbleElement(page, "編集");
        if (clickedEdit) {
          console.log("\n  >> Clicked 編集 button");
          await page.waitForTimeout(3000);
          await dumpFormElements(page, "加盟店一覧 - 編集フォーム");
        }
      }
      await page.close();
    }

    // =============================================================
    // 7. 料金表管理
    // =============================================================
    {
      const page = await context.newPage();
      await adminLogin(page);
      await clickSidebarMenu(page, "料金表管理");
      await dumpFormElements(page, "料金表管理");

      // Try opening edit/new form
      await tryOpenNewForm(page, "料金表管理");

      // Also try clicking "編集" if available
      const clickedEdit = await clickBubbleElement(page, "編集");
      if (clickedEdit) {
        console.log("\n  >> Clicked 編集 button in 料金表管理");
        await page.waitForTimeout(3000);
        await dumpFormElements(page, "料金表管理 - 編集フォーム");
      }
      await page.close();
    }

    console.log("\n" + "=".repeat(70));
    console.log("[DONE] All pages inspected successfully");
    console.log("=".repeat(70));
  } catch (err) {
    console.error("[ERROR]", err.message);
    console.error(err.stack);
  } finally {
    await browser.close();
  }
})();
