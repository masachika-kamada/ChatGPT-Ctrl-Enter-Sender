# Repository instructions

## 仕様の正本

- 仕様の正本: `README.md`
- 実装前に意図する仕様を正本へ反映し、仕様変更時は同じ変更で正本と検証を更新する。

## Repository boundaries

- このリポジトリの責務と既存の利用者向け挙動を維持する。
- README、CONTRIBUTING、docs、既存テストに矛盾がある場合は、実装だけを正として進めず差分を解消する。

## Verification

- リポジトリに記載されたtest、build、lint、typecheck、E2Eの入口を使用する。
- 仕様、実装、テスト、利用者向け文書が一致するまで完了扱いにしない。
