# Premiere Pro 自動無音削除ツール

ffmpeg で動画の無音区間を検出し、Premiere Pro のタイムラインから自動リップル削除するツールです。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `detect_silence.py` | ffmpeg で無音区間を検出 → `silence.json` を出力 |
| `remove_silence.jsx` | Premiere Pro で `silence.json` を読み込み、無音区間をリップル削除 |
| `index.html` | 使い方ガイドページ |

## 必要なもの

- Python 3
- ffmpeg（`brew install ffmpeg` または `winget install ffmpeg`）
- Adobe Premiere Pro 2024 / 2025

## 使い方

```bash
# ① 無音区間を検出
python3 detect_silence.py 動画.mp4 silence.json

# オプション（任意）
python3 detect_silence.py 動画.mp4 silence.json \
  --min-silence 0.3 \   # 無音とみなす最小時間（秒）
  --threshold -35 \     # dBレベル（大きくすると感度UP）
  --padding 0.1         # カット前後に残す余白（秒）
```

```
② Premiere Pro → ファイル → スクリプト → スクリプトファイルを実行
   → remove_silence.jsx を選択 → silence.json を指定
```

詳しい手順は [使い方ガイド](https://TatsuyaFushimi.github.io/premiere-silence-remover/) を参照してください。

## ライセンス

MIT
