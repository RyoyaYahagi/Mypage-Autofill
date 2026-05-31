# My Page Autofill

AXOL/SNAR/e2r/i-webs系マイページのプロフィール入力を補助するローカルChrome拡張です。

## 使い方

1. Chromeの `chrome://extensions/` を開く
2. デベロッパーモードを有効にする
3. 「パッケージ化されていない拡張機能を読み込む」でこのディレクトリを選ぶ
4. 拡張機能の「プロフィール設定」で情報を保存する
5. `https://*.axol.jp/*`、`https://*.snar.jp/*`、`https://www.e2r.jp/eARTH/*`、`https://*.i-webs.jp/*` のマイページでPopupから「自動入力」を押す

## 安全方針

- 入力情報は `chrome.storage.session` にのみ保存し、ブラウザ終了時に削除します。
- 以前のバージョンで `chrome.storage.local` に保存された入力情報は、次回読み込み時に一時ストレージへ移して永続ストレージから削除します。
- 外部サーバーへ送信しません。
- 送信、保存、次へ進むボタンは押しません。
- 自動入力はPopupのボタンを押したときだけ実行します。
# Mypage-Autofill
