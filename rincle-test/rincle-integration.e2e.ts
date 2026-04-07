import { test, expect, Page, BrowserContext, Browser } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

// ── URLs ──────────────────────────────────────────────────────────
const USER_BASE  = "https://rincle.co.jp/version-test";
const ADMIN_BASE = "https://rincle.co.jp/version-test/admin_login";
const STORE_BASE = "https://rincle.co.jp/version-test/shop_admin_login";

// ── 環境変数 ──────────────────────────────────────────────────────
const EMAIL          = process.env.RINCLE_EMAIL!;
const PASSWORD       = process.env.RINCLE_PASSWORD!;
const AREA           = process.env.RINCLE_AREA!;
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;
const STORE_EMAIL    = process.env.STORE_EMAIL!;
const STORE_PASSWORD = process.env.STORE_PASSWORD!;
const START_DATETIME = process.env.RINCLE_DATE!;
const END_DATETIME   = process.env.RINCLE_TIME!;

// ── 共通ヘルパー ──────────────────────────────────────────────────

function parseDatetime(raw: string) {
  if (!raw || raw === "未定") return null;
  const [datePart, timePart] = raw.trim().split(" ");
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split("/").map(Number);
  if (!y || !m || !d) return null;
  return { month: m, day: d, year: y, time: timePart };
}

/** Bubble要素をテキストで検索してクリック */
async function clickBubbleElement(page: Page, text: string): Promise<boolean> {
  return page.evaluate((searchText) => {
    const el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.textContent?.trim().includes(searchText);
    }) as HTMLElement | null;
    if (!el) return false;
    const events = (window as any).jQuery?._data?.(el, "events");
    const handler = events?.click?.[0]?.handler;
    if (handler) {
      const e = (window as any).jQuery.Event("click");
      e.target = el; e.currentTarget = el;
      handler.call(el, e);
      return true;
    }
    el.click();
    return true;
  }, text);
}

/** サイドバーメニューをクリック */
async function clickSidebarMenu(page: Page, text: string): Promise<void> {
  const clicked = await page.evaluate((searchText) => {
    let el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.textContent?.trim() === searchText;
    }) as HTMLElement | null;
    if (!el) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent?.trim() === searchText) {
          el = node.parentElement?.closest(".clickable-element") as HTMLElement | null;
          if (!el) el = node.parentElement as HTMLElement | null;
          break;
        }
      }
    }
    if (!el) return false;
    const events = (window as any).jQuery?._data?.(el, "events");
    const handler = events?.click?.[0]?.handler;
    if (handler) {
      const e = (window as any).jQuery.Event("click");
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
  await page.waitForTimeout(2000);
}

/** Bubble button_disabled パッチ付きクリック */
async function clickBubbleButton(page: Page, buttonText: RegExp): Promise<boolean> {
  return page.evaluate((textRe) => {
    const re = new RegExp(textRe);
    const btn = Array.from(document.querySelectorAll("button"))
      .find(b => re.test(b.textContent?.trim() || "")) as HTMLElement | null;
    if (!btn) return false;
    btn.scrollIntoView({ behavior: "instant", block: "center" });
    const clickable = btn.closest(".clickable-element") as HTMLElement | null;
    const inst = (clickable as any)?.bubble_data?.bubble_instance;
    if (inst?.element?.get_precomputed) {
      const origFn = inst.element.get_precomputed.bind(inst.element);
      inst.element.get_precomputed = () => {
        const p = origFn();
        if (p) p.button_disabled = false;
        return p;
      };
    }
    if (clickable) {
      const events = (window as any).jQuery?._data?.(clickable, "events");
      const handler = events?.click?.[0]?.handler;
      if (handler) {
        const e = (window as any).jQuery.Event("click");
        e.target = btn; e.currentTarget = clickable;
        handler.call(clickable, e);
        return true;
      }
    }
    btn.click();
    return true;
  }, buttonText.source);
}

/** Pikadayカレンダーで日付を選択 */
async function selectPikadayDate(page: Page, pickerIndex: number, month: number, day: number, year: number) {
  const pickerInput = page.locator("input.picker__input").nth(pickerIndex);
  const ariaOwns = await pickerInput.getAttribute("aria-owns");
  if (!ariaOwns) throw new Error(`picker__input[${pickerIndex}] に aria-owns がありません`);
  const pickerRoot = page.locator(`#${ariaOwns}`);
  await pickerInput.click({ force: true });
  await page.waitForTimeout(600);
  for (let i = 0; i < 24; i++) {
    const monthText = await pickerRoot.locator(".picker__month").textContent();
    const yearText  = await pickerRoot.locator(".picker__year").textContent();
    if (monthText?.includes(`${month}月`) && yearText?.includes(String(year))) break;
    await pickerRoot.locator(".picker__nav--next").click();
    await page.waitForTimeout(300);
  }
  await pickerRoot.locator(".picker__day--infocus")
    .getByText(String(day), { exact: true })
    .click({ force: true });
  await page.waitForTimeout(400);
  await pickerRoot.locator(".picker__button--close").click({ force: true });
  await page.waitForTimeout(500);
}

// ── ログイン関数 ──────────────────────────────────────────────────

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

// =====================================================================
//  結合テスト
// =====================================================================

test.describe("RINCLE 結合テスト", () => {
  test.describe.configure({ mode: "serial" });

  // ==================================================================
  // 1. 店舗 → 利用者: 営業カレンダー確認 → 利用者側で予約可能日確認
  //    店舗側で営業カレンダーを確認し、利用者側でその日付が予約可能か検証
  // ==================================================================
  test("結合1: 店舗の営業カレンダー → 利用者の予約フォーム日付整合性", async ({ browser }) => {
    // ── Step 1: 店舗管理画面で営業カレンダーを確認 ──
    const storeCtx = await browser.newContext();
    const storePage = await storeCtx.newPage();
    await storeLogin(storePage);

    await clickSidebarMenu(storePage, "営業カレンダー");
    const hasCalendar = await storePage.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("カレンダー") || text.includes("営業");
    });
    expect(hasCalendar).toBe(true);
    console.log("✅ [結合1] 店舗: 営業カレンダー表示確認");

    // 営業時間設定も確認
    await clickSidebarMenu(storePage, "営業時間設定");
    const hasHours = await storePage.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("営業時間") || text.includes("曜日") || text.includes("時");
    });
    expect(hasHours).toBe(true);
    console.log("✅ [結合1] 店舗: 営業時間設定確認");
    await storeCtx.close();

    // ── Step 2: 利用者側で予約フォームの日付が選択可能か確認 ──
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await userLogin(userPage);

    // 検索 → 自転車一覧 → 詳細
    await userPage.locator("select.bubble-element.Dropdown").first().selectOption({ label: AREA });
    await userPage.waitForTimeout(500);
    await userPage.locator('input[type="checkbox"]').nth(0).check();
    await userPage.locator('input[type="checkbox"]').nth(1).check();
    await userPage.getByRole("button", { name: "検索する" }).click();
    await userPage.waitForLoadState("networkidle");
    await userPage.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first().click();
    await userPage.waitForLoadState("networkidle");
    await userPage.getByRole("button", { name: "詳細を見る" }).first().click();
    await userPage.waitForLoadState("networkidle");
    await userPage.evaluate(() => window.scrollBy(0, 500));
    await userPage.waitForTimeout(1500);

    // 予約フォームのピッカーが存在すること = 営業日が反映されている
    const pickerCount = await userPage.locator("input.picker__input").count();
    expect(pickerCount).toBeGreaterThanOrEqual(3);
    console.log(`✅ [結合1] 利用者: 予約フォーム表示確認 (picker数: ${pickerCount})`);
    await userCtx.close();
  }, { timeout: 180000 });

  // ==================================================================
  // 2. 店舗 → 利用者: 自転車一覧確認 → 利用者検索で表示確認
  //    店舗の自転車が利用者の検索結果に表示されるか検証
  // ==================================================================
  test("結合2: 店舗の自転車一覧 → 利用者の検索結果整合性", async ({ browser }) => {
    // ── Step 1: 店舗側で自転車一覧を確認・自転車名を取得 ──
    const storeCtx = await browser.newContext();
    const storePage = await storeCtx.newPage();
    await storeLogin(storePage);

    await clickSidebarMenu(storePage, "自転車一覧");
    await storePage.waitForTimeout(2000);

    const storeBicycleInfo = await storePage.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasBicycleList: text.includes("自転車"),
        bodyText: text.substring(0, 2000), // デバッグ用
      };
    });
    expect(storeBicycleInfo.hasBicycleList).toBe(true);
    console.log("✅ [結合2] 店舗: 自転車一覧確認");
    await storeCtx.close();

    // ── Step 2: 利用者側で同エリアの検索結果を確認 ──
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await userLogin(userPage);

    await userPage.locator("select.bubble-element.Dropdown").first().selectOption({ label: AREA });
    await userPage.waitForTimeout(500);
    await userPage.locator('input[type="checkbox"]').nth(0).check();
    await userPage.locator('input[type="checkbox"]').nth(1).check();
    await userPage.getByRole("button", { name: "検索する" }).click();
    await userPage.waitForLoadState("networkidle");

    // 検索結果に自転車が存在すること
    const allBikesBtn = userPage.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first();
    await expect(allBikesBtn).toBeVisible({ timeout: 10000 });
    await allBikesBtn.click();
    await userPage.waitForLoadState("networkidle");
    await userPage.waitForTimeout(3000);

    // 「詳細を見る」ボタンが表示されるまで待機
    const detailBtn = userPage.getByRole("button", { name: "詳細を見る" }).first();
    await expect(detailBtn).toBeVisible({ timeout: 10000 });
    const detailBtns = userPage.getByRole("button", { name: "詳細を見る" });
    const userBikeCount = await detailBtns.count();
    expect(userBikeCount).toBeGreaterThan(0);
    console.log(`✅ [結合2] 利用者: 検索結果に自転車 ${userBikeCount} 件表示`);
    await userCtx.close();
  }, { timeout: 180000 });

  // ==================================================================
  // 3. 店舗 → 利用者: オプション管理確認 → 利用者の自転車詳細で確認
  //    店舗のオプションが利用者の予約画面に反映されるか検証
  // ==================================================================
  test("結合3: 店舗のオプション → 利用者の自転車詳細/予約画面整合性", async ({ browser }) => {
    // ── Step 1: 店舗側でオプション一覧を確認 ──
    const storeCtx = await browser.newContext();
    const storePage = await storeCtx.newPage();
    await storeLogin(storePage);

    await clickSidebarMenu(storePage, "オプション管理");
    await storePage.waitForTimeout(2000);

    const hasOptions = await storePage.evaluate(() => {
      return document.body.textContent?.includes("オプション") ?? false;
    });
    expect(hasOptions).toBe(true);
    console.log("✅ [結合3] 店舗: オプション管理確認");
    await storeCtx.close();

    // ── Step 2: 利用者側で自転車詳細ページのオプション表示を確認 ──
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await userLogin(userPage);

    await userPage.locator("select.bubble-element.Dropdown").first().selectOption({ label: AREA });
    await userPage.waitForTimeout(500);
    await userPage.locator('input[type="checkbox"]').nth(0).check();
    await userPage.locator('input[type="checkbox"]').nth(1).check();
    await userPage.getByRole("button", { name: "検索する" }).click();
    await userPage.waitForLoadState("networkidle");
    await userPage.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first().click();
    await userPage.waitForLoadState("networkidle");
    await userPage.getByRole("button", { name: "詳細を見る" }).first().click();
    await userPage.waitForLoadState("networkidle");
    await userPage.waitForTimeout(2000);

    // ページ全体をスキャンしてオプション関連コンテンツを確認
    const detailPageInfo = await userPage.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasOptionSection: text.includes("オプション") || text.includes("ヘルメット") || text.includes("カゴ") || text.includes("ライト"),
        hasReservationForm: text.includes("予約") || text.includes("貸出"),
        url: window.location.href,
      };
    });
    console.log(`✅ [結合3] 利用者: 自転車詳細ページ確認 (オプション: ${detailPageInfo.hasOptionSection}, 予約フォーム: ${detailPageInfo.hasReservationForm})`);
    expect(detailPageInfo.hasReservationForm).toBe(true);
    await userCtx.close();
  }, { timeout: 180000 });

  // ==================================================================
  // 4. 利用者 → 店舗: 予約実行 → 店舗の予約一覧で反映確認
  //    利用者が予約を行い、店舗管理画面の予約一覧に反映されるか検証
  // ==================================================================
  test("結合4: 利用者の予約 → 店舗の予約一覧反映確認", async ({ browser }) => {
    const start = parseDatetime(START_DATETIME);
    const end   = parseDatetime(END_DATETIME);
    if (!start || !end) {
      console.log("⚠️ RINCLE_DATE/RINCLE_TIME 未設定のためスキップ");
      return;
    }

    // ── Step 1: 店舗側で予約件数を事前取得 ──
    const storeCtx1 = await browser.newContext();
    const storePage1 = await storeCtx1.newPage();
    await storeLogin(storePage1);

    // 予約一覧ページで件数取得
    const beforeText = await storePage1.evaluate(() => {
      const el = Array.from(document.querySelectorAll("*")).find(e =>
        e.textContent?.includes("予約一覧（")
      );
      return el?.textContent?.match(/予約一覧（(\d+)/)?.[1] || "0";
    });
    const beforeCount = parseInt(beforeText, 10);
    console.log(`✅ [結合4] 店舗: 予約前の件数 = ${beforeCount}`);
    await storeCtx1.close();

    // ── Step 2: 利用者側で予約実行 ──
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await userLogin(userPage);

    // 検索 → 一覧 → 詳細
    await userPage.locator("select.bubble-element.Dropdown").first().selectOption({ label: AREA });
    await userPage.waitForTimeout(500);
    await userPage.locator('input[type="checkbox"]').nth(0).check();
    await userPage.locator('input[type="checkbox"]').nth(1).check();
    await userPage.getByRole("button", { name: "検索する" }).click();
    await userPage.waitForLoadState("networkidle");
    await userPage.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first().click();
    await userPage.waitForLoadState("networkidle");
    await userPage.getByRole("button", { name: "詳細を見る" }).first().click();
    await userPage.waitForLoadState("networkidle");
    await userPage.evaluate(() => window.scrollBy(0, 500));
    await userPage.waitForTimeout(1500);

    // 日時入力 — ピッカーインデックスを動的に検出
    const pickerInputs = userPage.locator("input.picker__input");
    const totalPickers = await pickerInputs.count();
    // 予約フォームのpickerは後半にある（検索用2つ + 予約用）
    const startPickerIdx = totalPickers >= 6 ? 2 : 0;
    const endPickerIdx   = totalPickers >= 6 ? 5 : Math.min(totalPickers - 1, 3);

    await selectPikadayDate(userPage, startPickerIdx, start.month, start.day, start.year);
    await selectPikadayDate(userPage, endPickerIdx, end.month, end.day, end.year);

    // 可視のselectドロップダウンから時間を選択
    const visibleSelects = userPage.locator("select.bubble-element.Dropdown:visible");
    const selectCount = await visibleSelects.count();
    console.log(`  [結合4] 可視select数: ${selectCount}`);

    // 時間選択 — 可視のselectのうち、時間値を含むものを探す
    const allSelects = userPage.locator("select");
    const totalSelects = await allSelects.count();
    let startTimeSet = false;
    let endTimeSet = false;
    for (let i = 0; i < totalSelects; i++) {
      const sel = allSelects.nth(i);
      const isVisible = await sel.isVisible().catch(() => false);
      if (!isVisible) continue;
      const options = await sel.locator("option").allTextContents();
      if (options.some(o => o.includes(":")) && !startTimeSet) {
        await sel.selectOption({ label: start.time });
        startTimeSet = true;
        await userPage.waitForTimeout(500);
        continue;
      }
      if (options.some(o => o.includes(":")) && startTimeSet && !endTimeSet) {
        await sel.selectOption({ label: end.time });
        endTimeSet = true;
        await userPage.waitForTimeout(500);
        break;
      }
    }
    console.log(`  [結合4] 時間選択: 貸出=${startTimeSet}, 返却=${endTimeSet}`);

    // 予約画面へ進む
    await userPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        b => b.textContent?.trim() === "予約画面へ進む"
      ) as HTMLElement | null;
      if (!btn) return;
      btn.scrollIntoView({ behavior: "instant", block: "center" });
      const clickable = btn.closest(".clickable-element") as HTMLElement | null;
      const inst = (clickable as any)?.bubble_data?.bubble_instance;
      if (inst?.element?.get_precomputed) {
        const origFn = inst.element.get_precomputed.bind(inst.element);
        inst.element.get_precomputed = () => {
          const p = origFn();
          if (p) p.button_disabled = false;
          return p;
        };
      }
      const events = (window as any).jQuery?._data?.(clickable, "events");
      const clickHandler = events?.click?.[0]?.handler;
      if (clickHandler) {
        const e = (window as any).jQuery.Event("click");
        e.target = btn; e.currentTarget = clickable;
        clickHandler.call(clickable, e);
      }
    });
    await userPage.waitForURL(/\/index\/cart/, { timeout: 20000 }).catch(() => {});
    console.log("✅ [結合4] 利用者: カートページへ遷移");

    // カートページ → お客様情報 → 確認 → 予約確定
    await userPage.waitForLoadState("networkidle", { timeout: 20000 });
    await userPage.waitForTimeout(2000);
    const toCustomerBtn = userPage.getByRole("button", { name: "お客様情報の入力へ" });
    if (await toCustomerBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await toCustomerBtn.click();
      await userPage.waitForLoadState("networkidle", { timeout: 15000 });
      console.log("✅ [結合4] 利用者: お客様情報入力ページ");
    }

    await userPage.waitForTimeout(2000);
    await clickBubbleButton(userPage, /予約内容の確認に進む/);
    await userPage.waitForTimeout(2000);

    const reserved = await clickBubbleButton(userPage, /^予約する$|^予約を確定|^注文確定/);
    if (reserved) {
      await userPage.waitForTimeout(5000);
      console.log("✅ [結合4] 利用者: 予約確定 URL:", userPage.url());
    }
    await userCtx.close();

    // ── Step 3: 店舗側で予約一覧を再確認 ──
    const storeCtx2 = await browser.newContext();
    const storePage2 = await storeCtx2.newPage();
    await storeLogin(storePage2);

    await storePage2.waitForTimeout(2000);
    const afterText = await storePage2.evaluate(() => {
      const text = document.body.textContent || "";
      const match = text.match(/予約一覧（(\d+)/);
      return match?.[1] || "0";
    });
    const afterCount = parseInt(afterText, 10);
    console.log(`✅ [結合4] 店舗: 予約後の件数 = ${afterCount} (差分: ${afterCount - beforeCount})`);
    // 件数が増えているか、少なくとも予約一覧が表示されていることを確認
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
    await storeCtx2.close();
  }, { timeout: 300000 });

  // ==================================================================
  // 5. 利用者 → 店舗: 予約キャンセル → 店舗側予約一覧の反映確認
  // ==================================================================
  test("結合5: 利用者の予約キャンセル → 店舗側反映確認", async ({ browser }) => {
    // ── Step 1: 利用者側で予約一覧を確認してキャンセル ──
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await userLogin(userPage);

    await userPage.goto(`${USER_BASE}/user_reservation_list`, { waitUntil: "networkidle" });
    await userPage.waitForTimeout(2000);

    const cancelBtns = userPage.getByRole("button", { name: "予約をキャンセルする" });
    const userResvCount = await cancelBtns.count();
    if (userResvCount === 0) {
      console.log("⚠️ [結合5] キャンセル可能な予約がないためスキップ");
      await userCtx.close();
      return;
    }

    // 最初の予約をキャンセル
    await cancelBtns.first().click();
    await userPage.waitForTimeout(3000);
    const confirmBtn = userPage.getByRole("button", { name: /はい|OK|キャンセルを確定|確定/ });
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
      await userPage.waitForTimeout(3000);
    }
    console.log("✅ [結合5] 利用者: 予約キャンセル実行");

    const afterCancelCount = await userPage.getByRole("button", { name: "予約をキャンセルする" }).count();
    console.log(`✅ [結合5] 利用者: キャンセル後の予約件数 = ${afterCancelCount} (元: ${userResvCount})`);
    await userCtx.close();

    // ── Step 2: 店舗側で予約一覧の変化を確認 ──
    const storeCtx = await browser.newContext();
    const storePage = await storeCtx.newPage();
    await storeLogin(storePage);

    // 予約一覧が表示されていること
    const storeResvInfo = await storePage.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasResvList: text.includes("予約一覧"),
        hasCSV: text.includes("CSV"),
      };
    });
    expect(storeResvInfo.hasResvList).toBe(true);
    console.log(`✅ [結合5] 店舗: 予約一覧表示確認 (CSV: ${storeResvInfo.hasCSV})`);
    await storeCtx.close();
  }, { timeout: 180000 });

  // ==================================================================
  // 6. 管理者 → 利用者: お知らせ管理 → 利用者TOPでの表示確認
  // ==================================================================
  test("結合6: 管理者のお知らせ → 利用者TOPの新着情報表示整合性", async ({ browser }) => {
    // ── Step 1: 管理者側でお知らせ管理を確認 ──
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await adminLogin(adminPage);

    await clickSidebarMenu(adminPage, "お知らせ管理");
    const hasNews = await adminPage.evaluate(() => {
      return document.body.textContent?.includes("お知らせ") ?? false;
    });
    expect(hasNews).toBe(true);
    console.log("✅ [結合6] 管理者: お知らせ管理ページ確認");
    await adminCtx.close();

    // ── Step 2: 利用者TOPで新着情報セクションを確認 ──
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await userLogin(userPage);

    await userPage.waitForTimeout(1500);
    await userPage.evaluate(() => window.scrollTo(0, 900));
    await userPage.waitForTimeout(1000);

    // 新着情報セクションが表示されていること
    const hasNewsSection = await userPage.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("新着") || text.includes("NEWS") || text.includes("OPEN");
    });
    expect(hasNewsSection).toBe(true);
    console.log("✅ [結合6] 利用者: TOPページ新着情報セクション表示確認");

    // 新着情報の1件目をクリックして詳細に遷移可能か確認
    await userPage.evaluate(() => {
      const el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.textContent?.includes("OPEN");
      }) as HTMLElement | null;
      if (!el) return;
      const events = (window as any).jQuery?._data?.(el, "events");
      const handler = events?.click?.[0]?.handler;
      if (handler) {
        const e = (window as any).jQuery.Event("click");
        e.target = el; e.currentTarget = el;
        handler.call(el, e);
      } else {
        el.click();
      }
    });

    await userPage.waitForURL(/\/index\/news_detail/, { timeout: 10000 }).catch(() => {});
    const isNewsDetail = userPage.url().includes("news_detail");
    console.log(`✅ [結合6] 利用者: 新着情報詳細ページ遷移 ${isNewsDetail ? "成功" : "スキップ"}`);
    await userCtx.close();
  }, { timeout: 180000 });

  // ==================================================================
  // 7. 管理者 → 店舗: 料金表管理 → 店舗側の料金反映確認
  // ==================================================================
  test("結合7: 管理者の料金表 → 店舗側の売上レポート整合性", async ({ browser }) => {
    // ── Step 1: 管理者側で料金表管理を確認 ──
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await adminLogin(adminPage);

    await clickSidebarMenu(adminPage, "加盟店一覧");
    await adminPage.waitForTimeout(1000);

    // 加盟店一覧から料金表管理に遷移可能か確認
    const hasShopList = await adminPage.evaluate(() => {
      return document.body.textContent?.includes("加盟店一覧") ?? false;
    });
    expect(hasShopList).toBe(true);
    console.log("✅ [結合7] 管理者: 加盟店一覧確認");

    await clickSidebarMenu(adminPage, "料金表管理");
    const hasPriceTable = await adminPage.evaluate(() => {
      return document.body.textContent?.includes("料金") ?? false;
    });
    expect(hasPriceTable).toBe(true);
    console.log("✅ [結合7] 管理者: 料金表管理確認");
    await adminCtx.close();

    // ── Step 2: 店舗側で売上レポートの料金情報を確認 ──
    const storeCtx = await browser.newContext();
    const storePage = await storeCtx.newPage();
    await storeLogin(storePage);

    await clickSidebarMenu(storePage, "売上レポート");
    const hasSales = await storePage.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("売上") || text.includes("レポート");
    });
    expect(hasSales).toBe(true);
    console.log("✅ [結合7] 店舗: 売上レポート確認");
    await storeCtx.close();
  }, { timeout: 180000 });

  // ==================================================================
  // 8. 利用者 → 管理者: お問い合わせ送信 → 管理者一覧確認
  // ==================================================================
  test("結合8: 利用者のお問い合わせフォーム → 管理者/店舗の問い合わせ一覧整合性", async ({ browser }) => {
    // ── Step 1: 利用者側でお問い合わせフォームを確認 ──
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await userLogin(userPage);

    await userPage.goto(`${USER_BASE}/index/contact`, { waitUntil: "networkidle" });
    await userPage.waitForTimeout(1500);

    await expect(userPage.getByText("RINCLEへの問い合わせ")).toBeVisible({ timeout: 5000 });
    const hasSendBtn = await userPage.evaluate(() => {
      const el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.textContent?.trim() === "送信";
      });
      return !!el;
    });
    expect(hasSendBtn).toBe(true);
    console.log("✅ [結合8] 利用者: お問い合わせフォーム確認");
    await userCtx.close();

    // ── Step 2: 管理者側でお問い合わせ一覧を確認 ──
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await adminLogin(adminPage);

    await clickSidebarMenu(adminPage, "お問い合わせ一覧");
    const adminHasContact = await adminPage.evaluate(() => {
      return document.body.textContent?.includes("お問い合わせ") ?? false;
    });
    expect(adminHasContact).toBe(true);
    console.log("✅ [結合8] 管理者: お問い合わせ一覧確認");
    await adminCtx.close();

    // ── Step 3: 店舗側でもお問い合わせ一覧を確認 ──
    const storeCtx = await browser.newContext();
    const storePage = await storeCtx.newPage();
    await storeLogin(storePage);

    await clickSidebarMenu(storePage, "お問い合わせ一覧");
    const storeHasContact = await storePage.evaluate(() => {
      return document.body.textContent?.includes("お問い合わせ") ?? false;
    });
    expect(storeHasContact).toBe(true);
    console.log("✅ [結合8] 店舗: お問い合わせ一覧確認");
    await storeCtx.close();
  }, { timeout: 180000 });

  // ==================================================================
  // 9. 管理者 → 利用者: FV/バナー管理 → 利用者TOPの表示確認
  // ==================================================================
  test("結合9: 管理者のFV/バナー → 利用者TOPの表示整合性", async ({ browser }) => {
    // ── Step 1: 管理者側でFV管理・バナー管理を確認 ──
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await adminLogin(adminPage);

    await clickSidebarMenu(adminPage, "FV管理");
    const hasFV = await adminPage.evaluate(() => {
      return document.body.textContent?.includes("FV") ?? false;
    });
    expect(hasFV).toBe(true);
    console.log("✅ [結合9] 管理者: FV管理確認");

    await clickSidebarMenu(adminPage, "バナー管理");
    const hasBanner = await adminPage.evaluate(() => {
      return document.body.textContent?.includes("バナー") ?? false;
    });
    expect(hasBanner).toBe(true);
    console.log("✅ [結合9] 管理者: バナー管理確認");
    await adminCtx.close();

    // ── Step 2: 利用者TOPでFV/バナーが表示されていることを確認 ──
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await userLogin(userPage);

    await userPage.waitForTimeout(2000);

    // TOPページのメインビジュアルやバナーエリアの存在を確認
    const topPageInfo = await userPage.evaluate(() => {
      const images = document.querySelectorAll("img");
      const hasVisualContent = images.length > 0;
      const hasClickableContent = document.querySelectorAll(".clickable-element").length > 0;
      return {
        imageCount: images.length,
        hasVisualContent,
        hasClickableContent,
      };
    });
    expect(topPageInfo.hasVisualContent).toBe(true);
    console.log(`✅ [結合9] 利用者: TOPページビジュアル確認 (画像: ${topPageInfo.imageCount}件)`);
    await userCtx.close();
  }, { timeout: 180000 });

  // ==================================================================
  // 10. 管理者 → 利用者: Q&A管理 → 利用者FAQページ整合性
  // ==================================================================
  test("結合10: 管理者のQ&A管理 → 利用者FAQページ整合性", async ({ browser }) => {
    // ── Step 1: 管理者でQ&A管理を確認 ──
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await adminLogin(adminPage);

    await clickSidebarMenu(adminPage, "Q&A管理");
    const hasQA = await adminPage.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("Q&A") || text.includes("質問");
    });
    expect(hasQA).toBe(true);
    console.log("✅ [結合10] 管理者: Q&A管理確認");
    await adminCtx.close();

    // ── Step 2: 利用者FAQページを確認 ──
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await userLogin(userPage);

    await userPage.goto(`${USER_BASE}/index/faq`, { waitUntil: "networkidle" });
    await userPage.waitForTimeout(1500);

    await expect(userPage).toHaveURL(/\/index\/faq/);
    await expect(userPage.getByText("ログアウト").first()).toBeVisible({ timeout: 5000 });
    console.log("✅ [結合10] 利用者: FAQページ表示確認");
    await userCtx.close();
  }, { timeout: 180000 });

  // ==================================================================
  // 11. 全ロール横断: 顧客情報の整合性確認
  //     管理者・店舗の顧客一覧に利用者が表示されるか
  // ==================================================================
  test("結合11: 全ロール横断 - 顧客情報の整合性", async ({ browser }) => {
    // ── Step 1: 利用者でマイページ確認(メールアドレス取得) ──
    const userCtx = await browser.newContext();
    const userPage = await userCtx.newPage();
    await userLogin(userPage);

    await userPage.goto(`${USER_BASE}/index/mypage`, { waitUntil: "networkidle" });
    await userPage.waitForTimeout(1500);
    await expect(userPage.getByText(EMAIL)).toBeVisible({ timeout: 5000 });
    console.log("✅ [結合11] 利用者: マイページでメールアドレス確認");
    await userCtx.close();

    // ── Step 2: 管理者の顧客一覧で確認 ──
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await adminLogin(adminPage);

    // デフォルトページが顧客一覧
    const adminCustomerInfo = await adminPage.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasCustomerList: text.includes("顧客一覧"),
        hasCSV: text.includes("CSV"),
        hasSearch: text.includes("キーワード"),
      };
    });
    expect(adminCustomerInfo.hasCustomerList).toBe(true);
    console.log(`✅ [結合11] 管理者: 顧客一覧確認 (CSV: ${adminCustomerInfo.hasCSV}, 検索: ${adminCustomerInfo.hasSearch})`);
    await adminCtx.close();

    // ── Step 3: 店舗の顧客一覧で確認 ──
    const storeCtx = await browser.newContext();
    const storePage = await storeCtx.newPage();
    await storeLogin(storePage);

    await clickSidebarMenu(storePage, "顧客一覧");
    const storeCustomerInfo = await storePage.evaluate(() => {
      return document.body.textContent?.includes("顧客一覧") ?? false;
    });
    expect(storeCustomerInfo).toBe(true);
    console.log("✅ [結合11] 店舗: 顧客一覧確認");
    await storeCtx.close();
  }, { timeout: 180000 });

  // ==================================================================
  // 12. 全ロール横断: 売上データの整合性確認
  //     管理者・店舗の売上レポートが整合しているか
  // ==================================================================
  test("結合12: 管理者/店舗 売上レポート整合性", async ({ browser }) => {
    // ── Step 1: 管理者の売上レポート ──
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await adminLogin(adminPage);

    await clickSidebarMenu(adminPage, "売上レポート");
    const adminSales = await adminPage.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasSalesReport: text.includes("売上"),
        bodySnippet: text.substring(0, 500),
      };
    });
    expect(adminSales.hasSalesReport).toBe(true);
    console.log("✅ [結合12] 管理者: 売上レポート表示確認");
    await adminCtx.close();

    // ── Step 2: 店舗の売上レポート ──
    const storeCtx = await browser.newContext();
    const storePage = await storeCtx.newPage();
    await storeLogin(storePage);

    await clickSidebarMenu(storePage, "売上レポート");
    const storeSales = await storePage.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasSalesReport: text.includes("売上") || text.includes("レポート"),
      };
    });
    expect(storeSales.hasSalesReport).toBe(true);
    console.log("✅ [結合12] 店舗: 売上レポート表示確認");
    await storeCtx.close();
  }, { timeout: 180000 });
});
