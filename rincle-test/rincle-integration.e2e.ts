import { test, expect, Page } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

// ============================================================================
// 統合・回帰E2E（新アプリ・version-43erq 対応版 2026-07-13）
// 旧アプリ版から全面書き換え。増永さん報告バグ（7/13）の回帰テスト:
//   ①「店頭決済で予約してもクレジット決済になる」
//      → 原因特定済み: cart部品WF bUtHX0 の action4（payment_method=クレジット）が無条件実行
//      → 本テスト: 店頭決済で予約を作成し、予約一覧カードの支払い方法表示を検証（終了時キャンセル）
//   ④「予約番号の重複」（7/13実測: 別店舗・別日程の2予約が同番号1000183）
//      → 本テスト: 予約一覧の全カードで「同じ予約番号なら店舗・日時も同一」を検証
//   ※②「非表示でも表示される」の回帰は rincle-store.e2e.ts の
//     「非表示切替のユーザー反映（統合・回帰）」でカバー
//
// バグ修正前は①④とも fail する（正検出）。日時ヘルパー等は rincle.e2e.ts と同方式。
// ============================================================================

const BASE_URL = "https://rincle.co.jp/version-43erq";
const EMAIL    = process.env.RINCLE_EMAIL!;
const PASSWORD = process.env.RINCLE_PASSWORD!;
const STORE_EMAIL    = process.env.STORE_EMAIL!;
const STORE_PASSWORD = process.env.STORE_PASSWORD!;
const AREA     = (process.env.RINCLE_AREA || "").replace(/"/g, "");
const START_DATETIME = process.env.RINCLE_DATE || "";
const END_DATETIME   = process.env.RINCLE_TIME || "";
// テスト店舗の自転車（SEINO自転車のFALD - ERX2）。作り直した場合は .env の TEST_BIKE_ID で上書き
const TEST_BIKE_URL = `${BASE_URL}/bicycle_detail?bicycle=${process.env.TEST_BIKE_ID || "1783597035177x490785382439820740"}`;

function parseDatetime(s: string) {
  const m = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})/);
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3], time: m[4].replace(/^0/, "") };
}
function toJpDate(d: { year: number; month: number; day: number }) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.year}年${pad(d.month)}月${pad(d.day)}日`;
}

async function freshenIfStale(page: Page): Promise<boolean> {
  const stale = await page.getByText("アプリが更新されました").first().isVisible().catch(() => false);
  if (!stale) return false;
  console.log("⚠️ アプリ更新バナーを検出 → リロード");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(3000);
  return true;
}

async function login(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });
      await freshenIfStale(page);
      await page.locator('input[type="email"]').first().waitFor({ state: "visible", timeout: 20000 });
      await page.locator('input[type="email"]').first().fill(EMAIL);
      await page.locator('input[type="password"]').first().fill(PASSWORD);
      await page.getByRole("button", { name: "ログイン" }).first().click();
      await page.waitForTimeout(5000);
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.getByText("ログアウト").first().waitFor({ state: "visible", timeout: 8000 });
      return;
    } catch (e) {
      console.log(`⚠️ ログイン試行${attempt + 1}回目失敗: ${String(e).split("\n")[0]}`);
      await page.waitForTimeout(3000);
    }
  }
  throw new Error("ログインに失敗しました");
}

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
  await pickerRoot.locator(".picker__day--infocus").getByText(String(day), { exact: true }).click({ force: true });
  await page.waitForTimeout(400);
  await pickerRoot.locator(".picker__button--close").click({ force: true });
  await page.waitForTimeout(500);
}

// トップ経由で予約一覧を開く（直接gotoはトップにバウンスする）
async function openReservationList(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await freshenIfStale(page);
  await page.getByRole("button", { name: "予約の確認・キャンセル" }).first().click();
  await page.waitForURL(/\/user_reservation_list/, { timeout: 20000 });
  await page.waitForTimeout(3000);
  await expect(page.getByText("予約状況一覧")).toBeVisible({ timeout: 10000 });
}

// 予約一覧から「予約番号 → カード全文」を収集
async function collectReservationCards(page: Page): Promise<{ no: string; text: string }[]> {
  return page.evaluate(() => {
    const cards: { no: string; text: string }[] = [];
    const seen = new Set<HTMLElement>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      const t = el.innerText || "";
      // 「予約番号」をちょうど1回含む最小ブロックをカードとみなす
      if ((t.match(/予約番号/g) || []).length === 1 && t.includes("店舗") && t.length < 2000) {
        let dup = false;
        for (const s of seen) if (s.contains(el) || el.contains(s)) { dup = el.contains(s); if (!dup) { dup = true; } break; }
        const no = t.match(/予約番号[^0-9]*([0-9]{6,})/)?.[1];
        if (no && !cards.some(c => c.no === no && c.text === t)) cards.push({ no, text: t });
        seen.add(el);
      }
    }
    // 同一予約番号・同一内容の重複（入れ子DOM由来）を除去し、番号ごとに最短テキストを採用
    const byKey = new Map<string, { no: string; text: string }>();
    for (const c of cards) {
      const key = c.no + "::" + c.text.substring(0, 80);
      const cur = byKey.get(key);
      if (!cur || c.text.length < cur.text.length) byKey.set(key, c);
    }
    return Array.from(byKey.values());
  });
}

// 店舗管理ログイン（統合テスト用・rincle-store.e2e.ts と同方式）
async function storeLogin(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}/admin_signin?role=shop&mode=sign_in`, { waitUntil: "domcontentloaded" });
      await freshenIfStale(page);
      await page.locator('input[type="email"]').first().waitFor({ state: "visible", timeout: 20000 });
      await page.locator('input[type="email"]').first().fill(STORE_EMAIL);
      await page.locator('input[type="password"]').first().fill(STORE_PASSWORD);
      await page.getByRole("button", { name: /ログイン/ }).first().click();
      await page.waitForURL(/\/admin\//, { timeout: 15000 });
      await page.getByText("自転車一覧").first().waitFor({ state: "visible", timeout: 15000 });
      // 【重要・実測】ログインWFはURL遷移後も店舗コンテキストの設定処理が続く。
      // ここで待たずに直後へgoto/reloadすると予約一覧が（0）のままになる
      await page.waitForTimeout(8000);
      return;
    } catch (e) {
      console.log(`⚠️ 店舗ログイン試行${attempt + 1}回目失敗: ${String(e).split("\n")[0]}`);
      await page.waitForTimeout(3000);
    }
  }
  throw new Error("店舗ログインに失敗しました");
}

// 予約番号を指定してキャンセル（後始末用）
async function cancelReservationByNo(page: Page, no: string): Promise<boolean> {
  await openReservationList(page);
  const target = await page.evaluate((noStr) => {
    const btns = Array.from(document.querySelectorAll("button"))
      .filter(b => (b.textContent || "").trim() === "予約をキャンセルする");
    for (let i = 0; i < btns.length; i++) {
      let card: HTMLElement | null = btns[i].parentElement;
      while (card && !(card.textContent || "").includes("予約番号")) card = card.parentElement;
      if ((card?.textContent || "").includes(noStr)) return i;
    }
    return -1;
  }, no);
  if (target < 0) return false;
  await page.getByRole("button", { name: "予約をキャンセルする" }).nth(target).click();
  const confirmBtn = page.locator('[class*="Popup"] button', { hasText: "キャンセルする" }).first();
  await confirmBtn.waitFor({ state: "visible", timeout: 10000 });
  await confirmBtn.click();
  await page.waitForTimeout(4000);
  return true;
}

test.describe("RINCLE 統合・回帰E2E", () => {

  // --------------------------------------------------------------------------
  // 【回帰①】店頭決済で予約 → 予約一覧の支払い方法が「店頭決済」で記録されること
  // --------------------------------------------------------------------------
  test("店頭決済の記録整合（回帰①）", async ({ page }) => {
    test.setTimeout(240000);
    const start = parseDatetime(START_DATETIME);
    const end   = parseDatetime(END_DATETIME);
    if (!start || !end) {
      console.log("⚠️ RINCLE_DATE / RINCLE_TIME が未設定のためスキップ（例: RINCLE_DATE=\"2026/07/16 11:00\"）");
      return;
    }

    await login(page);

    // 【重要】店舗側の反映確認（後段）のため、STORE_EMAILの店舗（SEINO自転車）の
    // 自転車＝TEST_BIKE_URL を直接予約する。検索経由の「最初の自転車」だと他店の
    // 自転車を予約してしまい、店舗一覧に出ない（実測で1時間溶かした罠）
    await page.goto(TEST_BIKE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(9000);
    await freshenIfStale(page);
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1500);

    await selectPikadayDate(page, 0, start.month, start.day, start.year);
    await selectPikadayDate(page, 3, end.month, end.day, end.year);
    const startTimeOk = await page.locator("select.bubble-element.Dropdown").nth(0)
      .selectOption({ label: start.time }).then(() => true).catch(() => false);
    const endTimeOk = await page.locator("select.bubble-element.Dropdown").nth(1)
      .selectOption({ label: end.time }).then(() => true).catch(() => false);
    expect(startTimeOk && endTimeOk,
      `貸出/返却時刻 ${start.time}〜${end.time} が選択肢にありません（.envの日時を営業時間内・予約可能ウィンドウ内に）`).toBe(true);

    const wasStale = await freshenIfStale(page);
    expect(wasStale, "アプリ更新バナーによりフォーム入力が失われました（再実行してください）").toBe(false);
    const proceedBtn = page.getByRole("button", { name: "予約画面へ進む" });
    await expect(proceedBtn).toBeVisible({ timeout: 15000 });
    await proceedBtn.click();
    await page.waitForURL(/\/reservation\?reservation=/, { timeout: 20000 });
    await page.waitForTimeout(3000);

    await freshenIfStale(page);
    await page.getByRole("button", { name: "お客様情報の入力へ" }).click();
    await page.waitForTimeout(4000);
    await page.getByText("アプリの登録者と同じ").first().click();
    await page.waitForTimeout(2000);
    await page.getByText("上記の利用規約に同意する").first().click();
    await page.waitForTimeout(400);
    await page.getByText("身分証明書を持参することに同意する", { exact: false }).first().click();
    await page.waitForTimeout(400);
    await page.getByText("親権者または18歳以上の方が同伴すること", { exact: false }).first().click();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "予約内容の確認に進む" }).click();
    await page.waitForTimeout(4000);
    await page.getByRole("button", { name: "支払い方法を選択する" }).click();
    await page.waitForTimeout(4000);

    // 店頭決済を明示選択（カード入力UIが消えることまで確認 = 選択操作の証跡）
    await expect(page.getByText("店頭決済").first()).toBeVisible({ timeout: 10000 });
    await page.getByText("店頭決済", { exact: true }).first().click();
    await page.waitForTimeout(2000);
    await expect(page.getByRole("button", { name: "カード情報を入力する" }),
      "「店頭決済」への切替に失敗").toBeHidden({ timeout: 8000 });
    const visibleCardFields = await page.locator('input[autocomplete="cc-number"], input[name*="card" i]')
      .locator("visible=true").count().catch(() => 0);
    expect(visibleCardFields, "カード番号入力欄が表示されています。停止").toBe(0);

    await page.getByRole("button", { name: "予約を確定する" }).click();
    await expect(page.getByText("予約が確定しました")).toBeVisible({ timeout: 25000 });

    // 予約番号を取得
    await page.getByRole("button", { name: "予約履歴を確認" }).click();
    await page.waitForURL(/\/user_reservation_list/, { timeout: 20000 });
    await page.waitForTimeout(3000);
    const startJp = toJpDate(start);
    const reservationNo = await page.evaluate((dateStr) => {
      const btns = Array.from(document.querySelectorAll("button"))
        .filter(b => (b.textContent || "").trim() === "予約をキャンセルする");
      for (const b of btns) {
        let card: HTMLElement | null = b.parentElement;
        while (card && !(card.textContent || "").includes("予約番号")) card = card.parentElement;
        const t = card?.textContent || "";
        if (t.includes(dateStr)) return t.match(/予約番号[^0-9]*([0-9]{6,})/)?.[1] ?? null;
      }
      return null;
    }, startJp);
    expect(reservationNo, "作成した予約が一覧に見つかりません").toBeTruthy();
    console.log(`✅ 店頭決済で予約作成: 予約番号 ${reservationNo}`);

    try {
      // 【本題】カードの支払い方法表示が「店頭決済」であること
      // バグ①（WF action4が無条件でクレジットに上書き）が未修正なら fail する（正検出）
      const cards = await collectReservationCards(page);
      const card = cards.find(c => c.no === reservationNo);
      expect(card, `予約番号 ${reservationNo} のカードをパースできません`).toBeTruthy();
      // 「支払い方法」単独行の次行が値（「料金・支払い方法」セクション見出しと区別する）
      const lines = card!.text.split("\n").map(s => s.trim());
      const i = lines.findIndex(l => l === "支払い方法");
      const paymentLine = (i >= 0 ? lines[i + 1] : "") || "(不明)";
      console.log(`支払い方法の表示: ${paymentLine}`);
      expect(paymentLine.includes("店頭決済") && !paymentLine.includes("クレジット"),
        `店頭決済で予約したのに支払い方法が「${paymentLine}」です（バグ①: 確定WFのaction4が無条件でクレジットに上書き）`
      ).toBe(true);
      console.log("✅ 支払い方法が店頭決済で正しく記録されています（バグ①修正済み）");

      // 【統合】店舗側の予約一覧にも新規予約が反映されていること
      // 【実測】一覧は非同期ロードで、件数（0）表示のまま10秒程度データが遅れて入ることがある
      // → ポーリングで最大30秒待つ
      await storeLogin(page);
      await page.goto(`${BASE_URL}/admin/reservation?role=shop`, { waitUntil: "domcontentloaded" });
      // 【実測】一覧は非同期ロードが遅い＋開発中は更新バナーでWFが凍結することがある
      // → リロードを挟みながら最大5回試行し、毎回の状態をログに残す
      let storeList = "";
      let found = false;
      for (let attempt = 1; attempt <= 5 && !found; attempt++) {
        await page.waitForTimeout(12000);
        await freshenIfStale(page);
        storeList = await page.evaluate(() => document.body.innerText);
        found = storeList.includes(reservationNo!);
        console.log(`  店舗一覧 試行${attempt}: ${storeList.match(/予約一覧（\d+）/)?.[0] ?? "(見出しなし)"} / 番号記載=${found} / URL=${page.url().split("?")[0].split("/").slice(-2).join("/")}`);
        if (!found) await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      }
      if (!found) console.log("  一覧本文（先頭200字）: " + storeList.replace(/\n/g, " / ").substring(0, 200));
      expect(found, `店舗側の予約一覧に予約番号 ${reservationNo} が表示されません（1分待機+リロード5回でも）`).toBe(true);
      console.log("✅ 店舗側の予約一覧への反映を確認");
    } finally {
      // 後始末: ユーザーに戻って作成した予約をキャンセル（店舗ログインでセッションが変わるため再ログイン）
      await login(page);
      const cancelled = await cancelReservationByNo(page, reservationNo!);
      console.log(cancelled
        ? `🧹 後始末OK: 予約番号 ${reservationNo} をキャンセルしました`
        : `⚠️ 後始末失敗: 予約番号 ${reservationNo} を手動でキャンセルしてください`);
    }
  });

  // --------------------------------------------------------------------------
  // 【統合】休業日設定の整合: 店舗の営業カレンダー（日別）とユーザー側の
  // 貸出可能日程カレンダーで、当月の休業日が一致すること（読み取りのみ・データ変更なし）
  // --------------------------------------------------------------------------
  test("休業日設定のユーザー側反映（統合）", async ({ page }) => {
    test.setTimeout(120000);
    const now = new Date();
    const thisMonth = now.getMonth() + 1;

    // 店舗側: 営業カレンダーの当月休業日
    await storeLogin(page);
    await page.goto(`${BASE_URL}/admin/calendar?role=shop`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    const storeText = await page.evaluate(() => document.body.innerText);
    expect(storeText.includes(`${now.getFullYear()}年${thisMonth}月`), "営業カレンダーが当月を表示していません").toBe(true);
    const storeClosed = new Set<number>();
    for (const m of storeText.matchAll(/(\d{1,2})\/(\d{1,2})\s*\n\s*休業/g)) {
      if (Number(m[1]) === thisMonth) storeClosed.add(Number(m[2]));
    }
    console.log(`店舗側の当月休業日: ${[...storeClosed].sort((a, b) => a - b).join(", ")}`);
    expect(storeClosed.size, "店舗側に休業日が1日もありません（テスト店舗は週2休の想定）").toBeGreaterThan(0);

    // ユーザー側: 貸出可能日程カレンダーの「休業日」表示
    await page.goto(TEST_BIKE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(10000);
    const userClosed: Set<number> = new Set(await page.evaluate(() => {
      const days: number[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
        const t = (el.innerText || "").trim();
        const m = t.match(/^(\d{1,2})\n休業日/);
        if (m && t.length < 20) days.push(Number(m[1]));
      }
      return [...new Set(days)];
    }));
    console.log(`ユーザー側の当月休業日表示: ${[...userClosed].sort((a, b) => a - b).join(", ")}`);

    const onlyStore = [...storeClosed].filter(d => !userClosed.has(d));
    const onlyUser  = [...userClosed].filter(d => !storeClosed.has(d));
    expect(onlyStore.length + onlyUser.length,
      `休業日の不一致: 店舗側のみ=[${onlyStore.join(",")}] ユーザー側のみ=[${onlyUser.join(",")}]`
    ).toBe(0);
    console.log("✅ 店舗の休業日設定とユーザー側カレンダー表示が一致");
  });

  // --------------------------------------------------------------------------
  // 【回帰④改め・仕様確認済み】予約番号の一意性は「店舗ごと」
  // 採番実装（bicycle_detail WF bUoGR0/bUoPE0）: number = Search for 予約
  //   (shop=この自転車の店舗, number is not empty, Created Date降順):first の number + 1
  //   （該当なしは1000000起点）→ 店舗をまたぐ同番号は設計どおり（7/14 清野さん確認）。
  // よって「同一店舗内」で同じ番号が複数の予約（日時違い）に付いていたらバグ。
  // 注意: 採番が「最新作成の予約のnumber+1」の非アトミック実装のため、同一店舗への
  //   同時予約で競合し得る（本テストがその実害を検出する）。
  // --------------------------------------------------------------------------
  test("予約番号の店舗内一意性（回帰④）", async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await openReservationList(page);

    const cards = await collectReservationCards(page);
    expect(cards.length, "予約カードを1件もパースできませんでした").toBeGreaterThan(0);
    console.log(`予約カード ${cards.length}件をパース: 番号=[${cards.map(c => c.no).join(", ")}]`);

    // (店舗, 番号) → 日時 でグループ化。同一店舗×同一番号で日時が複数あれば重複
    const byShopNo = new Map<string, Set<string>>();
    for (const c of cards) {
      const shop = c.text.match(/店舗\s*\n\s*([^\n]+)/)?.[1]?.trim() ?? "";
      const date = c.text.match(/日時\s*\n\s*([^\n]+)/)?.[1]?.trim() ?? "";
      if (!shop || !date) continue; // 折りたたみカード（過去分）は判定不能なので除外
      const key = `${shop}::${c.no}`;
      if (!byShopNo.has(key)) byShopNo.set(key, new Set());
      byShopNo.get(key)!.add(date);
    }
    const dups = Array.from(byShopNo.entries()).filter(([, dates]) => dates.size > 1);
    for (const [key, dates] of dups) {
      console.log(`🔴 同一店舗内で予約番号が重複: ${key.replace("::", " の番号 ")} → ${Array.from(dates).join(" | ")}`);
    }
    expect(dups.length,
      `同一店舗内で同じ予約番号が別の予約に使われています: ${dups.map(([k]) => k).join(", ")}（採番の同時実行競合の疑い）`
    ).toBe(0);
    console.log("✅ 予約番号の店舗内一意性OK（店舗をまたぐ同番号は設計どおり許容）");
  });
});
