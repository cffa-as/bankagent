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

const appear = (seconds: number, at: number, length = 0.6) => interpolate(seconds, [at, at + length], [0, 1], ease)

const SceneExit = ({durationInFrames, children}: {durationInFrames: number; children: React.ReactNode}) => {
  const frame = useCurrentFrame()
  return <AbsoluteFill style={{opacity: interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], clamp)}}>{children}</AbsoluteFill>
}

const Eyebrow = ({children, color = COLORS.steel}: {children: React.ReactNode; color?: string}) => (
  <div style={{color, fontFamily: FONTS.sans, fontSize: 20, fontWeight: 700, letterSpacing: '0.22em'}}>{children}</div>
)

/** The film's signature: a horizontal execution boundary with the three-part promise. */
const BoundaryLine = ({at, width = 1240}: {at: number; width?: number}) => {
  const seconds = useSeconds()
  const draw = interpolate(seconds, [at, at + 1.4], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)})
  const parts: {label: string; color: string; x: number}[] = [
    {label: '模型提议', color: COLORS.platinum, x: 0.08},
    {label: '服务端裁决', color: COLORS.cobalt, x: 0.5},
    {label: '回执证明结果', color: COLORS.teal, x: 0.92},
  ]
  return (
    <div style={{height: 120, position: 'relative', width}}>
      <div style={{background: COLORS.line, height: 2, left: 0, position: 'absolute', right: 0, top: 30}} />
      <div style={{background: `linear-gradient(90deg, ${COLORS.platinum}, ${COLORS.cobalt}, ${COLORS.teal})`, height: 2, left: 0, position: 'absolute', top: 30, width: `${draw * 100}%`}} />
      {parts.map((part, index) => {
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

export const IntroScene = ({scene, durationInFrames}: {scene: FilmScene; durationInFrames: number}) => {
  const seconds = useSeconds()
  const mark = appear(seconds, 0.3, 0.9)
  return (
    <Canvas>
      <SceneExit durationInFrames={durationInFrames}>
        <AbsoluteFill style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 72, justifyContent: 'center'}}>
          <div style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 26, opacity: mark, transform: `translateY(${(1 - mark) * 16}px)`}}>
            <Lockup size={74} />
            <Eyebrow>受控执行的银行 AGENT 工作台</Eyebrow>
          </div>
          <BoundaryLine at={1.6} />
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
      height: 520,
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

export const ProblemScene = ({scene, durationInFrames}: {scene: FilmScene; durationInFrames: number}) => {
  const seconds = useSeconds()
  const s = [0, 1, 2, 3, 4].map((index) => sentenceAt(scene, index))
  const headline = appear(seconds, s[0] + 0.1) * interpolate(seconds, [s[1] - 0.6, s[1] - 0.1], [1, 0], clamp)
  const dilemma = interpolate(seconds, [s[1] - 0.2, s[1] + 0.4, s[3] - 0.6, s[3] - 0.1], [0, 1, 1, 0], ease)
  const boundary = appear(seconds, s[3] - 0.1, 0.7)

  return (
    <Canvas>
      <SceneExit durationInFrames={durationInFrames}>
        {headline > 0 && (
          <AbsoluteFill style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 30, justifyContent: 'center', opacity: headline}}>
            <Eyebrow>问题</Eyebrow>
            <div style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 76, fontWeight: 900, letterSpacing: '0.02em', textAlign: 'center'}}>
              难点不是会不会聊天
            </div>
            <div style={{color: COLORS.cobalt, fontFamily: FONTS.sans, fontSize: 76, fontWeight: 900, letterSpacing: '0.02em', textAlign: 'center'}}>
              而是能不能被允许动钱
            </div>
          </AbsoluteFill>
        )}

        {dilemma > 0 && (
          <AbsoluteFill style={{alignItems: 'center', display: 'flex', flexDirection: 'row', gap: 56, justifyContent: 'center', opacity: dilemma}}>
            <DilemmaCard title="传统银行入口" caption="入口深 · 层层查找" tone="amber" p={appear(seconds, s[1])}>
              <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                {MENU.map((item, index) => {
                  const p = appear(seconds, s[1] + 0.3 + index * 0.35, 0.35)
                  return (
                    <div key={item} style={{alignItems: 'center', display: 'flex', gap: 14, opacity: p, paddingLeft: index * 26}}>
                      <span style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 22}}>{index === 0 ? '' : '›'}</span>
                      <span
                        style={{
                          background: index === MENU.length - 1 ? `${COLORS.amber}22` : 'rgba(183, 201, 226, 0.08)',
                          borderRadius: 10,
                          color: index === MENU.length - 1 ? COLORS.amber : COLORS.platinum,
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
            <DilemmaCard title="通用 Agent" caption="能理解需求 · 不能直接拿到资金权限" tone="red" p={appear(seconds, s[2])}>
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
                    opacity: appear(seconds, s[2] + 0.4),
                    padding: '16px 22px',
                  }}
                >
                  帮我把房租和装修的钱安排一下
                </div>
                <div style={{alignItems: 'center', display: 'flex', gap: 18, opacity: appear(seconds, s[2] + 1.4)}}>
                  <span style={{background: 'rgba(183, 201, 226, 0.08)', borderRadius: 12, color: COLORS.platinum, fontFamily: FONTS.sans, fontSize: 24, fontWeight: 600, padding: '12px 18px'}}>
                    模型直接调用转账
                  </span>
                  <BlockedArrow />
                  <span style={{border: `1px dashed ${COLORS.red}`, borderRadius: 12, color: COLORS.red, fontFamily: FONTS.sans, fontSize: 24, fontWeight: 700, padding: '12px 18px'}}>
                    资金权限
                  </span>
                </div>
                <div style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 22, lineHeight: 1.5, opacity: appear(seconds, s[2] + 2.2)}}>
                  模型输出不可预测，单靠提示词无法守住资金边界
                </div>
              </div>
            </DilemmaCard>
          </AbsoluteFill>
        )}

        {boundary > 0 && <BoundaryDiagram seconds={seconds} at={s[3]} emphasis={s[4]} p={boundary} />}
        <Subtitles beats={placeBeats(scene)} />
      </SceneExit>
    </Canvas>
  )
}

const SERVER_STEPS = ['不可变动作快照', '风险分级与授权', '一次性执行门', '银行回执']

const BoundaryDiagram = ({seconds, at, emphasis, p}: {seconds: number; at: number; emphasis: number; p: number}) => {
  const travel = interpolate(seconds, [emphasis + 0.2, emphasis + 1.6], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)})
  return (
    <AbsoluteFill style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 44, justifyContent: 'center', opacity: p}}>
      <Eyebrow>VAULTLINE 的做法</Eyebrow>
      <div style={{alignItems: 'stretch', display: 'flex', gap: 0}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 18, padding: '0 64px', width: 520}}>
          <span style={{color: COLORS.platinum, fontFamily: FONTS.sans, fontSize: 24, fontWeight: 700, letterSpacing: '0.12em'}}>模型</span>
          {['理解需求', '规划步骤', '提出动作'].map((item, index) => (
            <span
              key={item}
              style={{
                background: 'rgba(183, 201, 226, 0.08)',
                borderRadius: 14,
                color: COLORS.white,
                fontFamily: FONTS.sans,
                fontSize: 30,
                fontWeight: 700,
                opacity: appear(seconds, at + 0.4 + index * 0.4),
                padding: '16px 22px',
              }}
            >
              {item}
            </span>
          ))}
        </div>
        <div style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', width: 120}}>
          <div style={{background: COLORS.cobalt, borderRadius: 4, boxShadow: `0 0 28px ${COLORS.cobalt}`, flex: 1, width: 4}} />
          <span
            style={{
              background: COLORS.navy,
              color: COLORS.cobalt,
              fontFamily: FONTS.sans,
              fontSize: 22,
              fontWeight: 800,
              left: '50%',
              letterSpacing: '0.1em',
              padding: '8px 0',
              position: 'absolute',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              whiteSpace: 'nowrap',
              writingMode: 'vertical-rl',
            }}
          >
            资金执行边界
          </span>
          <span
            style={{
              background: COLORS.amber,
              borderRadius: 999,
              color: COLORS.navy,
              fontFamily: FONTS.sans,
              fontSize: 20,
              fontWeight: 800,
              left: interpolate(travel, [0, 1], [-300, -96]),
              opacity: appear(seconds, emphasis, 0.4),
              padding: '8px 16px',
              position: 'absolute',
              top: '84%',
              whiteSpace: 'nowrap',
            }}
          >
            动作提议
          </span>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 18, padding: '0 64px', width: 520}}>
          <span style={{color: COLORS.cobalt, fontFamily: FONTS.sans, fontSize: 24, fontWeight: 700, letterSpacing: '0.12em'}}>银行服务端</span>
          {SERVER_STEPS.map((item, index) => (
            <span
              key={item}
              style={{
                alignItems: 'center',
                border: `1px solid ${COLORS.cobalt}55`,
                borderRadius: 14,
                color: COLORS.white,
                display: 'flex',
                fontFamily: FONTS.sans,
                fontSize: 30,
                fontWeight: 700,
                gap: 14,
                opacity: appear(seconds, at + 1.4 + index * 0.4),
                padding: '14px 22px',
              }}
            >
              <span style={{background: index === SERVER_STEPS.length - 1 ? COLORS.teal : COLORS.cobalt, borderRadius: 99, height: 10, width: 10}} />
              {item}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
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
  const execute = EVIDENCE.execute as {passport?: string} | undefined
  const security = EVIDENCE.security as {passport?: string} | undefined
  const cards: PassportCard[] = [
    {src: execute?.passport ?? 'stills/passport-verified.png', title: '分两笔预留 · 第一笔', status: '已执行 · 回执已签发', tone: 'green'},
    {src: security?.passport ?? 'stills/passport-locked.png', title: '¥1,800 转账', status: '三次验证失败 · 已锁定', tone: 'red'},
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

const COVERAGE: {clip: string; title: string; tier: string; tone: Tone; speed: number}[] = [
  {clip: 'cov-transfer', title: '转账', tier: '黄色 · 确认后执行', tone: 'amber', speed: 1.6},
  {clip: 'cov-bill', title: '账单', tier: '只读 · 异常识别', tone: 'cobalt', speed: 1},
  {clip: 'cov-invest', title: '理财', tier: '只读 · 产品对比', tone: 'cobalt', speed: 1},
  {clip: 'cov-card', title: '卡片', tier: '只读 · 状态与额度', tone: 'cobalt', speed: 1},
  {clip: 'cov-subscription', title: '订阅', tier: '只读 · 续费提醒', tone: 'cobalt', speed: 1},
  {clip: 'cov-plan', title: '跨场景资金计划', tier: '计划 · 分步授权', tone: 'green', speed: 1.3},
]
const ITEM_SECONDS = 3.3
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
              return (
                <Sequence key={item.clip} from={Math.round((start + index * ITEM_SECONDS) * fps)} durationInFrames={itemFrames + 8} layout="none">
                  <CoverageClip src={clip.src} trimBefore={Math.round(clip.trimBeforeSeconds * fps)} speed={item.speed} />
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

export const OutroScene = ({scene, durationInFrames}: {scene: FilmScene; durationInFrames: number}) => {
  const seconds = useSeconds()
  const lockup = appear(seconds, 0.3, 0.9)
  const credits = appear(seconds, 4.2, 0.8)
  return (
    <Canvas>
      <SceneExit durationInFrames={durationInFrames}>
        <AbsoluteFill style={{alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 64, justifyContent: 'center'}}>
          <div style={{opacity: lockup, transform: `translateY(${(1 - lockup) * 14}px)`}}>
            <Lockup size={80} />
          </div>
          <BoundaryLine at={0.9} />
          <div style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 22, fontWeight: 600, letterSpacing: '0.12em', opacity: credits}}>
            Next.js 工作台 · Go 银行 API · 全程真实录制 · 合成账本
          </div>
        </AbsoluteFill>
        <Subtitles beats={placeBeats(scene)} />
      </SceneExit>
    </Canvas>
  )
}
