import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
// Gemini APIクライアントのインポート
import { GoogleGenerativeAI } from "@google/generative-ai";

// ★追加1: 用意したデータと設定ファイルをインポート
import casts from "./casts.js";
import { tarotDataShion } from "./tarot_data_shion.js";

const app = new Hono();

// ==========================================
// 🛠️ ユーティリティ関数: 占術ロジック
// ==========================================

/**
 * 指定されたデータソースからランダムにタロットカードを1枚引く
 */
function drawTarotCard(dataSource) {
  let deck = [];
  if (dataSource === 'shion_tarot') {
    deck = tarotDataShion;
  } else {
    // 将来他の占い師のデータが増えたらここに追加
    console.warn(`Unknown data source: ${dataSource}`);
    return null;
  }

  if (!deck || deck.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * deck.length);
  return deck[randomIndex];
}

/**
 * 占い結果を含めた動的なシステムプロンプトを生成する
 */
function generateDivinationPrompt(cast, userMessage, cardResult) {
  // 基本の性格設定
  let basePrompt = cast.systemPrompt;

  // 占い結果に基づく追加指令を作成
  let divinationInstruction = `\n
========================================
【✨ 特別指令：占断を実行せよ ✨】
========================================
現在、ユーザーから以下の相談が寄せられました。
これに対し、あなたの占術（タロット）で占った結果は以下の通りです。

この結果に基づき、設定されたキャラクター人格（${cast.name}）を崩さず、
相談者に寄り添ったアドバイスを行ってください。

---
■ 相談者のメッセージ:
「${userMessage}」

■ タロット占いの結果:
* 引いたカード: **${cardResult.name}** (${cardResult.position})
* カードの解釈キー: ${cardResult.message}
---

【回答のガイドライン】
1.  カードの名前を無理に出す必要はありません。自然な会話の流れを重視してください。
2.  「解釈キー」はそのまま読み上げるのではなく、あなたの言葉で噛み砕き、相談内容に合わせてアレンジして伝えてください。
3.  断定は避け、相談者が自ら気づきを得られるような、前向きな示唆を与えてください。
========================================
`;

  // 基本設定と追加指令を合体させる
  return basePrompt + divinationInstruction;
}


// ==========================================
// 🚀 APIルート定義
// ==========================================

// チャット一覧の取得 (既存のまま)
app.get("/chats", async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare("SELECT * FROM chats ORDER BY created_at DESC").all();
  return c.json(results);
});

// 新しいチャットの作成 (既存のまま)
app.post("/chats", async (c) => {
  const db = c.env.DB;
  // リクエストボディから castId を取得（デフォルトは1:紫苑）
  const { castId = 1 } = await c.req.json();
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  
  await db
    .prepare("INSERT INTO chats (id, cast_id, created_at) VALUES (?, ?, ?)")
    .bind(id, castId, createdAt)
    .run();
  
  return c.json({ id, castId, createdAt }, 201);
});

// チャット履歴の取得 (既存のまま)
app.get("/chats/:chatId/messages", async (c) => {
  const db = c.env.DB;
  const { chatId } = c.req.param();
  const { results } = await db
    .prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC")
    .bind(chatId)
    .all();
  return c.json(results);
});


// =================================================================
// ⭐ メッセージの送信とAI回答の生成（ここが最大の変更点！）⭐
// =================================================================
app.post("/chats/:chatId/messages", async (c) => {
  const db = c.env.DB;
  const { chatId } = c.req.param();
  const { content, role } = await c.req.json(); // role は 'user'

  // 1. ユーザーのメッセージをDBに保存 (既存処理)
  const userMessageId = uuidv4();
  const createdAt = new Date().toISOString();
  await db
    .prepare("INSERT INTO messages (id, chat_id, content, role, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(userMessageId, chatId, content, role, createdAt)
    .run();

  // -------------------------------------------------------
  // 🔮 ここから占いロジック開始 🔮
  // -------------------------------------------------------
  
  // A. 現在のチャットの担当キャストIDを調べる
  const chatInfo = await db.prepare("SELECT cast_id FROM chats WHERE id = ?").bind(chatId).first();
  const currentCastId = chatInfo ? chatInfo.cast_id : 1; // デフォルトは1
  
  // B. casts.js からキャストの設定情報を取得
  const castSetting = casts[currentCastId];
  let systemPromptToUse = castSetting.systemPrompt; // デフォルトは基本プロンプト

  // C. 占術タイプに応じた処理の分岐
  let drawnCard = null;
  if (castSetting.divinationType === 'tarot') {
    console.log(`🔮 ${castSetting.name}がタロット占いを開始します...`);
    
    // C-1. カードを引く
    drawnCard = drawTarotCard(castSetting.dataSource);
    
    if (drawnCard) {
      console.log(`🃏 引いたカード: ${drawnCard.name} (${drawnCard.position})`);
      // C-2. 占い結果を含めた強力なシステムプロンプトを動的に生成する
      systemPromptToUse = generateDivinationPrompt(castSetting, content, drawnCard);
    }
  }
  // ※将来他の占術が増えたらここに else if で追加していく

  // -------------------------------------------------------
  // 🤖 Gemini APIへの接続準備
  // -------------------------------------------------------
  const genAI = new GoogleGenerativeAI(c.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  // Geminiに送る会話履歴の準備
  // まず、動的に生成したシステムプロンプトを先頭にセット
  let historyForGemini = [
    {
      role: "user", // Gemini Proではシステム指示もuserロールで送るのが一般的
      parts: [{ text: systemPromptToUse }],
    },
    {
      role: "model",
      parts: [{ text: "承知いたしました。そのような設定と状況を踏まえ、回答します。" }],
    }
  ];

  // 過去の会話履歴をDBから取得して追加（直近数件に絞るのがベターだが一旦全件）
  // ※今回は占い結果をプロンプトに含めるので、過去ログは必須ではないが念のため
  const pastMessages = await db
  .prepare("SELECT content, role FROM messages WHERE chat_id = ? ORDER BY created_at ASC")
  .bind(chatId)
  .all();

  // DBの履歴をGeminiの形式に変換して追加
  // (直前のユーザーメッセージは重複するので除外する工夫が必要だが、簡易実装として進める)
  /* pastMessages.results.forEach(msg => {
      historyForGemini.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
      });
  });
  */
  // ★簡易実装：今回は過去ログを入れず、強力なシステムプロンプト＋直前の質問だけで勝負してみる
  historyForGemini.push({
    role: "user",
    parts: [{ text: content }] // 今回の相談内容
  });


  console.log("🚀 Geminiにリクエストを送信します...");
  // -------------------------------------------------------
  // 🗣️ Geminiに回答を生成させる
  // -------------------------------------------------------
  const chat = model.startChat({
    history: historyForGemini,
    generationConfig: {
      maxOutputTokens: 500, // 回答の長さ制限
    },
  });

  let aiResponseText = "";
  try {
    // ストリーミングを使わず一括で回答を取得（占い結果をまとめるため）
    const result = await chat.sendMessage(content);
    const response = await result.response;
    aiResponseText = response.text();
    console.log("✅ Geminiから回答を受信しました。");

  } catch (error) {
    console.error("❌ Gemini API Error:", error);
    aiResponseText = "申し訳ありません。星の声が少し遠いようです...少し時間を空けて、もう一度話しかけていただけますか？";
  }

  // -------------------------------------------------------
  // 📝 AIの回答を処理して保存
  // -------------------------------------------------------

  // (将来的な拡張：ここに「引いたカードの画像ファイル名」をレスポンスに含める処理を入れる)
  // 例: aiResponseText = aiResponseText + `\n\n(CARD_IMAGE:${drawnCard.imageFile})`;

  // 3. AIの回答をDBに保存
  const aiMessageId = uuidv4();
  await db
    .prepare("INSERT INTO messages (id, chat_id, content, role, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(aiMessageId, chatId, aiResponseText, "assistant", new Date().toISOString())
    .run();

  // 4. フロントエンドに回答を返す
  return c.json({
    id: aiMessageId,
    content: aiResponseText,
    role: "assistant",
    createdAt: new Date().toISOString(),
    // 将来的にここに cardImage: drawnCard.imageFile などを追加できる
  }, 201);
});

export default app;
// ==========================================
// 🆕 追加：キャスト一覧を取得するAPI
// ==========================================
app.get("/api/casts", (c) => {
  // casts.js から読み込んだデータを、扱いやすい配列の形にして返す
  const castsArray = Object.values(casts);
  return c.json(castsArray);
});
