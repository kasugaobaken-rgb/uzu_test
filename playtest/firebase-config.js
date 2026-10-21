// ============================================================
//  ここに Firebase の設定を貼り付けてください
// ------------------------------------------------------------
//  1. https://console.firebase.google.com/ でプロジェクトを作成
//  2. 左メニュー「構築 > Realtime Database」→ データベースを作成
//     ロケーションはどこでもOK。「テストモードで開始」を選ぶ
//  3. プロジェクトの設定（歯車）→ 全般 → 下部「マイアプリ」
//     → ウェブアプリ（</>）を追加 → 表示された firebaseConfig を下へ貼る
//  4. databaseURL が含まれていることを必ず確認（無ければ Realtime Database
//     の画面に表示されている https://xxxx.firebaseio.com を手で足す）
// ============================================================

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBQUuvGZndGVJc4pjzFJfxR9fXfd0TtKYY",
  authDomain: "test-16c7c.firebaseapp.com",
  databaseURL: "https://test-16c7c-default-rtdb.firebaseio.com",
  projectId: "test-16c7c",
  storageBucket: "test-16c7c.firebasestorage.app",
  messagingSenderId: "843118885500",
  appId: "1:843118885500:web:082c2b586bb13b1e7f67f9",
  measurementId: "G-GSY8SYN23Z"
};

// ------------------------------------------------------------
//  Realtime Database のルール（テスト用・デモ限定）
//  「ルール」タブに以下を貼って公開してください。
//
//  {
//    "rules": {
//      "rooms": {
//        "$room": { ".read": true, ".write": true }
//      }
//    }
//  }
//
//  ※ 誰でも読み書きできる状態です。デモ以外では使わないこと。
//     公開デモの後は Firebase プロジェクトを削除するか、
//     ルールを ".read": false / ".write": false に戻してください。
// ------------------------------------------------------------
