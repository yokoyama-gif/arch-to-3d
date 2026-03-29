import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

/**
 * アプリ全体を包むエラーバウンダリ。
 * 計算ロジックやレンダリングで例外が発生してもアプリ全体がクラッシュしない。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: "sans-serif" }}>
          <h2 style={{ color: "#f44336" }}>エラーが発生しました</h2>
          <p style={{ color: "#666" }}>
            {this.state.error?.message ?? "不明なエラー"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 14,
              marginTop: 8,
            }}
          >
            復旧を試みる
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 14,
              marginTop: 8,
              marginLeft: 8,
            }}
          >
            リロード
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
