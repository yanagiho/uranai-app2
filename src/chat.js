import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
// Gemini APIクライアントのインポート
import { GoogleGenerativeAI } from "@google/generative-ai";

// 用意したデータと設定ファイルをインポート
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

// 🆕 追加：キャスト一覧を取得するAPI（これが足りなかった部分です！）
app.get("/api/casts", (c) => {
  // casts.js から読み込んだデータを、扱いやすい配列の形にして返す
  const castsArray = Object.values(casts);
  return c.json(castsArray);
});

// チャット一覧の取得
app.get("/chats", async (c) => {
  const db = c.env.DB;
  // テーブルが存在しない場合のハンドリングを追加
  try {
    const { results } = await db.prepare("SELECT * FROM chats ORDER BY created_at DESC").all();
    return c.json(results);
  } catch (e) {
    console.error("Database error:", e);
    // まだテーブルがない場合は空配列を返す
    return c.json([]);
  }
});

// 新しいチャットの作成
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

// チャット履歴の取得
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
// ⭐ メッセージの送信とAI回答の生成
// =================================================================
app.post("/chats/:chatId/messages", async (c) => {
  const db = c.env.DB;
  const { chatId } = c.req.param();
  const { content, role } = await c.req.json(); // role は 'user'

  // 1. ユーザーのメッセージをDBに保存
  const userMessageId = uuidv4();
  const createdAt = new Date().toISOString();
  await db
    .prepare("INSERT INTO messages (id, chat_id, content, role, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(userMessageId, chatId, content, role, createdAt)
    .run();

  // -------------------------------------------------------
  // 🔮 占いロジック開始
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

  // -------------------------------------------------------
  // 🤖 Gemini APIへの接続準備
  // -------------------------------------------------------
  const genAI = new GoogleGenerativeAI(c.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  // Geminiに送る会話履歴の準備
  let historyForGemini = [
    {
      role: "user",
      parts: [{ text: systemPromptToUse }],
    },
    {
      role: "model",
      parts: [{ text: "承知いたしました。そのような設定と状況を踏まえ、回答します。" }],
    }
  ];

  // 今回のメッセージを追加
  historyForGemini.push({
    role: "user",
    parts: [{ text: content }]
  });


  console.log("🚀 Geminiにリクエストを送信します...");
  // -------------------------------------------------------
  // 🗣️ Geminiに回答を生成させる
  // -------------------------------------------------------
  const chat = model.startChat({
    history: historyForGemini,
    generationConfig: {
      maxOutputTokens: 500,
    },
  });

  let aiResponseText = "";
  try {
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
  }, 201);
});

export default app; // ★この行が必ず最後に来るようにしてください
