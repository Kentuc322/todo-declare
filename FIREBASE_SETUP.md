# Googleログイン・端末間同期の初期設定

GitHub Pagesで画面を配信し、Firebase AuthenticationとCloud Firestoreで本人のデータを保存します。GoogleログインはFirebaseの公式SDKを使用。クライアント設定だけではアクセスを保護できないため、下記のルール公開が必須です。

## 1. Firebaseプロジェクト

[Firebase Console](https://console.firebase.google.com/)でGoogleログインし、「プロジェクトを作成」。Google Analyticsはこのアプリには不要なのでオフにできます。支払い・有料プランへの変更は不要な構成です（利用枠を超えた場合は動作が制限されます）。規約への同意は本人が行ってください。

## 2. Googleログイン

プロジェクトのAuthentication → 始める → Sign-in methodでGoogleを有効にし、サポートメールを選んで保存。

Authentication → Settings → Authorized domainsに `kentuc322.github.io` を追加します。開発時のみ `127.0.0.1` / `localhost` も必要に応じて追加。

## 3. Firestore

Cloud Firestore → データベースを作成 → Standard edition、データベースID `(default)` を選択。地域は日本利用なら東京などを選びます。地域の変更は容易ではないため、作成時に確認してください。

「本番環境モード」で開始し、Rulesタブにリポジトリの `firestore.rules` の全文を貼り付けて公開してください。**テストモードの全員アクセス可能なルールは使わないでください。** Firebase CLIを使う場合は `firebase deploy --only firestore:rules --project <project-id>`。

ルールは `users/{Google認証UID}/todo/state` だけ本人の読み書きを許可し、他人・未ログイン・一覧取得・削除を拒否します。Security Rulesのシミュレータで、本人のgetを許可、別UID・匿名のgetを拒否することを確認してください。

## 4. Webアプリを登録

Project settings → General → Your appsで `</>`（Web）を選び、Todo Declareを登録。Firebase Hostingは不要です。

表示される `firebaseConfig` オブジェクトを共有してください。`apiKey`、`authDomain`、`projectId`、`appId` などの**Web用の公開設定**です。サービスアカウントのJSON秘密鍵やGoogleのパスワードは送らないでください。公開設定を `dist/firebase-config.js` に入れ、GitHub Pagesへ更新するとログインが有効になります。

## 5. 既存記録の移行

「通知と連携」でGoogleログイン。ローカル記録が残っていれば「この端末の記録を取り込む」（既存日付は上書きなし）。または「バックアップを読み込む」から手元のJSONを選びます（確認後にログイン中アカウントの記録を置換）。添付バックアップは2026-09-14の5件を検証済みですが、公開コードに含めていません。

別端末で同じGoogleアカウントにログインし、記録を確認します。Frictionは各端末のブラウザで個別にインストール・URL登録が必要です。

## 同期・障害時の仕様

- Google UID別の保存先。ログイン前の記録は自動移行・自動送信しません。
- 保存完了はFirestoreへの書き込み成功後に通知。失敗時は画面と本人用端末キャッシュに記録を残すため、バックアップして復旧できます。
- 別端末の更新はリアルタイム反映。ただしフォーム入力中・未同期変更がある場合は勝手に画面を切り替えません。
- revision付きトランザクションで古い端末からの上書きを拒否。競合時はバックアップ後に「最新データを読み込む」。自動マージ・オフライン書き込みキューはありません。
- クラウド保存は1アカウント1ドキュメント、JSON換算750KBまで。長期の大量記録が必要になったら日付別保存への移行が必要です。
- ログアウト後はローカルモードへ戻り、他アカウントの記録を表示しません。端末キャッシュはバックアップ用に残るため、共有端末ではブラウザのサイトデータを管理してください。

参考：[Googleログイン](https://firebase.google.com/docs/auth/web/google-signin)、[本人だけアクセスできるルール](https://firebase.google.com/docs/firestore/security/rules-conditions)、[トランザクション](https://firebase.google.com/docs/firestore/manage-data/transactions)。
