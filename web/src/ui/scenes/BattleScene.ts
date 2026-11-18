import Phaser from 'phaser';
import {
  battleStep,
  checkSkill,
  createBattle,
  enemyIntent,
  turnOrder,
  TURN_ORDER_LENGTH,
  type Actor,
  type BattleEvent,
  type BattleState,
  type Step,
} from '../../core/battle';
import { gameData } from '../../core/gameData';
import { backgroundKey, spriteName } from '../assets';
import { bridge, resetBridge, tapZone } from '../bridge';
import { C } from '../palette';
import { GAME_WIDTH } from '../scale';
import { addText } from '../text';
import { EndPanel, floorLabel, HeroPanel, LAYOUT, SkillBar, SpeedButton, TurnRow, type MarkerInfo } from '../battle/hud';
import { costLabel, enemySlots, skillInfo, type Prompt } from '../battle/present';
import { EnemyView, HeroView } from '../battle/units';

/** S1 has one hero class. */
const HERO_CLASS = 'warrior';
const HERO_SLOT = LAYOUT.hero;
const SPEEDS = [1, 2, 3] as const;

type Phase = 'busy' | 'input' | 'ended';

export class BattleScene extends Phaser.Scene {
  private encounterId = '';
  private state!: BattleState;
  private phase: Phase = 'busy';
  /**
   * The selected skill: its text is shown. A second tap on it uses it, or a tap on
   * an enemy for a skill that needs a target (HANDOFF S2: two taps for each skill).
   */
  private selected: string | null = null;
  private hero!: HeroView;
  private enemies: EnemyView[] = [];
  private turnRow!: TurnRow;
  private heroPanel!: HeroPanel;
  private skillBar!: SkillBar;
  private speedButton!: SpeedButton;

  constructor() {
    super('battle');
  }

  init(data: { encounterId: string }): void {
    this.encounterId = data.encounterId;
    this.enemies = [];
    this.phase = 'busy';
  }

  create(): void {
    resetBridge('battle');
    this.state = createBattle(gameData, this.encounterId, HERO_CLASS);
    const encounter = gameData.encounters.find((e) => e.id === this.encounterId)!;
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

    this.selected = heroDef.signatureSkill;
    this.sync();
    void this.run(battleStep(gameData, this.state, { kind: 'begin' }));
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

  /** The prompt for the selected skill: what the next tap does, if it can be used now. */
  private prompt(): Prompt {
    const id = this.selected;
    if (this.phase !== 'input' || id === null || checkSkill(gameData, this.state, id) !== 'ok') return null;
    return gameData.skills[id]!.target === 'enemy' ? 'enemy' : 'again';
  }

  private onSkill(id: string): void {
    if (this.phase !== 'input') return;
    // First tap: select the skill and show its text. Second tap: use it.
    if (this.selected === id && this.prompt() === 'again') {
      this.act(id, null);
      return;
    }
    this.selected = id;
    this.refreshControls();
  }

  private onEnemy(index: number): void {
    if (this.prompt() !== 'enemy' || (this.state.enemies[index]?.hp ?? 0) <= 0) return;
    this.act(this.selected!, index);
  }

  private act(skill: string, target: number | null): void {
    void this.run(battleStep(gameData, this.state, { kind: 'skill', skill, target }));
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
      if (checkSkill(gameData, this.state, signature) === 'ok') this.selected = signature;
      this.refreshControls();
    } else {
      this.phase = 'ended';
      this.showEnd();
    }
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
        case 'skill':
          this.skillBar.info({ ...skillInfo(gameData, this.state, e.skill, null), status: '' });
          this.float(HERO_SLOT.x, this.hero.body.top - 12, gameData.skills[e.skill]!.name, C.cream);
          await this.tween({ targets: this.hero.body.root, y: HERO_SLOT.ground - 8, duration: 90, yoyo: true });
          break;
        case 'enemyAction':
          await this.enemyAction(e.actor, e.action);
          break;
        case 'damage':
          await this.damage(e.target, e.amount, e.hp);
          break;
        case 'defeated':
          if (e.target !== 'hero') await this.defeat(e.target);
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
          await this.wait(500);
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
        const skill = gameData.skills[id]!;
        return {
          skill,
          upgraded: false,
          selected: inTurn && this.selected === id && check === 'ok',
          usable: check === 'ok' || (check === 'notHeroTurn' && s.status !== 'won' && s.status !== 'lost'),
          cooldown: Math.max(0, s.hero.cooldowns[k] ?? 0),
          noRage: check === 'rage',
          cost: costLabel(skill),
        };
      }),
    );
    const prompt = this.prompt();
    if (this.selected) this.skillBar.info(skillInfo(gameData, s, this.selected, prompt));
    this.enemies.forEach((view, i) => view.setTargetable(prompt === 'enemy' && (s.enemies[i]?.hp ?? 0) > 0));
  }

  private showEnd(): void {
    const s = this.state;
    const won = s.status === 'won';
    const lines = [`Turns ${s.hero.turns}`, `HP ${s.hero.hp}/${s.hero.maxHp}`, `Rage ${s.hero.rage}`];
    new EndPanel(
      this,
      won,
      lines,
      () => this.scene.restart({ encounterId: this.encounterId }),
      () => this.scene.start('picker'),
    );
  }
}

function warningText(action: string): string {
  return action === 'crush' ? 'Crush next!' : `${action[0]!.toUpperCase()}${action.slice(1)} next!`;
}
