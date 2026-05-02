"""
動画分割アプリ v2
- ドラッグ＆ドロップでファイル登録
- フィルムストリップ表示 + クリックで分割位置指定
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from tkinterdnd2 import TkinterDnD, DND_FILES
import subprocess, os, threading, re, time, tempfile, shutil
from PIL import Image, ImageTk, ImageDraw, ImageFont
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

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
    "marker":   "#f38ba8",
    "marker2":  "#fab387",
}

# ──────────────────────────────────────────
# ユーティリティ
# ──────────────────────────────────────────

def parse_time(s: str):
    s = s.strip()
    for pat, fn in [
        (r'(\d+):(\d{1,2}):(\d{1,2})(?:\.(\d+))?',
         lambda m: int(m[1])*3600+int(m[2])*60+int(m[3])+(float('0.'+m[4]) if m[4] else 0)),
        (r'(\d+):(\d{1,2})(?:\.(\d+))?',
         lambda m: int(m[1])*60+int(m[2])+(float('0.'+m[3]) if m[3] else 0)),
        (r'(\d+)(?:\.(\d+))?',
         lambda m: int(m[1])+(float('0.'+m[2]) if m[2] else 0)),
    ]:
        mo = re.fullmatch(pat, s)
        if mo:
            return fn(mo.groups())
    return None

def fmt_time(sec: float) -> str:
    h = int(sec // 3600); m = int((sec % 3600) // 60); s = sec % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"

def fmt_hms(sec: float) -> str:
    h = int(sec // 3600); m = int((sec % 3600) // 60); s = int(sec % 60)
    return (f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}")

def get_duration(path: str):
    r = subprocess.run([FFMPEG, "-i", path],
                       stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True)
    mo = re.search(r"Duration:\s+(\d+):(\d+):(\d+\.\d+)", r.stderr)
    return (int(mo[1])*3600+int(mo[2])*60+float(mo[3])) if mo else None

# ──────────────────────────────────────────
# フレーム抽出
# ──────────────────────────────────────────

def extract_frames(path: str, duration: float, n: int, thumb_h: int, tmp_dir: str,
                   progress_cb=None):
    """動画から n 枚のサムネを抽出して PIL Image リストを返す"""
    images = []
    for i in range(n):
        t = duration * i / n
        out = os.path.join(tmp_dir, f"frame_{i:04d}.jpg")
        subprocess.run(
            [FFMPEG, "-y", "-ss", str(t), "-i", path,
             "-vframes", "1", "-vf", f"scale=-1:{thumb_h}", out],
            stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL
        )
        if os.path.exists(out):
            try:
                img = Image.open(out).convert("RGB")
                images.append((t, img))
            except Exception:
                images.append((t, None))
        else:
            images.append((t, None))
        if progress_cb:
            progress_cb(i + 1, n)
    return images

# ──────────────────────────────────────────
# 分割処理
# ──────────────────────────────────────────

def split_video(input_path, split_times, output_dir, prefix, ext,
                log_cb, progress_cb, seg_cb, done_cb, cancel_flag):
    duration = get_duration(input_path)
    if duration is None:
        log_cb("エラー: 動画長を取得できませんでした"); done_cb(False, []); return

    points = sorted(split_times)
    segs = []
    prev = 0.0
    for pt in points:
        segs.append((prev, pt)); prev = pt
    segs.append((prev, duration))

    total = len(segs)
    log_cb(f"動画長: {fmt_time(duration)}")
    log_cb(f"分割数: {total} セグメント\n")
    output_files = []
    t0 = time.time()

    for i, (start, end) in enumerate(segs, 1):
        if cancel_flag():
            log_cb("\n⚠ キャンセル"); done_cb(False, output_files); return
        name = f"{prefix}_{i:03d}{ext}"
        out  = os.path.join(output_dir, name)
        seg_cb(i, total, start, end)
        log_cb(f"[{i}/{total}] {fmt_time(start)} → {fmt_time(end)}  →  {name}")
        proc = subprocess.run(
            [FFMPEG, "-y", "-i", input_path,
             "-ss", str(start), "-t", str(end-start), "-c", "copy", out],
            stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True
        )
        if proc.returncode != 0:
            log_cb(f"  ❌ {proc.stderr[-200:]}")
        else:
            sz = os.path.getsize(out)/1024
            output_files.append(out)
            log_cb(f"  ✅ 完了 ({'%.0f KB'%sz if sz<1024 else '%.2f MB'%(sz/1024)})")
        elapsed = time.time() - t0
        eta = (elapsed/i)*(total-i) if i else 0
        progress_cb(int(i/total*100), i, total, eta)

    log_cb(f"\n✨ 全 {total} セグメント完了（{time.time()-t0:.1f}秒）")
    done_cb(True, output_files)

# ──────────────────────────────────────────
# フィルムストリップ ウィジェット
# ──────────────────────────────────────────

STRIP_H   = 90   # フレームサムネの高さ
RULER_H   = 22   # ルーラー高さ
CANVAS_H  = STRIP_H + RULER_H + 4
MARKER_W  = 3

class FilmStrip(tk.Canvas):
    """タイムライン + フィルムストリップ + 分割マーカー"""

    def __init__(self, master, on_markers_changed=None, **kw):
        kw.setdefault("bg", THEME["mantle"])
        kw.setdefault("height", CANVAS_H)
        kw.setdefault("highlightthickness", 0)
        super().__init__(master, **kw)
        self.on_markers_changed = on_markers_changed
        self.duration   = 0.0
        self.markers    = []      # 分割時刻 (float)
        self._frames    = []      # (time, PhotoImage)
        self._photo_refs = []     # GC対策
        self._frame_w   = 0
        self._loading   = False
        self._drag_idx  = None    # ドラッグ中マーカーindex

        self.bind("<Configure>",       self._on_resize)
        self.bind("<Button-1>",        self._on_click)
        self.bind("<B1-Motion>",       self._on_drag)
        self.bind("<ButtonRelease-1>", self._on_release)
        self.bind("<Button-3>",        self._on_right)
        self._draw_empty()

    # ── 外部 API ──────────────────────────

    def set_loading(self, msg="フレームを読み込み中…"):
        self._loading = True
        self.delete("all")
        w = self.winfo_width() or 800
        self.create_rectangle(0, 0, w, CANVAS_H, fill=THEME["mantle"], outline="")
        self.create_text(w//2, CANVAS_H//2, text=msg,
                         fill=THEME["subtext"], font=("Segoe UI", 10))

    def set_frames(self, duration: float, frames: list):
        """frames: list of (time, PIL.Image | None)"""
        self._loading = False
        self.duration  = duration
        self._photo_refs.clear()
        self._frames = []
        for (t, img) in frames:
            if img is not None:
                ph = ImageTk.PhotoImage(img)
                self._photo_refs.append(ph)
                self._frames.append((t, ph))
            else:
                self._frames.append((t, None))
        self._redraw()

    def set_markers(self, times: list):
        self.markers = sorted(times)
        self._redraw()
        if self.on_markers_changed:
            self.on_markers_changed(self.markers)

    def clear(self):
        self.duration = 0.0
        self.markers  = []
        self._frames  = []
        self._photo_refs.clear()
        self._draw_empty()

    # ── 描画 ──────────────────────────────

    def _draw_empty(self):
        self.delete("all")
        w = self.winfo_width() or 800
        self.create_rectangle(0, 0, w, CANVAS_H,
                              fill=THEME["mantle"], outline="")
        self.create_text(w//2, CANVAS_H//2,
                         text="動画をドロップまたは「参照」でファイルを選択",
                         fill=THEME["surface2"], font=("Segoe UI", 10))

    def _on_resize(self, e):
        if self.duration:
            self._redraw()
        else:
            self._draw_empty()

    def _redraw(self):
        self.delete("all")
        w = self.winfo_width() or 800
        if not self.duration:
            self._draw_empty(); return

        # ── フレーム描画 ──
        n = len(self._frames)
        if n:
            fw = w // n
            self._frame_w = fw
            for i, (t, ph) in enumerate(self._frames):
                x = i * fw
                if ph:
                    self.create_image(x, RULER_H, anchor="nw", image=ph)
                else:
                    self.create_rectangle(x, RULER_H, x+fw, RULER_H+STRIP_H,
                                          fill=THEME["surface"], outline=THEME["surface2"])
        else:
            self._frame_w = 0

        # ── ルーラー ──
        self.create_rectangle(0, 0, w, RULER_H,
                              fill=THEME["surface"], outline="")
        step = self._nice_step(self.duration, w)
        t = 0.0
        while t <= self.duration + 0.001:
            x = int(t / self.duration * w)
            self.create_line(x, RULER_H-6, x, RULER_H,
                             fill=THEME["subtext"], width=1)
            label = fmt_hms(t)
            self.create_text(x+3, 4, text=label, anchor="nw",
                             fill=THEME["subtext"], font=("Segoe UI", 7))
            t += step

        # ── マーカー ──
        for i, mt in enumerate(self.markers):
            x = int(mt / self.duration * w)
            self.create_line(x, 0, x, CANVAS_H,
                             fill=THEME["marker"], width=MARKER_W,
                             tags=f"marker_{i}")
            # 上部ラベル
            self.create_rectangle(x-1, 0, x+36, 13,
                                  fill=THEME["marker"], outline="")
            self.create_text(x+2, 1, text=fmt_hms(mt), anchor="nw",
                             fill=THEME["bg"], font=("Segoe UI", 7, "bold"),
                             tags=f"mlabel_{i}")

        # ── 右端ガイド ──
        self.create_line(w-1, 0, w-1, CANVAS_H,
                         fill=THEME["surface2"], width=1)

    @staticmethod
    def _nice_step(dur, width):
        candidates = [1,2,5,10,15,30,60,120,300,600,1800,3600]
        for s in candidates:
            if dur / s * 40 <= width:
                return s
        return candidates[-1]

    # ── イベント ──────────────────────────

    def _time_at(self, x) -> float:
        w = self.winfo_width() or 1
        return max(0.0, min(self.duration, x / w * self.duration))

    def _marker_at(self, x, tol=8) -> int | None:
        """x 付近のマーカーindex を返す"""
        w = self.winfo_width() or 1
        for i, mt in enumerate(self.markers):
            mx = int(mt / self.duration * w)
            if abs(x - mx) <= tol:
                return i
        return None

    def _on_click(self, e):
        if not self.duration: return
        idx = self._marker_at(e.x)
        if idx is not None:
            self._drag_idx = idx
        else:
            t = self._time_at(e.x)
            self.markers = sorted(self.markers + [t])
            self._redraw()
            if self.on_markers_changed:
                self.on_markers_changed(self.markers)

    def _on_drag(self, e):
        if not self.duration or self._drag_idx is None: return
        t = self._time_at(e.x)
        self.markers[self._drag_idx] = t
        self.markers.sort()
        self._redraw()
        if self.on_markers_changed:
            self.on_markers_changed(self.markers)

    def _on_release(self, e):
        self._drag_idx = None

    def _on_right(self, e):
        """右クリックで近くのマーカーを削除"""
        if not self.duration: return
        idx = self._marker_at(e.x, tol=12)
        if idx is not None:
            self.markers.pop(idx)
            self._redraw()
            if self.on_markers_changed:
                self.on_markers_changed(self.markers)

# ──────────────────────────────────────────
# メインアプリ
# ──────────────────────────────────────────

class VideoSplitterApp(TkinterDnD.Tk):

    def __init__(self):
        super().__init__()
        self.title("動画分割アプリ")
        self.geometry("860x720")
        self.minsize(700, 580)
        self.configure(bg=THEME["bg"])
        self._cancel_requested = False
        self._duration = None
        self._tmp_dir  = None
        self._build_ui()
        self._setup_dnd()

    # ──────────────────────────────────────
    # UI 構築
    # ──────────────────────────────────────

    def _build_ui(self):
        T = THEME
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TFrame",    background=T["bg"])
        style.configure("TLabel",    background=T["bg"], foreground=T["fg"],
                        font=("Segoe UI", 10))
        style.configure("Sub.TLabel",background=T["bg"], foreground=T["subtext"],
                        font=("Segoe UI", 9))
        style.configure("Head.TLabel",background=T["bg"], foreground=T["purple"],
                        font=("Segoe UI", 16, "bold"))
        style.configure("TButton",   background=T["blue"], foreground=T["bg"],
                        font=("Segoe UI", 10, "bold"), relief="flat", padding=4)
        style.map("TButton",
                  background=[("active","#74c7ec"),("disabled",T["surface2"])])
        style.configure("Green.TButton", background=T["green"], foreground=T["bg"])
        style.map("Green.TButton",
                  background=[("active","#94e2a1"),("disabled",T["surface2"])])
        style.configure("Red.TButton", background=T["red"], foreground=T["bg"])
        style.map("Red.TButton",
                  background=[("active","#f97ba5")])
        style.configure("TProgressbar", troughcolor=T["surface"],
                        background=T["blue"], borderwidth=0, thickness=14)

        root = ttk.Frame(self, padding=14)
        root.pack(fill="both", expand=True)

        # タイトル
        ttk.Label(root, text="🎬 動画分割アプリ", style="Head.TLabel").pack(
            anchor="w", pady=(0,10))

        # ── ファイル選択 ──────────────────
        self._section(root, "入力ファイル")
        drop_frame = tk.Frame(root, bg=T["surface"], bd=0,
                              highlightthickness=2,
                              highlightbackground=T["surface2"],
                              highlightcolor=T["blue"])
        drop_frame.pack(fill="x", pady=(2,0))
        inner = tk.Frame(drop_frame, bg=T["surface"])
        inner.pack(fill="x", padx=6, pady=4)
        self.file_var = tk.StringVar()
        self.file_entry = tk.Entry(inner, textvariable=self.file_var,
                                   bg=T["surface"], fg=T["fg"],
                                   insertbackground=T["fg"],
                                   relief="flat", font=("Segoe UI",10))
        self.file_entry.pack(side="left", fill="x", expand=True, padx=(0,6))
        ttk.Button(inner, text="参照", command=self._browse).pack(side="left")

        self.dur_lbl = ttk.Label(root,
            text="▲ ここに動画ファイルをドロップ", style="Sub.TLabel")
        self.dur_lbl.pack(anchor="w", pady=(2,6))

        # ── フィルムストリップ ─────────────
        self._section(root, "タイムライン  （クリック＝分割点追加 ／ 右クリック＝削除 ／ ドラッグ＝移動）")
        strip_outer = tk.Frame(root, bg=T["mantle"], bd=1,
                               highlightthickness=1,
                               highlightbackground=T["surface2"])
        strip_outer.pack(fill="x", pady=(2,4))
        self.strip = FilmStrip(strip_outer, on_markers_changed=self._on_markers_changed)
        self.strip.pack(fill="x")

        self.strip_lbl = ttk.Label(root, text="", style="Sub.TLabel", wraplength=820)
        self.strip_lbl.pack(anchor="w", pady=(0,4))

        # ── 出力フォルダ ──────────────────
        self._section(root, "出力フォルダ")
        out_row = ttk.Frame(root)
        out_row.pack(fill="x", pady=(2,8))
        self.out_var = tk.StringVar()
        tk.Entry(out_row, textvariable=self.out_var,
                 bg=T["surface"], fg=T["fg"], insertbackground=T["fg"],
                 relief="flat", font=("Segoe UI",10)).pack(
            side="left", fill="x", expand=True, padx=(0,6))
        ttk.Button(out_row, text="参照",
                   command=self._browse_out).pack(side="left")

        # ── ボタン＆プログレス ────────────
        btn_row = ttk.Frame(root)
        btn_row.pack(fill="x", pady=(0,4))
        self.run_btn = ttk.Button(btn_row, text="▶  分割開始",
                                  style="Green.TButton", command=self._run)
        self.run_btn.pack(side="left", fill="x", expand=True, padx=(0,6))
        self.cancel_btn = ttk.Button(btn_row, text="✕  キャンセル",
                                     style="Red.TButton",
                                     command=self._cancel, state="disabled")
        self.cancel_btn.pack(side="left", ipadx=8)

        prog_row = ttk.Frame(root)
        prog_row.pack(fill="x", pady=(0,2))
        self.prog_var = tk.IntVar()
        ttk.Progressbar(prog_row, variable=self.prog_var,
                        maximum=100).pack(fill="x")
        info_row = ttk.Frame(root)
        info_row.pack(fill="x", pady=(0,4))
        self.prog_lbl = ttk.Label(info_row, text="待機中", style="Sub.TLabel")
        self.prog_lbl.pack(side="left")
        self.eta_lbl  = ttk.Label(info_row, text="", style="Sub.TLabel")
        self.eta_lbl.pack(side="right")

        # ── ログ ──────────────────────────
        self._section(root, "ログ")
        log_f = ttk.Frame(root)
        log_f.pack(fill="both", expand=True)
        self.log_text = tk.Text(log_f, bg=T["mantle"], fg=T["green"],
                                font=("Consolas",9), relief="flat",
                                state="disabled", wrap="word", height=6)
        sb = ttk.Scrollbar(log_f, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=sb.set)
        self.log_text.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")

        # 結果フレーム
        self.result_frame = ttk.Frame(root)
        ttk.Label(self.result_frame, text="出力ファイル:", style="Sub.TLabel").pack(anchor="w")
        self.result_list = tk.Listbox(self.result_frame,
                                      bg=T["surface"], fg=T["fg"],
                                      font=("Segoe UI",9), relief="flat", height=4,
                                      selectbackground=T["blue"])
        self.result_list.pack(fill="x")
        ttk.Button(self.result_frame, text="📂 フォルダを開く",
                   command=self._open_out).pack(anchor="e", pady=(4,0))

    def _section(self, parent, text):
        T = THEME
        f = ttk.Frame(parent); f.pack(fill="x", pady=(6,1))
        ttk.Label(f, text=text, background=T["bg"], foreground=T["purple"],
                  font=("Segoe UI",9,"bold")).pack(side="left")
        tk.Frame(f, bg=T["surface2"], height=1).pack(
            side="left", fill="x", expand=True, padx=(6,0), pady=6)

    # ──────────────────────────────────────
    # ドラッグ＆ドロップ
    # ──────────────────────────────────────

    def _setup_dnd(self):
        self.drop_target_register(DND_FILES)
        self.dnd_bind("<<Drop>>", self._on_drop)

    def _on_drop(self, event):
        raw = event.data.strip()
        # 複数ファイルは最初の1つ
        if raw.startswith("{"):
            path = raw[1:raw.index("}")]
        else:
            path = raw.split()[0]
        if os.path.isfile(path):
            self._load_file(path)

    # ──────────────────────────────────────
    # ファイル読み込み
    # ──────────────────────────────────────

    def _browse(self):
        path = filedialog.askopenfilename(
            title="動画ファイルを選択",
            filetypes=[("動画", "*.mp4 *.mov *.avi *.mkv *.wmv *.flv *.webm *.m4v"),
                       ("すべて", "*.*")])
        if path:
            self._load_file(path)

    def _browse_out(self):
        p = filedialog.askdirectory(title="出力フォルダを選択")
        if p: self.out_var.set(p)

    def _load_file(self, path: str):
        self.file_var.set(path)
        if not self.out_var.get():
            self.out_var.set(os.path.dirname(path))
        self.dur_lbl.configure(text="動画長を取得中…", foreground=THEME["yellow"])
        self._duration = None
        self.strip.set_loading("フレームを読み込み中…")
        self.strip_lbl.configure(text="")

        def worker():
            dur = get_duration(path)
            if dur is None:
                self.after(0, lambda: self.dur_lbl.configure(
                    text="動画長を取得できませんでした", foreground=THEME["red"]))
                self.after(0, self.strip.clear)
                return
            self._duration = dur
            self.after(0, lambda: self.dur_lbl.configure(
                text=f"動画長: {fmt_time(dur)}  （{fmt_hms(dur)}）  "
                     f"— タイムラインをクリックして分割位置を指定",
                foreground=THEME["green"]))

            # テンポラリ管理
            if self._tmp_dir and os.path.exists(self._tmp_dir):
                shutil.rmtree(self._tmp_dir, ignore_errors=True)
            self._tmp_dir = tempfile.mkdtemp(prefix="vsplit_")

            # フレーム数（幅に合わせて後で増やしてもよい）
            n_frames = min(40, max(10, int(dur / 5)))
            frames = extract_frames(path, dur, n_frames, STRIP_H, self._tmp_dir)
            self.after(0, lambda: self.strip.set_frames(dur, frames))
            # マーカーリセット
            self.after(0, lambda: self.strip.set_markers([]))

        threading.Thread(target=worker, daemon=True).start()

    # ──────────────────────────────────────
    # マーカー変更コールバック
    # ──────────────────────────────────────

    def _on_markers_changed(self, markers: list):
        if not markers:
            self.strip_lbl.configure(text="分割点なし（タイムラインをクリックして追加）")
            return
        segs = []
        prev = 0.0
        for mt in markers:
            segs.append((prev, mt)); prev = mt
        segs.append((prev, self._duration or 0))
        txt = "  ›  ".join(
            f"[{i+1}] {fmt_hms(s)}〜{fmt_hms(e)}"
            for i,(s,e) in enumerate(segs))
        self.strip_lbl.configure(
            text=f"{len(segs)} セグメント:  {txt}",
            foreground=THEME["subtext"])

    # ──────────────────────────────────────
    # 分割実行
    # ──────────────────────────────────────

    def _run(self):
        path = self.file_var.get().strip()
        out  = self.out_var.get().strip()
        if not path or not os.path.isfile(path):
            messagebox.showerror("エラー", "動画ファイルを選択してください"); return
        if not out or not os.path.isdir(out):
            messagebox.showerror("エラー", "出力フォルダを選択してください"); return
        if not self.strip.markers:
            messagebox.showerror("エラー", "タイムラインをクリックして分割位置を指定してください"); return

        base = os.path.splitext(os.path.basename(path))[0]
        ext  = os.path.splitext(path)[1]
        self._cancel_requested = False
        self.run_btn.configure(state="disabled")
        self.cancel_btn.configure(state="normal")
        self.prog_var.set(0)
        self.prog_lbl.configure(text="処理中…")
        self.eta_lbl.configure(text="")
        self.result_frame.pack_forget()
        self._clear_log()
        self._log(f"入力:  {os.path.basename(path)}")
        self._log(f"出力先: {out}")
        self._log(f"分割点: {', '.join(fmt_time(t) for t in self.strip.markers)}\n")

        def prog_cb(pct, done, total, eta):
            self.after(0, lambda: self.prog_var.set(pct))
            self.after(0, lambda: self.prog_lbl.configure(
                text=f"処理中… {done}/{total} セグメント ({pct}%)"))
            self.after(0, lambda: self.eta_lbl.configure(
                text=f"残り約{int(eta)}秒" if eta>1 else ""))

        def seg_cb(i, total, start, end):
            self.after(0, lambda: self.prog_lbl.configure(
                text=f"[{i}/{total}] {fmt_time(start)} → {fmt_time(end)}"))

        def done_cb(ok, files):
            self.after(0, lambda: self._on_done(ok, files, out))

        threading.Thread(
            target=split_video,
            args=(path, list(self.strip.markers), out, base, ext,
                  lambda m: self.after(0, self._log, m),
                  prog_cb, seg_cb, done_cb,
                  lambda: self._cancel_requested),
            daemon=True
        ).start()

    def _cancel(self):
        self._cancel_requested = True
        self.cancel_btn.configure(state="disabled")
        self._log("⚠ キャンセルリクエスト送信…")

    def _on_done(self, ok, files, out_dir):
        self.run_btn.configure(state="normal")
        self.cancel_btn.configure(state="disabled")
        if ok:
            self.prog_var.set(100)
            self.prog_lbl.configure(
                text=f"✅ 完了 — {len(files)} ファイル出力",
                foreground=THEME["green"])
            self._output_dir = out_dir
            self.result_list.delete(0, "end")
            for f in files:
                sz = os.path.getsize(f)/1024
                self.result_list.insert("end",
                    f"  {os.path.basename(f)}  "
                    f"({'%.0f KB'%sz if sz<1024 else '%.2f MB'%(sz/1024)})")
            self.result_frame.pack(fill="x", pady=(6,0))
        else:
            self.prog_lbl.configure(
                text="❌ 失敗またはキャンセル", foreground=THEME["red"])

    def _open_out(self):
        if hasattr(self, "_output_dir") and os.path.isdir(self._output_dir):
            os.startfile(self._output_dir)

    # ──────────────────────────────────────
    # ログ
    # ──────────────────────────────────────

    def _log(self, msg: str):
        self.log_text.configure(state="normal")
        self.log_text.insert("end", msg + "\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _clear_log(self):
        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.configure(state="disabled")

    def destroy(self):
        if self._tmp_dir and os.path.exists(self._tmp_dir):
            shutil.rmtree(self._tmp_dir, ignore_errors=True)
        super().destroy()


# ──────────────────────────────────────────

if __name__ == "__main__":
    app = VideoSplitterApp()
    app.mainloop()
