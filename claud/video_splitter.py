"""
動画分割アプリ
指定した時間（複数可）で動画を分割する
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import subprocess
import os
import threading
import re
import time
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


# ─────────────────────────────────────────────
# ユーティリティ
# ─────────────────────────────────────────────

def parse_time(s: str) -> float | None:
    """HH:MM:SS, MM:SS, SS などを秒数に変換"""
    s = s.strip()
    m = re.fullmatch(r'(\d+):(\d{1,2}):(\d{1,2})(?:\.(\d+))?', s)
    if m:
        h, mi, sec = int(m.group(1)), int(m.group(2)), int(m.group(3))
        frac = float('0.' + m.group(4)) if m.group(4) else 0
        return h * 3600 + mi * 60 + sec + frac
    m = re.fullmatch(r'(\d+):(\d{1,2})(?:\.(\d+))?', s)
    if m:
        mi, sec = int(m.group(1)), int(m.group(2))
        frac = float('0.' + m.group(3)) if m.group(3) else 0
        return mi * 60 + sec + frac
    m = re.fullmatch(r'(\d+)(?:\.(\d+))?', s)
    if m:
        sec = int(m.group(1))
        frac = float('0.' + m.group(2)) if m.group(2) else 0
        return sec + frac
    return None


def seconds_to_str(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def seconds_to_hms(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def get_duration(filepath: str) -> float | None:
    result = subprocess.run(
        [FFMPEG, "-i", filepath],
        stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True
    )
    m = re.search(r"Duration:\s+(\d+):(\d+):(\d+\.\d+)", result.stderr)
    if m:
        return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    return None


# ─────────────────────────────────────────────
# 分割処理
# ─────────────────────────────────────────────

def split_video(input_path, split_times, output_dir, prefix, ext,
                log_cb, progress_cb, seg_cb, done_cb, cancel_flag):
    duration = get_duration(input_path)
    if duration is None:
        log_cb("エラー: 動画の長さを取得できませんでした")
        done_cb(False, [])
        return

    points = sorted(split_times)
    segments = []
    prev = 0.0
    for pt in points:
        segments.append((prev, pt))
        prev = pt
    segments.append((prev, duration))

    total = len(segments)
    log_cb(f"動画長: {seconds_to_str(duration)}")
    log_cb(f"分割数: {total} セグメント\n")

    output_files = []
    start_time = time.time()

    for i, (start, end) in enumerate(segments, 1):
        if cancel_flag():
            log_cb("\n⚠ キャンセルされました")
            done_cb(False, output_files)
            return

        out_name = f"{prefix}_{i:03d}{ext}"
        out_path = os.path.join(output_dir, out_name)
        dur = end - start

        seg_cb(i, total, start, end)
        log_cb(f"[{i}/{total}] {seconds_to_str(start)} → {seconds_to_str(end)}  →  {out_name}")

        cmd = [
            FFMPEG, "-y",
            "-i", input_path,
            "-ss", str(start),
            "-t", str(dur),
            "-c", "copy",
            out_path
        ]

        proc = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True)

        if proc.returncode != 0:
            log_cb(f"  ❌ エラー: {proc.stderr[-300:]}")
        else:
            size = os.path.getsize(out_path) / 1024
            size_str = f"{size:.0f} KB" if size < 1024 else f"{size/1024:.2f} MB"
            output_files.append(out_path)
            log_cb(f"  ✅ 完了 ({size_str})")

        # 全体進捗
        pct = int(i / total * 100)
        elapsed = time.time() - start_time
        eta = (elapsed / i) * (total - i) if i > 0 else 0
        progress_cb(pct, i, total, eta)

    log_cb(f"\n✨ 全 {total} セグメントの処理が完了しました（{elapsed:.1f}秒）")
    done_cb(True, output_files)


# ─────────────────────────────────────────────
# UI
# ─────────────────────────────────────────────

THEME = {
    "bg":       "#1e1e2e",
    "surface":  "#313244",
    "surface2": "#45475a",
    "fg":       "#cdd6f4",
    "subtext":  "#a6adc8",
    "green":    "#a6e3a1",
    "blue":     "#89b4fa",
    "purple":   "#cba6f7",
    "red":      "#f38ba8",
    "yellow":   "#f9e2af",
    "mantle":   "#181825",
}


class VideoSplitterApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("動画分割アプリ")
        self.geometry("780x680")
        self.minsize(640, 540)
        self.configure(bg=THEME["bg"])
        self._cancel_requested = False
        self._duration = None
        self._build_ui()
        self._enable_drop()

    # ── UI構築 ────────────────────────────────

    def _build_ui(self):
        T = THEME
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TFrame",    background=T["bg"])
        style.configure("TLabel",    background=T["bg"], foreground=T["fg"],     font=("Segoe UI", 10))
        style.configure("Sub.TLabel",background=T["bg"], foreground=T["subtext"],font=("Segoe UI", 9))
        style.configure("Header.TLabel", background=T["bg"], foreground=T["purple"], font=("Segoe UI", 16, "bold"))
        style.configure("TButton",   background=T["blue"], foreground=T["bg"],   font=("Segoe UI", 10, "bold"), relief="flat", padding=4)
        style.map("TButton", background=[("active", "#74c7ec"), ("disabled", T["surface2"])])
        style.configure("Green.TButton", background=T["green"], foreground=T["bg"])
        style.map("Green.TButton",   background=[("active", "#94e2a1"), ("disabled", T["surface2"])])
        style.configure("Red.TButton",   background=T["red"],   foreground=T["bg"])
        style.map("Red.TButton",     background=[("active", "#f97ba5")])
        style.configure("TProgressbar", troughcolor=T["surface"], background=T["blue"], borderwidth=0, thickness=14)
        style.configure("Green.Horizontal.TProgressbar", troughcolor=T["surface"], background=T["green"], thickness=8)

        root = ttk.Frame(self, padding=16)
        root.pack(fill="both", expand=True)

        # タイトル
        ttk.Label(root, text="🎬 動画分割アプリ", style="Header.TLabel").pack(anchor="w", pady=(0, 10))

        # ── ファイル選択 ──────────────────────
        self._make_section(root, "入力ファイル")
        file_row = ttk.Frame(root)
        file_row.pack(fill="x", pady=(2, 0))
        self.file_var = tk.StringVar()
        self.file_entry = tk.Entry(file_row, textvariable=self.file_var,
                                   bg=T["surface"], fg=T["fg"], insertbackground=T["fg"],
                                   relief="flat", font=("Segoe UI", 10))
        self.file_entry.pack(side="left", fill="x", expand=True, padx=(0, 6))
        ttk.Button(file_row, text="参照", command=self._browse_file).pack(side="left")

        info_row = ttk.Frame(root)
        info_row.pack(fill="x", pady=(2, 8))
        self.duration_lbl = ttk.Label(info_row, text="（ファイルを選択すると動画長を表示します）", style="Sub.TLabel")
        self.duration_lbl.pack(side="left")

        # ── 出力フォルダ ──────────────────────
        self._make_section(root, "出力フォルダ")
        out_row = ttk.Frame(root)
        out_row.pack(fill="x", pady=(2, 8))
        self.out_var = tk.StringVar()
        tk.Entry(out_row, textvariable=self.out_var,
                 bg=T["surface"], fg=T["fg"], insertbackground=T["fg"],
                 relief="flat", font=("Segoe UI", 10)).pack(side="left", fill="x", expand=True, padx=(0, 6))
        ttk.Button(out_row, text="参照", command=self._browse_out).pack(side="left")

        # ── 分割時間 ──────────────────────────
        self._make_section(root, "分割時間")
        hint = ttk.Label(root, text="カンマ区切りで複数指定可　例: 1:30, 3:00, 5:45　（形式: MM:SS / HH:MM:SS / 秒数）",
                         style="Sub.TLabel")
        hint.pack(anchor="w", pady=(0, 3))
        self.times_var = tk.StringVar()
        self.times_var.trace_add("write", self._update_segments_preview)
        times_entry = tk.Entry(root, textvariable=self.times_var,
                               bg=T["surface"], fg=T["fg"], insertbackground=T["fg"],
                               relief="flat", font=("Segoe UI", 12))
        times_entry.pack(fill="x", pady=(0, 4))

        # クイック追加
        quick_row = ttk.Frame(root)
        quick_row.pack(fill="x", pady=(0, 4))
        ttk.Label(quick_row, text="クイック追加:").pack(side="left")
        for label, secs in [("30秒", 30), ("1分", 60), ("2分", 120), ("5分", 300), ("10分", 600), ("30分", 1800)]:
            tk.Button(quick_row, text=label, bg=T["surface2"], fg=T["fg"], relief="flat",
                      font=("Segoe UI", 9), cursor="hand2",
                      command=lambda s=secs: self._add_time(s)).pack(side="left", padx=2)
        tk.Button(quick_row, text="クリア", bg=T["red"], fg=T["bg"], relief="flat",
                  font=("Segoe UI", 9, "bold"), cursor="hand2",
                  command=lambda: self.times_var.set("")).pack(side="right")

        # セグメントプレビュー
        self.seg_preview = ttk.Label(root, text="", style="Sub.TLabel", wraplength=700)
        self.seg_preview.pack(anchor="w", pady=(0, 8))

        # ── ボタン行 ──────────────────────────
        btn_row = ttk.Frame(root)
        btn_row.pack(fill="x", pady=(0, 6))
        self.run_btn = ttk.Button(btn_row, text="▶  分割開始", style="Green.TButton", command=self._run)
        self.run_btn.pack(side="left", fill="x", expand=True, padx=(0, 6))
        self.cancel_btn = ttk.Button(btn_row, text="✕  キャンセル", style="Red.TButton",
                                     command=self._cancel, state="disabled")
        self.cancel_btn.pack(side="left", ipadx=8)

        # ── プログレスバー ────────────────────
        prog_frame = ttk.Frame(root)
        prog_frame.pack(fill="x", pady=(0, 4))
        self.prog_var = tk.IntVar()
        self.prog_bar = ttk.Progressbar(prog_frame, variable=self.prog_var, maximum=100)
        self.prog_bar.pack(fill="x")

        prog_info_row = ttk.Frame(root)
        prog_info_row.pack(fill="x", pady=(0, 6))
        self.prog_lbl = ttk.Label(prog_info_row, text="待機中", style="Sub.TLabel")
        self.prog_lbl.pack(side="left")
        self.eta_lbl = ttk.Label(prog_info_row, text="", style="Sub.TLabel")
        self.eta_lbl.pack(side="right")

        # ── ログ ──────────────────────────────
        self._make_section(root, "ログ")
        log_frame = ttk.Frame(root)
        log_frame.pack(fill="both", expand=True)
        self.log_text = tk.Text(log_frame, bg=T["mantle"], fg=T["green"],
                                font=("Consolas", 9), relief="flat",
                                state="disabled", wrap="word")
        sb = ttk.Scrollbar(log_frame, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=sb.set)
        self.log_text.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")

        # 完了ファイル一覧用フレーム（初期非表示）
        self.result_frame = ttk.Frame(root)
        self.result_lbl = ttk.Label(self.result_frame, text="出力ファイル:", style="Sub.TLabel")
        self.result_lbl.pack(anchor="w")
        self.result_list = tk.Listbox(self.result_frame, bg=THEME["surface"], fg=THEME["fg"],
                                      font=("Segoe UI", 9), relief="flat", height=4,
                                      selectbackground=THEME["blue"])
        self.result_list.pack(fill="x")
        open_btn = ttk.Button(self.result_frame, text="📂 出力フォルダを開く", command=self._open_output)
        open_btn.pack(anchor="e", pady=(4, 0))

    def _make_section(self, parent, text):
        T = THEME
        f = ttk.Frame(parent)
        f.pack(fill="x", pady=(6, 1))
        ttk.Label(f, text=text, background=T["bg"], foreground=T["purple"],
                  font=("Segoe UI", 9, "bold")).pack(side="left")
        sep = tk.Frame(f, bg=T["surface2"], height=1)
        sep.pack(side="left", fill="x", expand=True, padx=(6, 0), pady=6)

    # ── ドラッグ&ドロップ ──────────────────────

    def _enable_drop(self):
        try:
            self.file_entry.drop_target_register("DND_Files")
            self.file_entry.dnd_bind("<<Drop>>", self._on_drop)
        except Exception:
            pass  # tkinterdnd2 未インストール時はスキップ

    def _on_drop(self, event):
        path = event.data.strip("{}")
        if os.path.isfile(path):
            self.file_var.set(path)
            self._on_file_selected(path)

    # ── ファイル操作 ──────────────────────────

    def _browse_file(self):
        path = filedialog.askopenfilename(
            title="動画ファイルを選択",
            filetypes=[("動画ファイル", "*.mp4 *.mov *.avi *.mkv *.wmv *.flv *.webm *.m4v"),
                       ("すべてのファイル", "*.*")]
        )
        if path:
            self.file_var.set(path)
            self._on_file_selected(path)

    def _on_file_selected(self, path):
        if not self.out_var.get():
            self.out_var.set(os.path.dirname(path))
        self.duration_lbl.configure(text="動画長を取得中...", foreground=THEME["yellow"])
        self._duration = None

        def fetch():
            dur = get_duration(path)
            self._duration = dur
            if dur is not None:
                txt = f"動画長: {seconds_to_str(dur)}  （{seconds_to_hms(dur)}）"
                color = THEME["green"]
            else:
                txt = "動画長を取得できませんでした"
                color = THEME["red"]
            self.after(0, lambda: self.duration_lbl.configure(text=txt, foreground=color))
            self.after(0, self._update_segments_preview)

        threading.Thread(target=fetch, daemon=True).start()

    def _browse_out(self):
        path = filedialog.askdirectory(title="出力フォルダを選択")
        if path:
            self.out_var.set(path)

    # ── 時間操作 ──────────────────────────────

    def _add_time(self, seconds: int):
        current = self.times_var.get().strip()
        t = seconds_to_hms(seconds)
        self.times_var.set((current + ", " + t) if current else t)

    def _update_segments_preview(self, *_):
        times_str = self.times_var.get().strip()
        if not times_str:
            self.seg_preview.configure(text="")
            return
        parts = [p.strip() for p in times_str.split(",") if p.strip()]
        times = []
        for p in parts:
            t = parse_time(p)
            if t is None:
                self.seg_preview.configure(text=f"⚠ 時間の形式が不正: '{p}'", foreground=THEME["red"])
                return
            times.append(t)
        times = sorted(times)
        dur = self._duration
        segs = []
        prev = 0.0
        for pt in times:
            segs.append((prev, pt))
            prev = pt
        end_val = dur if dur else "?"
        segs.append((prev, end_val))

        def fmt(s):
            return seconds_to_hms(s) if isinstance(s, float) else str(s)

        parts_txt = "  →  ".join(f"[{i+1}] {fmt(s)}〜{fmt(e)}" for i, (s, e) in enumerate(segs))
        self.seg_preview.configure(
            text=f"プレビュー ({len(segs)} セグメント):  " + parts_txt,
            foreground=THEME["subtext"]
        )

    # ── 実行 ──────────────────────────────────

    def _run(self):
        input_path = self.file_var.get().strip()
        output_dir = self.out_var.get().strip()
        times_str = self.times_var.get().strip()

        if not input_path or not os.path.isfile(input_path):
            messagebox.showerror("エラー", "有効な動画ファイルを選択してください"); return
        if not output_dir or not os.path.isdir(output_dir):
            messagebox.showerror("エラー", "有効な出力フォルダを選択してください"); return
        if not times_str:
            messagebox.showerror("エラー", "分割時間を入力してください"); return

        parts = [p.strip() for p in times_str.split(",") if p.strip()]
        split_times = []
        for p in parts:
            t = parse_time(p)
            if t is None:
                messagebox.showerror("エラー", f"時間の形式が不正です: '{p}'\n例: 1:30 / 01:30:00 / 90")
                return
            split_times.append(t)

        basename = os.path.splitext(os.path.basename(input_path))[0]
        ext = os.path.splitext(input_path)[1]

        self._cancel_requested = False
        self.run_btn.configure(state="disabled")
        self.cancel_btn.configure(state="normal")
        self.prog_var.set(0)
        self.prog_lbl.configure(text="処理中...")
        self.eta_lbl.configure(text="")
        self.result_frame.pack_forget()

        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.configure(state="disabled")
        self._log(f"入力:  {os.path.basename(input_path)}")
        self._log(f"出力先: {output_dir}")
        self._log(f"分割時間: {', '.join(seconds_to_str(t) for t in sorted(split_times))}\n")

        def progress_cb(pct, done, total, eta):
            self.after(0, lambda: self.prog_var.set(pct))
            self.after(0, lambda: self.prog_lbl.configure(
                text=f"処理中... {done}/{total} セグメント  ({pct}%)"))
            eta_txt = f"残り約 {int(eta)}秒" if eta > 1 else ""
            self.after(0, lambda: self.eta_lbl.configure(text=eta_txt))

        def seg_cb(i, total, start, end):
            self.after(0, lambda: self.prog_lbl.configure(
                text=f"[{i}/{total}] {seconds_to_str(start)} → {seconds_to_str(end)}"))

        def done_cb(success, output_files):
            self.after(0, lambda: self._on_done(success, output_files, output_dir))

        threading.Thread(
            target=split_video,
            args=(input_path, split_times, output_dir, basename, ext,
                  lambda msg: self.after(0, self._log, msg),
                  progress_cb, seg_cb, done_cb,
                  lambda: self._cancel_requested),
            daemon=True
        ).start()

    def _cancel(self):
        self._cancel_requested = True
        self.cancel_btn.configure(state="disabled")
        self._log("⚠ キャンセルリクエスト送信...")

    def _on_done(self, success, output_files, output_dir):
        self.run_btn.configure(state="normal")
        self.cancel_btn.configure(state="disabled")
        if success:
            self.prog_var.set(100)
            self.prog_lbl.configure(text=f"✅ 完了  —  {len(output_files)} ファイル出力", foreground=THEME["green"])
            self._show_result(output_files, output_dir)
        else:
            self.prog_lbl.configure(text="❌ 失敗またはキャンセル", foreground=THEME["red"])

    def _show_result(self, files, output_dir):
        self._output_dir = output_dir
        self.result_list.delete(0, "end")
        for f in files:
            name = os.path.basename(f)
            size = os.path.getsize(f) / 1024
            size_str = f"{size:.0f} KB" if size < 1024 else f"{size/1024:.2f} MB"
            self.result_list.insert("end", f"  {name}  ({size_str})")
        self.result_frame.pack(fill="x", pady=(6, 0))

    def _open_output(self):
        if hasattr(self, "_output_dir") and os.path.isdir(self._output_dir):
            os.startfile(self._output_dir)

    # ── ログ ──────────────────────────────────

    def _log(self, msg: str):
        self.log_text.configure(state="normal")
        self.log_text.insert("end", msg + "\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")


# ─────────────────────────────────────────────

if __name__ == "__main__":
    app = VideoSplitterApp()
    app.mainloop()
