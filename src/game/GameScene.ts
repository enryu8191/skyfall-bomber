import Phaser from "phaser";

const TILE = 32;
const COLS = 19;
const ROWS = 15;
const OX = 16;
const OY = 72;
const W = OX * 2 + COLS * TILE; // 640
const H = OY + ROWS * TILE + 16; // 568

type Cell = 0 | 1 | 2; // empty, hard, soft
type PowerKind = "bomb" | "range" | "speed";

interface Power {
  x: number;
  y: number;
  kind: PowerKind;
  gfx: Phaser.GameObjects.Container;
}

interface Bomb {
  x: number;
  y: number;
  owner: Fighter;
  range: number;
  fuse: number;
  gfx: Phaser.GameObjects.Container;
}

interface SkyDrop {
  x: number;
  y: number;
  timer: number;
  shadow: Phaser.GameObjects.Image;
}

interface Fighter {
  id: "p1" | "ai";
  x: number;
  y: number;
  px: number;
  py: number;
  alive: boolean;
  bombs: number;
  maxBombs: number;
  range: number;
  speed: number;
  gfx: Phaser.GameObjects.Container;
  moveCd: number;
  bombCd: number;
  aiThink: number;
}

export class GameScene extends Phaser.Scene {
  private grid: Cell[][] = [];
  private softGfx = new Map<string, Phaser.GameObjects.Rectangle>();
  private hardGfx = new Map<string, Phaser.GameObjects.GameObject>();
  private powers: Power[] = [];
  private bombs: Bomb[] = [];
  private sky: SkyDrop[] = [];
  private p1!: Fighter;
  private ai!: Fighter;
  private keys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    bomb: Phaser.Input.Keyboard.Key;
  };
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private hud!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private overlayTitle!: Phaser.GameObjects.Text;
  private elapsed = 0;
  private skyTimer = 0;
  private skyInterval = 4200;
  private over = false;
  private started = false;

  constructor() {
    super("Game");
  }

  preload(): void {
    this.load.image("p1-body", "axie/p1-body.png");
    this.load.image("p1-eyes", "axie/p1-eyes.png");
    this.load.image("p1-tail", "axie/p1-tail.png");
    this.load.image("ai-body", "axie/ai-body.png");
    this.load.image("ai-eyes", "axie/ai-eyes.png");
    this.load.image("ai-tail", "axie/ai-tail.png");
    this.load.image("sky-shadow", "axie/shadow.png");
    this.load.image("sky-ball", "axie/ball.png");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x1a2430);
    this.elapsed = 0;
    this.skyTimer = 0;
    this.skyInterval = 4200;
    this.over = false;
    this.powers = [];
    this.bombs = [];
    this.sky = [];
    this.softGfx.clear();
    this.hardGfx.clear();

    this.buildGrid();
    this.drawBoard();
    this.spawnFighters();
    this.bindInput();

    this.hud = this.add
      .text(W / 2, 22, "", {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "15px",
        color: "#e8f0f8",
        fontStyle: "700",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.add
      .text(W / 2, 46, "WASD / arrows move · Space bomb · R restart", {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "11px",
        color: "#8aa0b8",
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.buildOverlay();
    this.started = true;
    this.refreshHud();
  }

  update(_t: number, dt: number): void {
    if (!this.started || this.over) return;
    const d = Math.min(dt, 40);
    this.elapsed += d;
    this.tickBombs(d);
    this.tickSky(d);
    this.tickPlayer(d);
    this.tickAi(d);
    this.refreshHud();
  }

  private buildGrid(): void {
    this.grid = [];
    for (let y = 0; y < ROWS; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < COLS; x++) {
        if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
          row.push(1);
        } else if (x % 2 === 0 && y % 2 === 0) {
          row.push(1);
        } else if (this.isSpawnSafe(x, y)) {
          row.push(0);
        } else if (Math.random() < 0.72) {
          row.push(2);
        } else {
          row.push(0);
        }
      }
      this.grid.push(row);
    }
  }

  private isSpawnSafe(x: number, y: number): boolean {
    const corners = [
      [1, 1],
      [2, 1],
      [1, 2],
      [COLS - 2, ROWS - 2],
      [COLS - 3, ROWS - 2],
      [COLS - 2, ROWS - 3],
    ];
    return corners.some(([cx, cy]) => cx === x && cy === y);
  }

  private cellCenter(x: number, y: number): { px: number; py: number } {
    return {
      px: OX + x * TILE + TILE / 2,
      py: OY + y * TILE + TILE / 2,
    };
  }

  private drawBoard(): void {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const { px, py } = this.cellCenter(x, y);
        const floor = (x + y) % 2 === 0 ? 0x2a3a48 : 0x243442;
        this.add.rectangle(px, py, TILE - 1, TILE - 1, floor).setDepth(0);
        const cell = this.grid[y][x];
        if (cell === 1) {
          const hard = this.add
            .rectangle(px, py, TILE - 4, TILE - 4, 0x5a6a78)
            .setStrokeStyle(2, 0x3a4a58)
            .setDepth(2);
          this.hardGfx.set(`${x},${y}`, hard);
        } else if (cell === 2) {
          const soft = this.add
            .rectangle(px, py, TILE - 6, TILE - 6, 0xc4a574)
            .setStrokeStyle(2, 0x8a7048)
            .setDepth(2);
          this.softGfx.set(`${x},${y}`, soft);
        }
      }
    }
  }

  private spawnFighters(): void {
    this.p1 = this.makeFighter("p1", 1, 1);
    this.ai = this.makeFighter("ai", COLS - 2, ROWS - 2);
  }

  private makeFighter(id: "p1" | "ai", x: number, y: number): Fighter {
    const { px, py } = this.cellCenter(x, y);
    const prefix = id;
    const target = 28; // fit ~28px in 32 tile

    const bodyKey = `${prefix}-body`;
    const eyesKey = `${prefix}-eyes`;
    const tailKey = `${prefix}-tail`;

    const bodyTex = this.textures.get(bodyKey).getSourceImage() as HTMLImageElement;
    const bodyScale = target / Math.max(bodyTex.width, bodyTex.height);

    const tail = this.add.image(-target * 0.38, 2, tailKey).setOrigin(0.5);
    tail.setScale(bodyScale * 0.85);

    const body = this.add.image(0, 0, bodyKey).setOrigin(0.5);
    body.setScale(bodyScale);

    const eyes = this.add.image(0, -target * 0.12, eyesKey).setOrigin(0.5);
    eyes.setScale(bodyScale * 1.05);

    const gfx = this.add.container(px, py, [tail, body, eyes]).setDepth(20);
    return {
      id,
      x,
      y,
      px,
      py,
      alive: true,
      bombs: 0,
      maxBombs: 1,
      range: 1,
      speed: 1,
      gfx,
      moveCd: 0,
      bombCd: 0,
      aiThink: 0,
    };
  }

  private bindInput(): void {
    const kb = this.input.keyboard!;
    this.keys = {
      up: kb.addKey("W"),
      down: kb.addKey("S"),
      left: kb.addKey("A"),
      right: kb.addKey("D"),
      bomb: kb.addKey("SPACE"),
    };
    this.cursors = kb.createCursorKeys();
    kb.on("keydown-R", () => this.scene.restart());
  }

  private tickPlayer(dt: number): void {
    if (!this.p1.alive) return;
    this.p1.moveCd = Math.max(0, this.p1.moveCd - dt);
    this.p1.bombCd = Math.max(0, this.p1.bombCd - dt);
    if (this.p1.moveCd <= 0) {
      let dx = 0;
      let dy = 0;
      if (this.keys.left.isDown || this.cursors.left.isDown) dx = -1;
      else if (this.keys.right.isDown || this.cursors.right.isDown) dx = 1;
      else if (this.keys.up.isDown || this.cursors.up.isDown) dy = -1;
      else if (this.keys.down.isDown || this.cursors.down.isDown) dy = 1;
      if (dx || dy) {
        this.tryMove(this.p1, dx, dy);
        this.p1.moveCd = 140 / this.p1.speed;
      }
    }
    if (this.keys.bomb.isDown && this.p1.bombCd <= 0) {
      this.placeBomb(this.p1);
      this.p1.bombCd = 200;
    }
    this.pickupPowers(this.p1);
  }

  private tickAi(dt: number): void {
    if (!this.ai.alive) return;
    this.ai.moveCd = Math.max(0, this.ai.moveCd - dt);
    this.ai.bombCd = Math.max(0, this.ai.bombCd - dt);
    this.ai.aiThink -= dt;
    if (this.ai.moveCd > 0) return;

    const dirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    Phaser.Utils.Array.Shuffle(dirs);

    let best: [number, number] | null = null;
    let bestScore = -Infinity;
    for (const [dx, dy] of dirs) {
      const nx = this.ai.x + dx;
      const ny = this.ai.y + dy;
      if (!this.walkable(nx, ny)) continue;
      let score = Math.random();
      if (this.cellDanger(nx, ny)) score -= 5;
      if (this.cellDanger(this.ai.x, this.ai.y)) score += 3;
      const dist = Math.abs(nx - this.p1.x) + Math.abs(ny - this.p1.y);
      score -= dist * 0.15;
      if (score > bestScore) {
        bestScore = score;
        best = [dx, dy];
      }
    }
    if (best) this.tryMove(this.ai, best[0], best[1]);
    this.ai.moveCd = 160 / this.ai.speed;

    if (this.ai.bombCd <= 0 && Math.random() < 0.35) {
      const near =
        Math.abs(this.ai.x - this.p1.x) + Math.abs(this.ai.y - this.p1.y) <=
        this.ai.range + 1;
      const softNear = this.hasSoftNeighbor(this.ai.x, this.ai.y);
      if (near || softNear) {
        this.placeBomb(this.ai);
        this.ai.bombCd = 500;
      }
    }
    this.pickupPowers(this.ai);
  }

  private hasSoftNeighbor(x: number, y: number): boolean {
    const n = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    return n.some(([dx, dy]) => this.grid[y + dy]?.[x + dx] === 2);
  }

  private cellDanger(x: number, y: number): boolean {
    if (this.sky.some((s) => s.x === x && s.y === y)) return true;
    for (const b of this.bombs) {
      if (b.fuse > 900) continue;
      if (b.x === x && b.y === y) return true;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        for (let i = 1; i <= b.range; i++) {
          const cx = b.x + dx * i;
          const cy = b.y + dy * i;
          if (this.grid[cy]?.[cx] === 1) break;
          if (cx === x && cy === y) return true;
          if (this.grid[cy]?.[cx] === 2) break;
        }
      }
    }
    return false;
  }

  private walkable(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    if (this.grid[y][x] !== 0) return false;
    if (this.bombs.some((b) => b.x === x && b.y === y)) return false;
    return true;
  }

  private tryMove(f: Fighter, dx: number, dy: number): void {
    const nx = f.x + dx;
    const ny = f.y + dy;
    if (!this.walkable(nx, ny)) return;
    f.x = nx;
    f.y = ny;
    const c = this.cellCenter(nx, ny);
    f.px = c.px;
    f.py = c.py;
    // face direction: flip container when moving left/right
    if (dx !== 0) f.gfx.setScale(dx < 0 ? -1 : 1, 1);
    this.tweens.add({
      targets: f.gfx,
      x: f.px,
      y: f.py,
      duration: 90,
      ease: "Sine.out",
    });
  }

  private placeBomb(f: Fighter): void {
    if (!f.alive) return;
    if (f.bombs >= f.maxBombs) return;
    if (this.bombs.some((b) => b.x === f.x && b.y === f.y)) return;
    const { px, py } = this.cellCenter(f.x, f.y);
    const core = this.add.circle(0, 0, 10, 0x222222).setStrokeStyle(2, 0xffcc44);
    const fuse = this.add.circle(5, -8, 2.5, 0xff6644);
    const gfx = this.add.container(px, py, [core, fuse]).setDepth(15);
    const bomb: Bomb = {
      x: f.x,
      y: f.y,
      owner: f,
      range: f.range,
      fuse: 2000,
      gfx,
    };
    f.bombs += 1;
    this.bombs.push(bomb);
  }

  private tickBombs(dt: number): void {
    for (const b of [...this.bombs]) {
      b.fuse -= dt;
      b.gfx.setScale(1 + 0.08 * Math.sin(this.elapsed / 80));
      if (b.fuse <= 0) this.explode(b);
    }
  }

  private explode(b: Bomb): void {
    const idx = this.bombs.indexOf(b);
    if (idx >= 0) this.bombs.splice(idx, 1);
    b.owner.bombs = Math.max(0, b.owner.bombs - 1);
    b.gfx.destroy();

    const hit = new Set<string>();
    hit.add(`${b.x},${b.y}`);
    this.blastFx(b.x, b.y);

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      for (let i = 1; i <= b.range; i++) {
        const x = b.x + dx * i;
        const y = b.y + dy * i;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) break;
        if (this.grid[y][x] === 1) break;
        hit.add(`${x},${y}`);
        this.blastFx(x, y);
        if (this.grid[y][x] === 2) {
          this.destroySoft(x, y);
          break;
        }
      }
    }

    for (const f of [this.p1, this.ai]) {
      if (f.alive && hit.has(`${f.x},${f.y}`)) this.kill(f, "bomb");
    }
  }

  private destroySoft(x: number, y: number): void {
    this.grid[y][x] = 0;
    const g = this.softGfx.get(`${x},${y}`);
    if (g) {
      g.destroy();
      this.softGfx.delete(`${x},${y}`);
    }
    if (Math.random() < 0.35) this.spawnPower(x, y);
  }

  private spawnPower(x: number, y: number): void {
    const kinds: PowerKind[] = ["bomb", "range", "speed"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const colors: Record<PowerKind, number> = {
      bomb: 0xffdd55,
      range: 0x66ffaa,
      speed: 0x66aaff,
    };
    const labels: Record<PowerKind, string> = {
      bomb: "B",
      range: "R",
      speed: "S",
    };
    const { px, py } = this.cellCenter(x, y);
    const disc = this.add.circle(0, 0, 8, colors[kind]).setStrokeStyle(1, 0xffffff);
    const label = this.add
      .text(0, 0, labels[kind], {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "10px",
        color: "#102028",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    const gfx = this.add.container(px, py, [disc, label]).setDepth(8);
    this.powers.push({ x, y, kind, gfx });
  }

  private pickupPowers(f: Fighter): void {
    for (let i = this.powers.length - 1; i >= 0; i--) {
      const p = this.powers[i];
      if (p.x !== f.x || p.y !== f.y) continue;
      if (p.kind === "bomb") f.maxBombs += 1;
      if (p.kind === "range") f.range += 1;
      if (p.kind === "speed") f.speed = Math.min(2.2, f.speed + 0.25);
      p.gfx.destroy();
      this.powers.splice(i, 1);
    }
  }

  private blastFx(x: number, y: number): void {
    const { px, py } = this.cellCenter(x, y);
    const flame = this.add
      .rectangle(px, py, TILE - 8, TILE - 8, 0xff8844, 0.85)
      .setDepth(12);
    this.tweens.add({
      targets: flame,
      alpha: 0,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 280,
      onComplete: () => flame.destroy(),
    });
  }

  private tickSky(dt: number): void {
    if (this.elapsed < 8000) return;
    this.skyInterval = Math.max(1400, 4200 - (this.elapsed - 8000) * 0.08);
    this.skyTimer -= dt;
    if (this.skyTimer <= 0) {
      this.skyTimer = this.skyInterval;
      this.spawnSkyDrop();
      if (this.elapsed > 25000 && Math.random() < 0.5) this.spawnSkyDrop();
      if (this.elapsed > 45000 && Math.random() < 0.5) this.spawnSkyDrop();
    }

    for (const s of [...this.sky]) {
      s.timer -= dt;
      const pulse = 0.35 + 0.25 * Math.sin(this.elapsed / 100);
      s.shadow.setAlpha(pulse);
      if (s.timer <= 0) this.impactSky(s);
    }
  }

  private spawnSkyDrop(): void {
    const candidates: [number, number][] = [];
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (this.grid[y][x] === 1) continue;
        if (this.sky.some((s) => s.x === x && s.y === y)) continue;
        candidates.push([x, y]);
      }
    }
    if (candidates.length === 0) return;
    const [x, y] = Phaser.Utils.Array.GetRandom(candidates);
    const { px, py } = this.cellCenter(x, y);
    const shadow = this.add
      .image(px, py + 4, "sky-shadow")
      .setDisplaySize(TILE * 0.85, TILE * 0.35)
      .setAlpha(0.45)
      .setDepth(5);
    this.sky.push({ x, y, timer: 1200, shadow });
  }

  private impactSky(s: SkyDrop): void {
    const i = this.sky.indexOf(s);
    if (i >= 0) this.sky.splice(i, 1);
    s.shadow.destroy();
    const { px, py } = this.cellCenter(s.x, s.y);
    const ball = this.add
      .image(px, py - 90, "sky-ball")
      .setDisplaySize(TILE - 4, TILE - 4)
      .setDepth(25);
    this.tweens.add({
      targets: ball,
      y: py,
      duration: 180,
      ease: "Quad.in",
      onComplete: () => {
        if (this.grid[s.y][s.x] === 2) this.destroySoft(s.x, s.y);
        // remove power on cell if any
        for (let pi = this.powers.length - 1; pi >= 0; pi--) {
          const p = this.powers[pi];
          if (p.x === s.x && p.y === s.y) {
            p.gfx.destroy();
            this.powers.splice(pi, 1);
          }
        }
        if (this.grid[s.y][s.x] === 0) {
          this.grid[s.y][s.x] = 1;
          const wall = this.add
            .image(px, py, "sky-ball")
            .setDisplaySize(TILE - 4, TILE - 4)
            .setDepth(2);
          this.hardGfx.set(`${s.x},${s.y}`, wall);
        }
        ball.destroy();
        for (const f of [this.p1, this.ai]) {
          if (f.alive && f.x === s.x && f.y === s.y) this.kill(f, "skyfall");
        }
        for (const b of [...this.bombs]) {
          if (b.x === s.x && b.y === s.y) this.explode(b);
        }
      },
    });
  }

  private kill(f: Fighter, _why: string): void {
    if (!f.alive) return;
    f.alive = false;
    this.tweens.add({
      targets: f.gfx,
      alpha: 0,
      scaleX: 0.3 * Math.sign(f.gfx.scaleX || 1),
      scaleY: 0.3,
      duration: 280,
      onComplete: () => f.gfx.setVisible(false),
    });
    this.checkWin();
  }

  private checkWin(): void {
    if (this.over) return;
    if (this.p1.alive && this.ai.alive) return;
    this.over = true;
    let msg = "Draw";
    if (this.p1.alive && !this.ai.alive) msg = "You win!";
    if (!this.p1.alive && this.ai.alive) msg = "AI wins";
    if (!this.p1.alive && !this.ai.alive) msg = "Both out — skyfall chaos";
    this.showOverlay(msg);
  }

  private buildOverlay(): void {
    const bg = this.add
      .rectangle(W / 2, H / 2, 400, 160, 0x0e1520, 0.92)
      .setStrokeStyle(2, 0x6ec8ff);
    this.overlayTitle = this.add
      .text(W / 2, H / 2 - 24, "", {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "26px",
        color: "#e8f0f8",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(W / 2, H / 2 + 24, "Press R to rematch", {
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: "14px",
        color: "#8aa0b8",
      })
      .setOrigin(0.5);
    this.overlay = this.add
      .container(0, 0, [bg, this.overlayTitle, sub])
      .setDepth(100)
      .setVisible(false);
  }

  private showOverlay(msg: string): void {
    this.overlayTitle.setText(msg);
    this.overlay.setVisible(true);
  }

  private refreshHud(): void {
    const t = Math.floor(this.elapsed / 1000);
    const sky =
      this.elapsed < 8000
        ? `Skyfall in ${Math.ceil((8000 - this.elapsed) / 1000)}s`
        : "SKYFALL";
    this.hud.setText(
      `Skyfall Bomber  ·  ${t}s  ·  ${sky}\nYou B${this.p1.maxBombs} R${this.p1.range}  |  AI B${this.ai.maxBombs} R${this.ai.range}`,
    );
  }
}

export const GAME_WIDTH = W;
export const GAME_HEIGHT = H;
