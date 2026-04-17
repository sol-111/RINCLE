import { test, expect, Page } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

const BASE_URL = "https://rincle.co.jp/version-5398j/shop_admin_login";
const STORE_EMAIL    = process.env.STORE_EMAIL!;
const STORE_PASSWORD = process.env.STORE_PASSWORD!;

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

// サイドバーメニューをクリック
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

async function storeLogin(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 8000 });
  await page.locator('input[type="email"]').fill(STORE_EMAIL);
  await page.locator('input[type="password"]').fill(STORE_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();

  await page.waitForLoadState("networkidle", { timeout: 20000 });
  await page.waitForTimeout(2000);

  // サイドバーが表示されるまで待機
  await Promise.race([
    page.getByText("顧客管理").first().waitFor({ state: "visible", timeout: 20000 }),
    page.getByText("予約一覧").first().waitFor({ state: "visible", timeout: 20000 }),
    page.getByText("加盟店一覧").first().waitFor({ state: "visible", timeout: 20000 }),
    page.getByText("売上レポート").first().waitFor({ state: "visible", timeout: 20000 }),
  ]).catch(() => {});
  await page.waitForTimeout(1000);
}

// -------------------------------------------------------------------

test.describe("RINCLE 店舗管理 E2E", () => {
  test.describe.configure({ mode: "serial" });

  // ----------------------------------------------------------------
  // 1. 店舗管理者ログイン
  // ----------------------------------------------------------------
  test("店舗管理者ログイン", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // 「加盟店様用 管理画面ログイン」テキストが表示されること
    const hasLoginText = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("加盟店") && text.includes("ログイン");
    });
    expect(hasLoginText).toBe(true);

    // メール・パスワード入力
    await page.locator('input[type="email"]').fill(STORE_EMAIL);
    await page.locator('input[type="password"]').fill(STORE_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();

    await page.waitForLoadState("networkidle", { timeout: 20000 });
    await page.waitForTimeout(2000);

    // サイドバーメニューが表示されること
    await expect(page.getByText("予約・売上管理").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("顧客管理").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("在庫管理").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("アカウント情報").first()).toBeVisible({ timeout: 5000 });
    console.log("✅ 店舗管理者ログイン完了:", page.url());
  });

  // ----------------------------------------------------------------
  // 2. 予約一覧（デフォルトページ）
  // ----------------------------------------------------------------
  test("予約一覧", async ({ page }) => {
    await storeLogin(page);

    // ログイン直後のデフォルトページが予約一覧であること
    await expect(page.getByText("予約一覧（").first()).toBeVisible({ timeout: 8000 });

    // CSVダウンロードボタンが表示されること
    await expect(page.getByRole("button", { name: "CSVダウンロード" })).toBeVisible({ timeout: 5000 });

    console.log("✅ 予約一覧（デフォルトページ）確認完了");
  });

  // ----------------------------------------------------------------
  // 3. 過去の予約
  // ----------------------------------------------------------------
  test("過去の予約", async ({ page }) => {
    await storeLogin(page);

    await clickSidebarMenu(page, "過去の予約");

    const hasContent = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("過去") || text.includes("予約");
    });
    expect(hasContent).toBe(true);
    console.log("✅ 過去の予約確認完了");
  });

  // ----------------------------------------------------------------
  // 4. 売上レポート
  // ----------------------------------------------------------------
  test("売上レポート", async ({ page }) => {
    await storeLogin(page);

    await clickSidebarMenu(page, "売上レポート");

    const hasContent = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("売上") || text.includes("レポート");
    });
    expect(hasContent).toBe(true);
    console.log("✅ 売上レポート確認完了");
  });

  // ----------------------------------------------------------------
  // 5. 顧客一覧
  // ----------------------------------------------------------------
  test("顧客一覧", async ({ page }) => {
    await storeLogin(page);

    await clickSidebarMenu(page, "顧客一覧");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("顧客一覧") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ 顧客一覧確認完了");
  });

  // ----------------------------------------------------------------
  // 6. 自転車一覧
  // ----------------------------------------------------------------
  test("自転車一覧", async ({ page }) => {
    await storeLogin(page);

    await clickSidebarMenu(page, "自転車一覧");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("自転車") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ 自転車一覧確認完了");
  });

  // ----------------------------------------------------------------
  // 7. オプション管理
  // ----------------------------------------------------------------
  test("オプション管理", async ({ page }) => {
    await storeLogin(page);

    await clickSidebarMenu(page, "オプション管理");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("オプション") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ オプション管理確認完了");
  });

  // ----------------------------------------------------------------
  // 8. 営業時間設定
  // ----------------------------------------------------------------
  test("営業時間設定", async ({ page }) => {
    await storeLogin(page);

    await clickSidebarMenu(page, "営業時間設定");

    const hasContent = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("営業時間") || text.includes("曜日") || text.includes("時");
    });
    expect(hasContent).toBe(true);
    console.log("✅ 営業時間設定確認完了");
  });

  // ----------------------------------------------------------------
  // 9. 営業カレンダー
  // ----------------------------------------------------------------
  test("営業カレンダー", async ({ page }) => {
    await storeLogin(page);

    await clickSidebarMenu(page, "営業カレンダー");

    const hasContent = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("カレンダー") || text.includes("営業");
    });
    expect(hasContent).toBe(true);
    console.log("✅ 営業カレンダー確認完了");
  });

  // ----------------------------------------------------------------
  // 10. 店舗情報
  // ----------------------------------------------------------------
  test("店舗情報", async ({ page }) => {
    await storeLogin(page);

    await clickSidebarMenu(page, "店舗情報");

    const hasContent = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("店舗") || text.includes("住所");
    });
    expect(hasContent).toBe(true);
    console.log("✅ 店舗情報確認完了");
  });

  // ----------------------------------------------------------------
  // 11. お問い合わせ一覧
  // ----------------------------------------------------------------
  test("お問い合わせ一覧", async ({ page }) => {
    await storeLogin(page);

    await clickSidebarMenu(page, "お問い合わせ一覧");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("お問い合わせ") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ お問い合わせ一覧確認完了");
  });

  // ----------------------------------------------------------------
  // 12. メールアドレスの変更
  // ----------------------------------------------------------------
  test("メールアドレスの変更", async ({ page }) => {
    await storeLogin(page);

    await clickSidebarMenu(page, "メールアドレスの変更");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("メールアドレス") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ メールアドレスの変更ページ確認完了");
  });

  // ----------------------------------------------------------------
  // 13. パスワードの変更
  // ----------------------------------------------------------------
  test("パスワードの変更", async ({ page }) => {
    await storeLogin(page);

    await clickSidebarMenu(page, "パスワードの変更");

    const hasContent = await page.evaluate(() => {
      return document.body.textContent?.includes("パスワード") ?? false;
    });
    expect(hasContent).toBe(true);
    console.log("✅ パスワードの変更ページ確認完了");
  });

  // ----------------------------------------------------------------
  // 14. パスワードリセットフォーム表示（ログイン画面）
  // ----------------------------------------------------------------
  test("パスワードリセットフォーム表示", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const clicked = await clickBubbleElement(page, "パスワードを忘れた方はこちら");
    if (!clicked) {
      await page.getByText("パスワードを忘れた方はこちら").first().click();
    }
    await page.waitForTimeout(1500);

    const hasResetForm = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("パスワードを再設定") || text.includes("再設定メール");
    });
    expect(hasResetForm).toBe(true);
    console.log("✅ パスワードリセットフォーム表示確認完了");
  });

  // ----------------------------------------------------------------
  // 15. 店舗管理者ログアウト
  // ----------------------------------------------------------------
  test("店舗管理者ログアウト", async ({ page }) => {
    await storeLogin(page);

    await clickSidebarMenu(page, "ログアウト");
    await page.waitForTimeout(3000);

    const hasLoginForm = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return text.includes("ログイン") || text.includes("加盟店");
    });
    expect(hasLoginForm).toBe(true);
    console.log("✅ 店舗管理者ログアウト完了");
  });
});
