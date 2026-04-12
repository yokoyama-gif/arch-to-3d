"""
動画分割アプリ
指定した時間で動画を分割する
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import subprocess
import os
import threading
import re
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def parse_time(s: str) -> float | None:
    """HH:MM:SS, MM:SS, SS などを秒数に変換"""
    s = s.strip()
    # HH:MM:SS.mmm または MM:SS.mmm
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


def get_duration(filepath: str) -> float | None:
    result = subprocess.run(
        [FFMPEG, "-i", filepath],
        stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True
    )
    m = re.search(r"Duration:\s+(\d+):(\d+):(\d+\.\d+)", result.stderr)
    if m:
        return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    return None


def split_video(input_path, split_times, output_dir, prefix, ext, log_callback, done_callback):
    duration = get_duration(input_path)
    if duration is None:
        log_callback("エラー: 動画の長さを取得できませんでした")
        done_callback(False)
        return

    points = sorted(split_times)
    segments = []
    prev = 0.0
    for pt in points:
        segments.append((prev, pt))
        prev = pt
    segments.append((prev, duration))

    log_callback(f"動画長: {seconds_to_str(duration)}")
    log_callback(f"分割数: {len(segments)} セグメント\n")

    for i, (start, end) in enumerate(segments, 1):
        out_name = f"{prefix}_{i:03d}{ext}"
        out_path = os.path.join(output_dir, out_name)
        dur = end - start
        cmd = [
            FFMPEG, "-y",
            "-i", input_path,
            "-ss", str(start),
            "-t", str(dur),
            "-c", "copy",
            out_path
        ]
        log_callback(f"[{i}/{len(segments)}] {seconds_to_str(start)} → {seconds_to_str(end)}  →  {out_name}")
        result = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True)
        if result.returncode != 0:
            log_callback(f"  エラー: {result.stderr[-300:]}")
        else:
            size = os.path.getsize(out_path) // 1024
            log_callback(f"  完了 ({size} KB)")

    log_callback("\n全セグメントの処理が完了しました")
    done_callback(True)


class VideoSplitterApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("動画分割アプリ")
        self.geometry("700x600")
        self.resizable(True, True)
        self.configure(bg="#1e1e2e")
        self._build_ui()

    def _build_ui(self):
        pad = {"padx": 12, "pady": 6}
        bg = "#1e1e2e"
        fg = "#cdd6f4"
        entry_bg = "#313244"
        btn_bg = "#89b4fa"
        btn_fg = "#1e1e2e"
        accent = "#cba6f7"

        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TFrame", background=bg)
        style.configure("TLabel", background=bg, foreground=fg, font=("Segoe UI", 10))
        style.configure("Header.TLabel", background=bg, foreground=accent, font=("Segoe UI", 16, "bold"))
        style.configure("TButton", background=btn_bg, foreground=btn_fg, font=("Segoe UI", 10, "bold"), relief="flat")
        style.map("TButton", background=[("active", "#74c7ec")])

        frame = ttk.Frame(self, padding=16)
        frame.pack(fill="both", expand=True)

        # タイトル
        ttk.Label(frame, text="動画分割アプリ", style="Header.TLabel").pack(anchor="w", pady=(0, 12))

        # ファイル選択
        file_frame = ttk.Frame(frame)
        file_frame.pack(fill="x", pady=4)
        ttk.Label(file_frame, text="動画ファイル:").pack(side="left")
        self.file_var = tk.StringVar()
        entry = tk.Entry(file_frame, textvariable=self.file_var, bg=entry_bg, fg=fg,
                         insertbackground=fg, relief="flat", font=("Segoe UI", 10))
        entry.pack(side="left", fill="x", expand=True, padx=8)
        tk.Button(file_frame, text="参照", bg=btn_bg, fg=btn_fg, relief="flat",
                  font=("Segoe UI", 10, "bold"), command=self._browse_file).pack(side="left")

        # 出力フォルダ
        out_frame = ttk.Frame(frame)
        out_frame.pack(fill="x", pady=4)
        ttk.Label(out_frame, text="出力フォルダ:").pack(side="left")
        self.out_var = tk.StringVar()
        entry2 = tk.Entry(out_frame, textvariable=self.out_var, bg=entry_bg, fg=fg,
                          insertbackground=fg, relief="flat", font=("Segoe UI", 10))
        entry2.pack(side="left", fill="x", expand=True, padx=8)
        tk.Button(out_frame, text="参照", bg=btn_bg, fg=btn_fg, relief="flat",
                  font=("Segoe UI", 10, "bold"), command=self._browse_out).pack(side="left")

        # 分割時間入力
        ttk.Label(frame, text="分割時間（カンマ区切り、例: 1:30, 3:00, 5:45）:").pack(anchor="w", pady=(12, 2))
        self.times_var = tk.StringVar()
        times_entry = tk.Entry(frame, textvariable=self.times_var, bg=entry_bg, fg=fg,
                               insertbackground=fg, relief="flat", font=("Segoe UI", 12))
        times_entry.pack(fill="x", pady=2)

        # 時間追加ボタン群
        quick_frame = ttk.Frame(frame)
        quick_frame.pack(fill="x", pady=6)
        ttk.Label(quick_frame, text="クイック追加:").pack(side="left")
        for label in ["30秒", "1分", "2分", "5分", "10分"]:
            secs = {"30秒": 30, "1分": 60, "2分": 120, "5分": 300, "10分": 600}[label]
            tk.Button(quick_frame, text=label, bg="#45475a", fg=fg, relief="flat",
                      font=("Segoe UI", 9),
                      command=lambda s=secs: self._add_time(s)).pack(side="left", padx=3)

        # 実行ボタン
        self.run_btn = tk.Button(frame, text="分割開始", bg="#a6e3a1", fg=btn_fg,
                                 relief="flat", font=("Segoe UI", 12, "bold"),
                                 command=self._run)
        self.run_btn.pack(fill="x", pady=(12, 6))

        # ログ出力
        ttk.Label(frame, text="ログ:").pack(anchor="w")
        log_frame = ttk.Frame(frame)
        log_frame.pack(fill="both", expand=True)
        self.log_text = tk.Text(log_frame, bg="#181825", fg="#a6e3a1", font=("Consolas", 9),
                                relief="flat", state="disabled", wrap="word")
        scrollbar = ttk.Scrollbar(log_frame, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scrollbar.set)
        self.log_text.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def _browse_file(self):
        path = filedialog.askopenfilename(
            title="動画ファイルを選択",
            filetypes=[("動画ファイル", "*.mp4 *.mov *.avi *.mkv *.wmv *.flv *.webm *.m4v"),
                       ("すべてのファイル", "*.*")]
        )
        if path:
            self.file_var.set(path)
            if not self.out_var.get():
                self.out_var.set(os.path.dirname(path))

    def _browse_out(self):
        path = filedialog.askdirectory(title="出力フォルダを選択")
        if path:
            self.out_var.set(path)

    def _add_time(self, seconds: int):
        current = self.times_var.get().strip()
        h, m = divmod(seconds, 3600)
        m, s = divmod(m, 60)
        t = f"{m}:{s:02d}" if not h else f"{h}:{m:02d}:{s:02d}"
        if current:
            self.times_var.set(current + ", " + t)
        else:
            self.times_var.set(t)

    def _log(self, msg: str):
        self.log_text.configure(state="normal")
        self.log_text.insert("end", msg + "\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _run(self):
        input_path = self.file_var.get().strip()
        output_dir = self.out_var.get().strip()
        times_str = self.times_var.get().strip()

        if not input_path or not os.path.isfile(input_path):
            messagebox.showerror("エラー", "有効な動画ファイルを選択してください")
            return
        if not output_dir or not os.path.isdir(output_dir):
            messagebox.showerror("エラー", "有効な出力フォルダを選択してください")
            return
        if not times_str:
            messagebox.showerror("エラー", "分割時間を入力してください")
            return

        # 時間パース
        parts = [p.strip() for p in times_str.split(",") if p.strip()]
        split_times = []
        for p in parts:
            t = parse_time(p)
            if t is None:
                messagebox.showerror("エラー", f"時間の形式が不正です: '{p}'\n例: 1:30 / 01:30:00 / 90")
                return
            split_times.append(t)

        if not split_times:
            messagebox.showerror("エラー", "分割時間を少なくとも1つ入力してください")
            return

        basename = os.path.splitext(os.path.basename(input_path))[0]
        ext = os.path.splitext(input_path)[1]

        self.run_btn.configure(state="disabled", text="処理中...")
        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.configure(state="disabled")
        self._log(f"入力: {os.path.basename(input_path)}")
        self._log(f"出力先: {output_dir}")
        self._log(f"分割時間: {', '.join(seconds_to_str(t) for t in sorted(split_times))}\n")

        def done(success):
            self.run_btn.configure(state="normal", text="分割開始")
            if success:
                if messagebox.askyesno("完了", "分割が完了しました。\n出力フォルダを開きますか？"):
                    os.startfile(output_dir)

        threading.Thread(
            target=split_video,
            args=(input_path, split_times, output_dir, basename, ext,
                  lambda msg: self.after(0, self._log, msg),
                  lambda ok: self.after(0, done, ok)),
            daemon=True
        ).start()


if __name__ == "__main__":
    app = VideoSplitterApp()
    app.mainloop()
