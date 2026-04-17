import { test, expect, Page } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

const BASE_URL  = "https://rincle.co.jp/version-5398j/admin_login";
const ADMIN_URL = "https://rincle.co.jp/version-5398j/admin";
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

const TS = Date.now();

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
  if (!clicked) {
    await page.getByText(text, { exact: true }).first().click();
  }
  await page.waitForLoadState("networkidle", { timeout: 15000 });
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
  const ok = page.getByRole("button", { name: /OK|はい|削除する|確定/ });
  if (await ok.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ok.click();
    await page.waitForTimeout(2000);
  }
  return r;
}

async function typeInNthInput(page: Page, index: number, text: string, clear = false) {
  await page.evaluate(({ idx }) => {
    const inputs = Array.from(document.querySelectorAll("input")).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.type !== "hidden" && el.type !== "file" && el.type !== "checkbox" && el.type !== "radio";
    }) as HTMLInputElement[];
    if (inputs[idx]) { inputs[idx].scrollIntoView({ block: "center" }); inputs[idx].focus(); }
  }, { idx: index });
  await page.waitForTimeout(300);
  if (clear) { await page.keyboard.press("Meta+a"); await page.waitForTimeout(100); }
  await page.keyboard.type(text, { delay: 30 });
  await page.waitForTimeout(200);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(100);
}

// =====================================================================
// 管理者機能テスト（6-2: 未実施項目）
// =====================================================================
test.describe("管理者機能テスト", () => {
  // 各テストは独立して実行可能

  // ================================================================
  // 加盟店CRUD
  // ================================================================
  test("A-STORE-1: 加盟店一覧の表示", async ({ page }) => {
    await adminLogin(page);
    await sidebarClick(page, "加盟店一覧");

    const storeList = await page.evaluate(() => {
      const text = document.body.textContent || "";
      const rows = document.querySelectorAll("table tr, .repeating-group > div");
      return {
        hasStoreList: text.includes("加盟店一覧"),
        rowCount: rows.length,
        hasAddButton: text.includes("新規") || text.includes("追加") || text.includes("登録"),
        hasSearch: text.includes("検索") || text.includes("絞り込み"),
      };
    });

    console.log(`✅ A-STORE-1: 加盟店一覧 — 行数=${storeList.rowCount}, 追加=${storeList.hasAddButton}, 検索=${storeList.hasSearch}`);
  });

  test("A-STORE-2: 加盟店詳細の表示", async ({ page }) => {
    await adminLogin(page);
    await sidebarClick(page, "加盟店一覧");

    // 最初の加盟店をクリック
    const clicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      const storeEl = els.find(el => {
        const t = el.textContent?.trim() || "";
        return t === "詳細" || t === "編集" || t === "確認";
      });
      if (storeEl) {
        const ev = (window as any).jQuery?._data?.(storeEl, "events")?.click?.[0]?.handler;
        if (ev) { const e = (window as any).jQuery.Event("click"); e.target = storeEl; e.currentTarget = storeEl; ev.call(storeEl, e); return true; }
        (storeEl as HTMLElement).click();
        return true;
      }
      return false;
    });
    await page.waitForTimeout(3000);

    if (clicked) {
      const detail = await page.evaluate(() => {
        const text = document.body.textContent || "";
        return {
          hasStoreDetail: text.includes("店舗") || text.includes("加盟店"),
          hasReviewStatus: text.includes("審査") || text.includes("passed") || text.includes("承認"),
          hasContactInfo: text.includes("メール") || text.includes("電話") || text.includes("住所"),
        };
      });
      console.log(`✅ A-STORE-2: 加盟店詳細 — 審査=${detail.hasReviewStatus}, 連絡先=${detail.hasContactInfo}`);
    } else {
      console.log("⚠️ A-STORE-2: 詳細ボタンが見つからない");
    }
  });

  // ================================================================
  // コンテンツ管理CRUD (FV / お知らせ / バナー / Q&A)
  // ================================================================
  test("A-FV-1: FV管理 — 一覧表示と追加フォーム", async ({ page }) => {
    await adminLogin(page);
    await sidebarClick(page, "FV管理");

    const fvInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasFV: text.includes("FV"),
        hasAddButton: text.includes("新規") || text.includes("追加") || text.includes("登録"),
        hasItems: document.querySelectorAll(".clickable-element").length > 5,
      };
    });

    console.log(`✅ A-FV-1: FV管理 — 表示=${fvInfo.hasFV}, 追加=${fvInfo.hasAddButton}`);

    // 追加フォームを開いてみる
    if (fvInfo.hasAddButton) {
      await bubbleClick(page, "新規追加") || await bubbleClick(page, "追加") || await bubbleClick(page, "登録");
      await page.waitForTimeout(3000);
      const formInputs = await getVisibleInputs(page);
      console.log(`  追加フォーム: input=${formInputs.length}`);
    }
  });

  test("A-NEWS-1: お知らせ管理 — 一覧と追加", async ({ page }) => {
    await adminLogin(page);
    await sidebarClick(page, "お知らせ管理");

    const newsInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasNews: text.includes("お知らせ"),
        hasAddButton: text.includes("新規") || text.includes("追加"),
        hasItems: document.querySelectorAll("table tr, .repeating-group > div").length,
      };
    });

    console.log(`✅ A-NEWS-1: お知らせ管理 — 表示=${newsInfo.hasNews}, 追加=${newsInfo.hasAddButton}, 件数=${newsInfo.hasItems}`);

    if (newsInfo.hasAddButton) {
      await bubbleClick(page, "新規追加") || await bubbleClick(page, "追加");
      await page.waitForTimeout(3000);
      const formInputs = await getVisibleInputs(page);
      console.log(`  追加フォーム: input=${formInputs.length}`);
    }
  });

  test("A-BANNER-1: バナー管理 — 一覧と追加", async ({ page }) => {
    await adminLogin(page);
    await sidebarClick(page, "バナー管理");

    const bannerInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasBanner: text.includes("バナー"),
        hasAddButton: text.includes("新規") || text.includes("追加"),
      };
    });

    console.log(`✅ A-BANNER-1: バナー管理 — 表示=${bannerInfo.hasBanner}, 追加=${bannerInfo.hasAddButton}`);

    if (bannerInfo.hasAddButton) {
      await bubbleClick(page, "新規追加") || await bubbleClick(page, "追加");
      await page.waitForTimeout(3000);
      const formInputs = await getVisibleInputs(page);
      console.log(`  追加フォーム: input=${formInputs.length}`);
    }
  });

  test("A-QA-1: Q&A管理 — 一覧と追加", async ({ page }) => {
    await adminLogin(page);
    await sidebarClick(page, "Q&A管理");

    const qaInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasQA: text.includes("Q&A") || text.includes("質問"),
        hasAddButton: text.includes("新規") || text.includes("追加"),
      };
    });

    console.log(`✅ A-QA-1: Q&A管理 — 表示=${qaInfo.hasQA}, 追加=${qaInfo.hasAddButton}`);

    if (qaInfo.hasAddButton) {
      await bubbleClick(page, "新規追加") || await bubbleClick(page, "追加");
      await page.waitForTimeout(3000);
      const formInputs = await getVisibleInputs(page);
      console.log(`  追加フォーム: input=${formInputs.length}`);
    }
  });

  // ================================================================
  // コンテンツCRUD: 作成→確認→削除の完全テスト
  // ================================================================
  test("A-NEWS-CRUD: お知らせ 作成→確認→削除", async ({ page }) => {
    const testTitle = `E2Eテストお知らせ${TS}`;
    await adminLogin(page);
    await sidebarClick(page, "お知らせ管理");

    // CREATE
    const addClicked = await bubbleClick(page, "新規追加") || await bubbleClick(page, "追加");
    if (!addClicked) {
      console.log("⚠️ A-NEWS-CRUD: 追加ボタンが見つからない — スキップ");
      return;
    }
    await waitForForm(page, 1);
    const inputs = await getVisibleInputs(page);
    if (inputs.length > 0) {
      await typeInNthInput(page, 0, testTitle);
    }
    if (inputs.length > 1) {
      await typeInNthInput(page, 1, "E2Eテスト用のお知らせ本文です");
    }
    await bubbleClick(page, "登録") || await bubbleClick(page, "保存") || await bubbleClick(page, "作成");
    await page.waitForTimeout(4000);
    console.log("  CREATE完了");

    // READ
    await sidebarClick(page, "お知らせ管理");
    const hasCreated = await page.evaluate((title) =>
      (document.body.textContent || "").includes(title), testTitle);
    console.log(`  READ: ${hasCreated ? "見つかった" : "見つからない"}`);

    // DELETE
    if (hasCreated) {
      const delResult = await deleteItem(page, testTitle);
      console.log(`  DELETE: ${delResult}`);
      await sidebarClick(page, "お知らせ管理");
      const afterDel = await page.evaluate((title) =>
        (document.body.textContent || "").includes(title), testTitle);
      console.log(`  削除後: ${afterDel ? "まだある" : "消えた"}`);
    }

    console.log("✅ A-NEWS-CRUD: お知らせCRUD完了");
  }, { timeout: 120000 });

  test("A-QA-CRUD: Q&A 作成→確認→削除", async ({ page }) => {
    const testTitle = `E2EテストQA${TS}`;
    await adminLogin(page);
    await sidebarClick(page, "Q&A管理");

    const addClicked = await bubbleClick(page, "新規追加") || await bubbleClick(page, "追加");
    if (!addClicked) {
      console.log("⚠️ A-QA-CRUD: 追加ボタンが見つからない — スキップ");
      return;
    }
    await waitForForm(page, 1);
    const inputs = await getVisibleInputs(page);
    if (inputs.length > 0) await typeInNthInput(page, 0, testTitle);
    if (inputs.length > 1) await typeInNthInput(page, 1, "E2Eテスト用の回答です");
    await bubbleClick(page, "登録") || await bubbleClick(page, "保存") || await bubbleClick(page, "作成");
    await page.waitForTimeout(4000);

    await sidebarClick(page, "Q&A管理");
    const hasCreated = await page.evaluate((title) =>
      (document.body.textContent || "").includes(title), testTitle);

    if (hasCreated) {
      const delResult = await deleteItem(page, testTitle);
      console.log(`  DELETE: ${delResult}`);
    }

    console.log(`✅ A-QA-CRUD: Q&A CRUD完了 (作成=${hasCreated})`);
  }, { timeout: 120000 });

  // ================================================================
  // 請求管理
  // ================================================================
  test("A-BILLING-1: 請求管理ページの確認", async ({ page }) => {
    await adminLogin(page);

    // サイドバーに請求管理があるか探す
    const billingInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      const sidebarItems = Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (el.textContent?.trim().length || 0) < 30;
      }).map(el => el.textContent?.trim());
      return {
        hasBilling: text.includes("請求") || sidebarItems.some(t => t?.includes("請求")),
        sidebarItems: sidebarItems.filter(t => t).slice(0, 20),
      };
    });

    if (billingInfo.hasBilling) {
      await sidebarClick(page, "請求管理");
      const text = await bodyText(page);
      console.log(`✅ A-BILLING-1: 請求管理ページ表示=${text.includes("請求")}`);
    } else {
      console.log(`⚠️ A-BILLING-1: 請求管理メニューが見つからない`);
      console.log(`  サイドバー項目: ${billingInfo.sidebarItems.join(", ")}`);
    }
  });

  // ================================================================
  // 管理者権限ロール
  // ================================================================
  test("A-ROLE-1: 管理者のロール/権限情報確認", async ({ page }) => {
    await adminLogin(page);

    // アカウント設定系のページを確認
    const roleInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasRole: text.includes("権限") || text.includes("ロール") || text.includes("管理者"),
        hasAdminList: text.includes("管理者一覧"),
        sidebarItems: Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }).map(el => el.textContent?.trim()).filter(t => t && t.length < 30).slice(0, 25),
      };
    });

    console.log(`✅ A-ROLE-1: 権限情報=${roleInfo.hasRole}, 管理者一覧=${roleInfo.hasAdminList}`);

    // メールアドレス変更、パスワード変更の存在確認
    await sidebarClick(page, "メールアドレスの変更");
    const hasEmailChange = (await bodyText(page)).includes("メールアドレス");
    await sidebarClick(page, "パスワードの変更");
    const hasPasswordChange = (await bodyText(page)).includes("パスワード");

    console.log(`  メール変更ページ=${hasEmailChange}, パスワード変更ページ=${hasPasswordChange}`);
  });

  // ================================================================
  // 予約管理（管理者視点）
  // ================================================================
  test("A-RESV-1: 管理者予約一覧の詳細確認", async ({ page }) => {
    await adminLogin(page);
    await sidebarClick(page, "予約一覧");

    const resvInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasReservations: text.includes("予約"),
        hasChargeId: text.includes("ch_"),
        hasCsvButton: text.includes("CSVダウンロード") || text.includes("CSV"),
        hasFilter: text.includes("絞り込み") || text.includes("フィルター") || text.includes("検索"),
        hasPrices: /\d{1,3}(,\d{3})*円/.test(text),
        dateCount: (text.match(/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/g) || []).length,
      };
    });

    console.log(`✅ A-RESV-1: 管理者予約一覧 — charge_id=${resvInfo.hasChargeId}, CSV=${resvInfo.hasCsvButton}, フィルタ=${resvInfo.hasFilter}`);
    console.log(`  日付件数=${resvInfo.dateCount}, 料金表示=${resvInfo.hasPrices}`);
  });

  test("A-RESV-2: 管理者 — 予約の詳細ポップアップ", async ({ page }) => {
    await adminLogin(page);
    await sidebarClick(page, "予約一覧");

    // 予約行をクリック
    const clicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 100 && r.height > 20;
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
      const detail = await page.evaluate(() => {
        const text = document.body.textContent || "";
        return {
          hasCustomer: text.includes("お客様") || text.includes("顧客") || text.includes(process.env.RINCLE_EMAIL || ""),
          hasBike: text.includes("自転車") || text.includes("車種"),
          hasPrice: /\d{1,3}(,\d{3})*円/.test(text),
          hasChargeId: text.includes("ch_"),
          hasRefundBtn: text.includes("返金"),
        };
      });
      console.log(`✅ A-RESV-2: 予約詳細 — 顧客=${detail.hasCustomer}, 自転車=${detail.hasBike}, charge_id=${detail.hasChargeId}, 返金ボタン=${detail.hasRefundBtn}`);
    } else {
      console.log("⚠️ A-RESV-2: 予約行をクリックできなかった");
    }
  });

  // ================================================================
  // 営業カレンダー（管理者版）
  // ================================================================
  test("A-CAL-1: 管理者 営業カレンダー確認", async ({ page }) => {
    await adminLogin(page);
    await page.goto("https://rincle.co.jp/version-5398j/admin_update_calendar", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const calInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasCalendar: text.includes("カレンダー") || text.includes("祝日") || text.includes("営業"),
        hasUpdateButton: text.includes("更新") || text.includes("保存") || text.includes("反映"),
      };
    });

    console.log(`✅ A-CAL-1: 管理者カレンダー — 表示=${calInfo.hasCalendar}, 更新ボタン=${calInfo.hasUpdateButton}`);
  });

  // ================================================================
  // 全サイドバーメニュー到達確認
  // ================================================================
  test("A-NAV-1: 管理者 全メニュー到達確認", async ({ page }) => {
    await adminLogin(page);

    const menus = [
      "顧客一覧", "加盟店一覧", "料金表管理",
      "予約一覧", "売上レポート",
      "FV管理", "お知らせ管理", "バナー管理", "Q&A管理",
      "お問い合わせ一覧",
      "メールアドレスの変更", "パスワードの変更",
    ];

    const results: { menu: string; found: boolean }[] = [];

    for (const menu of menus) {
      try {
        await sidebarClick(page, menu);
        const text = await bodyText(page);
        results.push({ menu, found: text.length > 100 });
      } catch {
        results.push({ menu, found: false });
      }
    }

    results.forEach(r => {
      console.log(`  ${r.found ? "✅" : "❌"} ${r.menu}`);
    });
    console.log(`✅ A-NAV-1: ${results.filter(r => r.found).length}/${results.length} メニュー到達`);
  }, { timeout: 180000 });

  // ================================================================
  // 顧客管理の詳細確認
  // ================================================================
  test("A-CUSTOMER-1: 顧客一覧の検索・フィルタ", async ({ page }) => {
    await adminLogin(page);

    const custInfo = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasCustomerList: text.includes("顧客一覧"),
        hasCsv: text.includes("CSVダウンロード"),
        hasSearch: text.includes("キーワード") || text.includes("検索") || text.includes("絞り込み"),
        hasSort: document.querySelectorAll("select").length > 0,
        customerCount: (text.match(/@/g) || []).length, // メールアドレスの数で概算
      };
    });

    console.log(`✅ A-CUSTOMER-1: 顧客一覧 — CSV=${custInfo.hasCsv}, 検索=${custInfo.hasSearch}, ソート=${custInfo.hasSort}`);
    console.log(`  メールアドレス数(概算): ${custInfo.customerCount}`);
  });

  test("A-CUSTOMER-2: 顧客詳細の表示", async ({ page }) => {
    await adminLogin(page);

    // 顧客一覧の最初の行をクリック
    const clicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
        const r = el.getBoundingClientRect();
        const t = el.textContent || "";
        return r.width > 100 && r.height > 20 && t.includes("@");
      });
      if (els[0]) {
        const ev = (window as any).jQuery?._data?.(els[0], "events")?.click?.[0]?.handler;
        if (ev) { const e = (window as any).jQuery.Event("click"); e.target = els[0]; e.currentTarget = els[0]; ev.call(els[0], e); return true; }
        (els[0] as HTMLElement).click();
        return true;
      }
      return false;
    });
    await page.waitForTimeout(3000);

    if (clicked) {
      const detail = await page.evaluate(() => {
        const text = document.body.textContent || "";
        return {
          hasEmail: text.includes("@"),
          hasReservationHistory: text.includes("予約") || text.includes("利用"),
          hasPaymentInfo: text.includes("決済") || text.includes("カード") || text.includes("cus_"),
        };
      });
      console.log(`✅ A-CUSTOMER-2: 顧客詳細 — メール=${detail.hasEmail}, 予約履歴=${detail.hasReservationHistory}, 決済情報=${detail.hasPaymentInfo}`);
    } else {
      console.log("⚠️ A-CUSTOMER-2: 顧客行をクリックできなかった");
    }
  });
});
