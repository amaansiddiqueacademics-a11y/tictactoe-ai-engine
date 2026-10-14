# Tic-Tac-Toe AI Engine: Minimax vs Alpha-Beta

A dependency-free Tic-Tac-Toe game that pits two search algorithms against each other. **Standard Minimax** and **Alpha-Beta Pruning** pick the same optimal move, but Alpha-Beta searches far fewer nodes. The app plays the game and measures that difference.

## Features

- Play **Player vs AI** or **Player vs Player**
- Choose who moves first and which AI algorithm to use
- Live scoreboard (X wins, O wins, draws)
- Per-move metrics: nodes visited and time taken
- **Compare** button that runs both algorithms on the current position and reports the search savings

## Project Structure

| File | Purpose |
|------|---------|
| `index.html` | Game page (entry point) |
| `style.css` | Styling |
| `game.js` | Board state, rules, win/draw detection |
| `minimax.js` | Standard Minimax search |
| `alphabeta.js` | Minimax with Alpha-Beta pruning |
| `metrics.js` | Benchmark and comparison helpers |
| `ui.js`, `main.js` | Rendering and app wiring |
| `checks.js`, `checks.html` | Gate tests for the pure core |

## How to Play

1. Open `index.html` in any modern browser. No build step or server is needed.
2. Pick a **Mode**, who **Moves first**, and the **AI algorithm**.
3. Click a square to place your mark (you are X).
4. Read the **Last AI move** and **This Game** panels to see nodes searched and time taken.
5. Click **Compare** to benchmark Minimax against Alpha-Beta on the same position.
6. Use **New Game** to restart, or **Reset Scores** to clear the scoreboard.

## Running the Gate Tests

`checks.js` tests the pure core (`game.js`, `minimax.js`, `alphabeta.js`, `metrics.js`). Modules that don't exist yet are skipped and reported.

**Node.js:**

```bash
node checks.js
```

**Browser:** open `checks.html` and read the results in the developer console (F12).

The output lists passed and failed checks, and any skipped modules.

## How the Algorithms Differ

- **Minimax** explores the whole game tree to find the optimal move.
- **Alpha-Beta** returns the same result, but prunes branches that cannot affect the final decision. This usually cuts the nodes visited substantially.

## License

No license has been specified yet.
