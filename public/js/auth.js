import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithRedirect, 
    getRedirectResult,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase設定 (ご自身の環境に合わせて変更してください)
const firebaseConfig = {
    apiKey: "AIzaSyCNaMyiMhGfWsCP69f-WELJP0oVwM-b3fY",
    authDomain: "uranai-app2.firebaseapp.com",
    projectId: "uranai-app2",
    storageBucket: "uranai-app2.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "1:104535743252:web:83f60f87def0d636448001"
};

// 初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 言語設定
auth.languageCode = 'ja';

// --------------------------------------------------
// ★重要修正: ページ読み込み時に、リダイレクト結果を確認する
// --------------------------------------------------
getRedirectResult(auth)
    .then((result) => {
        if (result) {
            // Googleログインから戻ってきた場合
            const user = result.user;
            console.log("Redirect Login Success:", user.uid);
            handleLoginSuccess(user, 'Google');
        }
    })
    .catch((error) => {
        console.error("Redirect Error:", error);
        // エラー内容によってはアラートを出すなど
        if (error.code !== 'auth/popup-closed-by-user') {
           // alert("ログインに失敗しました: " + error.message);
        }
    });

// --------------------------------------------------
// 認証状態の監視
// --------------------------------------------------
onAuthStateChanged(auth, (user) => {
    if (user) {
        // すでにログイン状態の場合
        // (リダイレクト直後以外でも、ブラウザを閉じてまた開いた時など)
        localStorage.setItem('fortune_user_id', user.uid);
        
        // 画面の表示切り替えは app.js 側で行われるが、
        // もしトップページ(gateway/title)にいるならアプリを開始させる
        const currentScreen = document.querySelector('.screen[style*="flex"]')?.id;
        if (['gateway-screen', 'title-screen'].includes(currentScreen)) {
            if (window.initApp) {
                window.initApp();
            } else {
                // app.jsのロード待ち等の場合リロード
                location.reload(); 
            }
        }
    } else {
        // 未ログイン時
        // 特に何もしない（ログアウト処理は window.logout で行う）
    }
});


// --------------------------------------------------
// ログイン処理関数 (Windowオブジェクトに紐付け)
// --------------------------------------------------

// ★Googleログイン（リダイレクト方式に変更）
window.handleGoogleLogin = () => {
    // Android/iOSでの安定性のため Redirect を使用
    signInWithRedirect(auth, provider);
    // ※この後、Googleの画面に遷移するため、ここから下の行は実行されません
};

// メールログイン
window.handleEmailLogin = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if (!email || !password) return alert("メールアドレスとパスワードを入力してください");

    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        handleLoginSuccess(result.user, 'Email');
    } catch (error) {
        console.error(error);
        alert("ログイン失敗: " + error.message);
    }
};

// メール新規登録
window.handleEmailSignup = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if (!email || !password) return alert("メールアドレスとパスワードを入力してください");
    if (password.length < 6) return alert("パスワードは6文字以上で設定してください");

    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        handleLoginSuccess(result.user, 'Email');
    } catch (error) {
        console.error(error);
        alert("登録失敗: " + error.message);
    }
};

// ログアウト
window.logout = () => {
    signOut(auth).then(() => {
        localStorage.removeItem('fortune_user_id');
        localStorage.removeItem('fortune_auth_type');
        alert("ログアウトしました");
        location.reload();
    }).catch((error) => {
        console.error(error);
    });
};

// 共通のログイン成功処理
function handleLoginSuccess(user, type) {
    localStorage.setItem('fortune_user_id', user.uid);
    localStorage.setItem('fortune_auth_type', type);
    
    // ユーザー情報をサーバーに一度送って確認（app.jsのロジックに任せるためリロード推奨）
    // もしくは initApp を直接呼ぶ
    if (typeof window.initApp === 'function') {
        window.initApp();
    } else {
        location.reload();
    }
}
