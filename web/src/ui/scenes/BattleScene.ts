/**
 * The battle screen. Two modes:
 * - single: one fight from the debug picker (?debug=1), as in S1.
 * - run: the fight of the current run room. Each action goes through the run
 *   controller, so it is saved before it is animated; a fight loaded from a
 *   save goes on from the hero's turn.
 */
import Phaser from 'phaser';
import {
  battleStep,
  checkSkill,
  createBattle,
  enemyIntent,
  heroSkill,
  turnOrder,
  TURN_ORDER_LENGTH,
  type Actor,
  type BattleEvent,
  type BattleInput,
  type BattleState,
  type Step,
} from '../../core/battle';
import { gameData } from '../../core/gameData';
import { backgroundKey, spriteName } from '../assets';
import { bridge, resetBridge, tapZone } from '../bridge';
import { frame, px } from '../draw';
import { C } from '../palette';
import { controller } from '../runController';
import { GAME_WIDTH } from '../scale';
import { addText } from '../text';
import { EndPanel, floorLabel, HeroPanel, LAYOUT, SkillBar, SpeedButton, TurnRow, type MarkerInfo } from '../battle/hud';
import { consumableInfo, costLabel, enemySlots, gainLabel, initials, skillInfo, type Prompt } from '../battle/present';
import { EnemyView, HeroView } from '../battle/units';

const HERO_CLASS = 'warrior';
const HERO_SLOT = LAYOUT.hero;
const SPEEDS = [1, 2, 3] as const;

type Phase = 'busy' | 'input' | 'ended';
type Selection = { kind: 'skill'; id: string } | { kind: 'item'; slot: number } | null;
export type BattleSceneData = { mode: 'single'; encounterId: string } | { mode: 'run' };

export class BattleScene extends Phaser.Scene {
  private mode: BattleSceneData = { mode: 'run' };
  private state!: BattleState;
  private phase: Phase = 'busy';
  /** The selection: its text is shown; a second tap (or a tap on an enemy) uses it. */
  private selected: Selection = null;
  private hero!: HeroView;
  private enemies: EnemyView[] = [];
  private turnRow!: TurnRow;
  private heroPanel!: HeroPanel;
  private skillBar!: SkillBar;
  private speedButton!: SpeedButton;
  private slots: Phaser.GameObjects.GameObject[] = [];
  private slotGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super('battle');
  }

  init(data: BattleSceneData): void {
    this.mode = data;
    this.enemies = [];
    this.slots = [];
    this.phase = 'busy';
    this.selected = null;
  }

  create(): void {
    resetBridge('battle');
    const run = this.mode.mode === 'run' ? controller.run : null;
    if (this.mode.mode === 'run') {
      if (!run || run.phase.kind !== 'fight') {
        this.scene.start('run');
        return;
      }
      this.state = run.phase.battle;
    } else {
      this.state = createBattle(gameData, this.mode.encounterId, HERO_CLASS);
    }
    const encounter = gameData.encounters.find((e) => e.id === this.state.encounterId)!;
    const heroDef = gameData.classes[HERO_CLASS]!;

    const bg = backgroundKey();
    // The M1 room is 270 x 480; it stays centred until A0 makes the 360 x 640 room.
    if (bg) this.add.image(GAME_WIDTH / 2, 0, bg).setOrigin(0.5, 0);
    else this.cameras.main.setBackgroundColor(C.navy);

    const slots = enemySlots(this.state.enemies.length);
    // Draw the back row first, so that lower enemies stand in front.
    const drawOrder = this.state.enemies.map((_, i) => i).sort((a, b) => slots[a]!.ground - slots[b]!.ground);
    const views: EnemyView[] = [];
    for (const i of drawOrder) {
      const def = gameData.enemies[this.state.enemies[i]!.id]!;
      views[i] = new EnemyView(this, slots[i]!, def.name, spriteName(def), def.boss);
    }
    this.enemies = views;
    this.enemies.forEach((view, i) => tapZone(this, `enemy:${i}`, view.hitRect(), () => this.onEnemy(i)));
    this.hero = new HeroView(this, HERO_SLOT, heroDef.name, spriteName(heroDef));

    this.turnRow = new TurnRow(this);
    floorLabel(this, encounter.floor);
    this.speedButton = new SpeedButton(this, this.speed, () => this.cycleSpeed());
    this.heroPanel = new HeroPanel(this, heroDef.name, spriteName(heroDef), gameData.rules.rageMax);
    this.skillBar = new SkillBar(this, this.state.hero.skills, (id) => this.onSkill(id));
    this.slotGraphics = this.add.graphics();
    if (run) {
      this.state.hero.consumables.forEach((_, i) => {
        const s = LAYOUT.slots;
        tapZone(this, `item:${i}`, { x: s.x + i * (s.size + s.gap), y: s.y, w: s.size, h: s.size }, () => this.onItem(i));
      });
      this.drawGear();
    }

    this.selected = { kind: 'skill', id: heroDef.signatureSkill };
    this.sync();
    if (this.state.status === 'start') void this.act({ kind: 'begin' });
    else void this.run({ state: this.state, events: [] });
  }

  // ---- speed ------------------------------------------------------------------

  private get speed(): number {
    return (this.registry.get('speed') as number | undefined) ?? 1;
  }

  private cycleSpeed(): void {
    const next = SPEEDS[(SPEEDS.indexOf(this.speed as 1 | 2 | 3) + 1) % SPEEDS.length]!;
    this.registry.set('speed', next);
    this.speedButton.show(next);
  }

  /** Animation time: the speed control changes only this. */
  private ms(base: number): number {
    return base / this.speed;
  }

  private wait(base: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(this.ms(base), resolve));
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...config, duration: this.ms(config.duration ?? 100), onComplete: () => resolve() });
    });
  }

  // ---- input ------------------------------------------------------------------

  /** What the next tap does for the selection, if it can be used now. */
  private prompt(): Prompt {
    const sel = this.selected;
    if (this.phase !== 'input' || sel === null) return null;
    if (sel.kind === 'item') {
      const usable =
        this.state.hero.consumables[sel.slot] != null && this.state.hero.consumablesUsed < gameData.consumables.maxPerTurn;
      return usable ? 'again' : null;
    }
    if (checkSkill(gameData, this.state, sel.id) !== 'ok') return null;
    return heroSkill(gameData, this.state.hero, sel.id).target === 'enemy' ? 'enemy' : 'again';
  }

  private isSelected(sel: Selection): boolean {
    return JSON.stringify(sel) === JSON.stringify(this.selected);
  }

  private onSkill(id: string): void {
    if (this.phase !== 'input') return;
    // First tap: select the skill and show its text. Second tap: use it (HANDOFF S2).
    if (this.isSelected({ kind: 'skill', id }) && this.prompt() === 'again') {
      void this.act({ kind: 'skill', skill: id, target: null });
      return;
    }
    this.selected = { kind: 'skill', id };
    this.refreshControls();
  }

  private onItem(slot: number): void {
    if (this.phase !== 'input') return;
    if (this.isSelected({ kind: 'item', slot }) && this.prompt() === 'again') {
      void this.act({ kind: 'consumable', slot });
      return;
    }
    this.selected = { kind: 'item', slot };
    this.refreshControls();
  }

  private onEnemy(index: number): void {
    const sel = this.selected;
    if (this.prompt() !== 'enemy' || sel?.kind !== 'skill' || (this.state.enemies[index]?.hp ?? 0) <= 0) return;
    void this.act({ kind: 'skill', skill: sel.id, target: index });
  }

  private async act(input: BattleInput): Promise<void> {
    if (this.mode.mode === 'single') {
      await this.run(battleStep(gameData, this.state, input));
      return;
    }
    const applied = controller.apply({ kind: 'battle', input });
    await this.run({ state: applied.battle!, events: applied.events });
  }

  // ---- playing a step -----------------------------------------------------------

  private async run(step: Step): Promise<void> {
    this.phase = 'busy';
    bridge.ready = false;
    // The views show the new state at the end; the events carry the values in between.
    this.state = step.state;
    this.refreshControls();
    await this.play(step.events);
    bridge.state = this.state;
    this.sync();
    if (this.state.status === 'heroTurn') {
      this.phase = 'input';
      // Each turn starts with the signature skill (Slash) selected, so one tap on an enemy attacks.
      const signature = gameData.classes[HERO_CLASS]!.signatureSkill;
      if (checkSkill(gameData, this.state, signature) === 'ok' && this.prompt() === null) this.selected = { kind: 'skill', id: signature };
      this.refreshControls();
      bridge.ready = true;
      return;
    }
    this.phase = 'ended';
    if (this.mode.mode === 'run') {
      // The run screen shows the reward, or the run summary.
      this.scene.start('run');
      return;
    }
    this.showEnd();
    bridge.ready = true;
  }

  private async play(events: readonly BattleEvent[]): Promise<void> {
    let actor: Actor = 'hero';
    for (const e of events) {
      switch (e.type) {
        case 'turn':
          actor = e.actor;
          this.turnRow.show(this.markers(e.order));
          if (e.actor !== 'hero') await this.wait(220);
          break;
        case 'skill': {
          const info = skillInfo(gameData, this.state, e.skill, null);
          this.skillBar.info({ ...info, status: '' });
          this.float(HERO_SLOT.x, this.hero.body.top - 12, info.title, C.cream);
          await this.tween({ targets: this.hero.body.root, y: HERO_SLOT.ground - 8, duration: 90, yoyo: true });
          break;
        }
        case 'consumable': {
          const label = gainLabel(gameData, { kind: 'consumable', id: e.id });
          this.skillBar.info({ title: label.title, status: '', tone: 'ok', text: label.text });
          this.float(HERO_SLOT.x, this.hero.body.top - 12, label.title, C.cream);
          this.drawSlots();
          await this.wait(250);
          break;
        }
        case 'enemyAction':
          await this.enemyAction(e.actor, e.action);
          break;
        case 'damage':
          await this.damage(e.target, e.amount, e.hp);
          break;
        case 'defeated':
          if (e.target !== 'hero') await this.defeat(e.target);
          break;
        case 'heal':
          this.heroPanel.setHp(e.hp);
          this.float(HERO_SLOT.x, this.hero.body.top + 6, `+${e.amount}`, C.lime);
          await this.wait(200);
          break;
        case 'gauge':
          this.float(HERO_SLOT.x, this.hero.body.top - 24, 'Haste', C.cyan);
          this.turnRow.show(this.markers(turnOrder(gameData, this.state, TURN_ORDER_LENGTH)));
          break;
        case 'rage': {
          // Show a drain by an enemy; the hero's own Rage costs need no note.
          const drained = this.heroPanel.rageValue - e.rage;
          if (actor !== 'hero' && drained > 0) this.float(HERO_SLOT.x, this.hero.body.top - 24, `-${drained} Rage`, C.orange);
          this.heroPanel.setRage(e.rage);
          break;
        }
        case 'knockback':
          this.float(HERO_SLOT.x, this.hero.body.top - 12, 'Pushed back', C.magenta);
          await this.wait(300);
          break;
        case 'guard':
          this.heroPanel.setGuard(e.active);
          if (e.active) this.float(HERO_SLOT.x, this.hero.body.top - 24, 'Guard', C.cyan);
          break;
        case 'atkUp':
          this.heroPanel.setAtkUp(e.actions);
          break;
        case 'telegraph':
          this.enemies[e.actor]?.setWarning(this, warningText(e.action));
          await this.wait(400);
          break;
        case 'end':
          if (this.mode.mode === 'run') this.float(GAME_WIDTH / 2, 200, e.outcome === 'won' ? 'Victory' : 'Defeat', e.outcome === 'won' ? C.gold : C.red);
          await this.wait(this.mode.mode === 'run' ? 900 : 500);
          break;
      }
    }
  }

  private async enemyAction(index: number, action: string): Promise<void> {
    const view = this.enemies[index]!;
    view.setWarning(this, null);
    if (action === 'hex') {
      this.float(view.slot.x, view.body.top - 12, 'Hex', C.magenta);
      await this.tween({ targets: view.body.root, y: view.slot.ground - 4, duration: 120, yoyo: true });
      return;
    }
    if (action === 'crush') {
      this.float(view.slot.x, view.body.top - 12, 'Crush!', C.red);
      await this.tween({ targets: view.body.root, y: view.slot.ground + 14, duration: 160, yoyo: true, ease: 'Quad.easeIn' });
      this.cameras.main.shake(this.ms(200), 0.01);
      return;
    }
    await this.tween({ targets: view.body.root, y: view.slot.ground + 6, duration: 90, yoyo: true });
  }

  private async damage(target: Actor, amount: number, hp: number): Promise<void> {
    if (target === 'hero') {
      this.hero.body.flash(this, this.ms(90));
      this.heroPanel.setHp(hp);
      this.float(HERO_SLOT.x, this.hero.body.top + 6, `${amount}`, C.pink);
    } else {
      const view = this.enemies[target]!;
      const enemy = this.state.enemies[target]!;
      view.body.flash(this, this.ms(90));
      view.setHp(hp, enemy.maxHp);
      this.float(view.slot.x, view.body.top + 10, `${amount}`, C.white);
    }
    await this.wait(260);
  }

  private async defeat(index: number): Promise<void> {
    const view = this.enemies[index]!;
    for (let i = 0; i < 3; i++) {
      view.body.root.setVisible(false);
      await this.wait(70);
      view.body.root.setVisible(true);
      await this.wait(70);
    }
    view.hide();
  }

  /** A short text that rises over a unit and goes away. */
  private float(x: number, y: number, text: string, color: number): void {
    const t = addText(this, x, y, text, { color, align: 'center' });
    this.tweens.add({
      targets: t,
      y: y - 10,
      duration: this.ms(450),
      ease: 'Cubic.easeOut',
      onComplete: () => this.time.delayedCall(this.ms(250), () => t.destroy()),
    });
  }

  // ---- showing the state ------------------------------------------------------------

  private markers(order: readonly Actor[]): MarkerInfo[] {
    const warned = new Set<number>();
    return order.map((actor) => {
      if (actor === 'hero') {
        const def = gameData.classes[HERO_CLASS]!;
        return { side: 'hero', sprite: spriteName(def), name: def.name, warn: false };
      }
      const def = gameData.enemies[this.state.enemies[actor]!.id]!;
      // Mark the enemy's next turn only.
      const warn = !warned.has(actor) && this.state.enemies[actor]!.hp > 0 && enemyIntent(gameData, this.state, actor).telegraph;
      warned.add(actor);
      return { side: 'enemy', sprite: spriteName(def), name: def.name, warn };
    });
  }

  /** The worn items, one column for each slot (run mode). */
  private drawGear(): void {
    const run = controller.run;
    if (!run) return;
    const slots = ['weapon', 'armor', 'relic'] as const;
    slots.forEach((slot, i) => {
      const id = run.hero.items[slot];
      const x = LAYOUT.equipment.columns[i]!;
      const name = id ? gameData.items[id]!.name : '-';
      addText(this, x, LAYOUT.equipment.y, name, { color: id ? C.silver : C.slate });
      if (id) {
        tapZone(this, `gear:${slot}`, { x, y: LAYOUT.equipment.y - 2, w: 112, h: 12 }, () => {
          if (this.phase !== 'input') return;
          const label = gainLabel(gameData, { kind: 'item', id });
          this.skillBar.info({ title: label.title, status: label.kind, tone: 'muted', text: label.text });
        });
      }
    });
  }

  /** The consumable slots (run mode). */
  private drawSlots(): void {
    for (const o of this.slots) o.destroy();
    this.slots = [];
    const g = this.slotGraphics;
    g.clear();
    if (this.mode.mode !== 'run') return;
    const s = LAYOUT.slots;
    this.state.hero.consumables.forEach((id, i) => {
      const x = s.x + i * (s.size + s.gap);
      const selected = this.isSelected({ kind: 'item', slot: i }) && this.phase === 'input';
      frame(g, x, s.y, s.size, s.size, selected ? 'buttonSelected' : 'inset');
      px(g, x + 2, s.y + 2, s.size - 4, s.size - 4, C.navy);
      if (id) {
        const name = gameData.consumables.items[id]!.name;
        this.slots.push(addText(this, x + s.size / 2, s.y + 8, initials(name), { color: C.cream, align: 'center' }));
      }
    });
  }

  /** Make every view match the state. */
  private sync(): void {
    const s = this.state;
    this.heroPanel.sync(s.hero);
    s.enemies.forEach((e, i) => {
      const view = this.enemies[i]!;
      if (e.hp <= 0) {
        view.hide();
        return;
      }
      view.setHp(e.hp, e.maxHp);
      const intent = enemyIntent(gameData, s, i);
      view.setWarning(this, intent.telegraph ? warningText(intent.action) : null);
    });
    this.turnRow.show(this.markers(turnOrder(gameData, s, TURN_ORDER_LENGTH)));
    this.refreshControls();
  }

  private refreshControls(): void {
    const s = this.state;
    const inTurn = this.phase === 'input';
    this.skillBar.show(
      s.hero.skills.map((id, k) => {
        const check = checkSkill(gameData, s, id);
        const skill = heroSkill(gameData, s.hero, id);
        return {
          skill,
          upgraded: s.hero.upgraded.includes(id),
          selected: inTurn && this.isSelected({ kind: 'skill', id }) && check === 'ok',
          usable: check === 'ok' || (check === 'notHeroTurn' && s.status !== 'won' && s.status !== 'lost'),
          cooldown: Math.max(0, s.hero.cooldowns[k] ?? 0),
          noRage: check === 'rage',
          cost: costLabel(skill),
        };
      }),
    );
    this.drawSlots();
    const prompt = this.prompt();
    const sel = this.selected;
    if (sel?.kind === 'skill') this.skillBar.info(skillInfo(gameData, s, sel.id, prompt));
    if (sel?.kind === 'item') this.skillBar.info(consumableInfo(gameData, s, sel.slot, prompt));
    this.enemies.forEach((view, i) => view.setTargetable(prompt === 'enemy' && (s.enemies[i]?.hp ?? 0) > 0));
  }

  private showEnd(): void {
    const s = this.state;
    const won = s.status === 'won';
    const lines = [`Turns ${s.hero.turns}`, `HP ${s.hero.hp}/${s.hero.maxHp}`, `Rage ${s.hero.rage}`];
    const encounterId = s.encounterId;
    new EndPanel(
      this,
      won,
      lines,
      () => this.scene.restart({ mode: 'single', encounterId }),
      () => this.scene.start('picker'),
    );
  }
}

function warningText(action: string): string {
  return action === 'crush' ? 'Crush next!' : `${action[0]!.toUpperCase()}${action.slice(1)} next!`;
}
