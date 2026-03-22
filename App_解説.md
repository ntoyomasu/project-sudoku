# App.tsx 解説ドキュメント
> 対象：プログラミング知識ゼロの方向け

---

## 全体マップ

`App.tsx` は、このスドク（数独）ゲームの**司令塔**です。画面に表示されるものすべて、ボタンを押したときの動き、ゲームのルール——これらをひとつのファイルで管理しています。

具体的にやっていることを箇条書きにすると：

- **ゲームの状態を記憶する**（今の盤面・選んでいるマス・タイマー・ミス数など）
- **新しいゲームを始める**（難易度に応じて問題を生成してリセット）
- **タイマーを動かす**（1秒ごとにカウントアップ）
- **マスをクリックしたときの処理**（どのマスが選ばれたか覚える）
- **数字を入力したときの処理**（正解か不正解か判定、メモモードの切替）
- **「元に戻す」機能**（ひとつ前の状態に戻る）
- **ヒント機能**（答えを自動入力。回数制限あり）
- **自動保存・中断再開**（アプリを閉じても、続きから再開できる）
- **統計・実績機能**（クリアタイムや連勝記録、獲得したバッジの管理）
- **キーボード操作のサポート**（矢印キー・数字キーで操作できる）
- **各マスの見た目と演出を決める**（震えたり光ったりするアニメーション）
- **画面を描画する**（盤面・数字ボタン・統計画面など）

---

## 各ブロックの解説

---

### ブロック 1：必要な道具を呼び出す

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { generateSudoku, type Board } from './utils/sudokuLogic';
```

**解説：**

`import` は「外から道具を借りてくる」命令です。

- `useState` / `useEffect` / `useCallback` / `useRef` は React（画面を作るための枠組み）が提供する便利な道具
- `generateSudoku` は別のファイルで作られた「数独の問題を自動生成する機械」
- `Board` は「9×9のマス目の形を表す型」（データのかたちを定義したもの）

---

### ブロック 2：データの「かたち」を定義する

```tsx
interface SelectedCell {
  row: number;
  col: number;
}

interface BestTimes {
  easy: number | null;
  medium: number | null;
  hard: number | null;
}

type Difficulty = 'easy' | 'medium' | 'hard';
```

**解説：**

ここは「メモ帳のフォーマットを決める」場所です。

- `SelectedCell`（選択中のマス）→「何行目・何列目」という情報を一緒に管理するための入れ物の形
- `BestTimes`（最高タイム）→ 難易度ごとのベストタイムを記録する入れ物の形。`null` は「まだ記録なし」という意味
- `Difficulty`（難易度）→ `'easy'`・`'medium'`・`'hard'` の3択しか入れられないルール

---

### ブロック 3：ゲームの「現在の状態」を記憶する場所

```tsx
const [initialBoard, setInitialBoard] = useState<Board>([]);
const [userBoard, setUserBoard] = useState<Board>([]);
const [solution, setSolution] = useState<Board>([]);
const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
const [mistakes, setMistakes] = useState(0);
const [timer, setTimer] = useState(0);
const [isGameActive, setIsGameActive] = useState(false);
const [isLoading, setIsLoading] = useState(true);
const [difficulty, setDifficulty] = useState<Difficulty>('medium');
const [hintsUsed, setHintsUsed] = useState(0); 
const hintsLimit = 3;
const [isStatsOpen, setIsStatsOpen] = useState(false);
const [gameMode, setGameMode] = useState<'classic' | 'time-attack'>('classic');
const [isDaily, setIsDaily] = useState(false);
const [timeEffect, setTimeEffect] = useState<{ type: 'plus' | 'minus', value: number } | null>(null);
const [isSolved, setIsSolved] = useState(false);
```

**解説：**

`useState` は「ゲームの現在の状態を覚えておく引き出し」です。引き出しは常に2つセットになっています：

- 左側（例：`initialBoard`）→ 引き出しの中身を**読む**ためのラベル
- 右側（例：`setInitialBoard`）→ 引き出しの中身を**書き換える**ためのボタン

各引き出しの役割：

| 引き出し名 | 何を覚えているか |
|---|---|
| `initialBoard` | 最初から印刷されている数字（変えられない問題の数字） |
| `userBoard` | 今プレイヤーが入力している盤面 |
| `solution` | 正解の盤面（判定に使う、画面には表示しない） |
| `selectedCell` | 今どのマスを選んでいるか（行・列） |
| `mistakes` | ミスした回数（0〜3） |
| `timer` | 経過秒数（タイムアタックでは残り秒数） |
| `isGameActive` | ゲームが進行中かどうか（true/false） |
| `isLoading` | 問題生成中で読み込み中かどうか |
| `difficulty` | 現在の難易度（easy/medium/hard + 隠し難易度'super-hard'） |
| `gameMode` | 「通常」モードか「タイムアタック」モードか |
| `theme` | 現在の画面テーマ（'default', 'ocean', 'sunset', 'cyber'） |
| `isDaily` | 今日のデイリーチャレンジに挑戦中かどうか |
| `timeEffect` | タイムアタックでの加点（+10s）や減点（-30s）のフワッとした演出 |
| `isSolved` | 数字がすべて埋まってクリアした瞬間の状態（キラリと光る演出に使用） |
| `hintsUsed` | 今回のゲームでヒントを使った回数 |
| `isStatsOpen` | 統計画面（モーダル）が開いているかどうか |
| `stats` | 全体での勝利数や実績、ストリーク（連勝）の記録 |

---

### ブロック 4：高度な機能の「状態」を記憶する場所

```tsx
const [history, setHistory] = useState<Board[]>([]);
const [memos, setMemos] = useState<number[][][]>(
  Array(9).fill(null).map(() => Array(9).fill(null).map(() => []))
);
const [isMemoMode, setIsMemoMode] = useState(false);
const [bestTimes, setBestTimes] = useState<BestTimes>(() => {
  const saved = localStorage.getItem('sudoku-best-times');
  try {
    return saved ? JSON.parse(saved) : { easy: null, medium: null, hard: null };
  } catch {
    return { easy: null, medium: null, hard: null };
  }
});
```

**解説：**

- `history`（履歴）→ 「元に戻す」ために過去の盤面を積み重ねて保存しておくスタック。CDの積み重ねのようなイメージ
- `memos`（メモ）→ 各マスに書いた小さいメモ数字を9×9で管理する立体的な棚
- `isMemoMode`（メモモード中か）→ メモモードのON/OFFのスイッチ
- `bestTimes`（ベストタイム）→ 難易度ごとの最短クリア時間
- `stats`（統計データ）→ 勝利数や「ノーミスクリア」などの実績バッジ、連続クリア記録。
- `gameMode`（ゲームモード）→ 「通常（Classic）」か、制限時間内に解く「タイムアタック（Time Attack）」かを選べます。
- `isDaily`（デイリー）→ その日の日付に基づいた「全ユーザー共通の問題」に挑戦中かどうか。挑戦すると「Daily Hero」の実績がもらえます。
- `localStorage`（ブラウザの保存庫）→ `bestTimes` や `stats` を保存し、ブラウザを閉じても消えないようにしています

---

### ブロック 5：新しいゲームを始める処理

```tsx
const startNewGame = useCallback((
  diff: Difficulty = 'medium', 
  mode: 'classic' | 'time-attack' = 'classic',
  daily = false,
  seed?: number
) => {
  // ... 確認処理 ...
  setGameMode(mode);
  setIsDaily(daily);
  
  // タイムアタックの初期時間設定 (Easy: 2分, Medium: 3分, Hard: 5分)
  if (mode === 'time-attack') {
    setTimer(diff === 'easy' ? 120 : diff === 'medium' ? 180 : 300);
  } else {
    setTimer(0);
  }
  
  const { initial, solution } = generateHistory(diff, seed);
  // ... 各種リセット処理 ...
}, [...]);

  // 中断データの削除（新しいゲームを始めるため）
  localStorage.removeItem('sudoku-current-game');

  setTimeout(() => {
    setDifficulty(diff);
    setIsLoading(true);
    const { initial, solution } = generateSudoku(diff);
    setInitialBoard(initial.map(row => [...row]));
    setUserBoard(initial.map(row => [...row]));
    setSolution(solution);
    setMistakes(0);
    setTimer(0);
    setIsGameActive(true);
    setSelectedCell(null);
    setHistory([]);
    setMemos(Array(9).fill(null).map(() => Array(9).fill(null).map(() => [])));
    setIsLoading(false);
  }, 100);
}, [...]);
```

**解説：**

「新しいゲームを始める」ボタンを押したときに動く一連の処理です。

1. 途中のゲームがあれば「本当にやめますか？」と確認する
2. 難易度を設定してローディング表示にする
3. `generateSudoku` という機械に問題を作ってもらう
4. 盤面・正解・ミス数・タイマーなどをすべてリセットする
5. ゲーム開始フラグを立てる（`isGameActive = true`）

`setTimeout(..., 100)` の100ミリ秒待ちは、「ローディング画面をちゃんと表示させてから処理する」ための一瞬の間です。

---

### ブロック 6：アプリ起動時に一度だけゲームを始める

```tsx
useEffect(() => {
  if (!initialized.current) {
    startNewGame('medium', true);
    initialized.current = true;
  }
}, [startNewGame]);
```

**解説：**

`useEffect` は「特定のタイミングで自動実行される仕掛け」です。ここでは**アプリが最初に起動したときだけ**、中難易度のゲームを自動スタートしています。

`initialized.current` はスイッチのような役割で、「もう起動済み」というフラグを立てて2回実行されるのを防いでいます。

---

### ブロック 6.5：自動保存・中断データの読み込み

```tsx
useEffect(() => {
  if (isGameActive && !isLoading) {
    localStorage.setItem('sudoku-current-game', JSON.stringify(gameState));
  }
}, [...]);
```

**解説：**

プレイヤーが数字を入力したり、タイマーが進んだりするたびに、今のゲームの状態を「保存庫（localStorage）」に書き込んでいます。万が一ブラウザが閉じても、次に来たときに続きから遊べるようにするための重要な機能です。

起動時（ブロック6）には、まずこの保存庫を確認し、中身があればそれを読み込んで以前の状態を復元します。

---

### ブロック 7：タイマーを動かす

```tsx
useEffect(() => {
  let interval: number;
  if (isGameActive && !isSolved) {
    interval = setInterval(() => {
      setTimer(prev => {
        if (gameMode === 'time-attack') {
          if (prev <= 1) {
            handleGameOver(); // 時間切れ
            return 0;
          }
          return prev - 1; // タイムアタックはカウントダウン
        }
        return prev + 1; // 通常はカウントアップ
      });
    }, 1000);
  }
  return () => clearInterval(interval);
}, [isGameActive, gameMode, isSolved]);
```

**解説：**

ゲームが進行中（`isGameActive = true`）の間、1秒（1000ミリ秒）ごとにタイマーを1増やす仕組みです。

- `setInterval` → 「毎秒繰り返す時計のアラーム」
- `clearInterval` → 「ゲームが終わったらアラームを止める」

---

### ブロック 8：時間を「00:00」形式に変換する

```tsx
const formatTime = (seconds: number | null) => {
  if (seconds === null) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
```

**解説：**

秒数を受け取って、見やすい「分：秒」形式に変換する関数です。

- 例：`75` 秒 → `"01:15"`
- `padStart(2, '0')` は「1桁なら先頭に0をつける」処理（`5` → `"05"`）
- `null`（記録なし）の場合は `"--:--"` を返す

---

### ブロック 9：マスをクリックしたときの処理

```tsx
const handleCellClick = (row: number, col: number) => {
  setSelectedCell({ row, col });
};
```

**解説：**

盤面のマスをクリックすると「何行目・何列目を選んだか」を `selectedCell` に保存します。シンプルな処理です。

---

### ブロック 10：数字を入力したときの処理（メイン処理）

```tsx
const handleNumberInput = useCallback((num: number) => {
  if (!selectedCell || !isGameActive) return;
  ...
  if (isMemoMode) {
    // メモモードの処理
  } else {
    if (solution[row][col] === num) {
      // 正解の場合：盤面を更新、クリア判定
    } else {
      // 不正解の場合：ミス+1、3回でゲームオーバー
    }
  }
}, [...]);
```

**解説：**

数字ボタンを押したとき（またはキーボードで入力したとき）の処理です。

**メモモードONの場合：**
- 選んだマスに小さいメモ数字を追加・削除する（すでにあれば消す、なければ追加）

**通常モードの場合：**
2. **正解なら** → 盤面を更新、履歴を保存
3. **数字が揃ったら** → 列・行・ブロック、または「同じ数字すべて」が揃ったときに**キラリと光る演出**を出す
4. **全部正解** → ゲーム終了。ベストタイム・勝利数・連勝記録・実績を更新
5. **不正解なら** → **「ブルッ」と震える演出**を出し、ミスカウントを1増やす
6. **3回ミス** → ゲームオーバー

---

### ブロック 11：元に戻す機能

```tsx
const undo = useCallback(() => {
  if (history.length === 0 || !isGameActive) return;
  const previousState = history[history.length - 1];
  setUserBoard(previousState);
  setHistory(prev => prev.slice(0, -1));
}, [history, isGameActive]);
```

**解説：**

「Undo（元に戻す）」ボタンを押したときの処理です。

`history` はCDを積み重ねたイメージで、一番上（最後）を取り出すことで1手前の状態に戻ります。履歴が空の場合は何もしません。

---

### ブロック 12：ヒント機能

```tsx
const getHint = useCallback(() => {
  if (!isGameActive) return;
  // 空きマスを全て列挙
  // 選択中のマスが空なら優先、なければランダムに選ぶ
  // 履歴に保存してから正解の数字を入力する
}, [...]);
```

**解説：**

「Hint（ヒント）」ボタンを押したときの処理です。

1. 盤面の空きマスをすべてリストアップする
2. 選択中のマスが空なら、そこを優先してヒントにする
3. ランダムで空きマスを選び、`solution`（正解）の数字を自動で入力する

「元に戻す」で消せるよう、ヒントを入力する前に履歴を保存しています。

---

### ブロック 13：キーボード操作のサポート

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isGameActive) return;

    if (e.key >= '1' && e.key <= '9') {
      handleNumberInput(parseInt(e.key));
    } else if (e.key.startsWith('Arrow') && selectedCell) {
      // 矢印キーでマス移動
    } else if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) {
      undo();
    } else if (e.key.toLowerCase() === 'n') {
      setIsMemoMode(prev => !prev);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [...]);
```

**解説：**

キーボードのキーを押したときに反応する仕掛けです。

| キー | 動作 |
|---|---|
| `1`〜`9` | 数字を入力 |
| `↑↓←→` | 選択マスを移動 |
| `Ctrl+Z` / `Cmd+Z` | 元に戻す |
| `N` | メモモードON/OFF切替 |

`window.addEventListener` でキー入力の監視を始め、不要になったら `removeEventListener` で解除します（メモリの無駄使いを防ぐため）。

---

### ブロック 14：各マスの見た目を決める

```tsx
const getCellClassName = (row: number, col: number) => {
  const isSelected = ...;      // 選択中のマスか
  const isSameRow = ...;       // 同じ行か
  const isSameCol = ...;       // 同じ列か
  const isSameBlock = ...;     // 同じ3×3ブロックか
  const isInitial = ...;       // 最初から印刷された数字か
  const isSameValue = ...;     // 同じ数字か

  // 枠線の太さ（3の倍数の列・行は太く）
  // 背景色・文字色を条件に応じて設定
  return base;
};
```

**解説：**

各マスがどんな見た目になるかを計算して返す関数です。

| 条件 | 見た目 |
|---|---|
| 選択中のマス | 青く光る |
| 同じ行・列・3×3ブロック | うっすら白くハイライト |
| 同じ数字のマス | 薄い青でハイライト |
| 最初から印刷された数字 | 白・太字 |
| プレイヤーが入力した数字 | シアン色 |

3×3のブロックの境界線は `(col + 1) % 3 === 0` という計算で判定し、太い線にしています（`%` は「割り算の余り」）。

---

### ブロック 15：ローディング画面

```tsx
if (isLoading) {
  return (
    <div className="...">
      <div className="... animate-spin"></div>
      Generating Sudoku...
    </div>
  );
}
```

**解説：**

問題を生成中（`isLoading = true`）の間だけ表示されるぐるぐる回るローディング画面です。問題の生成が終わると自動的に消えて本物の画面が表示されます。

---

### ブロック 16：画面全体の描画（return 内）

```tsx
return (
  <div className="min-h-screen ...">
    {/* ヘッダー：タイトル・ベストタイム・タイマー・難易度・ミス数 */}
    <div>...</div>

    {/* 盤面：9×9のマスをループで表示 */}
    <div className="grid grid-cols-9">
      {userBoard.map((row, ri) => (
        row.map((cell, ci) => (
          <div onClick={() => handleCellClick(ri, ci)}>
            {cell !== null ? cell : <メモ小数字表示 />}
          </div>
        ))
      ))}
    </div>

    {/* コントロール：Undo・Notes・Hint */}
    {/* 数字パッド：1〜9 */}
    {/* 新しいゲームボタン：Easy・Medium・Hard */}
  </div>
);
```

**解説：**

`return (...)` の中が「実際に画面に表示される部分」です。HTMLに近い記法（JSX）で書かれています。

- **ヘッダー** → 「Sudoku」ロゴを左に、各ボタン（Stats, Daily, Best, Timer）を右にまとめて配置。見た目もグラスモーフィズムで美しく。
- **盤面** → `userBoard`（81マス）を順番にループして全マスを描画。マスが空ならメモ数字を小さく表示。クリア時は全体がキラリと光ります。
- **コントロールボタン** → Undo（元に戻す）・Notes（メモ）・Hint（ヒント）
- **数字パッド** → 1〜9のボタン（クリックで入力）。完了した数字は薄くなります。
- **難易度・モード選択** → Easy・Medium・Hard・SUPER HARD（条件で解放解）のほか、「Classic / Time Attack」のモード切り替えもここで行います。
- **統計画面＆テーマ** → 全体でのクリア数や実績バッジを確認したり、解放（アンロック）したテーマ（OceanやCyberなど）を変更できます。

---

### ブロック 16.5：アンロック（解放）システム

これらはプレイヤーのモチベーションを高めるための機能群です。

**SUPER HARD 難易度**
通常の `Hard` モードを3回クリアすると解放されます。この難易度では、数独として破綻しない（答えが1つになる）ギリギリの数まで初手で表示される数字を削っています。未解放時はメニューに「🔒」が表示されます。

**カスタムテーマ（Theme）**
UIの見た目を自由に変更できる機能です。ゲームの実績に応じて新しいテーマが解放されます：
- **Ocean（ブルー系）**：累計3ゲームクリアで解放。
- **Sunset（赤・オレンジ系）**：累計7ゲームクリアで解放。
- **Cyber（紫・ピンク系）**：3日間連続クリア（ストリーク）で解放。

これらのデータも `localStorage` に保存されるため、遊べば遊ぶほど機能が増えていく長期的な楽しさを提供します。

---

### ブロック 17：このファイルを外に公開する

```tsx
export default App;
```

**解説：**

`export default` は「この `App` という部品を他のファイルから使えるようにする」という宣言です。`index.html` → `main.tsx` → `App.tsx` という順番で呼び出され、最終的に画面に表示されます。

---

## まとめ：全体の流れ

```
アプリ起動
  └→ ゲーム自動開始（中難易度）
       └→ タイマースタート
            └→ プレイヤーが操作
                 ├→ マスをクリック → selectedCell に記録
                 ├→ 数字を入力 → 正解/不正解を判定
                 │    ├→ 正解 → 盤面更新 → 全部埋まった？ → クリア！
                 │    └→ 不正解 → ミス+1 → 3回でゲームオーバー
                 ├→ Undo → ひとつ前の状態に戻す
                 ├→ Hint → 空きマスに自動入力
                 └→ 新しいゲーム → リセットして再スタート
```
