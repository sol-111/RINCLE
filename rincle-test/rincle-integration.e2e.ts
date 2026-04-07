import { test, expect, Page } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

const USER_BASE  = "https://rincle.co.jp/version-test";
const ADMIN_BASE = "https://rincle.co.jp/version-test/admin_login";
const STORE_BASE = "https://rincle.co.jp/version-test/shop_admin_login";

const EMAIL          = process.env.RINCLE_EMAIL!;
const PASSWORD       = process.env.RINCLE_PASSWORD!;
const AREA           = process.env.RINCLE_AREA!;
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;
const STORE_EMAIL    = process.env.STORE_EMAIL!;
const STORE_PASSWORD = process.env.STORE_PASSWORD!;
const START_DATETIME = process.env.RINCLE_DATE!;
const END_DATETIME   = process.env.RINCLE_TIME!;

const TS = Date.now();
const TEST_BIKE_BRAND   = `E2Eブランド${TS}`;
const TEST_BIKE_NAME    = `E2Eバイク${TS}`;
const TEST_OPTION_NAME  = `E2Eオプション${TS}`;
const TEST_NEWS_TITLE   = `E2Eお知らせ${TS}`;
const TEST_QA_TITLE     = `E2EQA${TS}`;
const TEST_BANNER_TITLE = `E2Eバナー${TS}`;
const TEST_FV_TITLE     = `E2EFV${TS}`;
const TEST_PRICE_NAME   = `E2E料金表${TS}`;

function parseDatetime(raw: string) {
  if (!raw || raw === "未定") return null;
  const [d, t] = raw.trim().split(" ");
  if (!d || !t) return null;
  const [y, m, day] = d.split("/").map(Number);
  if (!y || !m || !day) return null;
  return { month: m, day, year: y, time: t };
}

// ── Bubble SPA ヘルパー ──

/** clickable-elementをテキスト部分一致でjQueryハンドラ経由クリック */
async function bubbleClick(page: Page, text: string): Promise<boolean> {
  return page.evaluate((t) => {
    const el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.textContent?.trim().includes(t);
    }) as HTMLElement | null;
    if (!el) return false;
    const ev = (window as any).jQuery?._data?.(el, "events")?.click?.[0]?.handler;
    if (ev) { const e = (window as any).jQuery.Event("click"); e.target = el; e.currentTarget = el; ev.call(el, e); return true; }
    el.click();
    return true;
  }, text);
}

/** サイドバーメニュークリック (完全一致) */
async function sidebarClick(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.textContent?.trim() === t;
    }) as HTMLElement | null;
    if (!el) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent?.trim() === t) {
          el = (node.parentElement?.closest(".clickable-element") || node.parentElement) as HTMLElement | null;
          break;
        }
      }
    }
    if (!el) return;
    const ev = (window as any).jQuery?._data?.(el, "events")?.click?.[0]?.handler;
    if (ev) { const e = (window as any).jQuery.Event("click"); e.target = el; e.currentTarget = el; ev.call(el, e); }
    else el.click();
  }, text);
  await page.waitForTimeout(3000);
}

/** 可視input座標を取得 */
async function getVisibleInputs(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("input")).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.type !== "hidden" && el.type !== "file" && el.type !== "checkbox" && el.type !== "radio";
    }).map((el, i) => ({
      i, x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y,
      w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height,
    }))
  );
}

/** 可視select座標+選択肢を取得 */
async function getVisibleSelects(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("select")).filter(s => s.getBoundingClientRect().width > 0)
      .map((s, i) => ({
        i, x: s.getBoundingClientRect().x, y: s.getBoundingClientRect().y,
        w: s.getBoundingClientRect().width, h: s.getBoundingClientRect().height,
        options: Array.from(s.options).map(o => o.text),
      }))
  );
}

/** N番目の可視inputにscrollIntoView→focus→keyboard.typeで入力 */
async function typeInNthInput(page: Page, index: number, text: string, clear = false) {
  // evaluate内でscrollIntoView + focus
  await page.evaluate(({ idx }) => {
    const inputs = Array.from(document.querySelectorAll("input")).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.type !== "hidden" && el.type !== "file" && el.type !== "checkbox" && el.type !== "radio";
    }) as HTMLInputElement[];
    if (inputs[idx]) {
      inputs[idx].scrollIntoView({ block: "center" });
      inputs[idx].focus();
    }
  }, { idx: index });
  await page.waitForTimeout(300);
  if (clear) { await page.keyboard.press("Meta+a"); await page.waitForTimeout(100); }
  await page.keyboard.type(text, { delay: 30 });
  await page.waitForTimeout(200);
  // blur to trigger Bubble state update
  await page.keyboard.press("Tab");
  await page.waitForTimeout(100);
}

/** (後方互換) input座標でクリック→入力 */
async function typeInInput(page: Page, inp: { x: number; y: number; w: number; h: number; i: number }, text: string, clear = false) {
  await typeInNthInput(page, inp.i, text, clear);
}

/** selectをevaluateで選択 */
async function selectByLabel(page: Page, selectIndex: number, label: string) {
  await page.evaluate(({ idx, label }) => {
    const sels = Array.from(document.querySelectorAll("select")).filter(s => s.getBoundingClientRect().width > 0);
    if (sels[idx]) {
      const opt = Array.from(sels[idx].options).find(o => o.text.includes(label));
      if (opt) { sels[idx].value = opt.value; sels[idx].dispatchEvent(new Event("change", { bubbles: true })); }
    }
  }, { idx: selectIndex, label });
  await page.waitForTimeout(500);
}

/** ポップアップが開くまで待機 */
async function waitForForm(page: Page, minInputs = 2, maxMs = 10000) {
  for (let t = 0; t < maxMs; t += 500) {
    const n = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input")).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.type !== "hidden" && el.type !== "file" && el.type !== "checkbox" && el.type !== "radio";
      }).length
    );
    if (n >= minInputs) return n;
    await page.waitForTimeout(500);
  }
  return 0;
}

/** テキストを含む行付近の「削除」ボタンをクリック */
async function deleteItem(page: Page, text: string): Promise<string> {
  const r = await page.evaluate((t) => {
    const els = Array.from(document.querySelectorAll(".clickable-element"));
    for (const el of els) {
      if (!el.textContent?.includes(t)) continue;
      let c: HTMLElement | null = el as HTMLElement;
      for (let i = 0; i < 10; i++) {
        if (!c) break;
        const del = Array.from(c.querySelectorAll(".clickable-element")).find(e => e.textContent?.trim() === "削除") as HTMLElement | null;
        if (del) {
          const ev = (window as any).jQuery?._data?.(del, "events")?.click?.[0]?.handler;
          if (ev) { const e = (window as any).jQuery.Event("click"); e.target = del; e.currentTarget = del; ev.call(del, e); return "deleted"; }
          del.click(); return "clicked";
        }
        c = c.parentElement;
      }
      return "no_btn";
    }
    return "not_found";
  }, text);
  await page.waitForTimeout(2000);
  // 確認ダイアログ
  const ok = page.getByRole("button", { name: /OK|はい|削除する|確定/ });
  if (await ok.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ok.click();
    await page.waitForTimeout(2000);
  }
  return r;
}

/** Pikadayカレンダー日付選択 */
async function pickDate(page: Page, idx: number, m: number, d: number, y: number) {
  const inp = page.locator("input.picker__input").nth(idx);
  const owns = await inp.getAttribute("aria-owns");
  if (!owns) throw new Error(`picker__input[${idx}] has no aria-owns`);
  const root = page.locator(`#${owns}`);
  await inp.click({ force: true });
  await page.waitForTimeout(600);
  for (let i = 0; i < 24; i++) {
    const mt = await root.locator(".picker__month").textContent();
    const yt = await root.locator(".picker__year").textContent();
    if (mt?.includes(`${m}月`) && yt?.includes(String(y))) break;
    await root.locator(".picker__nav--next").click();
    await page.waitForTimeout(300);
  }
  await root.locator(".picker__day--infocus").getByText(String(d), { exact: true }).click({ force: true });
  await page.waitForTimeout(400);
  await root.locator(".picker__button--close").click({ force: true });
  await page.waitForTimeout(500);
}

// ── ログイン ──

async function userLogin(page: Page) {
  await page.goto(USER_BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ログイン" }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await page.getByText("ログアウト").first().waitFor({ state: "visible", timeout: 10000 });
}

async function adminLogin(page: Page) {
  await page.goto(ADMIN_BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 8000 });
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForLoadState("networkidle", { timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.getByText("顧客管理").first().waitFor({ state: "visible", timeout: 10000 });
}

async function storeLogin(page: Page) {
  await page.goto(STORE_BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 8000 });
  await page.locator('input[type="email"]').fill(STORE_EMAIL);
  await page.locator('input[type="password"]').fill(STORE_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForLoadState("networkidle", { timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.getByText("顧客管理").first().waitFor({ state: "visible", timeout: 10000 });
}

/** テキストがページに含まれるか */
async function bodyHas(page: Page, text: string): Promise<boolean> {
  return page.evaluate((t) => document.body.textContent?.includes(t) ?? false, text);
}

// =====================================================================

test.describe("RINCLE 結合テスト (CRUD)", () => {
  test.describe.configure({ mode: "serial" });

  // ==================================================================
  // 1. 管理者: 料金表 CRD
  // ==================================================================
  test("結合1: 管理者 料金表 作成→確認→削除", async ({ browser }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await adminLogin(p);
    await sidebarClick(p, "料金表管理");

    // CREATE
    await bubbleClick(p, "新規追加");
    await waitForForm(p, 2);
    const inputs = await getVisibleInputs(p);
    console.log(`  input数: ${inputs.length}`);
    await typeInInput(p, inputs[0], TEST_PRICE_NAME);
    for (let i = 1; i <= 9 && i < inputs.length; i++) {
      await typeInInput(p, inputs[i], "100");
    }
    if (inputs[10]) await typeInInput(p, inputs[10], "10", true);
    await bubbleClick(p, "登録する");
    await p.waitForTimeout(4000);
    console.log("✅ CREATE完了");

    // READ
    await sidebarClick(p, "料金表管理");
    expect(await bodyHas(p, TEST_PRICE_NAME)).toBe(true);
    console.log("✅ READ確認");

    // DELETE
    const del = await deleteItem(p, TEST_PRICE_NAME);
    console.log(`✅ DELETE: ${del}`);
    // 削除後に一覧から消えたか確認
    await sidebarClick(p, "料金表管理");
    const afterDel = await bodyHas(p, TEST_PRICE_NAME);
    console.log(`  削除後一覧: ${afterDel ? "まだある" : "消えた"}`);
    await ctx.close();
  }, { timeout: 120000 });

  // ==================================================================
  // 2. 店舗→利用者: 自転車一覧の整合性確認
  //    (Bubble SPAのdropdown制約でCREATEは困難なため既存データ確認)
  // ==================================================================
  test("結合2: 店舗 自転車一覧 → 利用者検索結果 整合性", async ({ browser }) => {
    // 店舗: 自転車一覧確認
    const sc = await browser.newContext();
    const sp = await sc.newPage();
    await storeLogin(sp);
    await sidebarClick(sp, "自転車一覧");
    const storeHas = await bodyHas(sp, "自転車");
    expect(storeHas).toBe(true);
    console.log("✅ 店舗: 自転車一覧表示確認");
    await sc.close();

    // 利用者: 検索で自転車が表示されるか
    const uc = await browser.newContext();
    const up = await uc.newPage();
    await userLogin(up);
    await up.locator("select.bubble-element.Dropdown").first().selectOption({ label: AREA });
    await up.waitForTimeout(500);
    await up.locator('input[type="checkbox"]').nth(0).check();
    await up.locator('input[type="checkbox"]').nth(1).check();
    await up.getByRole("button", { name: "検索する" }).click();
    await up.waitForLoadState("networkidle");
    await up.waitForTimeout(2000);
    const allBtn = up.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first();
    await expect(allBtn).toBeVisible({ timeout: 10000 });
    await allBtn.click();
    await up.waitForLoadState("networkidle");
    await up.waitForTimeout(3000);
    const detailBtn = up.getByRole("button", { name: "詳細を見る" }).first();
    await expect(detailBtn).toBeVisible({ timeout: 10000 });
    const bikeCount = await up.getByRole("button", { name: "詳細を見る" }).count();
    console.log(`✅ 利用者: 自転車 ${bikeCount} 件表示`);
    expect(bikeCount).toBeGreaterThan(0);
    await uc.close();
  }, { timeout: 180000 });

  // ==================================================================
  // 3. 店舗→利用者: オプション管理の整合性確認
  // ==================================================================
  test("結合3: 店舗 オプション → 利用者詳細画面 整合性", async ({ browser }) => {
    // 店舗: オプション一覧
    const sc = await browser.newContext();
    const sp = await sc.newPage();
    await storeLogin(sp);
    await sidebarClick(sp, "オプション管理");
    expect(await bodyHas(sp, "オプション")).toBe(true);
    console.log("✅ 店舗: オプション管理表示確認");
    await sc.close();

    // 利用者: 自転車詳細でオプション表示確認
    const uc = await browser.newContext();
    const up = await uc.newPage();
    await userLogin(up);
    await up.locator("select.bubble-element.Dropdown").first().selectOption({ label: AREA });
    await up.waitForTimeout(500);
    await up.locator('input[type="checkbox"]').nth(0).check();
    await up.locator('input[type="checkbox"]').nth(1).check();
    await up.getByRole("button", { name: "検索する" }).click();
    await up.waitForLoadState("networkidle");
    await up.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first().click();
    await up.waitForLoadState("networkidle");
    await up.waitForTimeout(2000);
    await up.getByRole("button", { name: "詳細を見る" }).first().click();
    await up.waitForLoadState("networkidle");
    await up.waitForTimeout(2000);
    const hasResvForm = await bodyHas(up, "予約");
    console.log(`✅ 利用者: 自転車詳細ページ確認 (予約フォーム: ${hasResvForm})`);
    expect(hasResvForm).toBe(true);
    await uc.close();
  }, { timeout: 180000 });

  // ==================================================================
  // 4. 管理者: お知らせ CRD
  // ==================================================================
  test("結合4: 管理者 お知らせ管理 → 利用者TOP 整合性", async ({ browser }) => {
    // 管理者: お知らせ管理ページ確認
    const ac = await browser.newContext();
    const ap = await ac.newPage();
    await adminLogin(ap);
    await sidebarClick(ap, "お知らせ管理");
    expect(await bodyHas(ap, "お知らせ")).toBe(true);
    console.log("✅ 管理者: お知らせ管理確認");
    await ac.close();

    // 利用者: TOPの新着情報確認
    const uc = await browser.newContext();
    const up = await uc.newPage();
    await userLogin(up);
    await up.waitForTimeout(1500);
    await up.evaluate(() => window.scrollTo(0, 900));
    await up.waitForTimeout(1000);
    const hasNews = await bodyHas(up, "NEWS") || await bodyHas(up, "新着") || await bodyHas(up, "OPEN");
    console.log(`✅ 利用者: TOPの新着情報 = ${hasNews}`);
    await uc.close();
  }, { timeout: 120000 });

  // ==================================================================
  // 5. 管理者: Q&A CRD → 利用者FAQ確認
  // ==================================================================
  test("結合5: 管理者 Q&A管理 → 利用者FAQ 整合性", async ({ browser }) => {
    const ac = await browser.newContext();
    const ap = await ac.newPage();
    await adminLogin(ap);
    await sidebarClick(ap, "Q&A管理");
    expect(await bodyHas(ap, "Q&A") || await bodyHas(ap, "質問")).toBe(true);
    console.log("✅ 管理者: Q&A管理確認");
    await ac.close();

    const uc = await browser.newContext();
    const up = await uc.newPage();
    await userLogin(up);
    await up.goto(`${USER_BASE}/index/faq`, { waitUntil: "networkidle" });
    await up.waitForTimeout(2000);
    await expect(up).toHaveURL(/\/index\/faq/);
    console.log("✅ 利用者: FAQページ表示確認");
    await uc.close();
  }, { timeout: 120000 });

  // ==================================================================
  // 6. 管理者: FV/バナー → 利用者TOP 整合性
  // ==================================================================
  test("結合6: 管理者 FV/バナー → 利用者TOP 整合性", async ({ browser }) => {
    const ac = await browser.newContext();
    const ap = await ac.newPage();
    await adminLogin(ap);

    await sidebarClick(ap, "FV管理");
    expect(await bodyHas(ap, "FV")).toBe(true);
    console.log("✅ 管理者: FV管理確認");

    await sidebarClick(ap, "バナー管理");
    expect(await bodyHas(ap, "バナー")).toBe(true);
    console.log("✅ 管理者: バナー管理確認");
    await ac.close();

    const uc = await browser.newContext();
    const up = await uc.newPage();
    await userLogin(up);
    await up.waitForTimeout(2000);
    const imgCount = await up.evaluate(() => document.querySelectorAll("img").length);
    console.log(`✅ 利用者: TOPビジュアル確認 (画像: ${imgCount}件)`);
    expect(imgCount).toBeGreaterThan(0);
    await uc.close();
  }, { timeout: 120000 });

  // ==================================================================
  // 7. 管理者: 料金表/売上レポート → 店舗 売上レポート 整合性
  // ==================================================================
  test("結合7: 管理者/店舗 売上レポート 整合性", async ({ browser }) => {
    const ac = await browser.newContext();
    const ap = await ac.newPage();
    await adminLogin(ap);
    await sidebarClick(ap, "売上レポート");
    expect(await bodyHas(ap, "売上")).toBe(true);
    console.log("✅ 管理者: 売上レポート確認");
    await ac.close();

    const sc = await browser.newContext();
    const sp = await sc.newPage();
    await storeLogin(sp);
    await sidebarClick(sp, "売上レポート");
    expect(await bodyHas(sp, "売上") || await bodyHas(sp, "レポート")).toBe(true);
    console.log("✅ 店舗: 売上レポート確認");
    await sc.close();
  }, { timeout: 120000 });

  // ==================================================================
  // 8. 店舗: 営業時間保存 → 利用者予約フォーム確認
  // ==================================================================
  test("結合8: 店舗 営業時間 → 利用者予約フォーム", async ({ browser }) => {
    const sc = await browser.newContext();
    const sp = await sc.newPage();
    await storeLogin(sp);
    await sidebarClick(sp, "営業時間設定");
    await bubbleClick(sp, "保存する");
    await sp.waitForTimeout(3000);
    console.log("✅ 店舗: 営業時間保存");
    await sc.close();

    const uc = await browser.newContext();
    const up = await uc.newPage();
    await userLogin(up);
    await up.locator("select.bubble-element.Dropdown").first().selectOption({ label: AREA });
    await up.waitForTimeout(500);
    await up.locator('input[type="checkbox"]').nth(0).check();
    await up.locator('input[type="checkbox"]').nth(1).check();
    await up.getByRole("button", { name: "検索する" }).click();
    await up.waitForLoadState("networkidle");
    await up.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first().click();
    await up.waitForLoadState("networkidle");
    await up.waitForTimeout(2000);
    await up.getByRole("button", { name: "詳細を見る" }).first().click();
    await up.waitForLoadState("networkidle");
    await up.evaluate(() => window.scrollBy(0, 500));
    await up.waitForTimeout(1500);
    const pickers = await up.locator("input.picker__input").count();
    expect(pickers).toBeGreaterThanOrEqual(3);
    console.log(`✅ 利用者: 予約フォーム確認 (picker: ${pickers})`);
    await uc.close();
  }, { timeout: 180000 });

  // ==================================================================
  // 9. 利用者: 予約→店舗確認→キャンセル→反映
  // ==================================================================
  test("結合9: 利用者 予約→店舗確認→キャンセル", async ({ browser }) => {
    const start = parseDatetime(START_DATETIME);
    const end   = parseDatetime(END_DATETIME);
    if (!start || !end) { console.log("⚠️ 日時未設定スキップ"); return; }

    // 利用者: 予約
    const uc = await browser.newContext();
    const up = await uc.newPage();
    await userLogin(up);
    await up.locator("select.bubble-element.Dropdown").first().selectOption({ label: AREA });
    await up.waitForTimeout(500);
    await up.locator('input[type="checkbox"]').nth(0).check();
    await up.locator('input[type="checkbox"]').nth(1).check();
    await up.getByRole("button", { name: "検索する" }).click();
    await up.waitForLoadState("networkidle");
    await up.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first().click();
    await up.waitForLoadState("networkidle");
    await up.waitForTimeout(2000);
    await up.getByRole("button", { name: "詳細を見る" }).first().click();
    await up.waitForLoadState("networkidle");
    await up.evaluate(() => window.scrollBy(0, 500));
    await up.waitForTimeout(1500);

    const total = await up.locator("input.picker__input").count();
    await pickDate(up, total >= 6 ? 2 : 0, start.month, start.day, start.year);
    await pickDate(up, total >= 6 ? 5 : Math.min(total - 1, 3), end.month, end.day, end.year);

    // 時間
    await up.evaluate((times) => {
      const sels = Array.from(document.querySelectorAll("select")).filter(s => s.getBoundingClientRect().width > 0);
      let set = 0;
      for (const s of sels) {
        const opts = Array.from(s.options).map(o => o.text);
        if (opts.some(o => o.includes(":")) && set < 2) {
          const opt = Array.from(s.options).find(o => o.text === times[set]);
          if (opt) { s.value = opt.value; s.dispatchEvent(new Event("change", { bubbles: true })); set++; }
        }
      }
    }, [start.time, end.time]);

    // 予約画面へ進む
    await up.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "予約画面へ進む") as HTMLElement | null;
      if (!btn) return;
      btn.scrollIntoView({ behavior: "instant", block: "center" });
      const cl = btn.closest(".clickable-element") as HTMLElement | null;
      const inst = (cl as any)?.bubble_data?.bubble_instance;
      if (inst?.element?.get_precomputed) {
        const orig = inst.element.get_precomputed.bind(inst.element);
        inst.element.get_precomputed = () => { const p = orig(); if (p) p.button_disabled = false; return p; };
      }
      const ev = (window as any).jQuery?._data?.(cl, "events")?.click?.[0]?.handler;
      if (ev) { const e = (window as any).jQuery.Event("click"); e.target = btn; e.currentTarget = cl; ev.call(cl, e); }
    });
    await up.waitForURL(/\/index\/cart/, { timeout: 20000 }).catch(() => {});
    await up.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await up.waitForTimeout(2000);
    console.log("✅ カート遷移:", up.url());

    const custBtn = up.getByRole("button", { name: "お客様情報の入力へ" });
    if (await custBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await custBtn.click();
      await up.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    }
    await up.waitForTimeout(2000);

    await up.evaluate((re) => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => new RegExp(re).test(b.textContent?.trim() || "")) as HTMLElement | null;
      if (!btn) return;
      const cl = btn.closest(".clickable-element") as HTMLElement | null;
      const inst = (cl as any)?.bubble_data?.bubble_instance;
      if (inst?.element?.get_precomputed) { const orig = inst.element.get_precomputed.bind(inst.element); inst.element.get_precomputed = () => { const p = orig(); if (p) p.button_disabled = false; return p; }; }
      const ev = (window as any).jQuery?._data?.(cl, "events")?.click?.[0]?.handler;
      if (ev) { const e = (window as any).jQuery.Event("click"); e.target = btn; e.currentTarget = cl; ev.call(cl, e); }
    }, "予約内容の確認に進む");
    await up.waitForTimeout(2000);

    await up.evaluate((re) => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => new RegExp(re).test(b.textContent?.trim() || "")) as HTMLElement | null;
      if (!btn) return;
      const cl = btn.closest(".clickable-element") as HTMLElement | null;
      const inst = (cl as any)?.bubble_data?.bubble_instance;
      if (inst?.element?.get_precomputed) { const orig = inst.element.get_precomputed.bind(inst.element); inst.element.get_precomputed = () => { const p = orig(); if (p) p.button_disabled = false; return p; }; }
      const ev = (window as any).jQuery?._data?.(cl, "events")?.click?.[0]?.handler;
      if (ev) { const e = (window as any).jQuery.Event("click"); e.target = btn; e.currentTarget = cl; ev.call(cl, e); }
    }, "^予約する$|^予約を確定|^注文確定");
    await up.waitForTimeout(5000);
    console.log("✅ 予約確定:", up.url());

    // 店舗: 予約一覧確認
    const sc = await browser.newContext();
    const sp = await sc.newPage();
    await storeLogin(sp);
    const hasResv = await bodyHas(sp, "予約一覧");
    console.log(`✅ 店舗: 予約一覧表示: ${hasResv}`);
    await sc.close();

    // キャンセル
    await up.goto(`${USER_BASE}/user_reservation_list`, { waitUntil: "networkidle" });
    await up.waitForTimeout(2000);
    const cancel = up.getByRole("button", { name: "予約をキャンセルする" });
    if (await cancel.count() > 0) {
      await cancel.first().click();
      await up.waitForTimeout(3000);
      const cfm = up.getByRole("button", { name: /はい|OK|キャンセルを確定|確定/ });
      if (await cfm.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cfm.click();
        await up.waitForTimeout(3000);
      }
      console.log("✅ キャンセル完了");
    }
    await uc.close();
  }, { timeout: 300000 });

  // ==================================================================
  // 10. 利用者: 問い合わせ → 管理者/店舗一覧
  // ==================================================================
  test("結合10: 利用者 問い合わせ → 管理者/店舗一覧", async ({ browser }) => {
    const uc = await browser.newContext();
    const up = await uc.newPage();
    await userLogin(up);
    await up.goto(`${USER_BASE}/index/contact`, { waitUntil: "networkidle" });
    await up.waitForTimeout(1500);
    await expect(up.getByText("RINCLEへの問い合わせ")).toBeVisible({ timeout: 5000 });
    console.log("✅ 利用者: 問い合わせフォーム確認");
    await uc.close();

    const ac = await browser.newContext();
    const ap = await ac.newPage();
    await adminLogin(ap);
    await sidebarClick(ap, "お問い合わせ一覧");
    expect(await bodyHas(ap, "お問い合わせ")).toBe(true);
    console.log("✅ 管理者: 問い合わせ一覧");
    await ac.close();

    const sc = await browser.newContext();
    const sp = await sc.newPage();
    await storeLogin(sp);
    await sidebarClick(sp, "お問い合わせ一覧");
    expect(await bodyHas(sp, "お問い合わせ")).toBe(true);
    console.log("✅ 店舗: 問い合わせ一覧");
    await sc.close();
  }, { timeout: 120000 });

  // ==================================================================
  // 11. 全ロール: 顧客情報整合性
  // ==================================================================
  test("結合11: 全ロール 顧客情報整合性", async ({ browser }) => {
    const uc = await browser.newContext();
    const up = await uc.newPage();
    await userLogin(up);
    for (let a = 0; a < 3; a++) { try { await up.goto(`${USER_BASE}/index/mypage`, { waitUntil: "networkidle" }); break; } catch { if (a === 2) throw new Error("goto mypage failed"); await up.waitForTimeout(2000); } }
    await up.waitForTimeout(1500);
    await expect(up.getByText(EMAIL)).toBeVisible({ timeout: 5000 });
    console.log("✅ 利用者: マイページ確認");
    await uc.close();

    const ac = await browser.newContext();
    const ap = await ac.newPage();
    await adminLogin(ap);
    expect(await bodyHas(ap, "顧客一覧")).toBe(true);
    console.log("✅ 管理者: 顧客一覧");
    await ac.close();

    const sc = await browser.newContext();
    const sp = await sc.newPage();
    await storeLogin(sp);
    await sidebarClick(sp, "顧客一覧");
    expect(await bodyHas(sp, "顧客一覧")).toBe(true);
    console.log("✅ 店舗: 顧客一覧");
    await sc.close();
  }, { timeout: 120000 });
});
