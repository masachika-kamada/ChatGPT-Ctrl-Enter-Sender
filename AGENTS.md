# Repository instructions

## 仕様の正本

- 仕様の正本: `README.md`
- 実装前に意図する仕様を正本へ反映し、仕様変更時は同じ変更で正本と検証を更新する。

## Repository boundaries

- このリポジトリの責務と既存の利用者向け挙動を維持する。
- README、CONTRIBUTING、docs、既存テストに矛盾がある場合は、実装だけを正として進めず差分を解消する。

## ブラウザ拡張機能の更新

- 拡張機能の読み込み対象はルート`manifest.json`、`background.js`、`content/`、`popup/`、`options/`を含むこのリポジトリ直下とする。変更時は共有`browser-extension-update-delivery`を適用し、`scripts/reload-extension.ps1`で自己再読み込みと`expectedVersion`／`expectedBuildId`の反映確認まで行う。
- `chrome://extensions`をユーザーの前面に開いたり、ユーザーへReload操作を依頼したりして完了扱いにしない。安全な機械実行経路がなければ、その経路の追加または修復を同じ作業に含める。

## Verification

- リポジトリに記載されたtest、build、lint、typecheck、E2Eの入口を使用する。
- 仕様、実装、テスト、利用者向け文書が一致するまで完了扱いにしない。
