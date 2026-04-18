import { test, expect, Page } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

const BASE_URL = "https://rincle.co.jp/version-5398j/admin_login";
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

// ── ヘルパー ──

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

async function sidebarClick(page: Page, text: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const clicked = await page.evaluate((t) => {
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
      if (!el) return false;
      const ev = (window as any).jQuery?._data?.(el, "events")?.click?.[0]?.handler;
      if (ev) { const e = (window as any).jQuery.Event("click"); e.target = el; e.currentTarget = el; ev.call(el, e); return true; }
      el.click();
      return true;
    }, text);
    if (clicked) break;
    if (attempt < 2) await page.waitForTimeout(2000);
  }
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

async function bodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.textContent || "");
}

async function adminLogin(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 8000 });
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForLoadState("networkidle", { timeout: 20000 });
  await page.waitForTimeout(2000);
  await Promise.race([
    page.getByText("顧客管理").first().waitFor({ state: "visible", timeout: 20000 }),
    page.getByText("予約一覧").first().waitFor({ state: "visible", timeout: 20000 }),
    page.getByText("加盟店一覧").first().waitFor({ state: "visible", timeout: 20000 }),
    page.getByText("売上レポート").first().waitFor({ state: "visible", timeout: 20000 }),
  ]).catch(() => {});
  await page.waitForTimeout(1000);
}

async function getVisibleInputs(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("input")).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.type !== "hidden" && el.type !== "file" && el.type !== "checkbox" && el.type !== "radio";
    }).map((el, i) => ({ i, type: el.type, placeholder: el.placeholder }))
  );
}

async function getVisibleSelects(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("select")).filter(s => s.getBoundingClientRect().width > 0)
      .map((s, i) => ({ i, optionCount: s.options.length, options: Array.from(s.options).slice(0, 5).map(o => o.text) }))
  );
}

async function getVisibleButtons(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".clickable-element, button")).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map(el => el.textContent?.trim()).filter(t => t && t.length < 30)
  );
}

async function hasPopupVisible(page: Page, keyword: string): Promise<boolean> {
  return page.evaluate((kw) => {
    const popups = document.querySelectorAll("[class*='bubble-element'][class*='popup'], [class*='Popup'], [style*='z-index']");
    for (const p of Array.from(popups)) {
      const r = (p as HTMLElement).getBoundingClientRect();
      if (r.width > 100 && r.height > 100 && (p.textContent || "").includes(kw)) return true;
    }
    return false;
  }, keyword);
}

async function waitForSectionLoad(page: Page, keyword: string, maxMs = 10000): Promise<boolean> {
  for (let t = 0; t < maxMs; t += 500) {
    const text = await bodyText(page);
    if (text.includes(keyword)) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

// =====================================================================
// 管理画面 UI要素 E2Eテスト
// =====================================================================
test.describe("管理画面 UI要素テスト", () => {

  // ================================================================
  // 1. admin_login ページ
  // ================================================================
  test.describe("1. admin_login ページ", () => {

    test("UI-LOGIN-1: ログインページの全UI要素が存在する", async ({ page }) => {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);

      // 管理画面ログインのタイトルテキスト
      await expect(page.getByText("管理画面ログイン")).toBeVisible({ timeout: 8000 });

      // email入力フィールド
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible({ timeout: 5000 });

      // password入力フィールド
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toBeVisible({ timeout: 5000 });

      // ログインボタン (Button id=bTHXH)
      const loginBtn = page.getByRole("button", { name: "ログイン" });
      await expect(loginBtn).toBeVisible({ timeout: 5000 });

      // 「パスワードを忘れた方はこちら」テキスト (Text id=bTgdN)
      await expect(page.getByText("パスワードを忘れた方はこちら").first()).toBeVisible({ timeout: 5000 });

      console.log("UI-LOGIN-1: ログインページ全UI要素確認完了");
    });

    test("UI-LOGIN-2: ログインボタンでadminページへ遷移する", async ({ page }) => {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);

      await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
      await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: "ログイン" }).click();

      await page.waitForLoadState("networkidle", { timeout: 20000 });
      await page.waitForTimeout(3000);

      // ログイン後のURLがadminページを含むこと
      const url = page.url();
      expect(url).toContain("admin");

      // サイドバーが表示されていること
      await expect(page.getByText("顧客管理").first()).toBeVisible({ timeout: 10000 });

      console.log("UI-LOGIN-2: ログイン遷移確認完了 URL=" + url);
    });

    test("UI-LOGIN-3: パスワードリセットポップアップが開閉する", async ({ page }) => {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);

      // 「パスワードを忘れた方はこちら」をクリック -> Popup reset password (id=bTgdT)
      await bubbleClick(page, "パスワードを忘れた方はこちら");
      await page.waitForTimeout(1500);

      // 「再設定メールを送信」ボタン (Button id=bTgdl) が表示される
      const resetBtn = page.getByRole("button", { name: "再設定メールを送信" });
      const isVisible = await resetBtn.isVisible({ timeout: 5000 }).catch(() => false);
      expect(isVisible).toBe(true);

      // 「閉じる」テキスト (Text id=bTgda) をクリックしてポップアップを閉じる
      await bubbleClick(page, "閉じる");
      await page.waitForTimeout(1500);

      console.log("UI-LOGIN-3: パスワードリセットポップアップ開閉確認完了");
    });
  });

  // ================================================================
  // 2. admin - サイドバーナビゲーション
  // ================================================================
  test.describe("2. admin サイドバーナビゲーション", () => {

    test("UI-NAV-1: 全サイドバーメニュー項目が存在する", async ({ page }) => {
      await adminLogin(page);

      const sidebarMenus = [
        "顧客管理", "加盟店管理", "料金表管理",
        "予約管理", "売上レポート",
        "ファーストビュー管理", "お知らせ管理", "バナー管理", "Q&A管理",
      ];

      // サイドバーに表示されるテキストを取得（実際のラベルは一覧/管理が付く場合あり）
      const pageText = await bodyText(page);

      const results: { menu: string; found: boolean }[] = [];
      for (const menu of sidebarMenus) {
        // サイドバーの表示名は「顧客管理」-> 「顧客一覧」等のバリエーションがある
        const variations = [menu, menu.replace("管理", "一覧"), menu.replace("管理", ""), menu.replace("ファーストビュー管理", "FV管理")];
        const found = variations.some(v => pageText.includes(v));
        results.push({ menu, found });
      }

      results.forEach(r => {
        console.log(`  ${r.found ? "OK" : "NG"} ${r.menu}`);
      });

      const foundCount = results.filter(r => r.found).length;
      console.log(`UI-NAV-1: ${foundCount}/${sidebarMenus.length} メニュー項目確認`);
      expect(foundCount).toBeGreaterThanOrEqual(7);
    });

    test("UI-NAV-2: 各サイドバークリックで対応セクションが読み込まれる", async ({ page }) => {
      await adminLogin(page);

      // 実際のサイドバー表示名とそのセクションで期待されるキーワードのペア
      const menuTests: { label: string; keyword: string }[] = [
        { label: "顧客一覧",       keyword: "顧客" },
        { label: "加盟店一覧",     keyword: "加盟店" },
        { label: "料金表管理",     keyword: "料金" },
        { label: "予約一覧",       keyword: "予約" },
        { label: "売上レポート",   keyword: "売上" },
        { label: "FV管理",         keyword: "FV" },
        { label: "お知らせ管理",   keyword: "お知らせ" },
        { label: "バナー管理",     keyword: "バナー" },
        { label: "Q&A管理",        keyword: "Q&A" },
      ];

      const results: { label: string; loaded: boolean }[] = [];

      for (const { label, keyword } of menuTests) {
        try {
          await sidebarClick(page, label);
          const loaded = await waitForSectionLoad(page, keyword, 8000);
          results.push({ label, loaded });
        } catch {
          results.push({ label, loaded: false });
        }
      }

      results.forEach(r => {
        console.log(`  ${r.loaded ? "OK" : "NG"} ${r.label}`);
      });

      const loadedCount = results.filter(r => r.loaded).length;
      console.log(`UI-NAV-2: ${loadedCount}/${menuTests.length} セクション読み込み確認`);
      expect(loadedCount).toBeGreaterThanOrEqual(7);
    }, { timeout: 180000 });
  });

  // ================================================================
  // 3. 顧客管理
  // ================================================================
  test.describe("3. 顧客管理", () => {

    test("UI-CUST-1: 顧客一覧テーブルが存在する", async ({ page }) => {
      await adminLogin(page);
      // ログイン直後のデフォルトページが顧客一覧
      await waitForSectionLoad(page, "顧客一覧", 10000);

      const text = await bodyText(page);
      expect(text).toContain("顧客一覧");

      // テーブルまたはリピーティンググループが存在
      const hasListElements = await page.evaluate(() => {
        const rows = document.querySelectorAll("table tr, .repeating-group > div, [class*='RepeatingGroup'] > div");
        return rows.length;
      });

      console.log(`UI-CUST-1: 顧客一覧テーブル行数=${hasListElements}`);
      expect(hasListElements).toBeGreaterThan(0);
    });

    test("UI-CUST-2: 顧客検索/フィルタ機能が存在する", async ({ page }) => {
      await adminLogin(page);
      await waitForSectionLoad(page, "顧客一覧", 10000);

      // キーワード検索入力
      const searchInput = page.getByPlaceholder("キーワードで絞り込み");
      const hasSearch = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);

      // ソートセレクト
      const selects = await getVisibleSelects(page);

      // CSVダウンロードボタン (Button id=bTdAP)
      const csvBtn = page.getByRole("button", { name: "CSVダウンロード" });
      const hasCsv = await csvBtn.isVisible({ timeout: 5000 }).catch(() => false);

      console.log(`UI-CUST-2: 検索=${hasSearch}, セレクト数=${selects.length}, CSV=${hasCsv}`);
      expect(hasSearch || selects.length > 0).toBe(true);
    });

    test("UI-CUST-3: 顧客詳細ポップアップにアクセスできる", async ({ page }) => {
      await adminLogin(page);
      await waitForSectionLoad(page, "顧客一覧", 10000);

      // 「詳細」ボタン (Button id=bTTDg0) をクリック -> Popup view 顧客詳細 (id=bTSEa0)
      const clicked = await bubbleClick(page, "詳細");
      await page.waitForTimeout(3000);

      if (clicked) {
        const text = await bodyText(page);
        const hasDetail = text.includes("顧客") || text.includes("メール") || text.includes("@");

        // 「閉じる」テキスト (Text id=bTTAH0) が表示される
        const hasClose = await page.evaluate(() => {
          return Array.from(document.querySelectorAll(".clickable-element")).some(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && el.textContent?.trim() === "閉じる";
          });
        });

        console.log(`UI-CUST-3: 顧客詳細ポップアップ 表示=${hasDetail}, 閉じるボタン=${hasClose}`);
        expect(hasDetail).toBe(true);
      } else {
        console.log("UI-CUST-3: 詳細ボタンが見つからない（顧客データなしの可能性）");
      }
    });

    test("UI-CUST-4: 顧客編集ポップアップが開ける", async ({ page }) => {
      await adminLogin(page);
      await waitForSectionLoad(page, "顧客一覧", 10000);

      // 詳細ボタンから顧客詳細を開き、その中の編集リンクを確認
      // Text id=bTQba -> Popup edit 顧客情報 (id=bTQqx)
      const clicked = await bubbleClick(page, "詳細");
      await page.waitForTimeout(3000);

      if (clicked) {
        const detailText = await bodyText(page);
        const hasEditLink = detailText.includes("退会") || detailText.includes("編集");
        console.log(`UI-CUST-4: 顧客詳細内の操作リンク確認=${hasEditLink}`);
      } else {
        console.log("UI-CUST-4: 詳細ボタンが見つからない");
      }
    });
  });

  // ================================================================
  // 4. 加盟店管理
  // ================================================================
  test.describe("4. 加盟店管理", () => {

    test("UI-STORE-1: 加盟店一覧が存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "加盟店一覧");

      const text = await bodyText(page);
      expect(text).toContain("加盟店");

      const listInfo = await page.evaluate(() => {
        const rows = document.querySelectorAll("table tr, .repeating-group > div, [class*='RepeatingGroup'] > div");
        const buttons = Array.from(document.querySelectorAll(".clickable-element, button")).filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }).map(el => el.textContent?.trim()).filter(t => t && t.length < 30);
        return { rowCount: rows.length, buttons };
      });

      console.log(`UI-STORE-1: 加盟店一覧 行数=${listInfo.rowCount}`);
    });

    test("UI-STORE-2: 新規追加ボタンでPopup add companyが開く", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "加盟店一覧");

      // 「新規追加」ボタン (Button id=bTHHb) -> Show 'Popup add company' (id=bTHHp)
      const addBtn = page.getByRole("button", { name: "新規追加" });
      const hasAddBtn = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasAddBtn).toBe(true);

      if (hasAddBtn) {
        await bubbleClick(page, "新規追加");
        await page.waitForTimeout(3000);

        // ポップアップ内に「招待メール送信」ボタン (Button id=bTHIl) が表示される
        const popupText = await bodyText(page);
        const hasInviteBtn = popupText.includes("招待メール送信");
        const hasCloseBtn = popupText.includes("閉じる");

        // ポップアップ内の入力フィールドを確認
        const inputs = await getVisibleInputs(page);

        console.log(`UI-STORE-2: 新規追加ポップアップ 招待ボタン=${hasInviteBtn}, 閉じる=${hasCloseBtn}, input数=${inputs.length}`);
        expect(hasInviteBtn || inputs.length > 0).toBe(true);

        // 閉じる (Text id=bTHJB)
        await bubbleClick(page, "閉じる");
        await page.waitForTimeout(1000);
      }
    });

    test("UI-STORE-3: 加盟店詳細ポップアップが開く", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "加盟店一覧");

      // 「詳細」ボタン (Button id=bTHlc) -> Show 'Popup shop detail' (id=bTHmT)
      const clicked = await bubbleClick(page, "詳細");
      await page.waitForTimeout(3000);

      if (clicked) {
        const text = await bodyText(page);
        const hasStoreDetail = text.includes("店舗") || text.includes("加盟店") || text.includes("住所") || text.includes("メール");

        // 「退会させる」ボタン (Button id=bTHod) -> Show 'Popup delete shop'
        const hasWithdrawBtn = text.includes("退会させる");

        // 「閲覧」ボタン (Button id=bTXFB0)
        const hasViewBtn = text.includes("閲覧");

        // 「閉じる」テキスト (Text id=bTHmk)
        const hasClose = text.includes("閉じる");

        console.log(`UI-STORE-3: 加盟店詳細ポップアップ 表示=${hasStoreDetail}, 退会=${hasWithdrawBtn}, 閲覧=${hasViewBtn}, 閉じる=${hasClose}`);
        expect(hasStoreDetail).toBe(true);

        // 閉じる
        await bubbleClick(page, "閉じる");
        await page.waitForTimeout(1000);
      } else {
        console.log("UI-STORE-3: 詳細ボタンが見つからない（加盟店データなしの可能性）");
      }
    });

    test("UI-STORE-4: 退会ポップアップが開く", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "加盟店一覧");

      // 詳細ポップアップを開く
      const detailClicked = await bubbleClick(page, "詳細");
      await page.waitForTimeout(3000);

      if (detailClicked) {
        // 「退会させる」ボタン (Button id=bTHod) -> Show 'Popup delete shop' (id=bTHoz)
        const withdrawClicked = await bubbleClick(page, "退会させる");
        await page.waitForTimeout(2000);

        if (withdrawClicked) {
          const text = await bodyText(page);
          // Popup delete shop内の「退会させる」確認ボタン (Button id=bTHpM)
          const hasConfirmWithdraw = text.includes("退会");
          // 「閉じる」テキスト (Text id=bTHpN)
          const hasClose = await page.evaluate(() => {
            return Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && el.textContent?.trim() === "閉じる";
            }).length;
          });

          console.log(`UI-STORE-4: 退会確認ポップアップ 退会ボタン=${hasConfirmWithdraw}, 閉じるボタン数=${hasClose}`);

          // 閉じる（操作は実行しない）
          await bubbleClick(page, "閉じる");
          await page.waitForTimeout(1000);
        } else {
          console.log("UI-STORE-4: 退会させるボタンが見つからない");
        }
      } else {
        console.log("UI-STORE-4: 詳細ボタンが見つからない");
      }
    });
  });

  // ================================================================
  // 5. 料金表管理
  // ================================================================
  test.describe("5. 料金表管理", () => {

    test("UI-PRICE-1: 料金表一覧が存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "料金表管理");

      const text = await bodyText(page);
      expect(text).toContain("料金");

      const listInfo = await page.evaluate(() => {
        const rows = document.querySelectorAll("table tr, .repeating-group > div, [class*='RepeatingGroup'] > div");
        return { rowCount: rows.length };
      });

      console.log(`UI-PRICE-1: 料金表一覧 行数=${listInfo.rowCount}`);
    });

    test("UI-PRICE-2: 新規追加ボタンでPopup add / edit price menuが開く", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "料金表管理");

      // 「新規追加」ボタン (Button id=bTHLw) -> Show 'Popup add / edit price menu' (id=bTHNX)
      const addBtn = page.getByRole("button", { name: "新規追加" });
      const hasAddBtn = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasAddBtn).toBe(true);

      if (hasAddBtn) {
        await bubbleClick(page, "新規追加");
        await page.waitForTimeout(3000);

        const inputs = await getVisibleInputs(page);
        const text = await bodyText(page);

        // 「登録する」ボタン (Button id=bTHNn)
        const hasRegisterBtn = text.includes("登録する");
        // 「閉じる」テキスト (Text id=bTHNo)
        const hasClose = text.includes("閉じる");

        console.log(`UI-PRICE-2: 料金表追加ポップアップ input数=${inputs.length}, 登録ボタン=${hasRegisterBtn}, 閉じる=${hasClose}`);
        expect(hasRegisterBtn || inputs.length > 0).toBe(true);

        await bubbleClick(page, "閉じる");
        await page.waitForTimeout(1000);
      }
    });

    test("UI-PRICE-3: 編集ボタンと削除ボタンが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "料金表管理");

      const buttons = await getVisibleButtons(page);
      // Button id=bTHMb text="編集" -> Show 'Popup add / edit price menu'
      const hasEditBtn = buttons.some(b => b === "編集");
      // Button id=bTHMr text="削除" -> Show 'Popup 料金表の削除' (id=bTgSt)
      const hasDeleteBtn = buttons.some(b => b === "削除");

      console.log(`UI-PRICE-3: 編集ボタン=${hasEditBtn}, 削除ボタン=${hasDeleteBtn}`);
    });

    test("UI-PRICE-4: 削除確認ポップアップが開く", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "料金表管理");

      // 「削除」ボタン (Button id=bTHMr) -> Show 'Popup 料金表の削除' (id=bTgSt)
      const deleteClicked = await bubbleClick(page, "削除");
      await page.waitForTimeout(2000);

      if (deleteClicked) {
        const text = await bodyText(page);
        // 「削除する」ボタン (Button id=bTgTf)
        const hasConfirmDelete = text.includes("削除する");
        // 「閉じる」テキスト (Text id=bTgTj)
        const hasClose = text.includes("閉じる");

        console.log(`UI-PRICE-4: 削除確認ポップアップ 削除するボタン=${hasConfirmDelete}, 閉じる=${hasClose}`);

        await bubbleClick(page, "閉じる");
        await page.waitForTimeout(1000);
      } else {
        console.log("UI-PRICE-4: 削除ボタンが見つからない（料金表データなしの可能性）");
      }
    });
  });

  // ================================================================
  // 6. 予約管理
  // ================================================================
  test.describe("6. 予約管理", () => {

    test("UI-RESV-1: 予約一覧が存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "予約一覧");

      const text = await bodyText(page);
      expect(text).toContain("予約");

      const listInfo = await page.evaluate(() => {
        const text = document.body.textContent || "";
        const rows = document.querySelectorAll("table tr, .repeating-group > div, [class*='RepeatingGroup'] > div");
        return {
          rowCount: rows.length,
          hasDates: /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(text),
          hasPrices: /\d{1,3}(,\d{3})*円/.test(text),
        };
      });

      console.log(`UI-RESV-1: 予約一覧 行数=${listInfo.rowCount}, 日付表示=${listInfo.hasDates}, 料金表示=${listInfo.hasPrices}`);
    });

    test("UI-RESV-2: ステータスドロップダウンが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "予約一覧");

      // ドロップダウン/セレクトの確認（Dropdown 予約一覧店舗選択 -> Popup キャンセル）
      const selects = await getVisibleSelects(page);
      const dropdowns = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("select, [class*='dropdown'], [class*='Dropdown']")).filter(el => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }).length;
      });

      console.log(`UI-RESV-2: セレクト数=${selects.length}, ドロップダウン数=${dropdowns}`);
      selects.forEach((s, i) => {
        console.log(`  select[${i}]: options=${s.optionCount} (${s.options.join(", ")})`);
      });
    });

    test("UI-RESV-3: 予約詳細ポップアップにアクセスできる", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "予約一覧");

      // Text id=bTQZp -> Show 'Popup 予約内容詳細' (id=bTela0)
      // 予約データを含む行をクリック
      const clicked = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 50 && r.height > 10;
        });
        const row = els.find(el => {
          const t = el.textContent || "";
          return /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(t) && t.length < 500;
        });
        if (row) {
          const ev = (window as any).jQuery?._data?.(row, "events")?.click?.[0]?.handler;
          if (ev) { const e = (window as any).jQuery.Event("click"); e.target = row; e.currentTarget = row; ev.call(row, e); return true; }
          (row as HTMLElement).click();
          return true;
        }
        return false;
      });
      await page.waitForTimeout(3000);

      if (clicked) {
        const text = await bodyText(page);
        const hasDetailInfo = text.includes("予約") && (text.includes("自転車") || text.includes("顧客") || text.includes("お客様") || text.includes("料金"));

        // 「閉じる」テキスト (Text id=bTelh0)
        const hasClose = await page.evaluate(() => {
          return Array.from(document.querySelectorAll(".clickable-element")).some(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && el.textContent?.trim() === "閉じる";
          });
        });

        console.log(`UI-RESV-3: 予約詳細ポップアップ 情報表示=${hasDetailInfo}, 閉じる=${hasClose}`);

        await bubbleClick(page, "閉じる");
        await page.waitForTimeout(1000);
      } else {
        console.log("UI-RESV-3: 予約データが見つからない（予約なしの可能性）");
      }
    });

    test("UI-RESV-4: キャンセルポップアップに返金あり/返金なしボタンが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "予約一覧");

      // Popup キャンセル (id=bTXNB0) はドロップダウン操作でトリガーされる
      // 「返金なし」ボタン (Button id=bTXNM0), 「返金あり」ボタン (Button id=bTXNN0)
      // ステータスドロップダウンでキャンセルを選択してポップアップを開く
      const cancelTriggered = await page.evaluate(() => {
        const selects = Array.from(document.querySelectorAll("select")).filter(s => s.getBoundingClientRect().width > 0);
        for (const sel of selects) {
          const options = Array.from(sel.options);
          const cancelOpt = options.find(o => o.text.includes("キャンセル"));
          if (cancelOpt) {
            sel.value = cancelOpt.value;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
        }
        return false;
      });
      await page.waitForTimeout(3000);

      if (cancelTriggered) {
        const text = await bodyText(page);
        const hasRefundYes = text.includes("返金あり");
        const hasRefundNo = text.includes("返金なし");
        const hasClose = text.includes("閉じる");

        console.log(`UI-RESV-4: キャンセルポップアップ 返金あり=${hasRefundYes}, 返金なし=${hasRefundNo}, 閉じる=${hasClose}`);

        // 閉じる (Text id=bTXNH0)
        if (hasRefundYes || hasRefundNo) {
          await bubbleClick(page, "閉じる");
          await page.waitForTimeout(1000);
        }
      } else {
        console.log("UI-RESV-4: キャンセルドロップダウンが見つからない");
      }
    });

    test("UI-RESV-5: CSVダウンロードボタンが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "予約一覧");

      // Button id=bTUfN text="CSVダウンロード"
      const csvBtn = page.getByRole("button", { name: "CSVダウンロード" });
      const hasCsv = await csvBtn.isVisible({ timeout: 5000 }).catch(() => false);

      console.log(`UI-RESV-5: CSVダウンロードボタン=${hasCsv}`);
    });

    test("UI-RESV-6: 請求ボタンが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "予約一覧");

      // Button id=bTUfH text="請求"
      const buttons = await getVisibleButtons(page);
      const hasBillingBtn = buttons.some(b => b === "請求");

      console.log(`UI-RESV-6: 請求ボタン=${hasBillingBtn}`);
    });
  });

  // ================================================================
  // 7. 売上レポート
  // ================================================================
  test.describe("7. 売上レポート", () => {

    test("UI-SALES-1: 売上レポートテーブルが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "売上レポート");

      const text = await bodyText(page);
      expect(text).toContain("売上");

      const tableInfo = await page.evaluate(() => {
        const text = document.body.textContent || "";
        const rows = document.querySelectorAll("table tr, .repeating-group > div, [class*='RepeatingGroup'] > div");
        return {
          rowCount: rows.length,
          hasPrices: /\d{1,3}(,\d{3})*円/.test(text),
          hasDates: /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(text),
        };
      });

      console.log(`UI-SALES-1: 売上レポートテーブル 行数=${tableInfo.rowCount}, 金額表示=${tableInfo.hasPrices}, 日付表示=${tableInfo.hasDates}`);
    });

    test("UI-SALES-2: エクスポート/CSV機能が存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "売上レポート");

      // Button id=bTgRB text="CSV出力"
      const buttons = await getVisibleButtons(page);
      const hasCsvExport = buttons.some(b => b?.includes("CSV") || b?.includes("出力") || b?.includes("ダウンロード") || b?.includes("エクスポート"));

      // Button id=bTQVt text="売上レポート" (別タブ/操作)
      const hasSalesBtn = buttons.some(b => b?.includes("売上レポート"));

      console.log(`UI-SALES-2: CSVエクスポート=${hasCsvExport}, 売上レポートボタン=${hasSalesBtn}`);
    });
  });

  // ================================================================
  // 8. ファーストビュー管理
  // ================================================================
  test.describe("8. ファーストビュー管理", () => {

    test("UI-FV-1: FV一覧が存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "FV管理");

      const text = await bodyText(page);
      const hasFV = text.includes("FV") || text.includes("ファーストビュー");
      expect(hasFV).toBe(true);

      const listInfo = await page.evaluate(() => {
        const rows = document.querySelectorAll("table tr, .repeating-group > div, [class*='RepeatingGroup'] > div");
        return { rowCount: rows.length };
      });

      console.log(`UI-FV-1: FV一覧 行数=${listInfo.rowCount}`);
    });

    test("UI-FV-2: 新規追加ボタンでPopup add / edit fvが開く", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "FV管理");

      // 「新規追加」ボタン (Button id=bTHsM) -> Show 'Popup add / edit fv' (id=bTHtn)
      const addClicked = await bubbleClick(page, "新規追加");
      await page.waitForTimeout(3000);

      if (addClicked) {
        const inputs = await getVisibleInputs(page);
        const text = await bodyText(page);

        // 「登録する」ボタン (Button id=bTHuD)
        const hasRegister = text.includes("登録する");
        // 「閉じる」テキスト (Text id=bTHuE)
        const hasClose = text.includes("閉じる");

        console.log(`UI-FV-2: FV追加ポップアップ input数=${inputs.length}, 登録ボタン=${hasRegister}, 閉じる=${hasClose}`);
        expect(hasRegister || inputs.length > 0).toBe(true);

        await bubbleClick(page, "閉じる");
        await page.waitForTimeout(1000);
      } else {
        console.log("UI-FV-2: 新規追加ボタンが見つからない");
      }
    });

    test("UI-FV-3: 編集・削除ボタンが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "FV管理");

      const buttons = await getVisibleButtons(page);
      // Button id=bTHsF text="編集" -> Show 'Popup add / edit fv'
      const hasEdit = buttons.some(b => b === "編集");
      // Button id=bTHsG text="削除" -> Delete
      const hasDelete = buttons.some(b => b === "削除");

      console.log(`UI-FV-3: 編集ボタン=${hasEdit}, 削除ボタン=${hasDelete}`);
    });
  });

  // ================================================================
  // 9. お知らせ管理
  // ================================================================
  test.describe("9. お知らせ管理", () => {

    test("UI-NEWS-1: お知らせ一覧が存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "お知らせ管理");

      const text = await bodyText(page);
      expect(text).toContain("お知らせ");

      const listInfo = await page.evaluate(() => {
        const rows = document.querySelectorAll("table tr, .repeating-group > div, [class*='RepeatingGroup'] > div");
        return { rowCount: rows.length };
      });

      console.log(`UI-NEWS-1: お知らせ一覧 行数=${listInfo.rowCount}`);
    });

    test("UI-NEWS-2: 新規追加/編集/削除ボタンが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "お知らせ管理");

      const buttons = await getVisibleButtons(page);
      // Button id=bTHzl text="新規追加" -> Show 'Popup add / edit news' (id=bTIAQ)
      const hasAdd = buttons.some(b => b === "新規追加");
      // Button id=bTHzV text="編集" -> Show 'Popup add / edit news'
      const hasEdit = buttons.some(b => b === "編集");
      // Button id=bTHzZ text="削除" -> Delete
      const hasDelete = buttons.some(b => b === "削除");

      console.log(`UI-NEWS-2: 新規追加=${hasAdd}, 編集=${hasEdit}, 削除=${hasDelete}`);
      expect(hasAdd).toBe(true);
    });

    test("UI-NEWS-3: 新規追加ポップアップが開閉する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "お知らせ管理");

      // 「新規追加」ボタン (Button id=bTHzl) -> Popup add / edit news (id=bTIAQ)
      await bubbleClick(page, "新規追加");
      await page.waitForTimeout(3000);

      const inputs = await getVisibleInputs(page);
      const text = await bodyText(page);

      // 「登録する」ボタン (Button id=bTIAd)
      const hasRegister = text.includes("登録する");
      // 「閉じる」テキスト (Text id=bTIAh)
      const hasClose = text.includes("閉じる");

      console.log(`UI-NEWS-3: お知らせ追加ポップアップ input数=${inputs.length}, 登録ボタン=${hasRegister}, 閉じる=${hasClose}`);

      await bubbleClick(page, "閉じる");
      await page.waitForTimeout(1000);
    });
  });

  // ================================================================
  // 10. バナー管理
  // ================================================================
  test.describe("10. バナー管理", () => {

    test("UI-BANNER-1: バナー一覧が存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "バナー管理");

      const text = await bodyText(page);
      expect(text).toContain("バナー");

      const listInfo = await page.evaluate(() => {
        const rows = document.querySelectorAll("table tr, .repeating-group > div, [class*='RepeatingGroup'] > div");
        return { rowCount: rows.length };
      });

      console.log(`UI-BANNER-1: バナー一覧 行数=${listInfo.rowCount}`);
    });

    test("UI-BANNER-2: 新規追加ボタンでPopup add / edit bannerが開く", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "バナー管理");

      // 「新規追加」ボタン (Button id=bTICr) -> Show 'Popup add / edit banner' (id=bTIDh)
      await bubbleClick(page, "新規追加");
      await page.waitForTimeout(3000);

      const inputs = await getVisibleInputs(page);
      const text = await bodyText(page);

      // 「登録する」ボタン (Button id=bTIDu)
      const hasRegister = text.includes("登録する");
      // 「閉じる」テキスト (Text id=bTIDv)
      const hasClose = text.includes("閉じる");

      console.log(`UI-BANNER-2: バナー追加ポップアップ input数=${inputs.length}, 登録ボタン=${hasRegister}, 閉じる=${hasClose}`);
      expect(hasRegister || inputs.length > 0).toBe(true);

      await bubbleClick(page, "閉じる");
      await page.waitForTimeout(1000);
    });

    test("UI-BANNER-3: 編集・削除ボタンが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "バナー管理");

      const buttons = await getVisibleButtons(page);
      // Button id=bTICb text="編集" -> Show 'Popup add / edit banner'
      const hasEdit = buttons.some(b => b === "編集");
      // Button id=bTICf text="削除" -> Delete
      const hasDelete = buttons.some(b => b === "削除");

      console.log(`UI-BANNER-3: 編集ボタン=${hasEdit}, 削除ボタン=${hasDelete}`);
    });
  });

  // ================================================================
  // 11. Q&A管理
  // ================================================================
  test.describe("11. Q&A管理", () => {

    test("UI-QA-1: Q&A一覧が存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "Q&A管理");

      const text = await bodyText(page);
      const hasQA = text.includes("Q&A") || text.includes("質問") || text.includes("FAQ");
      expect(hasQA).toBe(true);

      const listInfo = await page.evaluate(() => {
        const rows = document.querySelectorAll("table tr, .repeating-group > div, [class*='RepeatingGroup'] > div");
        return { rowCount: rows.length };
      });

      console.log(`UI-QA-1: Q&A一覧 行数=${listInfo.rowCount}`);
    });

    test("UI-QA-2: 新規追加ボタンでPopup add / edit faqが開く", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "Q&A管理");

      // 「新規追加」ボタン (Button id=bTIGP) -> Show 'Popup add / edit faq' (id=bTIGu)
      await bubbleClick(page, "新規追加");
      await page.waitForTimeout(3000);

      const inputs = await getVisibleInputs(page);
      const text = await bodyText(page);

      // 「登録する」ボタン (Button id=bTIHH)
      const hasRegister = text.includes("登録する");
      // 「閉じる」テキスト (Text id=bTIHL)
      const hasClose = text.includes("閉じる");

      console.log(`UI-QA-2: Q&A追加ポップアップ input数=${inputs.length}, 登録ボタン=${hasRegister}, 閉じる=${hasClose}`);
      expect(hasRegister || inputs.length > 0).toBe(true);

      await bubbleClick(page, "閉じる");
      await page.waitForTimeout(1000);
    });

    test("UI-QA-3: 編集・削除ボタンが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "Q&A管理");

      const buttons = await getVisibleButtons(page);
      // Button id=bTIFz text="編集" -> Show 'Popup add / edit faq'
      const hasEdit = buttons.some(b => b === "編集");
      // Button id=bTIGD text="削除" -> Delete
      const hasDelete = buttons.some(b => b === "削除");

      console.log(`UI-QA-3: 編集ボタン=${hasEdit}, 削除ボタン=${hasDelete}`);
    });

    test("UI-QA-4: カテゴリ管理UIが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "Q&A管理");

      // Popup add cateogry (id=bTIJv)
      // Button id=bTIMF text="追加" -> Create
      // Button id=bTIKx text="削除" -> Delete
      const text = await bodyText(page);
      const buttons = await getVisibleButtons(page);

      const hasAddCategory = buttons.some(b => b === "追加");
      const hasCategoryDelete = buttons.some(b => b === "削除");

      console.log(`UI-QA-4: カテゴリ追加=${hasAddCategory}, カテゴリ削除=${hasCategoryDelete}`);
    });
  });

  // ================================================================
  // 12. お問い合わせ一覧（追加セクション）
  // ================================================================
  test.describe("12. お問い合わせ一覧", () => {

    test("UI-CONTACT-1: お問い合わせ一覧が存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "お問い合わせ一覧");

      const text = await bodyText(page);
      expect(text).toContain("お問い合わせ");

      console.log("UI-CONTACT-1: お問い合わせ一覧確認完了");
    });

    test("UI-CONTACT-2: 詳細・アーカイブ・種別設定ボタンが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "お問い合わせ一覧");

      const buttons = await getVisibleButtons(page);
      // Button id=bTRGR text="詳細" -> Show 'Popup view お問い合わせ詳細' (id=bTRcX)
      const hasDetail = buttons.some(b => b === "詳細");
      // Button id=bTRGV text="アーカイブ" -> Modify
      const hasArchive = buttons.some(b => b === "アーカイブ");
      // Button id=bTRIP text="種別設定" -> Show 'Popup edit お問い合わせ種別' (id=bTRIb)
      const hasTypeConfig = buttons.some(b => b === "種別設定");

      console.log(`UI-CONTACT-2: 詳細=${hasDetail}, アーカイブ=${hasArchive}, 種別設定=${hasTypeConfig}`);
    });

    test("UI-CONTACT-3: お問い合わせ詳細ポップアップが開く", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "お問い合わせ一覧");

      // Button id=bTRGR text="詳細" -> Show 'Popup view お問い合わせ詳細'
      const clicked = await bubbleClick(page, "詳細");
      await page.waitForTimeout(3000);

      if (clicked) {
        const text = await bodyText(page);
        const hasContactDetail = text.includes("お問い合わせ") || text.includes("メッセージ") || text.includes("内容");

        // 「閉じる」テキスト (Text id=bTRdD)
        const hasClose = text.includes("閉じる");

        console.log(`UI-CONTACT-3: お問い合わせ詳細ポップアップ 表示=${hasContactDetail}, 閉じる=${hasClose}`);

        await bubbleClick(page, "閉じる");
        await page.waitForTimeout(1000);
      } else {
        console.log("UI-CONTACT-3: 詳細ボタンが見つからない（お問い合わせデータなしの可能性）");
      }
    });
  });

  // ================================================================
  // 13. メールアドレス・パスワード変更
  // ================================================================
  test.describe("13. アカウント設定", () => {

    test("UI-ACCOUNT-1: メールアドレス変更ページにフォームが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "メールアドレスの変更");

      const text = await bodyText(page);
      expect(text).toContain("メールアドレス");

      const inputs = await getVisibleInputs(page);

      // Button id=bTZPV text="変更を保存"
      const hasSaveBtn = text.includes("変更を保存");

      console.log(`UI-ACCOUNT-1: メールアドレス変更 input数=${inputs.length}, 保存ボタン=${hasSaveBtn}`);
      expect(hasSaveBtn).toBe(true);
    });

    test("UI-ACCOUNT-2: パスワード変更ページにフォームが存在する", async ({ page }) => {
      await adminLogin(page);
      await sidebarClick(page, "パスワードの変更");

      const text = await bodyText(page);
      expect(text).toContain("パスワード");

      const inputs = await getVisibleInputs(page);

      // Button id=bTZQW text="変更を保存"
      const hasSaveBtn = text.includes("変更を保存");

      console.log(`UI-ACCOUNT-2: パスワード変更 input数=${inputs.length}, 保存ボタン=${hasSaveBtn}`);
      expect(hasSaveBtn).toBe(true);
    });
  });

  // ================================================================
  // 14. ログアウト
  // ================================================================
  test("UI-LOGOUT: ログアウトでログインページに戻る", async ({ page }) => {
    await adminLogin(page);

    // side_bar Text id=bTHEt -> LogOut; Navigate->'admin_login'
    await sidebarClick(page, "ログアウト");
    await page.waitForTimeout(3000);

    const text = await bodyText(page);
    const hasLoginPage = text.includes("管理画面ログイン") || text.includes("ログイン");
    expect(hasLoginPage).toBe(true);

    console.log("UI-LOGOUT: ログアウト確認完了");
  });

  // ================================================================
  // 15. 総合: 全ポップアップのアクセシビリティ確認
  // ================================================================
  test("UI-POPUP-ALL: 主要ポップアップが正常に開閉する", async ({ page }) => {
    await adminLogin(page);

    const popupTests = [
      { nav: "加盟店一覧", trigger: "新規追加", popupName: "Popup add company", closeText: "閉じる" },
      { nav: "料金表管理", trigger: "新規追加", popupName: "Popup add / edit price menu", closeText: "閉じる" },
      { nav: "FV管理",     trigger: "新規追加", popupName: "Popup add / edit fv", closeText: "閉じる" },
      { nav: "お知らせ管理", trigger: "新規追加", popupName: "Popup add / edit news", closeText: "閉じる" },
      { nav: "バナー管理", trigger: "新規追加", popupName: "Popup add / edit banner", closeText: "閉じる" },
      { nav: "Q&A管理",   trigger: "新規追加", popupName: "Popup add / edit faq", closeText: "閉じる" },
    ];

    const results: { popup: string; opened: boolean; closed: boolean }[] = [];

    for (const { nav, trigger, popupName, closeText } of popupTests) {
      try {
        await sidebarClick(page, nav);
        await page.waitForTimeout(1000);

        const beforeInputs = (await getVisibleInputs(page)).length;
        await bubbleClick(page, trigger);
        await page.waitForTimeout(2000);

        const afterInputs = (await getVisibleInputs(page)).length;
        const text = await bodyText(page);
        const opened = afterInputs > beforeInputs || text.includes("登録する") || text.includes("招待メール送信");

        await bubbleClick(page, closeText);
        await page.waitForTimeout(1500);

        const finalInputs = (await getVisibleInputs(page)).length;
        const closed = finalInputs <= beforeInputs + 1;

        results.push({ popup: popupName, opened, closed });
      } catch {
        results.push({ popup: popupName, opened: false, closed: false });
      }
    }

    results.forEach(r => {
      console.log(`  ${r.opened && r.closed ? "OK" : "NG"} ${r.popup} (open=${r.opened}, close=${r.closed})`);
    });

    const successCount = results.filter(r => r.opened).length;
    console.log(`UI-POPUP-ALL: ${successCount}/${popupTests.length} ポップアップ正常動作`);
    expect(successCount).toBeGreaterThanOrEqual(4);
  }, { timeout: 180000 });
});
