#!/usr/bin/env python3
"""
detect_silence.py
ffmpeg の silencedetect フィルターを使って無音区間を検出し silence.json に出力する

必要なもの:
  brew install ffmpeg  のみ（pydub 不要）

使い方:
  python3 detect_silence.py 動画.mp4 silence.json
  python3 detect_silence.py 動画.mp4 silence.json --min-silence 0.3 --threshold -35 --padding 0.1
"""

import sys
import json
import os
import re
import subprocess
import argparse


def detect_silent_ranges(video_path, min_silence=0.5, threshold=-40, padding=0.1):
    """
    ffmpeg の silencedetect フィルターで無音区間を検出する

    Args:
        video_path   : 入力ファイルパス
        min_silence  : 無音とみなす最小時間（秒）
        threshold    : 無音とみなす dB レベル
        padding      : カット前後に残す余白（秒）

    Returns:
        [{start: 秒, end: 秒}, ...] のリスト
    """
    print(f"読み込み中: {video_path}")

    cmd = [
        "ffmpeg", "-i", video_path,
        "-af", f"silencedetect=noise={threshold}dB:d={min_silence}",
        "-f", "null", "-"
    ]

    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
    except FileNotFoundError:
        print("エラー: ffmpeg が見つかりません。brew install ffmpeg を実行してください。")
        sys.exit(1)

    output = result.stderr

    # silence_start / silence_end を正規表現で抽出
    starts = [float(m) for m in re.findall(r"silence_start: ([\d.]+)", output)]
    ends   = [float(m) for m in re.findall(r"silence_end: ([\d.]+)", output)]

    print(f"検出 (パディング前): {len(starts)} 箇所")

    ranges = []
    for s, e in zip(starts, ends):
        s2 = s + padding
        e2 = e - padding
        if e2 - s2 >= 0.1:  # パディング後に最低 0.1 秒残るものだけ採用
            ranges.append({
                "start": round(s2, 3),
                "end":   round(e2, 3),
            })

    return ranges


def main():
    parser = argparse.ArgumentParser(description="動画の無音区間を検出して JSON に出力します")
    parser.add_argument("input",  help="入力動画ファイルのパス")
    parser.add_argument("output", help="出力 JSON ファイルのパス（例: silence.json）")
    parser.add_argument("--min-silence", type=float, default=0.5,
                        help="無音とみなす最小時間（秒）  デフォルト: 0.5")
    parser.add_argument("--threshold",   type=int,   default=-40,
                        help="無音とみなす dB レベル      デフォルト: -40")
    parser.add_argument("--padding",     type=float, default=0.1,
                        help="カット前後に残す余白（秒）  デフォルト: 0.1")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"エラー: ファイルが見つかりません → {args.input}")
        sys.exit(1)

    ranges = detect_silent_ranges(
        args.input,
        min_silence=args.min_silence,
        threshold=args.threshold,
        padding=args.padding,
    )

    if not ranges:
        print("無音区間が見つかりませんでした。")
        print("--threshold の値を上げてみてください（例: --threshold -35）")
        sys.exit(0)

    out_dir = os.path.dirname(args.output)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(ranges, f, indent=2, ensure_ascii=False)

    print(f"\n検出した無音区間: {len(ranges)} 箇所")
    for i, r in enumerate(ranges[:10]):
        dur = r["end"] - r["start"]
        print(f"  [{i+1:3d}]  {r['start']:8.3f}s 〜 {r['end']:8.3f}s  ({dur:.3f}s)")
    if len(ranges) > 10:
        print(f"  ... 他 {len(ranges) - 10} 件")

    print(f"\n保存完了: {args.output}")
    print("\n次のステップ:")
    print("  1. Premiere Pro でシーケンスを複製（安全のため）")
    print("  2. メニュー → ファイル → スクリプト → スクリプトファイルを実行")
    print("  3. remove_silence.jsx を選択して実行")


if __name__ == "__main__":
    main()
