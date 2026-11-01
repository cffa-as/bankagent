import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion'
import {Canvas, Check, Lockup, Mark, ShieldIcon, Shimmer, clamp} from '../components/brand'
import {Subtitles} from '../components/subtitles'
import {NARRATION_DELAY} from '../film-plan'
import {COLORS, FONTS} from '../theme'

const out = {...clamp, easing: Easing.out(Easing.cubic)}

function useSceneTime() {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  return {frame, fps, t: frame / fps - NARRATION_DELAY}
}

const Reveal = ({at, children, distance = 24}: {at: number; children: React.ReactNode; distance?: number}) => {
  const {t} = useSceneTime()
  const p = interpolate(t, [at, at + 0.7], [0, 1], out)
  return <div style={{opacity: p, transform: `translateY(${(1 - p) * distance}px)`}}>{children}</div>
}

const Fade = ({durationInFrames, children}: {durationInFrames: number; children: React.ReactNode}) => {
  const frame = useCurrentFrame()
  return <AbsoluteFill style={{opacity: interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], clamp)}}>{children}</AbsoluteFill>
}

const Composer = ({text, progress, width = 1100}: {text: string; progress: number; width?: number}) => {
  const {frame} = useSceneTime()
  const shown = text.slice(0, Math.round(text.length * progress))
  return (
    <div
      style={{
        alignItems: 'center',
        background: COLORS.white,
        borderRadius: 22,
        boxShadow: '0 30px 90px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        gap: 20,
        height: 96,
        padding: '0 22px 0 34px',
        width,
      }}
    >
      <span style={{color: shown ? COLORS.ink : COLORS.steel, flex: 1, fontFamily: FONTS.sans, fontSize: 34}}>
        {shown || '今天想办理什么业务？'}
        <span style={{background: COLORS.cobalt, display: 'inline-block', height: 36, marginLeft: 4, opacity: frame % 30 < 16 ? 1 : 0, verticalAlign: 'middle', width: 3}} />
      </span>
      <span style={{alignItems: 'center', background: COLORS.ink, borderRadius: 16, display: 'flex', height: 60, justifyContent: 'center', width: 60}}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={COLORS.white} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </span>
    </div>
  )
}

export const IntroScene = ({durationInFrames}: {durationInFrames: number}) => {
  const {frame, fps, t} = useSceneTime()
  const mark = spring({fps, frame, config: {damping: 14, mass: 0.8}, durationInFrames: 40})
  const typing = interpolate(t, [5.8, 8.4], [0, 1], clamp)
  return (
    <Canvas>
      <Fade durationInFrames={durationInFrames}>
        <AbsoluteFill style={{alignItems: 'center', flexDirection: 'column', gap: 44, justifyContent: 'center'}}>
          <div style={{transform: `scale(${0.6 + mark * 0.4})`, opacity: mark}}>
            <Mark size={110} />
          </div>
          <Reveal at={0.2}>
            <div style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 96, fontWeight: 900, letterSpacing: '0.02em'}}>钱的事，一句话说清楚。</div>
          </Reveal>
          <Reveal at={2.4}>
            <div style={{color: COLORS.platinum, fontFamily: FONTS.sans, fontSize: 34, fontWeight: 500, letterSpacing: '0.12em'}}>
              Vaultline 智能银行助理
            </div>
          </Reveal>
          <Reveal at={5.4} distance={40}>
            <div style={{marginTop: 40}}>
              <Composer text="给张三转 300 元，备注项目款" progress={typing} width={980} />
            </div>
          </Reveal>
        </AbsoluteFill>
      </Fade>
    </Canvas>
  )
}

const MENU = ['首页', '我的账户', '交易明细', '筛选条件', '交易详情']
const FIELDS = ['收款人姓名', '收款账号', '开户银行', '开户网点', '转账金额', '转账用途', '到账时间']

export const ProblemScene = ({durationInFrames}: {durationInFrames: number}) => {
  const {t} = useSceneTime()
  const collapse = interpolate(t, [10.4, 11.4], [0, 1], out)
  const composer = interpolate(t, [11.2, 12.2], [0, 1], out)
  const typing = interpolate(t, [12.3, 14.6], [0, 1], clamp)
  return (
    <Canvas>
      <Fade durationInFrames={durationInFrames}>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: 1 - collapse, transform: `scale(${1 - collapse * 0.08})`}}>
          <div style={{display: 'flex', gap: 120}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: 18, width: 560}}>
              <div style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 24, fontWeight: 600, letterSpacing: '0.16em', marginBottom: 8}}>查一笔扣款</div>
              {MENU.map((item, index) => {
                const p = interpolate(t, [1.4 + index * 0.55, 1.9 + index * 0.55], [0, 1], out)
                return (
                  <div
                    key={item}
                    style={{
                      alignItems: 'center',
                      background: COLORS.panel,
                      border: `1px solid ${COLORS.line}`,
                      borderRadius: 14,
                      color: COLORS.platinum,
                      display: 'flex',
                      fontFamily: FONTS.sans,
                      fontSize: 30,
                      gap: 18,
                      marginLeft: index * 34,
                      opacity: p,
                      padding: '18px 24px',
                      transform: `translateX(${(1 - p) * -20}px)`,
                    }}
                  >
                    <span style={{color: COLORS.steel, fontSize: 22}}>{`第 ${index + 1} 层`}</span>
                    {item}
                    <span style={{color: COLORS.steel, marginLeft: 'auto'}}>›</span>
                  </div>
                )
              })}
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 14, width: 520}}>
              <div style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 24, fontWeight: 600, letterSpacing: '0.16em', marginBottom: 8}}>转一笔账</div>
              {FIELDS.map((field, index) => {
                const p = interpolate(t, [4.6 + index * 0.32, 5.0 + index * 0.32], [0, 1], out)
                return (
                  <div
                    key={field}
                    style={{
                      alignItems: 'center',
                      borderBottom: `1px solid ${COLORS.line}`,
                      display: 'flex',
                      fontFamily: FONTS.sans,
                      justifyContent: 'space-between',
                      opacity: p,
                      padding: '12px 4px',
                    }}
                  >
                    <span style={{color: COLORS.platinum, fontSize: 28}}>{field}</span>
                    <span style={{background: 'rgba(183, 201, 226, 0.12)', borderRadius: 8, height: 30, width: 220}} />
                  </div>
                )
              })}
            </div>
          </div>
        </AbsoluteFill>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: composer, transform: `translateY(${(1 - composer) * 40}px)`}}>
          <Composer text="给张三转 300 元，备注项目款" progress={typing} />
        </AbsoluteFill>
        <Subtitles id="problem" />
      </Fade>
    </Canvas>
  )
}

const PILLARS = [
  {word: '听得懂', line: '一句话说出你的需求', at: 0.1, icon: 'ear'},
  {word: '看得见', line: '每一步过程清清楚楚', at: 2.3, icon: 'eye'},
  {word: '守得住', line: '每一笔资金由你确认', at: 4.6, icon: 'shield'},
] as const

export const PrinciplesScene = ({durationInFrames}: {durationInFrames: number}) => {
  const {t} = useSceneTime()
  const closing = interpolate(t, [7.2, 8.0], [0, 1], out)
  return (
    <Canvas>
      <Fade durationInFrames={durationInFrames}>
        <AbsoluteFill style={{alignItems: 'center', flexDirection: 'column', gap: 90, justifyContent: 'center'}}>
          <div style={{display: 'flex', gap: 40}}>
            {PILLARS.map((pillar) => {
              const p = interpolate(t, [pillar.at, pillar.at + 0.8], [0, 1], out)
              return (
                <div
                  key={pillar.word}
                  style={{
                    background: COLORS.panel,
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 26,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 26,
                    opacity: p,
                    padding: '48px 46px',
                    transform: `translateY(${(1 - p) * 30}px)`,
                    width: 440,
                  }}
                >
                  <span style={{alignItems: 'center', background: 'rgba(49, 91, 255, 0.16)', borderRadius: 16, display: 'flex', height: 64, justifyContent: 'center', width: 64}}>
                    {pillar.icon === 'shield' ? (
                      <ShieldIcon size={34} color={COLORS.white} />
                    ) : pillar.icon === 'eye' ? (
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={COLORS.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={COLORS.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                      </svg>
                    )}
                  </span>
                  <span style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 76, fontWeight: 900, letterSpacing: '0.04em'}}>{pillar.word}</span>
                  <span style={{color: COLORS.platinum, fontFamily: FONTS.sans, fontSize: 30}}>{pillar.line}</span>
                </div>
              )
            })}
          </div>
          <div style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 34, fontWeight: 600, letterSpacing: '0.1em', opacity: closing}}>
            这是我们对智能银行的理解
          </div>
        </AbsoluteFill>
      </Fade>
    </Canvas>
  )
}

export const OutroScene = ({durationInFrames}: {durationInFrames: number}) => {
  const {frame, fps, t} = useSceneTime()
  const lock = spring({fps, frame, config: {damping: 200}, durationInFrames: 30})
  return (
    <Canvas>
      <AbsoluteFill style={{opacity: interpolate(frame, [durationInFrames - 24, durationInFrames], [1, 0], clamp)}}>
        <AbsoluteFill style={{alignItems: 'center', flexDirection: 'column', gap: 40, justifyContent: 'center'}}>
          <div style={{opacity: lock, transform: `scale(${0.9 + lock * 0.1})`}}>
            <Lockup size={84} />
          </div>
          <Reveal at={1.6}>
            <div style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 64, fontWeight: 800, letterSpacing: '0.04em'}}>钱的事，一句话说清楚。</div>
          </Reveal>
          <Reveal at={3}>
            <div style={{alignItems: 'center', display: 'flex', gap: 14}}>
              <Check size={26} color={COLORS.teal} />
              <Shimmer text="智能银行助理 · 每一笔资金操作都由你确认" size={28} color={COLORS.steel} highlight={COLORS.white} />
            </div>
          </Reveal>
        </AbsoluteFill>
        <div
          style={{
            bottom: 48,
            color: COLORS.steel,
            fontFamily: FONTS.sans,
            fontSize: 20,
            left: 0,
            opacity: interpolate(t, [3.6, 4.4], [0, 1], clamp),
            position: 'absolute',
            right: 0,
            textAlign: 'center',
          }}
        >
          演示中的账户、金额与交易均为合成数据，画面为本地运行的真实产品录屏
        </div>
      </AbsoluteFill>
    </Canvas>
  )
}
