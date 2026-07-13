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
const AREA     = (process.env.RINCLE_AREA || "").replace(/"/g, "");
const START_DATETIME = process.env.RINCLE_DATE || "";
const END_DATETIME   = process.env.RINCLE_TIME || "";

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

    // 検索 → 詳細 → 日時入力 → 予約確定（rincle.e2e.ts テスト7と同方式・店頭決済）
    await page.locator("select.bubble-element.Dropdown").first().selectOption({ label: AREA });
    await page.waitForTimeout(500);
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(1).check();
    await page.getByRole("button", { name: "検索する" }).click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first().click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "詳細を見る" }).first().click();
    await page.waitForLoadState("networkidle");
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
      const paymentLine = card!.text.match(/支払い方法\s*\n?\s*([^\n]+)/)?.[1]?.trim() ?? "(不明)";
      console.log(`支払い方法の表示: ${paymentLine}`);
      expect(paymentLine.includes("店頭決済") && !paymentLine.includes("クレジット"),
        `店頭決済で予約したのに支払い方法が「${paymentLine}」です（バグ①: 確定WFのaction4が無条件でクレジットに上書き）`
      ).toBe(true);
      console.log("✅ 支払い方法が店頭決済で正しく記録されています（バグ①修正済み）");
    } finally {
      // 後始末: 作成した予約をキャンセル
      const cancelled = await cancelReservationByNo(page, reservationNo!);
      console.log(cancelled
        ? `🧹 後始末OK: 予約番号 ${reservationNo} をキャンセルしました`
        : `⚠️ 後始末失敗: 予約番号 ${reservationNo} を手動でキャンセルしてください`);
    }
  });

  // --------------------------------------------------------------------------
  // 【回帰④】予約番号の一意性: 同じ予約番号のカードは店舗・日時も同一であること
  // （7/13実測: 別店舗・別日程の2予約がどちらも1000183 → 採番/表示バグの疑い）
  // --------------------------------------------------------------------------
  test("予約番号の一意性（回帰④）", async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await openReservationList(page);

    const cards = await collectReservationCards(page);
    expect(cards.length, "予約カードを1件もパースできませんでした").toBeGreaterThan(0);
    console.log(`予約カード ${cards.length}件をパース: 番号=[${cards.map(c => c.no).join(", ")}]`);

    // 番号→カード概要（店舗行と日時行）でグループ化
    const byNo = new Map<string, Set<string>>();
    for (const c of cards) {
      const shop = c.text.match(/店舗\s*\n\s*([^\n]+)/)?.[1]?.trim() ?? "";
      const date = c.text.match(/日時\s*\n\s*([^\n]+)/)?.[1]?.trim() ?? "";
      if (!shop && !date) continue; // 折りたたみカード（過去分）は判定不能なので除外
      if (!byNo.has(c.no)) byNo.set(c.no, new Set());
      byNo.get(c.no)!.add(`${shop} / ${date}`);
    }
    const dups = Array.from(byNo.entries()).filter(([, v]) => v.size > 1);
    for (const [no, v] of dups) {
      console.log(`🔴 予約番号 ${no} が複数の予約に付与: ${Array.from(v).join(" | ")}`);
    }
    expect(dups.length,
      `同一予約番号が異なる予約（店舗/日時違い）に使われています: ${dups.map(([no]) => no).join(", ")}（バグ④）`
    ).toBe(0);
    console.log("✅ 予約番号の一意性OK");
  });
});
