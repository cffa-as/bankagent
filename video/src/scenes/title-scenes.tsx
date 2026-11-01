import {Video} from '@remotion/media'
import {AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion'
import {Canvas, Lockup, Mark, clamp} from '../components/brand'
import {ChapterChip, DemoDisclosure, TONE} from '../components/chapter'
import {Subtitles} from '../components/subtitles'
import {CLIPS, EVIDENCE, NARRATION, placeBeats, type FilmScene, type Tone} from '../film-plan'
import {COLORS, FONTS} from '../theme'

const ease = {...clamp, easing: Easing.out(Easing.cubic)}

function useSeconds() {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  return frame / fps
}

/** Absolute scene time of sentence `index` in the scene's first narration beat. */
function sentenceAt(scene: FilmScene, index: number) {
  const beat = placeBeats(scene)[0]
  return beat.start + (NARRATION[beat.id]?.sentences[index]?.start ?? 0)
}

/** Index of the sentence being spoken, or -1 before the first one starts. */
function activeSentence(scene: FilmScene, seconds: number, count: number) {
  let active = -1
  for (let index = 0; index < count; index++) if (seconds >= sentenceAt(scene, index) - 0.1) active = index
  return active
}

const appear = (seconds: number, at: number, length = 0.6) => interpolate(seconds, [at, at + length], [0, 1], ease)

const SceneExit = ({durationInFrames, children}: {durationInFrames: number; children: React.ReactNode}) => {
  const frame = useCurrentFrame()
  return <AbsoluteFill style={{opacity: interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], clamp)}}>{children}</AbsoluteFill>
}

const Eyebrow = ({children, color = COLORS.steel}: {children: React.ReactNode; color?: string}) => (
  <div style={{color, fontFamily: FONTS.sans, fontSize: 20, fontWeight: 700, letterSpacing: '0.22em'}}>{children}</div>
)

export const IntroScene = ({scene, durationInFrames}: {scene: FilmScene; durationInFrames: number}) => {
  const seconds = useSeconds()
  const mark = appear(seconds, 0.3, 0.9)
  const s = [0, 1].map((index) => sentenceAt(scene, index))
  const first = appear(seconds, s[0] + 0.1, 0.7)
  const second = appear(seconds, s[1] - 0.1, 0.7)
  return (
    <Canvas>
      <SceneExit durationInFrames={durationInFrames}>
        <AbsoluteFill style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 84, justifyContent: 'center'}}>
          <div style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 26, opacity: mark, transform: `translateY(${(1 - mark) * 16}px)`}}>
            <Lockup size={74} />
            <Eyebrow>受控执行的银行 AGENT 工作台</Eyebrow>
          </div>
          <div style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 22}}>
            <div style={{color: COLORS.platinum, fontFamily: FONTS.sans, fontSize: 60, fontWeight: 800, opacity: first, transform: `translateY(${(1 - first) * 12}px)`}}>
              难点不是会不会聊天
            </div>
            <div style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 60, fontWeight: 900, opacity: second, transform: `translateY(${(1 - second) * 12}px)`}}>
              而是能否<span style={{color: COLORS.cobalt}}>按权限分级</span>，安全地动钱
            </div>
          </div>
        </AbsoluteFill>
        <Subtitles beats={placeBeats(scene)} />
      </SceneExit>
    </Canvas>
  )
}

const BlockedArrow = () => (
  <span style={{alignItems: 'center', display: 'flex', height: 24, position: 'relative', width: 64}}>
    <span style={{background: COLORS.steel, height: 2, width: '100%'}} />
    {[45, -45].map((angle) => (
      <span key={angle} style={{background: COLORS.red, borderRadius: 2, height: 4, left: 22, position: 'absolute', top: 10, transform: `rotate(${angle}deg)`, width: 22}} />
    ))}
  </span>
)

const MENU = ['首页', '转账汇款', '预约转账', '选择收款人', '填写金额与用途', '安全验证']

const DilemmaCard = ({title, caption, tone, children, p}: {title: string; caption: string; tone: Tone; children: React.ReactNode; p: number}) => (
  <div
    style={{
      background: COLORS.panel,
      border: `1px solid ${COLORS.line}`,
      borderRadius: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 28,
      height: 560,
      opacity: p,
      padding: '36px 40px',
      transform: `translateY(${(1 - p) * 24}px)`,
      width: 640,
    }}
  >
    <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
      <span style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 36, fontWeight: 800}}>{title}</span>
      <span style={{color: TONE[tone], fontFamily: FONTS.sans, fontSize: 22, fontWeight: 700, letterSpacing: '0.06em'}}>{caption}</span>
    </div>
    {children}
  </div>
)

const PROMISE_LINE: {label: string; color: string; x: number}[] = [
  {label: '模型提议', color: COLORS.platinum, x: 0.08},
  {label: '服务端裁决', color: COLORS.cobalt, x: 0.5},
  {label: '回执证明结果', color: COLORS.teal, x: 0.92},
]

const BoundaryLine = ({seconds, at}: {seconds: number; at: number}) => {
  const draw = interpolate(seconds, [at, at + 1.4], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)})
  return (
    <div style={{height: 120, position: 'relative', width: 1240}}>
      <div style={{background: COLORS.line, height: 2, left: 0, position: 'absolute', right: 0, top: 30}} />
      <div style={{background: `linear-gradient(90deg, ${COLORS.platinum}, ${COLORS.cobalt}, ${COLORS.teal})`, height: 2, left: 0, position: 'absolute', top: 30, width: `${draw * 100}%`}} />
      {PROMISE_LINE.map((part, index) => {
        const p = appear(seconds, at + 0.6 + index * 0.55, 0.5)
        return (
          <div
            key={part.label}
            style={{
              alignItems: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
              left: `${part.x * 100}%`,
              opacity: p,
              position: 'absolute',
              top: 22,
              transform: `translate(-50%, ${(1 - p) * 10}px)`,
            }}
          >
            <span style={{background: COLORS.navy, border: `3px solid ${part.color}`, borderRadius: 99, height: 18, width: 18}} />
            <span style={{color: part.color, fontFamily: FONTS.sans, fontSize: 38, fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap'}}>{part.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export const ProblemScene = ({scene, durationInFrames}: {scene: FilmScene; durationInFrames: number}) => {
  const seconds = useSeconds()
  const s = [0, 1, 2].map((index) => sentenceAt(scene, index))
  const dilemma = interpolate(seconds, [s[0] - 0.4, s[0] + 0.2, s[2] - 0.6, s[2] - 0.1], [0, 1, 1, 0], ease)
  const answer = appear(seconds, s[2] - 0.1, 0.7)

  return (
    <Canvas>
      <SceneExit durationInFrames={durationInFrames}>
        {dilemma > 0 && (
          <AbsoluteFill style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 36, justifyContent: 'center', opacity: dilemma, paddingBottom: 60}}>
            <Eyebrow>为什么现有方式都不够</Eyebrow>
            <div style={{display: 'flex', gap: 56}}>
              <DilemmaCard title="传统银行入口" caption="入口深 · 层层查找" tone="amber" p={appear(seconds, s[0])}>
                <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                  {MENU.map((item, index) => {
                    const p = appear(seconds, s[0] + 0.3 + index * 0.35, 0.35)
                    const last = index === MENU.length - 1
                    return (
                      <div key={item} style={{alignItems: 'center', display: 'flex', gap: 14, opacity: p, paddingLeft: index * 26}}>
                        <span style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 22}}>{index === 0 ? '' : '›'}</span>
                        <span
                          style={{
                            background: last ? `${COLORS.amber}22` : 'rgba(183, 201, 226, 0.08)',
                            borderRadius: 10,
                            color: last ? COLORS.amber : COLORS.platinum,
                            fontFamily: FONTS.sans,
                            fontSize: 24,
                            fontWeight: 600,
                            padding: '7px 16px',
                          }}
                        >
                          {item}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </DilemmaCard>
              <DilemmaCard title="通用 Agent" caption="能理解需求 · 不能直接拿到资金权限" tone="red" p={appear(seconds, s[1] - 0.2)}>
                <div style={{display: 'flex', flexDirection: 'column', gap: 28}}>
                  <div
                    style={{
                      alignSelf: 'flex-end',
                      background: COLORS.cobalt,
                      borderRadius: '20px 20px 6px 20px',
                      color: COLORS.white,
                      fontFamily: FONTS.sans,
                      fontSize: 26,
                      fontWeight: 600,
                      opacity: appear(seconds, s[1] + 0.3),
                      padding: '16px 22px',
                    }}
                  >
                    帮我把房租和装修的钱安排一下
                  </div>
                  <div style={{alignItems: 'center', display: 'flex', gap: 18, opacity: appear(seconds, s[1] + 1.2)}}>
                    <span style={{background: 'rgba(183, 201, 226, 0.08)', borderRadius: 12, color: COLORS.platinum, fontFamily: FONTS.sans, fontSize: 24, fontWeight: 600, padding: '12px 18px'}}>
                      模型直接调用转账
                    </span>
                    <BlockedArrow />
                    <span style={{border: `1px dashed ${COLORS.red}`, borderRadius: 12, color: COLORS.red, fontFamily: FONTS.sans, fontSize: 24, fontWeight: 700, padding: '12px 18px'}}>
                      资金权限
                    </span>
                  </div>
                  <div style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 22, lineHeight: 1.5, opacity: appear(seconds, s[1] + 2)}}>
                    模型输出不可预测，单靠提示词无法守住资金边界
                  </div>
                </div>
              </DilemmaCard>
            </div>
          </AbsoluteFill>
        )}

        {answer > 0 && (
          <AbsoluteFill style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 56, justifyContent: 'center', opacity: answer, paddingBottom: 60}}>
            <div style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 26}}>
              <Lockup size={56} />
              <Eyebrow>资金动作的可信执行层</Eyebrow>
            </div>
            <BoundaryLine seconds={seconds} at={s[2] + 0.4} />
          </AbsoluteFill>
        )}
        <Subtitles beats={placeBeats(scene)} />
      </SceneExit>
    </Canvas>
  )
}

const TIER_COLUMNS: {tone: Tone; name: string; strategy: string; ops: string[]; gate: string}[] = [
  {tone: 'green', name: '绿色', strategy: '自动执行', ops: ['余额查询', '交易记录查询', '账单分析', '理财收益查询'], gate: '纯查询 · 确认意图后直接执行'},
  {tone: 'amber', name: '黄色', strategy: '用户确认', ops: ['小额转账（日累计 ≤ 1000 元）', '订阅取消', '虚拟卡申请', '卡片临时冻结'], gate: '展示动作快照 · 明确确认后执行'},
  {tone: 'red', name: '红色', strategy: '强验证', ops: ['大额转账（日累计 > 1000 元）', '卡片挂失 / 解挂', '卡片额度调整', '理财申购 / 赎回'], gate: '动作绑定 MFA · 演示用动态验证码'},
]

export const TiersScene = ({scene, durationInFrames}: {scene: FilmScene; durationInFrames: number}) => {
  const seconds = useSeconds()
  const ruleIndex = (NARRATION[placeBeats(scene)[0].id]?.sentences.length ?? 5) - 1
  const active = activeSentence(scene, seconds, ruleIndex + 1)
  const litColumn = active >= 1 && active < ruleIndex ? Math.min(active, TIER_COLUMNS.length) - 1 : -1
  const rule = appear(seconds, sentenceAt(scene, ruleIndex), 0.6)
  return (
    <Canvas>
      <SceneExit durationInFrames={durationInFrames}>
        <AbsoluteFill style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 44, justifyContent: 'center', paddingTop: 70}}>
          <div style={{display: 'flex', gap: 36}}>
            {TIER_COLUMNS.map((column, index) => {
              const p = appear(seconds, 0.4 + index * 0.25, 0.7)
              const lit = litColumn === index
              const dim = litColumn >= 0 && !lit
              const color = TONE[column.tone]
              return (
                <div
                  key={column.name}
                  style={{
                    background: lit ? `${color}14` : COLORS.panel,
                    border: `2px solid ${lit ? color : COLORS.line}`,
                    borderRadius: 24,
                    boxShadow: lit ? `0 0 0 8px ${color}1f, 0 30px 80px rgba(0, 0, 0, 0.35)` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 26,
                    opacity: p * (dim ? 0.45 : 1),
                    padding: '34px 36px',
                    transform: `translateY(${(1 - p) * 20}px)`,
                    width: 500,
                  }}
                >
                  <div style={{alignItems: 'center', display: 'flex', gap: 16}}>
                    <span style={{background: color, borderRadius: 99, boxShadow: `0 0 0 7px ${color}2e`, height: 18, width: 18}} />
                    <span style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 40, fontWeight: 900}}>{column.name}</span>
                    <span style={{color, fontFamily: FONTS.sans, fontSize: 28, fontWeight: 800, marginLeft: 'auto'}}>{column.strategy}</span>
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
                    {column.ops.map((op) => (
                      <span key={op} style={{color: COLORS.platinum, fontFamily: FONTS.sans, fontSize: 25, fontWeight: 600}}>
                        {op}
                      </span>
                    ))}
                  </div>
                  <div style={{borderTop: `1px solid ${COLORS.line}`, color, fontFamily: FONTS.sans, fontSize: 21, fontWeight: 700, paddingTop: 18}}>{column.gate}</div>
                </div>
              )
            })}
          </div>
          <div
            style={{
              alignItems: 'center',
              background: COLORS.white,
              borderRadius: 999,
              color: COLORS.navy,
              display: 'flex',
              fontFamily: FONTS.sans,
              fontSize: 27,
              fontWeight: 800,
              gap: 14,
              opacity: rule,
              padding: '13px 30px',
              transform: `translateY(${(1 - rule) * 12}px)`,
            }}
          >
            <Mark size={26} inverse />
            风险等级由服务端规则判定，模型输出无法改变
          </div>
        </AbsoluteFill>
        {scene.chapter && <ChapterChip chapter={scene.chapter} persistent />}
        <Subtitles beats={placeBeats(scene)} />
      </SceneExit>
    </Canvas>
  )
}

const MECHANISMS: {name: string; proof: string; seen: string}[] = [
  {name: '防幻觉', proof: '余额、交易号、成功状态只来自业务工具回执', seen: '黄色转账 · 回执'},
  {name: '防注入', proof: '不可信输入隔离检查，高置信注入直接拒绝', seen: '注入回放'},
  {name: '操作审计', proof: '每笔动作按 Trace 记录决策链路与执行日志', seen: '审计时间线'},
  {name: '异常熔断', proof: '动作级 3 次失败锁定；账户级 10 分钟 6 次锁定写操作', seen: '熔断回放'},
  {name: '受控执行', proof: '只调用服务端白名单工具，不运行模型生成的代码或 SQL', seen: '工具边界'},
]

export const MechanismsScene = ({scene, durationInFrames}: {scene: FilmScene; durationInFrames: number}) => {
  const seconds = useSeconds()
  const active = activeSentence(scene, seconds, MECHANISMS.length)
  return (
    <Canvas>
      <SceneExit durationInFrames={durationInFrames}>
        <AbsoluteFill style={{alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 60}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 16, width: 1360}}>
            {MECHANISMS.map((item, index) => {
              const p = appear(seconds, 0.3 + index * 0.18, 0.5)
              const lit = index === active
              const done = index < active
              return (
                <div
                  key={item.name}
                  style={{
                    alignItems: 'center',
                    background: lit ? COLORS.panel : 'transparent',
                    border: `1px solid ${lit ? `${COLORS.teal}88` : COLORS.line}`,
                    borderRadius: 18,
                    display: 'flex',
                    gap: 32,
                    opacity: p * (lit ? 1 : done ? 0.75 : 0.5),
                    padding: '22px 30px',
                    transform: `translateX(${(1 - p) * -16}px)`,
                  }}
                >
                  <span style={{background: lit || done ? COLORS.teal : COLORS.steel, borderRadius: 99, flexShrink: 0, height: 12, width: 12}} />
                  <span style={{color: COLORS.white, flexShrink: 0, fontFamily: FONTS.sans, fontSize: 34, fontWeight: 900, width: 170}}>{item.name}</span>
                  <span style={{color: COLORS.platinum, flex: 1, fontFamily: FONTS.sans, fontSize: 27, fontWeight: 600}}>{item.proof}</span>
                  <span style={{color: COLORS.steel, flexShrink: 0, fontFamily: FONTS.sans, fontSize: 19, fontWeight: 700, letterSpacing: '0.06em'}}>{item.seen}</span>
                </div>
              )
            })}
          </div>
        </AbsoluteFill>
        {scene.chapter && <ChapterChip chapter={scene.chapter} persistent />}
        <Subtitles beats={placeBeats(scene)} />
      </SceneExit>
    </Canvas>
  )
}

type PassportCard = {src: string; title: string; status: string; tone: Tone}
const PASSPORT_ROWS: {label: string; from: number; to: number}[] = [
  {label: 'SOURCE', from: 0.145, to: 0.405},
  {label: 'IDENTITY', from: 0.405, to: 0.68},
  {label: 'RECEIPT', from: 0.68, to: 0.985},
]
const STILL_W = 690
const STILL_H = (STILL_W * 572) / 742

export const PassportScene = ({scene, durationInFrames}: {scene: FilmScene; durationInFrames: number}) => {
  const seconds = useSeconds()
  const s = [0, 1, 2, 3, 4].map((index) => sentenceAt(scene, index))
  const dag = EVIDENCE.dag as {passport?: string} | undefined
  const red = EVIDENCE.red as {passport?: string} | undefined
  const cards: PassportCard[] = [
    {src: dag?.passport ?? 'stills/passport-verified.png', title: '预算锁定 · ¥1,000', status: '已执行 · 回执已验证', tone: 'green'},
    {src: red?.passport ?? 'stills/passport-locked.png', title: '¥1,800 转账', status: '三次验证失败 · 已锁定', tone: 'red'},
  ]
  const activeRow = seconds >= s[3] ? 2 : seconds >= s[2] ? 1 : seconds >= s[1] ? 0 : -1
  const rule = appear(seconds, s[4] + 0.2, 0.6)

  return (
    <Canvas>
      <SceneExit durationInFrames={durationInFrames}>
        <AbsoluteFill style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 34, justifyContent: 'center', paddingTop: 40}}>
          <div style={{display: 'flex', gap: 64}}>
            {cards.map((card, index) => {
              const p = appear(seconds, 0.5 + index * 0.4, 0.7)
              return (
                <div key={card.src} style={{display: 'flex', flexDirection: 'column', gap: 18, opacity: p, transform: `translateY(${(1 - p) * 20}px)`}}>
                  <div style={{alignItems: 'center', display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 28, fontWeight: 800}}>{card.title}</span>
                    <span
                      style={{
                        border: `1px solid ${TONE[card.tone]}`,
                        borderRadius: 999,
                        color: TONE[card.tone],
                        fontFamily: FONTS.sans,
                        fontSize: 19,
                        fontWeight: 700,
                        padding: '5px 14px',
                      }}
                    >
                      {card.status}
                    </span>
                  </div>
                  <div style={{borderRadius: 18, boxShadow: '0 30px 80px rgba(0, 0, 0, 0.45)', height: STILL_H, overflow: 'hidden', position: 'relative', width: STILL_W}}>
                    <Img src={staticFile(card.src)} style={{display: 'block', height: STILL_H, width: STILL_W}} />
                    {PASSPORT_ROWS.map((row, rowIndex) => {
                      const dim = activeRow === -1 || activeRow === rowIndex ? 0 : 0.55
                      return (
                        <div
                          key={row.label}
                          style={{
                            background: `rgba(7, 17, 31, ${dim})`,
                            boxShadow: activeRow === rowIndex ? `inset 0 0 0 3px ${TONE[card.tone]}` : 'none',
                            height: (row.to - row.from) * STILL_H,
                            left: 0,
                            position: 'absolute',
                            right: 0,
                            top: row.from * STILL_H,
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <div
            style={{
              alignItems: 'center',
              background: COLORS.white,
              borderRadius: 999,
              color: COLORS.navy,
              display: 'flex',
              fontFamily: FONTS.sans,
              fontSize: 28,
              fontWeight: 800,
              gap: 14,
              opacity: rule,
              padding: '14px 30px',
              transform: `translateY(${(1 - rule) * 12}px)`,
            }}
          >
            <Mark size={26} inverse />
            任何单一验证信号，都不能独立授权高风险资金动作
          </div>
        </AbsoluteFill>
        {scene.chapter && <ChapterChip chapter={scene.chapter} persistent />}
        <DemoDisclosure />
        <Subtitles beats={placeBeats(scene)} />
      </SceneExit>
    </Canvas>
  )
}

type CoverageItem = {clip: string; title: string; tier: string; tone: Tone; speed: number; fromCue?: string; lead?: number}
const COVERAGE: CoverageItem[] = [
  {clip: 'yellow', title: '转账', tier: '黄色 · 确认后执行', tone: 'amber', speed: 1.3, fromCue: 'receipt', lead: 3.2},
  {clip: 'cov-bill', title: '账单分析', tier: '绿色 · 异常识别', tone: 'green', speed: 1},
  {clip: 'cov-invest', title: '理财', tier: '绿色 · 产品对比', tone: 'green', speed: 1},
  {clip: 'cov-card', title: '卡片', tier: '绿色 · 状态与额度', tone: 'green', speed: 1},
  {clip: 'cov-subscription', title: '订阅', tier: '绿色 · 续费提醒', tone: 'green', speed: 1},
  {clip: 'dag-run', title: '跨场景资金计划', tier: '计划 · 分步授权', tone: 'amber', speed: 1.3, fromCue: 'flowers', lead: 0.6},
]
const ITEM_SECONDS = 3.55
const WINDOW_W = 1240
const WINDOW_H = (WINDOW_W * 864) / 1536

export const CoverageScene = ({scene, durationInFrames}: {scene: FilmScene; durationInFrames: number}) => {
  const seconds = useSeconds()
  const {fps} = useVideoConfig()
  const start = 0.6
  const active = Math.min(COVERAGE.length - 1, Math.max(0, Math.floor((seconds - start) / ITEM_SECONDS)))
  const itemFrames = Math.round(ITEM_SECONDS * fps)

  return (
    <Canvas>
      <SceneExit durationInFrames={durationInFrames}>
        <AbsoluteFill style={{alignItems: 'center', display: 'flex', flexDirection: 'row', gap: 64, justifyContent: 'center', paddingTop: 60}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 14, width: 400}}>
            {COVERAGE.map((item, index) => {
              const on = index === active
              const done = index < active
              return (
                <div
                  key={item.clip}
                  style={{
                    background: on ? COLORS.panel : 'transparent',
                    border: `1px solid ${on ? `${TONE[item.tone]}88` : 'transparent'}`,
                    borderRadius: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    opacity: on ? 1 : done ? 0.6 : 0.4,
                    padding: '14px 20px',
                  }}
                >
                  <span style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 30, fontWeight: 800}}>{item.title}</span>
                  <span style={{color: TONE[item.tone], fontFamily: FONTS.sans, fontSize: 19, fontWeight: 700, letterSpacing: '0.04em'}}>{item.tier}</span>
                </div>
              )
            })}
          </div>
          <div style={{borderRadius: 14, boxShadow: '0 40px 120px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(214, 226, 242, 0.14)', height: WINDOW_H, overflow: 'hidden', position: 'relative', width: WINDOW_W}}>
            {COVERAGE.map((item, index) => {
              const clip = CLIPS[item.clip]
              if (!clip) return null
              const from = item.fromCue ? Math.max(0, (clip.cues[item.fromCue] ?? 0) - (item.lead ?? 0)) : 0
              return (
                <Sequence key={item.clip} from={Math.round((start + index * ITEM_SECONDS) * fps)} durationInFrames={itemFrames + 8} layout="none">
                  <CoverageClip src={clip.src} trimBefore={Math.round((clip.trimBeforeSeconds + from) * fps)} speed={item.speed} />
                </Sequence>
              )
            })}
          </div>
        </AbsoluteFill>
        {scene.chapter && <ChapterChip chapter={scene.chapter} persistent />}
        <DemoDisclosure />
        <Subtitles beats={placeBeats(scene)} />
      </SceneExit>
    </Canvas>
  )
}

const CoverageClip = ({src, trimBefore, speed}: {src: string; trimBefore: number; speed: number}) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, 8], [0, 1], clamp)
  return (
    <AbsoluteFill style={{opacity: p}}>
      <Video src={staticFile(src)} trimBefore={trimBefore} playbackRate={speed} muted style={{height: '100%', width: '100%'}} />
    </AbsoluteFill>
  )
}

const PROMISES: {label: string; tone: Tone}[] = [
  {label: '权限分级', tone: 'cobalt'},
  {label: '动作绑定 MFA', tone: 'red'},
  {label: '回执为准', tone: 'green'},
]

export const OutroScene = ({scene, durationInFrames}: {scene: FilmScene; durationInFrames: number}) => {
  const seconds = useSeconds()
  const lockup = appear(seconds, 0.3, 0.9)
  const line = appear(seconds, 1.2, 0.8)
  const credits = appear(seconds, 4.2, 0.8)
  return (
    <Canvas>
      <SceneExit durationInFrames={durationInFrames}>
        <AbsoluteFill style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 56, justifyContent: 'center'}}>
          <div style={{opacity: lockup, transform: `translateY(${(1 - lockup) * 14}px)`}}>
            <Lockup size={80} />
          </div>
          <div style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 58, fontWeight: 900, opacity: line, transform: `translateY(${(1 - line) * 12}px)`}}>
            Agent 读懂需求，银行守住资金
          </div>
          <div style={{display: 'flex', gap: 18}}>
            {PROMISES.map((promise, index) => {
              const p = appear(seconds, 2 + index * 0.35, 0.5)
              return (
                <span
                  key={promise.label}
                  style={{
                    alignItems: 'center',
                    border: `1px solid ${TONE[promise.tone]}88`,
                    borderRadius: 999,
                    color: COLORS.platinum,
                    display: 'flex',
                    fontFamily: FONTS.sans,
                    fontSize: 24,
                    fontWeight: 700,
                    gap: 12,
                    opacity: p,
                    padding: '10px 22px',
                  }}
                >
                  <span style={{background: TONE[promise.tone], borderRadius: 99, height: 10, width: 10}} />
                  {promise.label}
                </span>
              )
            })}
          </div>
          <div style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 22, fontWeight: 600, letterSpacing: '0.12em', opacity: credits}}>
            Next.js 工作台 · Go 银行 API · 全程真实录制 · 合成账本
          </div>
        </AbsoluteFill>
        <Subtitles beats={placeBeats(scene)} />
      </SceneExit>
    </Canvas>
  )
}
