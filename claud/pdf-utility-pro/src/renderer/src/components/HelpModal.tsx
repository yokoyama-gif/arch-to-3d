import React, { useEffect } from 'react'

interface HelpModalProps {
  onClose: () => void
}

export function HelpModal({ onClose }: HelpModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="help-modal show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="help-box">
        <button className="help-close" onClick={onClose} title="閉じる (Esc)">
          ✕
        </button>
        <div className="help-title">📖 操作ヘルプ</div>

        <div className="help-section">
          <div className="help-section-title">🖱️ マウス操作</div>
          <table className="help-table">
            <tbody>
              <tr><td><span className="help-mouse">クリック</span></td><td>そのページのみを選択</td></tr>
              <tr><td><span className="help-mouse">Ctrl + クリック</span></td><td>選択を追加／解除（複数選択）</td></tr>
              <tr><td><span className="help-mouse">Shift + クリック</span></td><td>直前選択ページから今クリックしたページまで<strong>範囲選択</strong></td></tr>
              <tr><td><span className="help-mouse">ダブルクリック</span></td><td>そのページを<strong>全画面で拡大表示</strong></td></tr>
              <tr><td><span className="help-mouse">ドラッグ</span></td><td>サムネイルをドラッグして並べ替え</td></tr>
              <tr><td><span className="help-mouse">PDFファイルをドロップ</span></td><td>ウィンドウにドラッグ＆ドロップで追加</td></tr>
            </tbody>
          </table>
        </div>

        <div className="help-section">
          <div className="help-section-title">⌨️ キーボード（通常画面）</div>
          <table className="help-table">
            <tbody>
              <tr><td><span className="help-kbd">Ctrl</span> + <span className="help-kbd">A</span></td><td>全ページ選択</td></tr>
              <tr><td><span className="help-kbd">Ctrl</span> + <span className="help-kbd">Z</span></td><td>直前の操作を元に戻す（最大20ステップ）</td></tr>
              <tr><td><span className="help-kbd">Delete</span></td><td>選択中のページを削除</td></tr>
              <tr><td><span className="help-kbd">F1</span> / <span className="help-kbd">?</span></td><td>このヘルプを表示</td></tr>
            </tbody>
          </table>
        </div>

        <div className="help-section">
          <div className="help-section-title">🔍 拡大表示中</div>
          <table className="help-table">
            <tbody>
              <tr><td><span className="help-kbd">←</span> / <span className="help-kbd">→</span></td><td>前後のページへ移動</td></tr>
              <tr><td><span className="help-kbd">L</span></td><td>左に90°回転</td></tr>
              <tr><td><span className="help-kbd">R</span></td><td>右に90°回転</td></tr>
              <tr><td><span className="help-kbd">Delete</span></td><td>表示中のページを削除</td></tr>
              <tr><td><span className="help-kbd">Esc</span></td><td>拡大表示を閉じる</td></tr>
            </tbody>
          </table>
        </div>

        <div className="help-section">
          <div className="help-section-title">🔄 他形式への変換・取り込み</div>
          <table className="help-table">
            <tbody>
              <tr><td>🔄 <strong>他形式に変換</strong></td><td>PDF→画像（PNG/JPEG）／PDF→テキスト（.txt）に変換して保存</td></tr>
              <tr><td>🖼️ <strong>画像→PDF</strong></td><td>PNG/JPEG 画像を選択して1つのPDFに変換して取り込み</td></tr>
              <tr><td>ドラッグ＆ドロップ</td><td>PDF・PNG・JPEG を混在させてドロップ可能（画像は自動でPDF化）</td></tr>
            </tbody>
          </table>
        </div>

        <div className="help-section">
          <div className="help-section-title">💡 ワークフローのヒント</div>
          <table className="help-table">
            <tbody>
              <tr><td colSpan={2}>複数のPDFをドラッグ＆ドロップで一度に読み込めます。並べ替えた後、「全体を保存」で1つのPDFに結合できます。</td></tr>
              <tr><td colSpan={2}><span className="help-mouse">Shift+クリック</span> で範囲選択してから「選択ページを保存」で抽出PDFを作成できます。</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
