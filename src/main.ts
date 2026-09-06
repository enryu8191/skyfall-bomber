import Phaser from "phaser";
import { GameScene } from "./game/GameScene";

const parent = document.getElementById("game") ?? undefined;

new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: 720,
  height: 800,
  backgroundColor: "#1a2430",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});
