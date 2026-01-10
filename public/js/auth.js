import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCNaMyiMhGfWsCP69f-WELJP0oVwM-b3fY",
    authDomain: "uranai-app-54348.firebaseapp.com",
    projectId: "uranai-app-54348",
    storageBucket: "uranai-app-54348.firebasestorage.app",
    messagingSenderId: "104535743252",
    appId: "1:104535743252:web:83f60f87def0d636448001",
    measurementId: "G-T89YYWNPL3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// グローバル関数として公開
window.handleGoogleLogin = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        handleAuthWithFirebase(result.user, 'Google');
    } catch (error) {
        console.error(error);
        alert("ログインエラー: " + error.message);
    }
};

window.handleEmailSignup = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if (!email || !password) return alert("メールとパスワードを入力してください");

    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        handleAuthWithFirebase(result.user, 'Email');
    } catch (error) {
        console.error(error);
        let msg = "登録エラー: " + error.message;
        if (error.code === 'auth/email-already-in-use') msg = "このメールアドレスは既に登録されています。ログインしてください。";
        if (error.code === 'auth/weak-password') msg = "パスワードは6文字以上にしてください。";
        alert(msg);
    }
};

window.handleEmailLogin = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if (!email || !password) return alert("メールとパスワードを入力してください");

    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        handleAuthWithFirebase(result.user, 'Email');
    } catch (error) {
        console.error(error);
        let msg = "ログインエラー: " + error.message;
        if (error.code === 'auth/invalid-credential') msg = "メールアドレスまたはパスワードが違います。";
        if (error.code === 'auth/user-not-found') msg = "登録されていません。新規登録してください。";
        alert(msg);
    }
};

window.logout = async () => {
    await signOut(auth);
    localStorage.clear();
    location.reload();
};

async function handleAuthWithFirebase(firebaseUser, authType = 'Email') {
    const userId = firebaseUser.uid;
    const email = firebaseUser.email;

    localStorage.setItem('fortune_user_id', userId);
    localStorage.setItem('fortune_auth_type', authType);

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, email, auth_type: authType })
        });

        if (!res.ok) throw new Error("サーバー通信エラー");
        const data = await res.json();

        if (data.isComplete) {
            window.initApp();
        } else {
            window.showScreen('setup-screen');
        }
    } catch (e) {
        alert("認証後の処理に失敗しました: " + e.message);
    }
}
