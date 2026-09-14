# 非公開キーを配信しないGoogleログイン・同期

画面はGitHub Pages、本人のGoogle IDトークンを検証するAPIはCloud Run、保存先はFirestoreです。FirebaseブラウザAPIキー、OAuthクライアントシークレット、サービスアカウントJSON秘密鍵は不要です。Google OAuth **クライアントID**は公開識別子で、秘密鍵ではありません。

## 事前確認

1. 以前公開したAPIキーをGoogle Cloud側で失効してください。ソースからの削除だけで失効しません。
2. Firestore `(default)` があることを確認。新規作成・データ削除は不要です。
3. Cloud Run / Cloud Build / Artifact Registryには課金アカウントの紐づけが必要です。無料枠超過やビルド・保存等で料金が発生し得ます。予算通知は支払い上限ではありません。費用を了承した場合のみ進めてください。

## 1. OAuthのWebクライアントID

Google Cloud Console → Google Auth Platform（またはAPIとサービス → 認証情報）で **ウェブアプリケーション** のOAuthクライアントを作成または確認します。

- 承認済みJavaScript生成元：`https://kentuc322.github.io`
- OAuth同意画面がテスト公開なら、自分のGoogleアカウントをテストユーザーへ追加。
- 共有するのは `...apps.googleusercontent.com` で終わる **クライアントIDだけ**。クライアントシークレットは送らず、リポジトリにも登録しません。
- ローカル開発の生成元は必要時だけ追加。API側のALLOWED_ORIGINも別の開発サービスで対応します。

## 2. Cloud Shellで初回公開

Google Cloud ConsoleのCloud Shellを開き、次の公開識別子を設定します。APIキーを設定する箇所はありません。IAM変更と課金を伴うため、プロジェクト所有者が確認して実行してください。

```sh
export TODO_PROJECT=todo-declare
export TODO_REGION=asia-northeast1
export TODO_CLIENT_ID='自分のWebクライアントID.apps.googleusercontent.com'
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com identitytoolkit.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project "$TODO_PROJECT"
gcloud iam service-accounts create todo-runtime --project "$TODO_PROJECT"
gcloud iam service-accounts create todo-build --project "$TODO_PROJECT"
gcloud projects add-iam-policy-binding "$TODO_PROJECT" --member="serviceAccount:todo-runtime@$TODO_PROJECT.iam.gserviceaccount.com" --role=roles/datastore.user
gcloud projects add-iam-policy-binding "$TODO_PROJECT" --member="serviceAccount:todo-runtime@$TODO_PROJECT.iam.gserviceaccount.com" --role=roles/firebaseauth.viewer
gcloud projects add-iam-policy-binding "$TODO_PROJECT" --member="serviceAccount:todo-build@$TODO_PROJECT.iam.gserviceaccount.com" --role=roles/run.builder
git clone https://github.com/Kentuc322/todo-declare.git
cd todo-declare
gcloud run deploy todo-declare-api --source . --project "$TODO_PROJECT" --region "$TODO_REGION" --service-account "todo-runtime@$TODO_PROJECT.iam.gserviceaccount.com" --build-service-account "projects/$TODO_PROJECT/serviceAccounts/todo-build@$TODO_PROJECT.iam.gserviceaccount.com" --set-env-vars "GOOGLE_CLOUD_PROJECT=$TODO_PROJECT,GOOGLE_CLIENT_ID=$TODO_CLIENT_ID,ALLOWED_ORIGIN=https://kentuc322.github.io" --min-instances 0 --max-instances 2 --concurrency 20 --memory 256Mi --cpu 1 --timeout 30 --allow-unauthenticated
```

API入口を公開する `--allow-unauthenticated` は、Googleのユーザー認証を省略する意味ではありません。`/health` 以外はAPI自身が全リクエストのGoogle署名・audience・issuer・期限を検証し、不正なトークンを拒否します。Cloud RunサービスアカウントのIAM権限も公開されません。

`todo-runtime` はFirestore読み書きと旧Firebase GoogleユーザーのUID参照だけに利用。旧版の保存先をGoogle provider UIDで照合し、同じユーザーの既存データを維持します。メールアドレスによるアカウント統合はしません。

既存サービスアカウントの場合、createでalready existsになったら作成を繰り返さず内容を確認してください。組織ポリシーで公開が禁止されている場合は、ポリシーを無断で緩めず停止してください。

## 3. Firestoreの直接アクセスを停止

Firebase Console → Firestore → Rulesで、`firestore.rules` を公開してください。すべてのブラウザ直接アクセスを拒否するルールです。Admin SDKは実行アカウントのIAMで接続します。これは同じFirestoreを使う他のクライアントアプリにも影響するので、共用している場合は適用前に分離を検討してください。データ自体は削除しません。

## 4. 公開画面を接続

Cloud RunのサービスURL（`https://....run.app`）とWeb OAuthクライアントIDを共有してください。どちらも公開識別子です。これらだけを `dist/cloud-config.js` に設定し、Pagesを更新します。APIキーやシークレットは送らないでください。

ログイン後は既存端末の取り込み、またはJSONバックアップの読み込みで移行できます。Googleトークンはメモリのみで保持し、ファイル・URL・localStorageには保存しません。ページ再読み込み、またはトークン期限切れ（通常約1時間）ではGoogleでログインし直します。ログアウトはこのページのトークン破棄であり、Google側のトークンを即時失効する処理ではありません。

## 5. 任意：GitHubから鍵なしで更新（OIDC）

初回は上のCloud Shellだけで公開できます。自動更新を使う場合のみ、Workload Identity Federationを設定します。JSON秘密鍵・GitHub Secretsは不要です。

専用 `todo-deployer` アカウントを作成し、以下を付与します。

- プロジェクト：`roles/run.sourceDeveloper`、`roles/serviceusage.serviceUsageConsumer`
- **todo-declare-apiサービスだけ**：`roles/run.admin`（公開サービスのIAM設定を維持するため）
- todo-runtime / todo-buildアカウントそれぞれ：`roles/iam.serviceAccountUser`
- ビルドはtodo-build、実行はtodo-runtime。GitHubのdeployerにはFirestore権限を直接与えません。ただしコードを更新できるアカウントは実行コード経由でデータにアクセスできるため、deployerとリポジトリの書き込み権限も保護が必要です。

OIDCプロバイダのissuerは `https://token.actions.githubusercontent.com`。属性マッピングに `google.subject=assertion.sub`、`attribute.repository_id=assertion.repository_id` を設定し、次の条件で限定します（名前だけでなく不変の数値IDを使います）。

```text
assertion.repository_id == '1369016520' &&
assertion.repository_owner_id == '103643583' &&
assertion.ref == 'refs/heads/main' &&
assertion.event_name == 'workflow_dispatch' &&
assertion.sub == 'repo:Kentuc322/todo-declare:environment:backend-production'
```

todo-deployerの `roles/iam.workloadIdentityUser` は、作成したpoolのrepository_idが1369016520であるprincipalSetだけに付与。pool全体・全GitHubには許可しません。

GitHub Settings → Environmentsで `backend-production` を作成し、デプロイ元をmainに限定、可能なら承認者を設定。その環境の **Variables** に以下の公開識別子を登録します。

| Variable | 値 |
| --- | --- |
| GCP_PROJECT_ID | todo-declare |
| GCP_REGION | asia-northeast1 |
| GCP_WORKLOAD_IDENTITY_PROVIDER | projects/数値/locations/global/workloadIdentityPools/プール/providers/プロバイダ |
| GCP_DEPLOY_SERVICE_ACCOUNT | todo-deployer@todo-declare.iam.gserviceaccount.com |
| GCP_RUNTIME_SERVICE_ACCOUNT | todo-runtime@todo-declare.iam.gserviceaccount.com |
| GCP_BUILD_SERVICE_ACCOUNT | todo-build@todo-declare.iam.gserviceaccount.com |
| GOOGLE_CLIENT_ID | WebクライアントID |

Actions → Deploy private-credential backend → Run workflowでmainを選びます。短寿命のOIDC認証ファイルは作業用に生成されますが、Git・ビルドへの取り込みを除外し、終了時に削除されます。環境の承認・IAM条件の検証はGoogle Cloud管理者が行ってください。

## 公開前に確認すること

- 自分のGoogleログイン・保存・別端末読み込み。
- 未ログイン、不正トークン、別クライアント用トークン、期限切れトークンのAPIアクセスが401。
- 異なるOriginが403、任意UID指定URLが404、古いrevisionで409。
- Firestoreブラウザ直接アクセスが拒否。APIにはトークン・タスクをログ出力しません。
- バックアップ保存と復元、旧UIDデータの参照。
- 予算通知・APIクォータ。最大2インスタンスは課金の上限やDoS対策を保証しません。インターネット向け公開規模では外部ロードバランサ・Cloud Armor等のレート制限を追加し、Cloud Run直アクセスも制限する構成を検討してください。

参考：[Googleトークン検証](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)、[Cloud Runの実行ID](https://docs.cloud.google.com/run/docs/securing/service-identity)、[Source deploy](https://docs.cloud.google.com/run/docs/deploying-source-code)、[GitHub OIDC](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)。
