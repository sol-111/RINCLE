import { test, expect, Page } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

// ============================================================================
// システム管理者E2E（新アプリ・version-43erq 対応版 2026-07-13）
// 旧アプリ版（version-5398j/admin_login）から全面書き換え。
//
// 新アプリの管理者画面の構造（実地調査 2026-07-13）:
//   - ログイン: /admin_signin?role=admin&mode=sign_in → 成功で /admin/customer?role=admin
//   - サイドナビ: 顧客一覧 / 加盟店一覧 / 料金表管理 / 予約一覧 / 売上レポート /
//                 FV管理 / ニュース(新着情報)管理 / お知らせ管理 / Q&A管理 /
//                 お問い合わせ一覧 / 設定
//   - セクションURL: /admin/{customer|...}?role=admin（ナビクリックで遷移）
//
// 読み取り専用（表示確認のみ）。データは一切変更しない。
// ============================================================================

const BASE_URL = "https://rincle.co.jp/version-43erq";
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

async function freshenIfStale(page: Page) {
  const stale = await page.getByText("アプリが更新されました").first().isVisible().catch(() => false);
  if (stale) {
    console.log("⚠️ アプリ更新バナーを検出 → リロード");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(3000);
  }
}

// 管理者ログイン。成功判定はサイドナビ「加盟店一覧」の表示。
async function adminLogin(page: Page) {
  // 一時的なネットワーク断（ERR_NETWORK_CHANGED等）にも耐えるよう試行全体をtryで包む
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}/admin_signin?role=admin&mode=sign_in`, { waitUntil: "domcontentloaded" });
      await freshenIfStale(page);
      await page.locator('input[type="email"]').first().waitFor({ state: "visible", timeout: 20000 });
      await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
      await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: /ログイン/ }).first().click();
      await page.waitForURL(/\/admin\//, { timeout: 15000 });
      await page.getByText("加盟店一覧").first().waitFor({ state: "visible", timeout: 15000 });
      return;
    } catch (e) {
      console.log(`⚠️ ログイン試行${attempt + 1}回目失敗: ${String(e).split("\n")[0]}`);
      await page.waitForTimeout(3000);
    }
  }
  throw new Error("管理者ログインに失敗しました（/admin_signin?role=admin 経由・3回試行）");
}

// サイドナビのラベルをクリックして該当セクションへ
async function gotoNav(page: Page, label: string) {
  await page.getByText(label, { exact: true }).first().click();
  await page.waitForTimeout(5000);
  await freshenIfStale(page);
}

test.describe("RINCLE 管理者E2E", () => {

  test("管理者ログイン", async ({ page }) => {
    await adminLogin(page);
    for (const nav of ["顧客一覧", "加盟店一覧", "料金表管理", "予約一覧", "売上レポート", "お問い合わせ一覧"]) {
      await expect(page.getByText(nav, { exact: true }).first(), `サイドナビ「${nav}」がありません`).toBeVisible();
    }
    console.log("✅ 管理者ログイン完了（サイドナビ6項目確認）");
  });

  test("顧客一覧", async ({ page }) => {
    await adminLogin(page);
    // ログイン直後の着地ページが顧客一覧
    await expect(page.getByText(/顧客一覧（\d+）/).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("CSVダウンロード").first()).toBeVisible();
    const countText = await page.getByText(/顧客一覧（\d+）/).first().textContent();
    const count = Number(countText?.match(/（(\d+)）/)?.[1] ?? 0);
    expect(count, "顧客が0件です（テスト環境に顧客データがあるはず）").toBeGreaterThan(0);
    await expect(page.getByText("詳細", { exact: true }).first(), "顧客行の「詳細」ボタンがありません").toBeVisible();
    console.log(`✅ 顧客一覧表示確認完了（${count}件）`);
  });

  test("加盟店一覧", async ({ page }) => {
    await adminLogin(page);
    await gotoNav(page, "加盟店一覧");
    const text = await page.evaluate(() => document.body.innerText);
    expect(/加盟店一覧/.test(text), "加盟店一覧の見出しがありません").toBe(true);
    // テスト店舗（SEINO自転車 or 株式会社SEINO）が載っていること
    expect(/SEINO/.test(text), "加盟店一覧にテスト店舗（SEINO）が見つかりません").toBe(true);
    console.log("✅ 加盟店一覧表示確認完了（テスト店舗の掲載確認）");
  });

  test("予約一覧（管理者）", async ({ page }) => {
    await adminLogin(page);
    await gotoNav(page, "予約一覧");
    // 管理者の予約一覧にはCSVダウンロードは無い（店舗側のみ・2026-07-13実測）
    const heading = page.getByText(/予約一覧（\d+）/).first();
    await expect(heading).toBeVisible({ timeout: 15000 });
    const count = Number((await heading.textContent())?.match(/（(\d+)）/)?.[1] ?? 0);
    expect(count, "予約が0件です（全店舗分が集計されるはず）").toBeGreaterThan(0);
    console.log(`✅ 管理者の予約一覧表示確認完了（${count}件）`);
    console.log("✅ 管理者の予約一覧表示確認完了");
  });

  test("売上レポート", async ({ page }) => {
    await adminLogin(page);
    await gotoNav(page, "売上レポート");
    const text = await page.evaluate(() => document.body.innerText);
    expect(/売上/.test(text), "売上レポートの内容が表示されていません").toBe(true);
    console.log("✅ 売上レポート表示確認完了");
  });

  test("料金表管理", async ({ page }) => {
    await adminLogin(page);
    await gotoNav(page, "料金表管理");
    const text = await page.evaluate(() => document.body.innerText);
    expect(/料金/.test(text), "料金表管理の内容が表示されていません").toBe(true);
    console.log("✅ 料金表管理表示確認完了");
  });

  test("お問い合わせ一覧", async ({ page }) => {
    await adminLogin(page);
    await gotoNav(page, "お問い合わせ一覧");
    const text = await page.evaluate(() => document.body.innerText);
    expect(/お問い合わせ/.test(text), "お問い合わせ一覧が表示されていません").toBe(true);
    console.log("✅ お問い合わせ一覧表示確認完了");
  });

  test("管理者ログアウト", async ({ page }) => {
    await adminLogin(page);
    await page.getByText("ログアウト", { exact: true }).first().click();
    await page.waitForTimeout(5000);
    const stillIn = await page.getByText("加盟店一覧", { exact: true }).first().isVisible().catch(() => false);
    expect(stillIn, "ログアウト後も管理画面が表示されています").toBe(false);
    console.log("✅ 管理者ログアウト完了");
  });
});
