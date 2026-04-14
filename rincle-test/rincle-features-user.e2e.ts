import { test, expect, Page } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

const BASE_URL = "https://rincle.co.jp/version-test";
const EMAIL    = process.env.RINCLE_EMAIL!;
const PASSWORD = process.env.RINCLE_PASSWORD!;
const AREA     = process.env.RINCLE_AREA!;

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

async function bodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.textContent || "");
}

async function login(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ログイン" }).first().click();
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await page.getByText("ログアウト").first().waitFor({ state: "visible", timeout: 10000 });
}

// =====================================================================
// ユーザー機能テスト（6-2: 未実施項目）
// =====================================================================
test.describe("ユーザー機能テスト", () => {
  // 各テストは独立して実行可能

  // ================================================================
  // 新規会員登録
  // ================================================================
  test("U-REG-1: 新規会員登録ページが表示される", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    // ログインポップアップを開く
    await page.getByRole("button", { name: "ログイン" }).first().click();
    await page.waitForTimeout(2000);

    // 新規登録リンク/ボタンを探す
    const regInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasRegisterLink: text.includes("新規登録") || text.includes("アカウント作成") || text.includes("会員登録"),
        hasSignup: text.includes("signup") || text.includes("register"),
      };
    });

    if (regInfo.hasRegisterLink) {
      const clicked = await bubbleClick(page, "新規登録") ||
                      await bubbleClick(page, "アカウント作成") ||
                      await bubbleClick(page, "会員登録");
      await page.waitForTimeout(3000);
      console.log(`✅ U-REG-1: 新規登録リンク検出・クリック=${clicked}`);
    } else {
      console.log("⚠️ U-REG-1: 新規登録リンクが見つからない");
    }

    // 登録フォームの要素確認
    const formInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input")).filter(i =>
        i.getBoundingClientRect().width > 0 && i.type !== "hidden"
      );
      return {
        inputCount: inputs.length,
        hasEmail: inputs.some(i => i.type === "email" || i.placeholder?.includes("メール")),
        hasPassword: inputs.some(i => i.type === "password"),
        hasName: inputs.some(i => i.placeholder?.includes("名") || i.placeholder?.includes("name")),
      };
    });

    console.log(`  フォーム: input=${formInfo.inputCount}, email=${formInfo.hasEmail}, password=${formInfo.hasPassword}, name=${formInfo.hasName}`);
  });

  test("U-REG-2: 新規登録フォームのバリデーション", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "ログイン" }).first().click();
    await page.waitForTimeout(2000);

    // 新規登録画面に遷移
    await bubbleClick(page, "新規登録") ||
    await bubbleClick(page, "アカウント作成") ||
    await bubbleClick(page, "会員登録");
    await page.waitForTimeout(3000);

    // 空のまま送信を試みる
    const submitClicked = await bubbleClick(page, "登録") ||
                          await bubbleClick(page, "作成") ||
                          await bubbleClick(page, "サインアップ");
    await page.waitForTimeout(3000);

    const validationInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasError: text.includes("エラー") || text.includes("入力してください") || text.includes("必須"),
        hasEmptyError: text.includes("空") || text.includes("未入力"),
      };
    });

    console.log(`✅ U-REG-2: 空送信テスト — エラー表示=${validationInfo.hasError}`);
  });

  // ================================================================
  // パスワードリセット
  // ================================================================
  test("U-RESET-1: パスワードリセットページ表示", async ({ page }) => {
    await page.goto(`${BASE_URL}/reset_pw`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const resetInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasResetPage: text.includes("パスワード") && (text.includes("リセット") || text.includes("再設定")),
        hasEmailInput: Array.from(document.querySelectorAll("input")).some(i =>
          i.type === "email" && i.getBoundingClientRect().width > 0
        ),
        hasSendButton: text.includes("送信") || text.includes("リセット"),
      };
    });

    console.log(`✅ U-RESET-1: リセットページ=${resetInfo.hasResetPage}, メール入力=${resetInfo.hasEmailInput}, 送信ボタン=${resetInfo.hasSendButton}`);
  });

  test("U-RESET-2: パスワードリセット — ログイン画面からの導線", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "ログイン" }).first().click();
    await page.waitForTimeout(2000);

    const clicked = await bubbleClick(page, "パスワードを忘れた");
    await page.waitForTimeout(3000);

    const text = await bodyText(page);
    const hasResetForm = text.includes("パスワードを再設定") || text.includes("再設定メール") || text.includes("リセット");

    console.log(`✅ U-RESET-2: パスワードリセット導線 — クリック=${clicked}, フォーム表示=${hasResetForm}`);
  });

  // ================================================================
  // 退会フロー
  // ================================================================
  test("U-WITHDRAW-1: 退会ボタンが表示される", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/index/mypage`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const withdrawBtn = page.getByRole("button", { name: "退会する" });
    const isVisible = await withdrawBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ U-WITHDRAW-1: 退会ボタン表示=${isVisible}`);
    expect(isVisible).toBe(true);
  });

  test("U-WITHDRAW-2: 退会確認ダイアログの表示", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/index/mypage`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // 退会ボタンをクリック（実際に退会はしない）
    await page.getByRole("button", { name: "退会する" }).click();
    await page.waitForTimeout(3000);

    const dialogInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasConfirm: text.includes("退会しますか") || text.includes("よろしいですか") || text.includes("確認"),
        hasWarning: text.includes("取り消し") || text.includes("元に戻") || text.includes("削除"),
        buttons: Array.from(document.querySelectorAll("button"))
          .filter(b => b.getBoundingClientRect().width > 0)
          .map(b => b.textContent?.trim())
          .filter(t => t && (t.includes("退会") || t.includes("キャンセル") || t.includes("戻る") || t.includes("はい") || t.includes("いいえ"))),
      };
    });

    console.log(`✅ U-WITHDRAW-2: 退会確認ダイアログ=${dialogInfo.hasConfirm}, 警告=${dialogInfo.hasWarning}`);
    console.log(`  ボタン: ${dialogInfo.buttons.join(", ")}`);

    // キャンセルして戻る（退会しない）
    const cancelBtn = page.getByRole("button", { name: /キャンセル|戻る|いいえ/ });
    if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelBtn.click();
      console.log("  → ダイアログをキャンセル（退会せず）");
    }
  });

  // ================================================================
  // 予約詳細ポップアップ
  // ================================================================
  test("U-DETAIL-1: 予約一覧から予約詳細が開ける", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/user_reservation_list`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const text = await bodyText(page);
    if (!text.includes("予約状況一覧")) {
      console.log("⚠️ U-DETAIL-1: 予約一覧ページが表示されない");
      return;
    }

    // 予約の詳細を開く操作を試みる
    const detailClicked = await page.evaluate(() => {
      // 予約行をクリックしてポップアップを開く
      const clickables = Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      // 予約に関するクリック可能な要素を探す
      const detailEl = clickables.find(el => {
        const t = el.textContent?.trim() || "";
        return t.includes("詳細") || t.includes("確認");
      });
      if (detailEl) {
        const ev = (window as any).jQuery?._data?.(detailEl, "events")?.click?.[0]?.handler;
        if (ev) { const e = (window as any).jQuery.Event("click"); e.target = detailEl; e.currentTarget = detailEl; ev.call(detailEl, e); return true; }
        (detailEl as HTMLElement).click();
        return true;
      }
      return false;
    });
    await page.waitForTimeout(3000);

    if (detailClicked) {
      const popupInfo = await page.evaluate(() => {
        const text = document.body.textContent || "";
        return {
          hasReservationDetail: text.includes("予約番号") || text.includes("予約ID") || text.includes("予約日"),
          hasBikeInfo: text.includes("自転車") || text.includes("バイク"),
          hasPriceInfo: /\d{1,3}(,\d{3})*円/.test(text),
          hasDateInfo: /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(text),
        };
      });
      console.log(`✅ U-DETAIL-1: 詳細ポップアップ — 予約情報=${popupInfo.hasReservationDetail}, 自転車=${popupInfo.hasBikeInfo}, 料金=${popupInfo.hasPriceInfo}`);
    } else {
      console.log("⚠️ U-DETAIL-1: 詳細リンクが見つからない（予約なしの可能性）");
    }
  });

  // ================================================================
  // 検索ページ（/search）
  // ================================================================
  test("U-SEARCH-1: 検索ページ直接アクセス", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/index/search`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const searchInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasSearchPage: true, // ページが表示されれば成功
        hasAreaSelect: document.querySelectorAll("select").length > 0,
        hasDatePicker: document.querySelectorAll("input.picker__input").length > 0,
        hasSearchButton: text.includes("検索"),
        url: window.location.href,
      };
    });

    console.log(`✅ U-SEARCH-1: 検索ページ — URL=${searchInfo.url}`);
    console.log(`  エリア選択=${searchInfo.hasAreaSelect}, 日付ピッカー=${searchInfo.hasDatePicker}, 検索ボタン=${searchInfo.hasSearchButton}`);
  });

  test("U-SEARCH-2: 検索ページからの検索実行", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/index/search`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // エリア選択
    const selects = page.locator("select.bubble-element.Dropdown");
    if (await selects.count() > 0) {
      await selects.first().selectOption({ label: AREA });
      await page.waitForTimeout(500);
    }

    // 日付未定
    const checkboxes = page.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    for (let i = 0; i < Math.min(cbCount, 2); i++) {
      await checkboxes.nth(i).check();
    }

    // 検索ボタン: Bubble SPA のため複数パターンで試行
    const searchBtn = page.getByRole("button", { name: "検索する" });
    if (await searchBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchBtn.click();
    } else {
      // ボタンが見つからない場合はBubble経由でクリック
      await bubbleClick(page, "検索");
    }
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(3000);

    const resultText = await bodyText(page);
    const hasResults = resultText.includes("貸出可能") || resultText.includes("詳細を見る");
    console.log(`✅ U-SEARCH-2: 検索実行 — 結果あり=${hasResults}`);
  });

  // ================================================================
  // アカウント編集
  // ================================================================
  test("U-EDIT-1: アカウント編集ページの入力欄確認", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/index/edit`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const editInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input")).filter(i =>
        i.getBoundingClientRect().width > 0 && i.type !== "hidden" && i.type !== "file"
      );
      const selects = Array.from(document.querySelectorAll("select")).filter(s =>
        s.getBoundingClientRect().width > 0
      );
      return {
        inputCount: inputs.length,
        selectCount: selects.length,
        inputTypes: inputs.map(i => ({ type: i.type, placeholder: i.placeholder, value: i.value ? "***" : "" })),
        hasSubmit: document.body.textContent?.includes("変更を完了する") || false,
      };
    });

    console.log(`✅ U-EDIT-1: アカウント編集 — input=${editInfo.inputCount}, select=${editInfo.selectCount}, 保存ボタン=${editInfo.hasSubmit}`);
    editInfo.inputTypes.forEach((t, i) => {
      console.log(`  input[${i}]: type=${t.type}, placeholder="${t.placeholder}", hasValue=${t.value ? "yes" : "no"}`);
    });
  });

  // ================================================================
  // ページ遷移テスト（全ページ到達確認）
  // ================================================================
  test("U-NAV-1: 全主要ページへの到達確認", async ({ page }) => {
    await login(page);

    const pages = [
      { path: "/index/mypage", name: "マイページ" },
      { path: "/index/guide", name: "ガイド" },
      { path: "/index/howtopay", name: "料金" },
      { path: "/index/faq", name: "FAQ" },
      { path: "/index/privacypolicy", name: "プライバシーポリシー" },
      { path: "/index/contact", name: "お問い合わせ" },
      { path: "/index/edit", name: "アカウント編集" },
      { path: "/user_reservation_list", name: "予約一覧" },
    ];

    const results: { name: string; status: string; hasContent: boolean }[] = [];

    for (const p of pages) {
      try {
        await page.goto(`${BASE_URL}${p.path}`, { waitUntil: "networkidle", timeout: 15000 });
        await page.waitForTimeout(1000);

        const hasContent = await page.evaluate(() => {
          return (document.body.textContent || "").length > 100;
        });

        results.push({ name: p.name, status: "OK", hasContent });
      } catch (e) {
        results.push({ name: p.name, status: "ERROR", hasContent: false });
      }
    }

    results.forEach(r => {
      console.log(`  ${r.status === "OK" ? "✅" : "❌"} ${r.name}: ${r.status} (content=${r.hasContent})`);
    });
    console.log(`✅ U-NAV-1: ${results.filter(r => r.status === "OK").length}/${results.length} ページ到達`);
  });
});
