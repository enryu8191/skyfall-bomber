import Phaser from "phaser";
import { GameScene, GAME_WIDTH, GAME_HEIGHT } from "./game/GameScene";

const parent = document.getElementById("game") ?? undefined;

new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1a2430",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});
