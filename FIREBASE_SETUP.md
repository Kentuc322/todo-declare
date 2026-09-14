# 一人専用のFirebase設定（課金設定なし）

現在の構成はGitHub Pages + Firebase Authentication（メール/パスワード）+ Firestoreです。Cloud Run、GitHub Secrets、サービスアカウント秘密鍵は不要です。Sparkプランを維持してください。無料枠上限に達すると利用が制限されるため、端末保存とJSONバックアップを併用します。

## 1. 以前のキーを交換

以前公開されたキーはGoogle Cloud Consoleで失効・交換してください。Git履歴の変更だけではキーは失効しません。新しいWeb用APIキーも秘密鍵ではありませんが、今回はGitHubにも公開ファイルにも保存せず各端末に入力します。Firebase関連APIに用途を限定し、他のGoogle API用のキーと兼用しないでください。必要に応じてWebリファラー制限を設定し、認証動作を確認します。キー制限はSecurity Rulesの代わりにはなりません。

## 2. 専用ユーザーを一人作成

Firebase Console → Authentication → Sign-in methodでメール/パスワードを有効化します。Googleログインや匿名認証は、他のアプリで使っていなければ無効化します。

Users → Add userで専用ユーザーを作成し、長く固有のパスワードを設定します。パスワードはパスワード管理アプリに保管し、チャット、GitHub、設定JSONには入れないでください。作成したユーザーのUIDをコピーします。UIDは秘密情報ではありません。

アプリには新規登録画面がありませんが、これは第三者による認証ユーザー作成を完全に防ぐものではありません。データのアクセス制限は次のルールで行います。

## 3. Firestoreのアクセスルールを公開

Firestore Databaseのデフォルトデータベースを作成（既存ならそのまま使用）します。

このリポジトリの `firestore.rules` をFirestore → Rulesへ貼り付け、`REPLACE_WITH_OWNER_UID` を手順2のUIDに置き換え、Publishします。未設定のテンプレートはアクセスを許可しません。

許可するのはそのUIDによる `users/{UID}/todo/state` の取得・作成・更新のみです。一覧取得、削除、他のパス、未ログイン、他人のUIDは拒否します。Firebase管理者/Admin SDKにはルールが適用されないため、管理者権限も適切に保護してください。同じプロジェクトを別アプリで使っている場合、この全体ルールへ置き換える前に影響を確認してください。

## 4. 各端末から接続設定を入力

Firebase Console → Project settings → Your appsからWebアプリの公開設定を確認し、アプリの「通知と連携」→「Firebase接続設定」で次の5項目だけをJSONとして入力します。`const firebaseConfig =`などのJavaScript構文は不要です。

```json
{
  "apiKey": "新しいWeb用APIキー",
  "authDomain": "todo-declare.firebaseapp.com",
  "projectId": "todo-declare",
  "appId": "WebアプリのappId",
  "ownerUid": "手順2のUID"
}
```

設定はそのブラウザーのlocalStorageにだけ保存します。別端末でも同じ公開設定を入力してください。Firebaseへの接続時にはキーをGoogleに送信するので、ブラウザーの通信からは見えます。パスワード、OAuthシークレット、サービスアカウントJSONは入力できません。

設定後、専用ユーザーでログインします。認証セッションはメモリだけに保持し、ページを開き直すと再ログインが必要です。パスワードは認証のためFirebaseへHTTPS送信しますが、アプリでは永続保存・ログ出力しません。Firebase AuthenticationのAuthorized domainsには `kentuc322.github.io` を登録してください。

## 5. バックアップ移行と動作確認

ログイン前のデータは自動で送信しません。既存端末の「この端末の記録を取り込む」、または添付済みJSONバックアップの読み込みで移行します。以前Googleログインで保存したデータがある場合、メール/パスワード専用ユーザーは別UIDになることがあります。まず旧データのバックアップを取得し、明示的に取り込んでください。

確認すること：

- 未ログイン/別UIDではFirestoreの読み書きが拒否される（Rulesのテスト機能で確認）。
- 正しいUIDで初回保存・更新ができる。
- 別端末でログインすると同じ記録が読み込まれる。
- 別端末の保存が反映され、競合時には上書きせずエラーになる。
- オフライン保存は端末に残り、クラウド同期成功とは表示されない。

公開用アプリコードと各端末のキャッシュは秘密の保管庫ではありません。共有端末ではブラウザープロファイルの分離/終了後のサイトデータ削除を行ってください。XSS、悪意ある拡張機能、盗まれたログイン情報まで防ぐ構成ではありません。

公式資料：[料金](https://firebase.google.com/pricing)、[APIキー](https://firebase.google.com/docs/projects/api-keys)、[認証とルール](https://firebase.google.com/docs/rules/rules-and-auth)、[認証セッション](https://firebase.google.com/docs/auth/web/auth-state-persistence)
