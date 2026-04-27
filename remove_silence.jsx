/**
 * remove_silence.jsx
 * Premiere Pro 無音削除スクリプト
 *
 * detect_silence.py が出力した silence.json を読み込み、
 * アクティブなシーケンスから無音区間をリップル削除します。
 *
 * 使い方:
 *   Premiere Pro → メニュー → ファイル → スクリプト → スクリプトファイルを実行
 *   → このファイルを選択
 *
 * ※ 動画クリップがタイムラインの 00:00:00 から始まっていることを前提にしています。
 *    別の位置から始まる場合は下の TIMELINE_OFFSET を変更してください。
 */

#target premierepro

// ===== 設定 =====
var TIMELINE_OFFSET = 0.0;  // クリップのタイムライン上の開始位置（秒）。00:00:00 始まりなら 0
var EPSILON         = 0.05; // 時間の許容誤差（秒）

// ===== ユーティリティ =====

function toTime(sec) {
    var t = new Time();
    t.seconds = sec;
    return t;
}

function readFile(filePath) {
    var f = new File(filePath);
    if (!f.exists) { return null; }
    f.encoding = "UTF-8";
    f.open("r");
    var content = f.read();
    f.close();
    return content;
}

/**
 * 指定した時間範囲 [startSec, endSec] に完全に収まるクリップを削除（リップル）
 */
function removeClipsInRange(track, startSec, endSec) {
    var i = track.clips.numItems - 1;
    while (i >= 0) {
        try {
            var clip = track.clips[i];
            var cs   = clip.start.seconds;
            var ce   = clip.end.seconds;
            if (cs >= startSec - EPSILON && ce <= endSec + EPSILON) {
                clip.remove(true, false); // ripple=true でギャップを閉じる
                i = Math.min(i - 1, track.clips.numItems - 1);
            } else {
                i--;
            }
        } catch (e) {
            // リンクされたクリップが先に削除されていた場合など
            i--;
        }
    }
}

// ===== メイン =====

function main() {

    // --- アクティブシーケンスの確認 ---
    var seq = app.project.activeSequence;
    if (!seq) {
        alert("アクティブなシーケンスがありません。\nシーケンスを開いてから再実行してください。");
        return;
    }

    // --- JSON ファイルを選択 ---
    var jsonFile = File.openDialog("silence.json を選択してください", "JSON:*.json", false);
    if (!jsonFile) { return; }

    var content = readFile(jsonFile.fsName);
    if (!content) {
        alert("ファイルを読み込めませんでした:\n" + jsonFile.fsName);
        return;
    }

    var ranges;
    try {
        ranges = eval("(" + content + ")");
    } catch (e) {
        alert("JSON の解析に失敗しました:\n" + e.message);
        return;
    }

    if (!ranges || ranges.length === 0) {
        alert("無音区間が見つかりませんでした。");
        return;
    }

    // --- 確認ダイアログ ---
    var totalSec = 0;
    for (var i = 0; i < ranges.length; i++) {
        totalSec += ranges[i].end - ranges[i].start;
    }

    var msg  = "■ 実行内容\n";
        msg += "シーケンス    : " + seq.name + "\n";
        msg += "無音区間      : " + ranges.length + " 箇所\n";
        msg += "合計削除時間  : " + totalSec.toFixed(1) + " 秒\n\n";
        msg += "※ 実行前にシーケンスを複製することを推奨します\n\n";
        msg += "続行しますか？";

    msg += "\n続行しますか？(OKで実行)";
    alert(msg);

    // --- タイムラインオフセットを適用し、後ろから処理（タイムコードがずれないように） ---
    for (var i = 0; i < ranges.length; i++) {
        ranges[i].start += TIMELINE_OFFSET;
        ranges[i].end   += TIMELINE_OFFSET;
    }
    ranges.sort(function (a, b) { return b.start - a.start; });

    var numVideo = seq.videoTracks.numTracks;
    var numAudio = seq.audioTracks.numTracks;
    var processed = 0;

    for (var i = 0; i < ranges.length; i++) {
        var s = ranges[i].start;
        var e = ranges[i].end;

        // ① 各トラックに対してカットを入れる
        for (var vi = 0; vi < numVideo; vi++) {
            try { seq.videoTracks[vi].razor(toTime(s)); } catch (_) {}
            try { seq.videoTracks[vi].razor(toTime(e)); } catch (_) {}
        }
        for (var ai = 0; ai < numAudio; ai++) {
            try { seq.audioTracks[ai].razor(toTime(s)); } catch (_) {}
            try { seq.audioTracks[ai].razor(toTime(e)); } catch (_) {}
        }

        // ② 映像トラック内のクリップを削除
        for (var vi = 0; vi < numVideo; vi++) {
            removeClipsInRange(seq.videoTracks[vi], s, e);
        }

        // ③ 音声トラック内のクリップを削除
        for (var ai = 0; ai < numAudio; ai++) {
            removeClipsInRange(seq.audioTracks[ai], s, e);
        }

        processed++;
    }

    alert("完了！\n" + processed + " 箇所の無音区間を削除しました。");
}

main();
