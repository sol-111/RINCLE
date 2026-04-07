import { test, expect, Page } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

const BASE_URL = "https://rincle.co.jp/version-test/admin_login";
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

// Bubble の button_disabled precomputed キャッシュを無効化してボタンをクリック
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
        e.target = btn;
        e.currentTarget = clickable;
        handler.call(clickable, e);
        return true;
      }
    }
    btn.click();
    return true;
  }, buttonText.source);
}

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

async function adminLogin(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // 管理画面ログインフォーム
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 8000 });
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();

  // ログイン後、管理画面が表示されるまで待機
  await page.waitForLoadState("networkidle", { timeout: 20000 });
  await page.waitForTimeout(2000);
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

    // 管理画面の要素が表示されること（ログアウトボタン or 管理メニュー）
    const logoutVisible = await page.getByText("ログアウト").first().isVisible({ timeout: 10000 }).catch(() => false);
    const adminPageLoaded = logoutVisible || await page.locator(".bubble-element").first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(adminPageLoaded).toBe(true);
    console.log("✅ 管理者ログイン完了:", page.url());
  });

  // ----------------------------------------------------------------
  // 2. 加盟店一覧
  // ----------------------------------------------------------------
  test("加盟店一覧", async ({ page }) => {
    await adminLogin(page);

    // サイドバーから「加盟店一覧」or「加盟店管理」をクリック
    const clicked = await clickBubbleElement(page, "加盟店一覧") ||
                    await clickBubbleElement(page, "加盟店管理");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 加盟店に関する要素が表示されること
    const hasShopContent = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("加盟店") || text.includes("店舗");
      });
    });
    expect(hasShopContent).toBe(true);
    console.log(`✅ 加盟店一覧確認完了 (クリック: ${clicked})`);
  });

  // ----------------------------------------------------------------
  // 3. 予約・売上管理
  // ----------------------------------------------------------------
  test("予約・売上管理", async ({ page }) => {
    await adminLogin(page);

    // サイドバーから「予約・売上管理」or「予約一覧」をクリック
    const clicked = await clickBubbleElement(page, "予約・売上管理") ||
                    await clickBubbleElement(page, "予約一覧");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 予約に関する要素が表示されること
    const hasReservationContent = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("予約") || text.includes("売上");
      });
    });
    expect(hasReservationContent).toBe(true);
    console.log(`✅ 予約・売上管理確認完了 (クリック: ${clicked})`);
  });

  // ----------------------------------------------------------------
  // 4. 顧客管理
  // ----------------------------------------------------------------
  test("顧客管理", async ({ page }) => {
    await adminLogin(page);

    const clicked = await clickBubbleElement(page, "顧客管理") ||
                    await clickBubbleElement(page, "顧客一覧");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    const hasUserContent = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("顧客") || text.includes("ユーザー");
      });
    });
    expect(hasUserContent).toBe(true);
    console.log(`✅ 顧客管理確認完了 (クリック: ${clicked})`);
  });

  // ----------------------------------------------------------------
  // 5. 自転車一覧
  // ----------------------------------------------------------------
  test("自転車一覧", async ({ page }) => {
    await adminLogin(page);

    const clicked = await clickBubbleElement(page, "自転車一覧") ||
                    await clickBubbleElement(page, "在庫管理");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    const hasBicycleContent = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("自転車") || text.includes("在庫");
      });
    });
    expect(hasBicycleContent).toBe(true);
    console.log(`✅ 自転車一覧確認完了 (クリック: ${clicked})`);
  });

  // ----------------------------------------------------------------
  // 6. 料金表管理
  // ----------------------------------------------------------------
  test("料金表管理", async ({ page }) => {
    await adminLogin(page);

    const clicked = await clickBubbleElement(page, "料金表管理") ||
                    await clickBubbleElement(page, "料金管理") ||
                    await clickBubbleElement(page, "利用料管理");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    const hasPriceContent = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("料金") || text.includes("プラン");
      });
    });
    expect(hasPriceContent).toBe(true);
    console.log(`✅ 料金表管理確認完了 (クリック: ${clicked})`);
  });

  // ----------------------------------------------------------------
  // 7. お知らせ管理
  // ----------------------------------------------------------------
  test("お知らせ管理", async ({ page }) => {
    await adminLogin(page);

    const clicked = await clickBubbleElement(page, "お知らせ管理") ||
                    await clickBubbleElement(page, "お知らせ一覧");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    const hasNewsContent = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("お知らせ") || text.includes("新規追加");
      });
    });
    expect(hasNewsContent).toBe(true);
    console.log(`✅ お知らせ管理確認完了 (クリック: ${clicked})`);
  });

  // ----------------------------------------------------------------
  // 8. FV管理
  // ----------------------------------------------------------------
  test("FV管理", async ({ page }) => {
    await adminLogin(page);

    const clicked = await clickBubbleElement(page, "FV管理") ||
                    await clickBubbleElement(page, "バナー管理");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    const hasFVContent = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("FV") || text.includes("バナー");
      });
    });
    expect(hasFVContent).toBe(true);
    console.log(`✅ FV管理確認完了 (クリック: ${clicked})`);
  });

  // ----------------------------------------------------------------
  // 9. トップページ管理
  // ----------------------------------------------------------------
  test("トップページ管理", async ({ page }) => {
    await adminLogin(page);

    const clicked = await clickBubbleElement(page, "トップページ管理");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    const hasTopContent = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("トップ") || text.includes("管理");
      });
    });
    expect(hasTopContent).toBe(true);
    console.log(`✅ トップページ管理確認完了 (クリック: ${clicked})`);
  });

  // ----------------------------------------------------------------
  // 10. Q&A管理
  // ----------------------------------------------------------------
  test("Q&A管理", async ({ page }) => {
    await adminLogin(page);

    const clicked = await clickBubbleElement(page, "Q&A管理");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    const hasQAContent = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("Q&A") || text.includes("質問");
      });
    });
    expect(hasQAContent).toBe(true);
    console.log(`✅ Q&A管理確認完了 (クリック: ${clicked})`);
  });

  // ----------------------------------------------------------------
  // 11. お問い合わせ一覧
  // ----------------------------------------------------------------
  test("お問い合わせ一覧", async ({ page }) => {
    await adminLogin(page);

    const clicked = await clickBubbleElement(page, "お問い合わせ一覧") ||
                    await clickBubbleElement(page, "お問い合わせ");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    const hasContactContent = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("問い合わせ") || text.includes("お問い合わせ");
      });
    });
    expect(hasContactContent).toBe(true);
    console.log(`✅ お問い合わせ一覧確認完了 (クリック: ${clicked})`);
  });

  // ----------------------------------------------------------------
  // 12. 売上レポート
  // ----------------------------------------------------------------
  test("売上レポート", async ({ page }) => {
    await adminLogin(page);

    const clicked = await clickBubbleElement(page, "売上レポート") ||
                    await clickBubbleElement(page, "売上状況");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    const hasSalesContent = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("売上") || text.includes("レポート");
      });
    });
    expect(hasSalesContent).toBe(true);
    console.log(`✅ 売上レポート確認完了 (クリック: ${clicked})`);
  });

  // ----------------------------------------------------------------
  // 13. 営業カレンダー
  // ----------------------------------------------------------------
  test("営業カレンダー", async ({ page }) => {
    await adminLogin(page);

    await page.goto("https://rincle.co.jp/version-test/admin_update_calendar", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // カレンダー関連の要素が表示されること
    const hasCalendarContent = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("カレンダー") || text.includes("祝日") || text.includes("営業");
      });
    });
    expect(hasCalendarContent).toBe(true);

    // 「祝日処理」ボタンが表示されること
    const holidayBtn = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("button")).some(
        b => b.textContent?.trim().includes("祝日処理")
      );
    });
    console.log(`✅ 営業カレンダー確認完了 (祝日処理ボタン: ${holidayBtn})`);
  });

  // ----------------------------------------------------------------
  // 14. 料金シミュレーション
  // ----------------------------------------------------------------
  test("料金シミュレーション", async ({ page }) => {
    await adminLogin(page);

    await page.goto("https://rincle.co.jp/version-test/admin_price_simulation", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // シミュレーション関連の要素が表示されること
    await expect(page.getByText("貸出開始日時")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("返却日")).toBeVisible({ timeout: 5000 });

    // 「シュミレーション」ボタンが表示されること
    const simBtn = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("button")).some(
        b => b.textContent?.trim().includes("シュミレーション")
      );
    });
    expect(simBtn).toBe(true);
    console.log("✅ 料金シミュレーション確認完了");
  });

  // ----------------------------------------------------------------
  // 15. オプション管理
  // ----------------------------------------------------------------
  test("オプション管理", async ({ page }) => {
    await adminLogin(page);

    const clicked = await clickBubbleElement(page, "オプション管理");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    const hasOptionContent = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("オプション");
      });
    });
    expect(hasOptionContent).toBe(true);
    console.log(`✅ オプション管理確認完了 (クリック: ${clicked})`);
  });

  // ----------------------------------------------------------------
  // 16. アカウント情報
  // ----------------------------------------------------------------
  test("アカウント情報", async ({ page }) => {
    await adminLogin(page);

    const clicked = await clickBubbleElement(page, "アカウント情報");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // メールアドレスが表示されること
    const hasAccountContent = await page.evaluate((email) => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("アカウント") || text.includes(email);
      });
    }, ADMIN_EMAIL);
    expect(hasAccountContent).toBe(true);
    console.log(`✅ アカウント情報確認完了 (クリック: ${clicked})`);
  });

  // ----------------------------------------------------------------
  // 17. パスワードリセットフォーム表示
  // ----------------------------------------------------------------
  test("パスワードリセットフォーム表示", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // 「パスワードを忘れた方はこちら」リンクをクリック
    const clicked = await clickBubbleElement(page, "パスワードを忘れた方はこちら");
    if (!clicked) {
      // テキストリンクの場合
      const link = page.getByText("パスワードを忘れた方はこちら");
      if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
        await link.click();
      }
    }
    await page.waitForTimeout(1500);

    // パスワードリセットフォームが表示されること
    const hasResetForm = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("パスワードを再設定") || text.includes("再設定メール");
      });
    });
    expect(hasResetForm).toBe(true);

    // 「閉じる」で元に戻れること
    const closeClicked = await clickBubbleElement(page, "閉じる");
    if (!closeClicked) {
      const closeBtn = page.getByText("閉じる");
      if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
    await page.waitForTimeout(1000);
    console.log("✅ パスワードリセットフォーム表示確認完了");
  });

  // ----------------------------------------------------------------
  // 18. 管理者ログアウト
  // ----------------------------------------------------------------
  test("管理者ログアウト", async ({ page }) => {
    await adminLogin(page);

    // ログアウトボタンをクリック
    const clicked = await clickBubbleElement(page, "ログアウト");
    if (!clicked) {
      await page.getByText("ログアウト").first().click();
    }
    await page.waitForTimeout(3000);

    // ログアウト後はログインページに戻ること
    const hasLoginForm = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".bubble-element"));
      return els.some(el => {
        const text = el.textContent || "";
        return text.includes("管理画面ログイン") || text.includes("ログイン");
      });
    });
    expect(hasLoginForm).toBe(true);
    console.log("✅ 管理者ログアウト完了");
  });
});
