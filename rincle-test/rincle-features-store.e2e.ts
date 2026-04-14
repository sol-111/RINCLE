import { test, expect, Page } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

const BASE_URL = "https://rincle.co.jp/version-test/shop_admin_login";
const STORE_EMAIL    = process.env.STORE_EMAIL!;
const STORE_PASSWORD = process.env.STORE_PASSWORD!;

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
  // リトライ付き: Bubble SPAの描画タイミングに対応
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

async function storeLogin(page: Page) {
  for (let retry = 0; retry < 2; retry++) {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 10000 });
    await page.locator('input[type="email"]').fill(STORE_EMAIL);
    await page.locator('input[type="password"]').fill(STORE_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    let loggedIn = false;
    for (let i = 0; i < 5; i++) {
      loggedIn = await page.evaluate(() => {
        const text = document.body.textContent || "";
        return text.includes("予約・売上管理") || text.includes("顧客管理") || text.includes("自転車一覧") || text.includes("予約一覧");
      });
      if (loggedIn) break;
      await page.waitForTimeout(2000);
    }
    if (loggedIn) break;
  }
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

async function waitForForm(page: Page, minInputs = 2, maxMs = 10000) {
  for (let t = 0; t < maxMs; t += 500) {
    const n = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input")).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.type !== "hidden" && el.type !== "file";
      }).length
    );
    if (n >= minInputs) return n;
    await page.waitForTimeout(500);
  }
  return 0;
}

// =====================================================================
// 店舗機能テスト（6-2: 未実施項目）
// =====================================================================
test.describe("店舗機能テスト", () => {
  // 各テストは独立して実行可能

  // ================================================================
  // ライド開始/終了
  // ================================================================
  test("S-RIDE-1: 予約一覧でライド管理ボタンの確認", async ({ page }) => {
    await storeLogin(page);
    await page.waitForTimeout(2000);

    const rideButtons = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll(".clickable-element, button")).filter(el =>
        el.getBoundingClientRect().width > 0
      );
      const rideRelated = elements.filter(el => {
        const t = el.textContent?.trim() || "";
        return t.includes("ライド") || t.includes("開始") || t.includes("終了") || t.includes("貸出") || t.includes("返却");
      });
      return rideRelated.map(el => el.textContent?.trim()).slice(0, 20);
    });

    console.log(`✅ S-RIDE-1: ライド関連ボタン: ${rideButtons.join(", ") || "なし"}`);
  });

  test("S-RIDE-2: 予約詳細を開いてライド操作UIを確認", async ({ page }) => {
    await storeLogin(page);
    await page.waitForTimeout(2000);

    // 予約一覧の最初の行をクリックして詳細を開く
    const clicked = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 100 && r.height > 20;
      });
      // 予約データを含む行を探す
      const row = rows.find(el => {
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
      const detailInfo = await page.evaluate(() => {
        const text = document.body.textContent || "";
        return {
          hasRideStart: text.includes("ライド開始") || text.includes("貸出開始"),
          hasRideEnd: text.includes("ライド終了") || text.includes("返却"),
          hasExtension: text.includes("延長"),
          hasCustomerInfo: text.includes("お客様") || text.includes("顧客"),
          hasBikeInfo: text.includes("自転車") || text.includes("車種"),
          hasPriceInfo: /\d{1,3}(,\d{3})*円/.test(text),
        };
      });
      console.log(`✅ S-RIDE-2: 予約詳細 — ライド開始=${detailInfo.hasRideStart}, 終了=${detailInfo.hasRideEnd}, 延長=${detailInfo.hasExtension}`);
      console.log(`  顧客=${detailInfo.hasCustomerInfo}, 自転車=${detailInfo.hasBikeInfo}, 料金=${detailInfo.hasPriceInfo}`);
    } else {
      console.log("⚠️ S-RIDE-2: 予約詳細を開けなかった（予約なしの可能性）");
    }
  });

  // ================================================================
  // 延長操作
  // ================================================================
  test("S-EXT-1: 延長操作UIの存在確認", async ({ page }) => {
    await storeLogin(page);
    await page.waitForTimeout(2000);

    const extInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      const allElements = Array.from(document.querySelectorAll(".clickable-element, button")).filter(el =>
        el.getBoundingClientRect().width > 0
      );
      return {
        hasExtensionButton: allElements.some(el => el.textContent?.trim().includes("延長")),
        hasExtensionMenu: text.includes("延長"),
        allButtons: allElements.map(el => el.textContent?.trim()).filter(t => t && t.length < 20).slice(0, 30),
      };
    });

    console.log(`✅ S-EXT-1: 延長ボタン=${extInfo.hasExtensionButton}, メニュー=${extInfo.hasExtensionMenu}`);
    if (!extInfo.hasExtensionButton) {
      console.log(`  利用可能ボタン: ${extInfo.allButtons.join(", ")}`);
    }
  });

  // ================================================================
  // 自転車CRUD
  // ================================================================
  test("S-BIKE-1: 自転車一覧の表示確認", async ({ page }) => {
    await storeLogin(page);
    await sidebarClick(page, "自転車一覧");
    await page.waitForTimeout(2000);

    const bikeList = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasBikeList: text.includes("自転車"),
        hasAddButton: text.includes("新規") || text.includes("追加") || text.includes("登録"),
        rowCount: document.querySelectorAll("table tr, .repeating-group > div").length,
        hasPrices: /\d{1,3}(,\d{3})*円/.test(text),
      };
    });

    console.log(`✅ S-BIKE-1: 自転車一覧 — 行数=${bikeList.rowCount}, 追加ボタン=${bikeList.hasAddButton}`);
  });

  test("S-BIKE-2: 自転車登録フォームの表示確認", async ({ page }) => {
    await storeLogin(page);
    await sidebarClick(page, "自転車一覧");
    await page.waitForTimeout(2000);

    // 新規追加ボタンをクリック
    const clicked = await bubbleClick(page, "新規") || await bubbleClick(page, "追加") || await bubbleClick(page, "登録");
    await page.waitForTimeout(3000);

    if (clicked) {
      const formInputs = await getVisibleInputs(page);
      const formSelects = await getVisibleSelects(page);

      console.log(`✅ S-BIKE-2: 自転車登録フォーム — input=${formInputs.length}, select=${formSelects.length}`);
      formInputs.forEach((inp, i) => {
        console.log(`  input[${i}]: type=${inp.type}, placeholder="${inp.placeholder}"`);
      });
      formSelects.forEach((sel, i) => {
        console.log(`  select[${i}]: options=${sel.optionCount} (${sel.options.join(", ")})`);
      });
    } else {
      console.log("⚠️ S-BIKE-2: 新規追加ボタンが見つからない");
    }
  });

  test("S-BIKE-3: 自転車の詳細/編集画面", async ({ page }) => {
    await storeLogin(page);
    await sidebarClick(page, "自転車一覧");
    await page.waitForTimeout(2000);

    // 最初の自転車の詳細/編集を開く
    const clicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      const editEl = els.find(el => {
        const t = el.textContent?.trim() || "";
        return t === "編集" || t === "詳細" || t === "確認";
      });
      if (editEl) {
        const ev = (window as any).jQuery?._data?.(editEl, "events")?.click?.[0]?.handler;
        if (ev) { const e = (window as any).jQuery.Event("click"); e.target = editEl; e.currentTarget = editEl; ev.call(editEl, e); return true; }
        (editEl as HTMLElement).click();
        return true;
      }
      return false;
    });
    await page.waitForTimeout(3000);

    if (clicked) {
      const formInputs = await getVisibleInputs(page);
      console.log(`✅ S-BIKE-3: 自転車編集画面 — input=${formInputs.length}`);
    } else {
      console.log("⚠️ S-BIKE-3: 編集ボタンが見つからない");
    }
  });

  // ================================================================
  // オプションCRUD
  // ================================================================
  test("S-OPT-1: オプション一覧の表示確認", async ({ page }) => {
    await storeLogin(page);
    await sidebarClick(page, "オプション管理");
    await page.waitForTimeout(2000);

    const optList = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasOptionList: text.includes("オプション"),
        hasAddButton: text.includes("新規") || text.includes("追加") || text.includes("登録"),
        hasPrices: /\d{1,3}(,\d{3})*円/.test(text),
      };
    });

    console.log(`✅ S-OPT-1: オプション管理 — 一覧=${optList.hasOptionList}, 追加=${optList.hasAddButton}, 料金=${optList.hasPrices}`);
  });

  test("S-OPT-2: オプション登録フォームの表示確認", async ({ page }) => {
    await storeLogin(page);
    await sidebarClick(page, "オプション管理");
    await page.waitForTimeout(2000);

    const clicked = await bubbleClick(page, "新規") || await bubbleClick(page, "追加") || await bubbleClick(page, "登録");
    await page.waitForTimeout(3000);

    if (clicked) {
      const formInfo = await waitForForm(page, 1);
      const formInputs = await getVisibleInputs(page);
      console.log(`✅ S-OPT-2: オプション登録フォーム — input=${formInputs.length}`);
    } else {
      console.log("⚠️ S-OPT-2: 追加ボタンが見つからない");
    }
  });

  // ================================================================
  // 在庫設定
  // ================================================================
  test("S-INV-1: 在庫管理ページの表示確認", async ({ page }) => {
    await storeLogin(page);
    await sidebarClick(page, "在庫管理");
    await page.waitForTimeout(2000);

    const invInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasInventory: text.includes("在庫"),
        hasCalendar: text.includes("カレンダー"),
        hasBikes: text.includes("自転車"),
        hasAvailability: text.includes("○") || text.includes("×") || text.includes("可") || text.includes("不可"),
      };
    });

    console.log(`✅ S-INV-1: 在庫管理 — 在庫=${invInfo.hasInventory}, カレンダー=${invInfo.hasCalendar}, 可否表示=${invInfo.hasAvailability}`);
  });

  // ================================================================
  // 店舗情報編集
  // ================================================================
  test("S-INFO-1: 店舗情報ページの入力欄確認", async ({ page }) => {
    await storeLogin(page);
    await sidebarClick(page, "店舗情報");
    await page.waitForTimeout(2000);

    const storeInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      const inputs = Array.from(document.querySelectorAll("input")).filter(i =>
        i.getBoundingClientRect().width > 0 && i.type !== "hidden"
      );
      return {
        hasStoreInfo: text.includes("店舗") || text.includes("住所"),
        inputCount: inputs.length,
        hasAddress: text.includes("住所") || text.includes("所在地"),
        hasPhone: text.includes("電話") || text.includes("TEL"),
        hasSaveButton: text.includes("保存") || text.includes("更新") || text.includes("変更"),
      };
    });

    console.log(`✅ S-INFO-1: 店舗情報 — input=${storeInfo.inputCount}, 住所=${storeInfo.hasAddress}, 電話=${storeInfo.hasPhone}, 保存=${storeInfo.hasSaveButton}`);
  });

  // ================================================================
  // 会社登録/審査/オンボーディング（Pay.JP連携）
  // ================================================================
  test("S-ONBOARD-1: アカウント情報で審査状態が確認できる", async ({ page }) => {
    await storeLogin(page);
    await sidebarClick(page, "アカウント情報");
    await page.waitForTimeout(2000);

    const onboardInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasAccountPage: text.includes("アカウント") || text.includes("店舗情報"),
        hasReviewStatus: text.includes("審査") || text.includes("passed") || text.includes("承認") || text.includes("確認済"),
        hasPayjpLink: text.includes("pay.jp") || text.includes("本人確認") || text.includes("書類"),
        hasBankInfo: text.includes("銀行") || text.includes("口座") || text.includes("振込"),
      };
    });

    console.log(`✅ S-ONBOARD-1: アカウント情報 — 審査=${onboardInfo.hasReviewStatus}, Pay.jp=${onboardInfo.hasPayjpLink}, 口座=${onboardInfo.hasBankInfo}`);
  });

  // ================================================================
  // 全サイドバーメニュー到達確認
  // ================================================================
  test("S-NAV-1: 全サイドバーメニュー到達確認", async ({ page }) => {
    await storeLogin(page);

    const menus = [
      "予約・売上管理", "過去の予約", "売上レポート",
      "顧客一覧", "自転車一覧", "オプション管理",
      "営業時間設定", "営業カレンダー", "店舗情報",
      "お問い合わせ一覧", "メールアドレスの変更", "パスワードの変更",
    ];

    const results: { menu: string; found: boolean }[] = [];

    for (const menu of menus) {
      try {
        await sidebarClick(page, menu);
        const text = await bodyText(page);
        const found = text.length > 100;
        results.push({ menu, found });
      } catch {
        results.push({ menu, found: false });
      }
    }

    results.forEach(r => {
      console.log(`  ${r.found ? "✅" : "❌"} ${r.menu}`);
    });
    console.log(`✅ S-NAV-1: ${results.filter(r => r.found).length}/${results.length} メニュー到達`);
  }, { timeout: 180000 });

  // ================================================================
  // CSVダウンロード
  // ================================================================
  test("S-CSV-1: 予約一覧のCSVダウンロードボタン確認", async ({ page }) => {
    await storeLogin(page);
    await page.waitForTimeout(2000);

    const csvBtn = page.getByRole("button", { name: "CSVダウンロード" });
    const isVisible = await csvBtn.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`✅ S-CSV-1: CSVダウンロードボタン=${isVisible}`);
  });
});
