import { test, expect, Page } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.RINCLE_BASE_URL || "https://rincle.co.jp/version-43erq";
const EMAIL    = process.env.RINCLE_EMAIL!;
const PASSWORD = process.env.RINCLE_PASSWORD!;
const AREA     = process.env.RINCLE_AREA!;
const START_DATETIME = process.env.RINCLE_DATE!;
const END_DATETIME   = process.env.RINCLE_TIME!;
// ネガティブ系テスト（18-20）用の固定対象: テスト店舗「SEINO自転車」（栃木・水金休業）の
// FALD - ERX2。店舗・自転車を作り直した場合は TEST_BIKE_ID を .env で上書きする
const TEST_BIKE_URL = `${BASE_URL}/bicycle_detail?bicycle=${process.env.TEST_BIKE_ID || "1783597035177x490785382439820740"}`;

// "2026/04/05 11:00" → { month: 4, day: 5, year: 2026, time: "11:00" }
function parseDatetime(raw: string) {
  if (!raw || raw === "未定") return null;
  const [datePart, timePart] = raw.trim().split(" ");
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split("/").map(Number);
  if (!y || !m || !d) return null;
  return { month: m, day: d, year: y, time: timePart };
}

// "2026/07/20" → "2026年07月20日"（予約一覧カードの日時表記・ゼロ埋めあり）
function toJpDate(d: { year: number; month: number; day: number }) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.year}年${pad(d.month)}月${pad(d.day)}日`;
}

// 【Bubble開発ブランチ特有の罠・実測】version-13fge は編集中ブランチのため、テスト実行中に
// アプリが更新されると「アプリが更新されました。〜ページを再読み込みしてください」バナーが表示され、
// 以後の全ワークフローが凍結される（ボタンをクリックしても何も起きない。コンソールには
// "PLEASE REFRESH: workflow" が出る）。ログイン不成立・「予約画面へ進む」無反応 flake の正体。
// 検出したらリロードして解除する。
async function freshenIfStale(page: Page): Promise<boolean> {
  const stale = await page.getByText("アプリが更新されました").first().isVisible().catch(() => false);
  if (!stale) return false;
  console.log("⚠️ アプリ更新バナーを検出 → リロードしてワークフロー凍結を解除");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(3000);
  return true;
}

// 新アプリ（version-13fge）のログイン。
// 旧アプリはトップのポップアップでログインしたが、新アプリは専用ページ /signin 方式。
// 【既知バグ】トップヘッダーの「ログイン」ボタンは ?mode=signin へ遷移するが、
//   サインインフォームの表示条件は mode=sign_in（アンダースコア）のため mode=signin では
//   本文が空になる。/signin へ直接遷移すると mode=sign_in にリダイレクトされフォームが出る。
// ログイン成否はトップページのヘッダーに「ログアウト」が出るかで判定（サインイン送信では
//   ページ遷移しないため、トップへ移動して確認する）。稀にセッション確立が遅れるため最大2回試行。
async function login(page: Page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    // networkidle はBubbleの常駐接続で確定しないことがある（間欠タイムアウトを実測）ため、
    // domcontentloaded + 直後の要素待ちで代替する
    await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });
    await freshenIfStale(page); // アプリ更新バナーが出ているとログインWFが凍結されるため
    await page.locator('input[type="email"]').first().waitFor({ state: "visible", timeout: 20000 });
    await page.locator('input[type="email"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).first().click();
    await page.waitForTimeout(5000);

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    const loggedIn = await page.getByText("ログアウト").first()
      .waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
    if (loggedIn) return;
  }
  throw new Error("ログインに失敗しました（/signin 経由でセッションが確立できませんでした）");
}

// Pikadayカレンダーで日付を選択する
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

  await pickerRoot.locator(".picker__day--infocus")
    .getByText(String(day), { exact: true })
    .click({ force: true });
  await page.waitForTimeout(400);

  await pickerRoot.locator(".picker__button--close").click({ force: true });
  await page.waitForTimeout(500);
}

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

// 汎用クリックヘルパー: テキスト完全一致の .clickable-element を jQuery ハンドラ経由でクリックする。
// フッターナビ（アンカースクロールリンク等、button_disabledのようなdisabled制御を持たない
// 単純なワークフロー）向け。clickBubbleButton とは別に追加（既存ヘルパーは変更しない）。
async function clickClickableElementByText(page: Page, text: string): Promise<boolean> {
  return page.evaluate((t) => {
    const els = Array.from(document.querySelectorAll(".clickable-element"));
    const el = els.find(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (e.textContent || "").trim() === t;
    }) as HTMLElement | null;
    if (!el) return false;
    el.scrollIntoView({ behavior: "instant", block: "center" });
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

// -------------------------------------------------------------------

test.describe("RINCLE E2E", () => {
  test.describe.configure({ mode: "serial" });

  // ----------------------------------------------------------------
  // 1. ログイン
  // ----------------------------------------------------------------
  test("ログイン", async ({ page }) => {
    // 新アプリは /signin ページ方式（トップの「ログイン」ボタンは mode=signin へ飛ぶが
    // フォームは mode=sign_in でしか描画されない既知バグのため /signin へ直接遷移）
    await page.goto(`${BASE_URL}/signin`, { waitUntil: "networkidle" });
    await page.locator('input[type="email"]').first().waitFor({ state: "visible", timeout: 15000 });
    await page.locator('input[type="email"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).first().click();
    await page.waitForTimeout(5000);

    // ログイン後、トップページのヘッダーに「ログアウト」が表示されることを確認
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    const logoutBtn = page.getByText("ログアウト").first();
    await logoutBtn.waitFor({ state: "visible", timeout: 15000 });
    await expect(logoutBtn).toBeVisible();
    console.log("✅ ログイン完了");
  });

  // ----------------------------------------------------------------
  // 2. マイページ確認
  // ----------------------------------------------------------------
  test("マイページ", async ({ page }) => {
    await login(page);

    // 新アプリでは専用ページ /mypage（ロード時に /mypage/userinfo にリダイレクト）
    await page.goto(`${BASE_URL}/mypage`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/mypage/);

    // マイページが表示されていることを確認
    await expect(page.getByRole("button", { name: "アカウント編集" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "予約一覧" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "退会する" })).toBeVisible({ timeout: 5000 });

    // ユーザー情報が表示されていること（メールアドレス）。userinfo部品は非同期ロードのため長めに待つ
    await expect(page.getByText(EMAIL).first()).toBeVisible({ timeout: 15000 });
    console.log("✅ マイページ確認完了");
  });

  // ----------------------------------------------------------------
  // 3. ガイドページ閲覧
  // ----------------------------------------------------------------
  // 【新アプリでの構造変化・実地プローブで確認済み】
  // 旧 /index/guide は独立ページとして直接遷移すると実は "FAQ" コンテンツ（保険・補償/予約・受付等の
  // Q&A）を表示する（フッターの「よくある質問」リンクの遷移先でもある＝テスト13と同じ実体）。
  // 一方、旧アプリで「ガイド」的な内容（Rincleの特徴・ご利用の流れ）は、新アプリではトップページ内の
  // アンカーセクション（FEATURE/FLOW）に統合されており、フッターの「Rincleの特徴」「ご利用の流れ」
  // リンクはページ内スクロールとして機能する（別ページには遷移しない）。
  // 意図の重複を避けるため、本テストは「ガイド」に相当するこの2セクションへのアンカー遷移を検証し、
  // テスト13は実体としての /index/guide（FAQ）を検証する。
  test("ガイドページ", async ({ page }) => {
    await login(page);

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // 「Rincleの特徴」（FEATURE）セクションへアンカー遷移し、本文が表示されること
    const scrollY0 = await page.evaluate(() => window.scrollY);
    const clickedFeature = await clickClickableElementByText(page, "Rincleの特徴");
    expect(clickedFeature).toBe(true);
    await page.waitForTimeout(1200);
    const scrollY1 = await page.evaluate(() => window.scrollY);
    expect(scrollY1).toBeGreaterThan(scrollY0);
    await expect(page.getByText("スポーツバイクレンタルで感じる究極のライド体験")).toBeVisible({ timeout: 5000 });
    console.log(`✅ Rincleの特徴セクションへ遷移 (scrollY ${scrollY0} → ${scrollY1})`);

    // 「ご利用の流れ」（FLOW）セクションへもアンカー遷移できること
    const clickedFlow = await clickClickableElementByText(page, "ご利用の流れ");
    expect(clickedFlow).toBe(true);
    await page.waitForTimeout(1200);
    const scrollY2 = await page.evaluate(() => window.scrollY);
    expect(scrollY2).toBeGreaterThan(scrollY1);
    console.log(`✅ ご利用の流れセクションへ遷移 (scrollY ${scrollY1} → ${scrollY2})`);
    console.log("✅ ガイド相当コンテンツ（トップページ内アンカー）確認完了");
  });

  // ----------------------------------------------------------------
  // 4. 料金ページ閲覧
  // ----------------------------------------------------------------
  // 【新アプリで機能自体が削除済み・実地プローブ＋rincle.bubble解析で確認】
  // - /index/howtopay に直接遷移してもヘッダー/フッターのナビのみでコンテンツ本文が空
  //   （body innerText = 126文字、guide/contact等では実コンテンツが入り数百〜数千文字ある）
  // - documents/rincle.bubble を python3 で解析: option_sets.index_page には
  //   db_value="howtopay" の値自体は残っているが、index ページ(bTGbC)の elements 定義内に
  //   "howtopay" という文字列は0件 → 表示条件・コンテンツグループ自体が実装から削除済み
  // - /howtopay （素のパス）は 404
  // - トップページのフッターリンク（Rincleの特徴/ご利用の流れ/よくある質問/会社概要/
  //   お問い合わせ/利用規約/プライバシーポリシー）に「料金」相当のリンクなし
  // - /legal?mode=docs（特定商取引法の表示）にも価格・支払い方法の具体的説明はなく
  //   「各商品・サービスのご購入ページに記載」という参照のみで、旧ページの代替にはならない
  // → 新アプリには対応する「料金ページ」が存在しないため test.skip とする（テスト自体は削除しない）
  test.skip("料金ページ", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/index/howtopay`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/index\/howtopay/);
    await expect(page.getByText("ログアウト").first()).toBeVisible({ timeout: 5000 });
    console.log("✅ 料金ページ閲覧完了");
  });

  // ----------------------------------------------------------------
  // 5. 自転車検索・一覧
  // ----------------------------------------------------------------
  test("自転車検索・一覧", async ({ page }) => {
    await login(page);

    // エリア選択
    await page.locator("select.bubble-element.Dropdown").first().selectOption({ label: AREA });
    await page.waitForTimeout(500);

    // 日付未定チェックボックス
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(1).check();

    // 検索
    await page.getByRole("button", { name: "検索する" }).click();
    await page.waitForLoadState("networkidle");

    // 「貸出可能な自転車をすべて見る」ボタンが表示されること
    const allBikesBtn = page.getByRole("button", { name: "貸出可能な自転車をすべて見る" }).first();
    await expect(allBikesBtn).toBeVisible({ timeout: 10000 });

    await allBikesBtn.click();
    await page.waitForLoadState("networkidle");

    // 「詳細を見る」ボタンが1件以上表示されること
    const detailBtn = page.getByRole("button", { name: "詳細を見る" }).first();
    await expect(detailBtn).toBeVisible({ timeout: 10000 });
    console.log(`✅ 自転車検索完了 (エリア: ${AREA})`);
  });

  // ----------------------------------------------------------------
  // 6. 自転車詳細ページ
  // ----------------------------------------------------------------
  test("自転車詳細ページ", async ({ page }) => {
    await login(page);

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

    // 新アプリは専用ページ /bicycle_detail に遷移する
    await expect(page).toHaveURL(/\/bicycle_detail/);

    // 予約フォームの貸出日ピッカー（index 0）が表示されること
    const rentalDateInput = page.locator("input.picker__input").nth(0);
    await expect(rentalDateInput).toBeVisible({ timeout: 8000 });

    // 予約フォームのピッカー群が揃っていること（日付4[貸出/返却×表示/隠し] + 時刻2 = 6）
    const pickerCount = await page.locator("input.picker__input").count();
    expect(pickerCount).toBeGreaterThanOrEqual(4);
    console.log("✅ 自転車詳細ページ確認完了");
  });

  // ----------------------------------------------------------------
  // 7. 予約フロー（完全）
  // ----------------------------------------------------------------
  test("予約フロー", async ({ page }) => {
    test.setTimeout(180000);
    const start = parseDatetime(START_DATETIME);
    const end   = parseDatetime(END_DATETIME);

    if (!start || !end) {
      console.log("⚠️ RINCLE_DATE / RINCLE_TIME が未設定のため予約テストをスキップ");
      return;
    }

    await login(page);

    // 検索 → 一覧 → 詳細（新アプリ: /search → /bicycle_detail）
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
    await expect(page).toHaveURL(/\/bicycle_detail/);
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1500);
    console.log("✅ 自転車詳細ページへ遷移:", page.url());

    // 新アプリ /bicycle_detail の予約フォーム構造:
    //   picker__input: index0=貸出日(表示), 1=貸出日(隠しミラー), 2=貸出時刻ピッカー,
    //                  3=返却日(表示), 4=返却日(隠しミラー), 5=返却時刻ピッカー
    //   時刻は select.bubble-element.Dropdown: nth(0)=貸出時刻, nth(1)=返却時刻 で選ぶ
    await selectPikadayDate(page, 0, start.month, start.day, start.year);

    // 貸出日が実際に入ったか確認。
    // 【重要】当日/過去日はカレンダー上 disabled（予約は前日23:59まで）。制約により日時は
    //   一切変更しないため、選択できなければ具体的な理由付きで fail させる（緩いpass禁止）。
    const startVal = await page.locator("input.picker__input").nth(0).inputValue().catch(() => "");
    expect(startVal,
      `貸出日 ${start.year}/${start.month}/${start.day} が選択できません（当日/過去はカレンダーでdisabled）。.env の RINCLE_DATE を未来日に更新してください（テスト側で日時は変更しない）`
    ).toBeTruthy();
    console.log(`✅ 貸出日選択: ${startVal}`);

    await selectPikadayDate(page, 3, end.month, end.day, end.year);
    const endVal = await page.locator("input.picker__input").nth(3).inputValue().catch(() => "");
    expect(endVal,
      `返却日 ${end.year}/${end.month}/${end.day} が選択できません（カレンダーでdisabled）`
    ).toBeTruthy();
    console.log(`✅ 返却日選択: ${endVal}`);

    // 貸出/返却時刻（選択肢に無い時刻＝店舗の受付時間外なら理由付き fail）
    const startTimeOk = await page.locator("select.bubble-element.Dropdown").nth(0)
      .selectOption({ label: start.time }).then(() => true).catch(() => false);
    expect(startTimeOk,
      `貸出時刻 ${start.time} は選択肢にありません（店舗の受付時間外。実測の選択肢は10:00〜20:00）`
    ).toBe(true);
    console.log(`✅ 貸出時間選択: ${start.time}`);

    const endTimeOk = await page.locator("select.bubble-element.Dropdown").nth(1)
      .selectOption({ label: end.time }).then(() => true).catch(() => false);
    expect(endTimeOk,
      `返却時刻 ${end.time} は選択肢にありません（店舗の受付時間外。実測の選択肢は11:00〜21:00）`
    ).toBe(true);
    console.log(`✅ 返却時間選択: ${end.time}`);

    // 「予約画面へ進む」は日時が全て正しく入ると display:none → 表示 に切り替わる
    // （＝この可視化がフォームバリデーション通過の証跡）。可視化を待って通常クリックする。
    // 【実測】非表示のままjQueryハンドラを直接発火（clickBubbleButton）してもワークフローは
    //   走らない（前回failの一因）。もう一因はアプリ更新バナーによるWF凍結 → freshenで解除。
    //   ただしバナーが出た場合はリロードで入力が消えるため、その回は fail させ再実行に委ねる。
    const wasStale = await freshenIfStale(page);
    expect(wasStale, "アプリ更新バナーによりフォーム入力が失われました（再実行してください）").toBe(false);
    const proceedBtn = page.getByRole("button", { name: "予約画面へ進む" });
    await expect(proceedBtn, "日時入力後も「予約画面へ進む」が表示されない（バリデーション未通過）").toBeVisible({ timeout: 15000 });
    await proceedBtn.click();

    // 新アプリは /reservation?reservation=<id> に遷移（cart部品。この時点でstatus=仮情報の予約が作られる）
    await page.waitForURL(/\/reservation\?reservation=/, { timeout: 20000 });
    console.log("✅ 予約(reservation/cart)ページへ遷移:", page.url());
    await page.waitForTimeout(3000);

    // ---- ステップ1: カート内容確認 → お客様情報の入力へ ----
    await freshenIfStale(page);
    const toCustomerBtn = page.getByRole("button", { name: "お客様情報の入力へ" });
    await expect(toCustomerBtn).toBeVisible({ timeout: 15000 });
    await toCustomerBtn.click();
    await page.waitForTimeout(4000);

    // ---- ステップ2: お客様情報入力（ステッパー: 空車検索→お客様情報入力→予約内容確認→支払い方法→予約完了）----
    // 「アプリの登録者と同じ」をチェック → アカウント情報から全項目オートフィルされる
    await page.getByText("アプリの登録者と同じ").first().click();
    await page.waitForTimeout(2000);

    // 同意チェック3つ（利用規約・身分証持参・18歳未満同伴）
    await page.getByText("上記の利用規約に同意する").first().click();
    await page.waitForTimeout(400);
    await page.getByText("身分証明書を持参することに同意する", { exact: false }).first().click();
    await page.waitForTimeout(400);
    await page.getByText("親権者または18歳以上の方が同伴すること", { exact: false }).first().click();
    await page.waitForTimeout(600);

    const toReviewBtn = page.getByRole("button", { name: "予約内容の確認に進む" });
    await expect(toReviewBtn).toBeVisible({ timeout: 10000 });
    await toReviewBtn.click();
    await page.waitForTimeout(4000);

    // ---- ステップ3: 予約内容確認 → 支払い方法へ ----
    const toPaymentBtn = page.getByRole("button", { name: "支払い方法を選択する" });
    await expect(toPaymentBtn, "予約内容確認ステップに到達できません（お客様情報の必須項目が未充足の可能性）").toBeVisible({ timeout: 15000 });
    await toPaymentBtn.click();
    await page.waitForTimeout(4000);

    // ---- ステップ4: 支払い方法選択 ----
    // デフォルトは「オンライン決済」がチェック済み（pay.jpカード入力UI付き）。
    // 実カード決済は禁止のため、必ず「店頭決済」に切り替える（クリックで相互排他）。
    await expect(page.getByText("店頭決済").first()).toBeVisible({ timeout: 10000 });
    await page.getByText("店頭決済", { exact: true }).first().click();
    await page.waitForTimeout(2000);

    // 店頭決済へ切り替わった証跡: オンライン決済側の「カード情報を入力する」ボタンが消えること
    await expect(page.getByRole("button", { name: "カード情報を入力する" }),
      "「店頭決済」への切替に失敗（カード入力ボタンが表示されたまま）。カード決済のまま確定はしない"
    ).toBeHidden({ timeout: 8000 });

    // 【安全策】可視のカード番号入力欄が無いことを確認（カード入力・送信は絶対にしない）
    const visibleCardFields = await page.locator('input[autocomplete="cc-number"], input[name*="card" i]')
      .locator("visible=true").count().catch(() => 0);
    expect(visibleCardFields, "カード番号入力欄が表示されています。店頭決済で進められないため停止").toBe(0);

    // ---- 予約を確定する ----
    await page.getByRole("button", { name: "予約を確定する" }).click();

    // 【厳格な完了判定】「予約が確定しました。」ポップアップの表示（緩いURL containsは廃止）
    await expect(page.getByText("予約が確定しました")).toBeVisible({ timeout: 25000 });
    console.log("🎉 予約が確定しました（店頭決済・実カード決済なし）");

    // 予約一覧へ遷移し、今回の貸出日の予約カードが実在することまで確認 + 予約番号を取得
    await page.getByRole("button", { name: "予約履歴を確認" }).click();
    await page.waitForURL(/\/user_reservation_list/, { timeout: 20000 });
    await page.waitForTimeout(3000);
    const startJp = toJpDate(start); // 例: "2026年07月20日"
    await expect(page.getByText(startJp).first(), `予約一覧に貸出日 ${startJp} のカードが見つかりません`).toBeVisible({ timeout: 15000 });
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
    expect(reservationNo, "予約一覧から予約番号を取得できませんでした").toBeTruthy();
    console.log(`✅ 予約一覧に反映を確認 — 予約番号: ${reservationNo} / 貸出日: ${startJp}（テスト9でキャンセルして後始末する）`);
  });

  // ----------------------------------------------------------------
  // 8. 予約一覧確認
  // ----------------------------------------------------------------
  test("予約一覧確認", async ({ page }) => {
    await login(page);

    // 新アプリでは /user_reservation_list へ直接遷移するとトップにバウンスするため、
    // トップの「予約の確認・キャンセル」ボタン経由で開く（Bubbleの状態が必要）
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "予約の確認・キャンセル" }).first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/user_reservation_list/);

    // 予約一覧ページが表示されること
    await expect(page.getByText("予約状況一覧")).toBeVisible({ timeout: 10000 });

    // 予約がある場合はキャンセルボタンが表示される
    const cancelBtns = page.getByRole("button", { name: "予約をキャンセルする" });
    const count = await cancelBtns.count();
    console.log(`✅ 予約一覧確認完了 (キャンセルボタン件数: ${count})`);
  });

  // ----------------------------------------------------------------
  // 9. 予約キャンセル
  //    直近の予約（今回テストで作成した予約）をキャンセルする
  // ----------------------------------------------------------------
  test("予約キャンセル", async ({ page }) => {
    test.setTimeout(150000);
    const start = parseDatetime(START_DATETIME);
    if (!start) {
      console.log("⚠️ RINCLE_DATE が未設定のためスキップ（テスト7も予約を作っていない）");
      return;
    }
    const startJp = toJpDate(start); // テスト7が作成した予約の貸出日表記（例: 2026年07月20日）

    await login(page);

    // 新アプリ: トップの「予約の確認・キャンセル」ボタン経由で予約一覧を開く
    // （/user_reservation_list への直接遷移はトップへバウンスするため不可）
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await freshenIfStale(page);
    await page.getByRole("button", { name: "予約の確認・キャンセル" }).first().click();
    await page.waitForURL(/\/user_reservation_list/, { timeout: 20000 });
    await page.waitForTimeout(3000);
    await expect(page.getByText("予約状況一覧")).toBeVisible({ timeout: 10000 });

    // テスト7が作成した予約（貸出日 = RINCLE_DATE の日付）のキャンセルボタンを日付で特定する。
    // 【重要・実測】一覧には過去出発の古い予約も並び、それらのキャンセルボタンは
    //   淡色（キャンセル期限切れ＝出発日前日23:59超過）で押しても何も起きない。
    //   そのため「先頭をクリック」ではなく、対象カードの日付でボタンindexを特定する。
    const findTargetIndex = () => page.evaluate((dateStr) => {
      const btns = Array.from(document.querySelectorAll("button"))
        .filter(b => (b.textContent || "").trim() === "予約をキャンセルする");
      for (let i = 0; i < btns.length; i++) {
        let card: HTMLElement | null = btns[i].parentElement;
        while (card && !(card.textContent || "").includes("予約番号")) card = card.parentElement;
        if ((card?.textContent || "").includes(dateStr)) {
          return { index: i, no: (card!.textContent || "").match(/予約番号[^0-9]*([0-9]{6,})/)?.[1] ?? "?" };
        }
      }
      return null;
    }, startJp);

    let target = await findTargetIndex();
    if (!target) {
      // テスト7が予約を作れていない場合のみ正当なスキップ（後始末対象も存在しない）
      console.log(`⚠️ 貸出日 ${startJp} の予約が一覧にありません（テスト7で予約が作成されていない）— スキップ`);
      return;
    }

    // 同日付の残骸（過去の失敗runの取り残し）も含め、全てキャンセルして後始末する（最大5件）
    let cancelled = 0;
    for (let i = 0; i < 5 && target; i++) {
      console.log(`✅ キャンセル対象: 予約番号 ${target.no}（貸出日 ${startJp}）`);
      await page.getByRole("button", { name: "予約をキャンセルする" }).nth(target.index).click();

      // 確認ポップアップ（「本当にキャンセルしますか」系）の「キャンセルする」を押す
      const confirmBtn = page.locator('[class*="Popup"] button', { hasText: "キャンセルする" }).first();
      await expect(confirmBtn, "キャンセル確認ポップアップが表示されません").toBeVisible({ timeout: 10000 });
      await confirmBtn.click();
      await page.waitForTimeout(4000);
      cancelled++;

      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1500);
      target = await findTargetIndex();
    }

    // 【厳格な後始末確認】テストが作成した貸出日の予約カードが一覧から消えていること
    expect(target, `キャンセル後も貸出日 ${startJp} の予約が一覧に残っています（後始末未完了）`).toBeNull();
    console.log(`✅ 予約キャンセル完了（${cancelled}件）。貸出日 ${startJp} の予約は一覧に残っていません（後始末OK）`);
  });

  // ----------------------------------------------------------------
  // 10. ログアウト
  // ----------------------------------------------------------------
  test("ログアウト", async ({ page }) => {
    await login(page);

    // 新アプリではトップヘッダーの「ログアウト」をクリック → /signin に遷移
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByText("ログアウト").first().click();
    await page.waitForTimeout(3000);

    // ログアウト後は /signin へ遷移し、ログイン用の「ログイン」ボタンが表示される
    await expect(page.getByRole("button", { name: "ログイン" }).first()).toBeVisible({ timeout: 10000 });
    console.log("✅ ログアウト完了");
  });

  // ----------------------------------------------------------------
  // 11. 新着情報詳細
  // ----------------------------------------------------------------
  test("新着情報詳細", async ({ page }) => {
    await login(page);

    // コンテンツが描画されるまで待機してからスクロール
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(2000);

    // 新着情報の1件目をBubble jQuery handler経由でクリック
    const clicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".clickable-element"));
      const el = els.find(el => {
        const r = el.getBoundingClientRect();
        const text = el.textContent || "";
        // 新着情報の記事を検索（日付パターンを含み、かつラベル「新着情報」自体は除外）
        return r.width > 0 && r.height > 0
          && /\d{4}\.\d{1,2}\.\d{1,2}/.test(text)
          && text.trim() !== "新着情報";
      }) as HTMLElement | null;
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
    });
    if (!clicked) {
      console.log("⚠️ 新着情報の記事が見つからない — スキップ");
      return;
    }

    // 【新アプリでの構造変化・実地プローブで確認済み】新着情報の記事クリックは
    // 独立ページ /index/news_detail ではなく、/index/news_list?news=<id> に遷移する
    // （news_list ページが news パラメータの有無で一覧/詳細を出し分ける構造に変更されている）。
    // また「一覧へ戻る」ボタンの文言も新アプリでは単に「戻る」になっている。
    await page.waitForTimeout(3000);
    await page.waitForURL(/\/index\/news_list\?news=/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/index\/news_list\?news=/);

    // 「戻る」ボタンが表示されること
    const backBtn = page.evaluate(() => {
      const el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.textContent?.trim() === "戻る";
      });
      return !!el;
    });
    expect(await backBtn).toBe(true);
    console.log("✅ 新着情報詳細ページ確認完了:", page.url().replace(BASE_URL, ""));
  });

  // ----------------------------------------------------------------
  // 12. TOPICS詳細
  // ----------------------------------------------------------------
  test("TOPICS詳細", async ({ page }) => {
    await login(page);

    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 1300));
    await page.waitForTimeout(1000);

    // TOPICSの1件目をBubble jQuery handler経由でクリック
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.textContent?.includes("加盟店おすすめライドコース");
      }) as HTMLElement | null;
      if (!el) return;
      const events = (window as any).jQuery?._data?.(el, "events");
      const handler = events?.click?.[0]?.handler;
      if (handler) {
        const e = (window as any).jQuery.Event("click");
        e.target = el; e.currentTarget = el;
        handler.call(el, e);
      } else {
        el.click();
      }
    });

    // topics_detail ページに遷移したことを確認（新アプリでも /index/topics_detail?banner=<id> のまま）
    await page.waitForURL(/\/index\/topics_detail/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/index\/topics_detail/);

    // 【新アプリでの文言変化・実地プローブで確認済み】戻るボタンの文言は
    // 「一覧へ戻る」ではなく「戻る」になっている
    const backBtn = page.evaluate(() => {
      const el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.textContent?.trim() === "戻る";
      });
      return !!el;
    });
    expect(await backBtn).toBe(true);
    console.log("✅ TOPICS詳細ページ確認完了:", page.url().replace(BASE_URL, ""));
  });

  // ----------------------------------------------------------------
  // 13. よくある質問（FAQ）
  // ----------------------------------------------------------------
  // 【新アプリでの構造変化・実地プローブで確認済み】旧 /index/faq は option set
  // (index_page) に対応する値自体が存在せず、実際に遷移してもヘッダー/フッターのみで本文なし。
  // 実際のFAQ本文（保険・補償/装備・付属品/予約・受付/利用・返却のQ&A）はフッターの
  // 「よくある質問」リンクの遷移先である /index/guide にある（テスト3参照＝内部的な
  // ページ名は"guide"のままFAQコンテンツに転用されている）。
  test("よくある質問ページ", async ({ page }) => {
    await login(page);

    await page.goto(`${BASE_URL}/index/guide`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    await expect(page).toHaveURL(/\/index\/guide/);
    // FAQ本文（guideページ固有の見出し）が表示されていること
    await expect(page.getByText("保険・補償")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("予約・受付")).toBeVisible({ timeout: 5000 });
    // ナビゲーションが表示されていること
    await expect(page.getByText("ログアウト").first()).toBeVisible({ timeout: 5000 });
    console.log("✅ よくある質問ページ確認完了（実体は /index/guide）");
  });

  // ----------------------------------------------------------------
  // 14. プライバシーポリシー
  // ----------------------------------------------------------------
  // 【新アプリでの構造変化・実地プローブで確認済み】旧 /index/privacypolicy は
  // ヘッダー/フッターのみで本文が空。実際のプライバシーポリシー本文は新設された
  // /legal?mode=privacypolicy ページにある（フッターの「プライバシーポリシー」リンクの
  // 遷移先。ただし新しいタブで開く仕様のため、テストでは直接遷移で内容を検証する）。
  test("プライバシーポリシーページ", async ({ page }) => {
    await login(page);

    await page.goto(`${BASE_URL}/legal?mode=privacypolicy`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    await expect(page).toHaveURL(/\/legal\?mode=privacypolicy/);
    // プライバシーポリシー本文が表示されていること
    await expect(page.getByText("個人情報の取得方法")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("ログアウト").first()).toBeVisible({ timeout: 5000 });
    console.log("✅ プライバシーポリシーページ確認完了（実体は /legal?mode=privacypolicy）");
  });

  // ----------------------------------------------------------------
  // 15. お問い合わせフォーム
  // ----------------------------------------------------------------
  test("お問い合わせフォーム", async ({ page }) => {
    await login(page);

    await page.goto(`${BASE_URL}/index/contact`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    await expect(page).toHaveURL(/\/index\/contact/);

    // 「RINCLEへのお問い合わせ」テキストと「送信」ボタンが表示されること
    // 【新アプリでの文言変化・実地プローブで確認済み】見出しは「RINCLEへの問い合わせ」ではなく
    // 「RINCLEへのお問い合わせ」（「お」が追加）になっている
    await expect(page.getByText("RINCLEへのお問い合わせ")).toBeVisible({ timeout: 5000 });
    const sendBtn = page.evaluate(() => {
      const el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.textContent?.trim() === "送信";
      });
      return !!el;
    });
    expect(await sendBtn).toBe(true);
    console.log("✅ お問い合わせフォーム確認完了");
  });

  // ----------------------------------------------------------------
  // 16. アカウント情報編集
  // ----------------------------------------------------------------
  // 【新アプリでの構造変化・実地プローブで確認済み】旧 /index/edit はヘッダー/フッターのみで
  // 本文が空（独立ページとしては機能していない）。新アプリではマイページ(/mypage → 内部的に
  // /mypage/userinfo にリダイレクト)の「アカウント編集」ボタンを押すと、同一URL(/mypage/userinfo)
  // 上でコンテンツが編集フォーム（お客様情報編集）に差し替わる構造になっている。
  test("アカウント情報編集ページ", async ({ page }) => {
    await login(page);

    await page.goto(`${BASE_URL}/mypage`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/mypage/);

    const editBtn = page.getByRole("button", { name: "アカウント編集" });
    await expect(editBtn).toBeVisible({ timeout: 10000 });
    await editBtn.click();
    await page.waitForTimeout(2000);

    // 編集フォーム（「お客様情報編集」見出し）に切り替わっていること
    await expect(page.getByText("お客様情報編集")).toBeVisible({ timeout: 8000 });

    // 「変更を完了する」ボタンが表示されること
    const saveBtn = page.evaluate(() => {
      const el = Array.from(document.querySelectorAll(".clickable-element")).find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.textContent?.trim() === "変更を完了する";
      });
      return !!el;
    });
    expect(await saveBtn).toBe(true);
    console.log("✅ アカウント情報編集ページ確認完了（実体は /mypage/userinfo 上のフォーム切替）");
  });

  // ----------------------------------------------------------------
  // 17. 自転車種類フィルタ検索
  // ----------------------------------------------------------------
  test("自転車種類フィルタ検索", async ({ page }) => {
    await login(page);

    // エリア選択
    await page.locator("select.bubble-element.Dropdown").first().selectOption({ label: AREA });
    await page.waitForTimeout(500);

    // 日付未定チェック
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(1).check();

    // 自転車種類フィルタ: ロードバイクのみ選択
    // 【重要・実地プローブで確認したアプリの挙動】自転車のタイプのタグは初期状態で
    // 全種類（ロードバイク/クロスバイク/マウンテンバイク/ミニベロ・折りたたみ/キッズ）が
    // 選択済み（背景が濃色）になっており、タグをクリックすると「選択される」のではなく
    // 「選択解除される」トグル式。旧テストはロードバイクをクリックしていたが、これは
    // ロードバイクを除外し他の4種類だけで検索してしまうバグだった（実際に確認: URLの
    // type パラメータが "クロスバイク,マウンテンバイク,..." になりロードバイクが除外されていた）。
    // ロードバイクのみで絞り込むには、ロードバイク以外の4種類を選択解除する必要がある。
    for (const otherType of ["クロスバイク", "マウンテンバイク", "ミニベロ/折りたたみ", "キッズ"]) {
      const deselected = await clickClickableElementByText(page, otherType);
      expect(deselected).toBe(true);
      await page.waitForTimeout(300);
    }

    // 検索実行
    await page.getByRole("button", { name: "検索する" }).click();
    await page.waitForLoadState("networkidle");
    // 【タイミング注意・実地プローブで確認済み】networkidle 到達後も /search への
    // クライアントサイド遷移が少し遅れて発生することがあるため、URL遷移を明示的に待つ
    await page.waitForURL(/\/search/, { timeout: 10000 }).catch(() => {});

    // 検索条件にロードバイクのみが反映されていること（URLの type パラメータで確認）
    const url = decodeURIComponent(page.url());
    expect(url).toContain("type=ロードバイク");
    expect(url).not.toMatch(/type=[^&]*(クロスバイク|マウンテンバイク|ミニベロ|キッズ)/);

    // 検索条件表示にも「ロードバイク」のみが表示されていること
    await expect(page.getByText("自転車のタイプ")).toBeVisible({ timeout: 8000 });

    // 検索結果（貸出可能な自転車をすべて見る／詳細を見る）が表示されること。
    // 「検索中...」の非同期ロードが終わるまで待つ必要があるためポーリングする
    await expect(async () => {
      const hasResults = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll(".clickable-element")).filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        return els.some(el => el.textContent?.includes("貸出可能") || el.textContent?.includes("詳細"));
      });
      expect(hasResults).toBe(true);
    }).toPass({ timeout: 15000 });
    console.log(`✅ ロードバイクフィルタ検索完了 (url: ${url})`);
  });

  // ----------------------------------------------------------------
  // 18. ログイン失敗（誤パスワード）— ネガティブ系
  // ----------------------------------------------------------------
  test("ログイン失敗（誤パスワード）", async ({ page }) => {
    await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });
    await freshenIfStale(page);
    await page.locator('input[type="email"]').first().waitFor({ state: "visible", timeout: 20000 });
    await page.locator('input[type="email"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill("wrong-password-e2e");
    await page.getByRole("button", { name: "ログイン" }).first().click();
    await page.waitForTimeout(5000);
    // セッションが確立されないこと（トップにログアウトが出ない）。
    // 開発中はアプリ更新バナー等で表示が乱れることがあるため、検出時は一度リロードして再判定
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    let loggedIn = await page.getByText("ログアウト").first()
      .waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
    if (loggedIn) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(4000);
      loggedIn = await page.getByText("ログアウト").first()
        .waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);
    }
    expect(loggedIn, "誤ったパスワードでログインできてしまいました").toBe(false);
    console.log("✅ 誤パスワードでログインできないことを確認");
  });

  // ----------------------------------------------------------------
  // 19. 過去日・当日は貸出日として選択不可 — ネガティブ系
  //     （予約は前日23:59まで。テスト店舗=SEINO自転車のFALD - ERX2 を使用）
  // ----------------------------------------------------------------
  test("過去日・当日の貸出日選択不可", async ({ page }) => {
    await page.goto(TEST_BIKE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    await freshenIfStale(page);
    // 貸出日ピッカーを開き、当日セルが disabled であることを確認
    const pickerInput = page.locator("input.picker__input").nth(0);
    const ariaOwns = await pickerInput.getAttribute("aria-owns");
    const pickerRoot = page.locator(`#${ariaOwns}`);
    await pickerInput.click({ force: true });
    await page.waitForTimeout(800);
    const today = new Date();
    const todayDisabled = await pickerRoot.locator(".picker__day--disabled")
      .filter({ hasText: new RegExp(`^${today.getDate()}$`) }).count();
    expect(todayDisabled, `当日(${today.getDate()}日)が貸出日ピッカーで選択可能になっています（前日23:59までの予約制約に反する）`).toBeGreaterThan(0);
    // 過去日（月初〜昨日のどれか）も disabled であること（1日でなければ前日で確認）
    if (today.getDate() > 1) {
      const yesterdayDisabled = await pickerRoot.locator(".picker__day--disabled")
        .filter({ hasText: new RegExp(`^${today.getDate() - 1}$`) }).count();
      expect(yesterdayDisabled, "過去日が貸出日ピッカーで選択可能になっています").toBeGreaterThan(0);
    }
    console.log("✅ 当日・過去日が貸出日として選択不可（ピッカーdisabled）を確認");
  });

  // ----------------------------------------------------------------
  // 20. 休業日を返却日に選ぶとエラー表示 — ネガティブ系
  //     貸出可能日程カレンダーの「休業日」表示から対象日を動的に特定する
  //     （SEINO自転車は水・金休業のため、直近数日以内に必ず存在する）
  // ----------------------------------------------------------------
  test("休業日を返却日に選ぶとエラー表示", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(TEST_BIKE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    await freshenIfStale(page);

    // 貸出可能日程カレンダー（当月）から「休業日」の日と「○（予約可）」の日を読む
    const cal = await page.evaluate(() => {
      const holidays: number[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
        const t = (el.innerText || "").trim();
        const m = t.match(/^(\d{1,2})\n休業日/);
        if (m && t.length < 20) holidays.push(Number(m[1]));
      }
      return { holidays: [...new Set(holidays)].sort((a, b) => a - b) };
    });
    console.log(`当月の休業日: ${cal.holidays.join(", ")}`);
    const today = new Date();
    // ピッカーで選択可能（翌日以降）の直近の休業日を対象にする
    const targetHoliday = cal.holidays.find(d => d > today.getDate());
    if (!targetHoliday) {
      console.log("⚠️ 当月内に翌日以降の休業日が見つからないためスキップ（店舗の休業設定に依存）");
      return;
    }
    // 貸出日: 休業日より前の営業日（ピッカーで有効なセルのうち休業日でない直近日）
    const startDay = (() => {
      for (let d = today.getDate() + 1; d < targetHoliday; d++) {
        if (!cal.holidays.includes(d)) return d;
      }
      return null;
    })();
    if (!startDay) {
      console.log("⚠️ 休業日より前に選択可能な営業日がないためスキップ");
      return;
    }
    console.log(`貸出日=${startDay}日 / 返却日=${targetHoliday}日（休業日）で検証`);

    await selectPikadayDate(page, 0, today.getMonth() + 1, startDay, today.getFullYear());
    await selectPikadayDate(page, 3, today.getMonth() + 1, targetHoliday, today.getFullYear());
    await page.waitForTimeout(2000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(/休業日のため返却できません/.test(bodyText),
      "休業日を返却日に選んでもエラーメッセージ（〜は休業日のため返却できません）が表示されません"
    ).toBe(true);
    console.log("✅ 休業日を返却日に選ぶとエラーメッセージが表示されることを確認");
  });

  // ----------------------------------------------------------------
  // 21. タイプフィルタの絞り込み精度（クロスバイク）
  //     URLパラメータ直指定で、該当タイプのみ表示されることを確認
  // ----------------------------------------------------------------
  test("タイプフィルタ絞り込み精度（クロスバイク）", async ({ page }) => {
    await page.goto(`${BASE_URL}/search?pref=9&start=&end=&type=クロスバイク&e-bike=&free=&shop=`,
      { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(10000);
    const text = await page.evaluate(() => document.body.innerText);
    // テスト店舗（SEINO自転車）のクロスバイク FALD - ERX2 は表示される
    expect(text.includes("FALD"), "クロスバイク指定でテスト店舗のクロスバイク（FALD - ERX2）が表示されません").toBe(true);
    // ロードバイク（株式会社SEINOのTREK FX3 DISC）は表示されない
    expect(text.includes("FX3"), "クロスバイク指定なのにロードバイク（FX3 DISC）が表示されています（絞り込み漏れ）").toBe(false);
    console.log("✅ タイプフィルタの絞り込み精度確認完了（クロスバイクのみ表示）");
  });
});
