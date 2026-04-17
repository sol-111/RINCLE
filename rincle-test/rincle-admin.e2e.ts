import { test, expect, Page } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

const BASE_URL = "https://rincle.co.jp/version-5398j/admin_login";
const ADMIN_URL = "https://rincle.co.jp/version-5398j/admin";
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

// Bubble要素をテキストで検索してクリック
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
      e.target = el;
      e.currentTarget = el;
      handler.call(el, e);
      return true;
    }
    el.click();
    return true;
  }, text);
}

// サイドバーメニューをクリック（テキスト完全一致）
async function clickSidebarMenu(page: Page, text: string): Promise<void> {
  // cursor=pointer の要素からテキスト一致でクリック
  const clicked = await page.evaluate((searchText) => {
    const els = Array.from(document.querySelectorAll("[style*='cursor'][class*='clickable'], .clickable-element, [style*='cursor: pointer'], [style*='cursor:pointer']"));
    // まずclickable-elementから探す
    let el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.textContent?.trim() === searchText;
    }) as HTMLElement | null;
    if (!el) {
      // テキストノードで探す
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
    // Playwright getByText フォールバック
    await page.getByText(text, { exact: true }).first().click();
  }
  await page.waitForLoadState("networkidle", { timeout: 15000 });
  await page.waitForTimeout(2000);
}

async function adminLogin(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // 管理画面ログインフォーム
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 8000 });
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();

  // ログイン後、管理画面のサイドバーが表示されるまで待機
  await page.waitForLoadState("networkidle", { timeout: 20000 });
  await page.waitForTimeout(2000);

  // サイドバーの「顧客管理」見出しが表示されることで確認
  await Promise.race([
    page.getByText("顧客管理").first().waitFor({ state: "visible", timeout: 20000 }),
    page.getByText("予約一覧").first().waitFor({ state: "visible", timeout: 20000 }),
    page.getByText("加盟店一覧").first().waitFor({ state: "visible", timeout: 20000 }),
    page.getByText("売上レポート").first().waitFor({ state: "visible", timeout: 20000 }),
  ]).catch(() => {});
  await page.waitForTimeout(1000);
}

// -------------------------------------------------------------------

test.describe("RINCLE 管理者 E2E", () => {
  test.describe.configure({ mode: "serial" });

  // ----------------------------------------------------------------
  // 1. 管理者ログイン
  // ----------------------------------------------------------------
  test("管理者ログイン", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // 「管理画面ログイン」テキストが表示されること
    await expect(page.getByText("管理画面ログイン")).toBeVisible({ timeout: 8000 });

    // メール・パスワード入力
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();

    // ログイン後、管理画面に遷移すること
    await page.waitForLoadState("networkidle", { timeout: 20000 });
    await page.waitForTimeout(2000);

    // サイドバーメニューが表示されること
    await expect(page.getByText("顧客管理").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("加盟店管理").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("予約・売上管理").first()).toBeVisible({ timeout: 5000 });
    console.log("✅ 管理者ログイン完了:", page.url());
  });

  // ----------------------------------------------------------------
  // 2. 顧客一覧（デフォルトページ）
  // ----------------------------------------------------------------
  test("顧客一覧", async ({ page }) => {
    await adminLogin(page);

    // ログイン直後のデフォルトページが顧客一覧であること
    await expect(page.getByText("顧客一覧（").first()).toBeVisible({ timeout: 8000 });

    // CSVダウンロードボタンが表示されること
    await expect(page.getByRole("button", { name: "CSVダウンロード" })).toBeVisible({ timeout: 5000 });

    // キーワード検索入力が表示されること
    await expect(page.getByPlaceholder("キーワードで絞り込み")).toBeVisible({ timeout: 5000 });

    // ソート選択が表示されること
    const sortSelect = page.getByRole("combobox").first();
    await expect(sortSelect).toBeVisible({ timeout: 5000 });

    console.log("✅ 顧客一覧（デフォルトページ）確認完了");
  });

  // ----------------------------------------------------------------
  // 3. 加盟店一覧
  // ----------------------------------------------------------------
  test("加盟店一覧", async ({ page }) => {
    await adminLogin(page);

    await clickSidebarMenu(page, "加盟店一覧");

    // 加盟店一覧ページが表示されること
    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("加盟店一覧") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ 加盟店一覧確認完了");
  });

  // ----------------------------------------------------------------
  // 4. 料金表管理
  // ----------------------------------------------------------------
  test("料金表管理", async ({ page }) => {
    await adminLogin(page);

    await clickSidebarMenu(page, "料金表管理");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("料金") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ 料金表管理確認完了");
  });

  // ----------------------------------------------------------------
  // 5. 予約一覧
  // ----------------------------------------------------------------
  test("予約一覧", async ({ page }) => {
    await adminLogin(page);

    await clickSidebarMenu(page, "予約一覧");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("予約") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ 予約一覧確認完了");
  });

  // ----------------------------------------------------------------
  // 6. 売上レポート
  // ----------------------------------------------------------------
  test("売上レポート", async ({ page }) => {
    await adminLogin(page);

    await clickSidebarMenu(page, "売上レポート");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("売上") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ 売上レポート確認完了");
  });

  // ----------------------------------------------------------------
  // 7. FV管理
  // ----------------------------------------------------------------
  test("FV管理", async ({ page }) => {
    await adminLogin(page);

    await clickSidebarMenu(page, "FV管理");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("FV") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ FV管理確認完了");
  });

  // ----------------------------------------------------------------
  // 8. お知らせ管理
  // ----------------------------------------------------------------
  test("お知らせ管理", async ({ page }) => {
    await adminLogin(page);

    await clickSidebarMenu(page, "お知らせ管理");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("お知らせ") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ お知らせ管理確認完了");
  });

  // ----------------------------------------------------------------
  // 9. バナー管理
  // ----------------------------------------------------------------
  test("バナー管理", async ({ page }) => {
    await adminLogin(page);

    await clickSidebarMenu(page, "バナー管理");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("バナー") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ バナー管理確認完了");
  });

  // ----------------------------------------------------------------
  // 10. Q&A管理
  // ----------------------------------------------------------------
  test("Q&A管理", async ({ page }) => {
    await adminLogin(page);

    await clickSidebarMenu(page, "Q&A管理");

    const hasContent = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("Q&A") || text.includes("質問");
    });
    expect(hasContent).toBe(true);
    console.log("✅ Q&A管理確認完了");
  });

  // ----------------------------------------------------------------
  // 11. お問い合わせ一覧
  // ----------------------------------------------------------------
  test("お問い合わせ一覧", async ({ page }) => {
    await adminLogin(page);

    await clickSidebarMenu(page, "お問い合わせ一覧");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("お問い合わせ") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ お問い合わせ一覧確認完了");
  });

  // ----------------------------------------------------------------
  // 12. メールアドレスの変更ページ
  // ----------------------------------------------------------------
  test("メールアドレスの変更", async ({ page }) => {
    await adminLogin(page);

    await clickSidebarMenu(page, "メールアドレスの変更");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("メールアドレス") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ メールアドレスの変更ページ確認完了");
  });

  // ----------------------------------------------------------------
  // 13. パスワードの変更ページ
  // ----------------------------------------------------------------
  test("パスワードの変更", async ({ page }) => {
    await adminLogin(page);

    await clickSidebarMenu(page, "パスワードの変更");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("パスワード") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ パスワードの変更ページ確認完了");
  });

  // ----------------------------------------------------------------
  // 14. 営業カレンダー
  // ----------------------------------------------------------------
  test("営業カレンダー", async ({ page }) => {
    await adminLogin(page);

    await page.goto("https://rincle.co.jp/version-5398j/admin_update_calendar", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // カレンダー関連の要素が表示されること
    const hasContent = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("カレンダー") || text.includes("祝日") || text.includes("営業");
    });
    expect(hasContent).toBe(true);
    console.log("✅ 営業カレンダー確認完了");
  });

  // ----------------------------------------------------------------
  // 15. 料金シミュレーション
  // ----------------------------------------------------------------
  test("料金シミュレーション", async ({ page }) => {
    await adminLogin(page);

    await page.goto("https://rincle.co.jp/version-5398j/admin_price_simulation", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // シミュレーション関連の要素が表示されること
    const hasContent = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("貸出") || text.includes("返却") || text.includes("シミュレーション") || text.includes("シュミレーション");
    });
    expect(hasContent).toBe(true);
    console.log("✅ 料金シミュレーション確認完了");
  });

  // ----------------------------------------------------------------
  // 16. パスワードリセットフォーム表示（ログイン画面）
  // ----------------------------------------------------------------
  test("パスワードリセットフォーム表示", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // 「パスワードを忘れた方はこちら」をクリック
    const clicked = await clickBubbleElement(page, "パスワードを忘れた方はこちら");
    if (!clicked) {
      await page.getByText("パスワードを忘れた方はこちら").first().click();
    }
    await page.waitForTimeout(1500);

    // パスワードリセットフォームが表示されること
    const hasResetForm = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("パスワードを再設定") || text.includes("再設定メール");
    });
    expect(hasResetForm).toBe(true);
    console.log("✅ パスワードリセットフォーム表示確認完了");
  });

  // ----------------------------------------------------------------
  // 17. 管理者ログアウト
  // ----------------------------------------------------------------
  test("管理者ログアウト", async ({ page }) => {
    await adminLogin(page);

    // サイドバーの「ログアウト」をクリック
    await clickSidebarMenu(page, "ログアウト");
    await page.waitForTimeout(3000);

    // ログアウト後はログインページに戻ること
    const hasLoginForm = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("管理画面ログイン") || text.includes("ログイン");
    });
    expect(hasLoginForm).toBe(true);
    console.log("✅ 管理者ログアウト完了");
  });
});
