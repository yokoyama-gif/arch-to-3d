import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createInitialProject, useProjectStore } from '../store/projectStore';

const resetStore = () => {
  const project = createInitialProject();
  useProjectStore.setState({
    project,
    activePlanId: project.plans[0]!.id,
    selectedObjectId: null,
    showComparison: false,
    overlayVisibility: {
      corridor: true,
      chair: false,
      door: true,
      reception: true,
      copy: true,
      meeting: true,
    },
    lastSavedPath: null,
  });
};

describe('App UI', () => {
  beforeEach(() => {
    resetStore();
    window.officeApi = {
      saveProject: vi.fn().mockResolvedValue({ canceled: false, filePath: 'saved.json' }),
      loadProject: vi.fn().mockResolvedValue({
        canceled: false,
        filePath: 'loaded.json',
        content: JSON.stringify({
          ...createInitialProject(),
          name: 'Loaded Project',
        }),
      }),
      saveTextFile: vi.fn().mockResolvedValue({ canceled: false, filePath: 'report.csv' }),
      saveBinaryFile: vi.fn().mockResolvedValue({ canceled: false, filePath: 'plan.png' }),
      exportPdf: vi.fn().mockResolvedValue({ canceled: false, filePath: 'plan.pdf' }),
    };

    globalThis.XMLSerializer = class {
      serializeToString() {
        return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      }
    } as typeof XMLSerializer;

    globalThis.Image = class {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    } as unknown as typeof Image;

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillStyle: '#ffffff',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    });
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob(['png'], { type: 'image/png' }));
    });
  });

  it('adds, moves, rotates, deletes, saves and loads objects', async () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /1人用デスク/i }));
    expect(useProjectStore.getState().project.plans[0]!.objects).toHaveLength(1);

    const svg = container.querySelector('svg')!;
    Object.defineProperty(svg, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        width: 900,
        height: 600,
        right: 900,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    const rects = container.querySelectorAll('svg rect');
    const objectRect = rects[rects.length - 1]!;
    fireEvent.pointerDown(objectRect, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 260, clientY: 180 });
    fireEvent.pointerUp(window);
    expect(useProjectStore.getState().project.plans[0]!.objects[0]!.x).not.toBe(1000);

    fireEvent.click(screen.getAllByRole('button', { name: '回転' })[0]!);
    expect(useProjectStore.getState().project.plans[0]!.objects[0]!.rotation).toBe(90);

    fireEvent.click(screen.getAllByRole('button', { name: '削除' })[0]!);
    expect(useProjectStore.getState().project.plans[0]!.objects).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(window.officeApi?.saveProject).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '読込' }));
    expect(window.officeApi?.loadProject).toHaveBeenCalled();
    await waitFor(() => {
      expect(useProjectStore.getState().project.name).toBe('Loaded Project');
    });
  }, 30000);

  it('handles templates, zones, custom library, comparison, and exports', async () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /^通路\s+\d+$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /来客対応重視/i }));
    expect(useProjectStore.getState().project.plans[0]!.zones.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '執務ゾーン' }));
    expect(useProjectStore.getState().project.plans[0]!.zones.length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('button', { name: /4人島/i }));
    fireEvent.click(screen.getByRole('button', { name: 'カスタム登録' }));
    expect(useProjectStore.getState().project.customLibrary.length).toBe(1);
    expect(screen.getByText(/4人島 カスタム/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '新規案' }));
    expect(useProjectStore.getState().project.plans.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: '比較表示' }));
    expect(screen.getByText('案比較')).toBeInTheDocument();
    expect(screen.getByText('ベスト案')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'CSV出力' }));
    await waitFor(() => expect(window.officeApi?.saveTextFile).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'PDF出力' }));
    await waitFor(() => expect(window.officeApi?.exportPdf).toHaveBeenCalled());
  }, 60000);
});
