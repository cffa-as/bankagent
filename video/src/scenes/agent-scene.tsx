import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion'
import {Canvas, Check, Mark, Shimmer, Spinner, clamp} from '../components/brand'
import {Subtitles} from '../components/subtitles'
import {NARRATION_DELAY} from '../scenes'
import {COLORS, FONTS} from '../theme'

const STEPS = [
  {label: '理解你的需求', at: 2.6},
  {label: '核对业务规则', at: 3.9},
  {label: '测算未来 30 天现金流', source: '现金流', at: 5.2},
  {label: '生成现金流方案', source: '现金流', at: 6.5},
]
const LIVE_LABELS = ['正在理解你的需求', '正在调取所需信息', '正在测算现金流', '正在整理测算结论', '正在整理测算结论']
const COLLAPSE_AT = 8.6
const REOPEN_AT = 11.6

export const AgentScene = ({durationInFrames}: {durationInFrames: number}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps - NARRATION_DELAY
  const enter = spring({fps, frame, config: {damping: 200}, durationInFrames: 24})
  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], clamp)

  const done = STEPS.filter((step) => t >= step.at).length
  const live = t < COLLAPSE_AT
  const open = live || t >= REOPEN_AT
  const listReveal = live ? 1 : interpolate(t, [REOPEN_AT, REOPEN_AT + 0.4], [0, 1], clamp)
  const answer = interpolate(t, [COLLAPSE_AT + 0.3, COLLAPSE_AT + 0.9], [0, 1], clamp)
  const cursorX = interpolate(t, [REOPEN_AT - 1.4, REOPEN_AT - 0.2], [1180, 560], {...clamp, easing: Easing.inOut(Easing.cubic)})
  const cursorY = interpolate(t, [REOPEN_AT - 1.4, REOPEN_AT - 0.2], [760, 368], {...clamp, easing: Easing.inOut(Easing.cubic)})
  const cursorOpacity = interpolate(t, [REOPEN_AT - 1.6, REOPEN_AT - 1.2, REOPEN_AT + 1.2, REOPEN_AT + 1.6], [0, 1, 1, 0], clamp)
  const click = interpolate(t, [REOPEN_AT - 0.15, REOPEN_AT + 0.35], [0, 1], clamp)

  return (
    <Canvas>
      <AbsoluteFill style={{opacity: exit}}>
        <div style={{left: 0, position: 'absolute', right: 0, textAlign: 'center', top: 74}}>
          <div style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 22, fontWeight: 600, letterSpacing: '0.2em'}}>看得见的过程</div>
        </div>

        <div
          style={{
            background: COLORS.ice,
            borderRadius: 28,
            boxShadow: '0 40px 120px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: 30,
            left: 330,
            opacity: enter,
            padding: '48px 64px',
            position: 'absolute',
            top: 150,
            transform: `translateY(${(1 - enter) * 30}px)`,
            width: 1260,
            height: 760,
          }}
        >
          <div style={{display: 'flex', justifyContent: 'flex-end'}}>
            <div style={{background: COLORS.ink, borderRadius: 20, color: COLORS.white, fontFamily: FONTS.sans, fontSize: 28, padding: '16px 26px'}}>
              如果预留 2000 元，会影响未来 30 天的必要支出吗？
            </div>
          </div>

          <div style={{display: 'flex', gap: 22}}>
            <Mark size={52} inverse />
            <div style={{display: 'flex', flex: 1, flexDirection: 'column', gap: 18, paddingTop: 8}}>
              <div style={{alignItems: 'center', display: 'flex', gap: 16, height: 40}}>
                {live ? (
                  <>
                    <Spinner size={26} />
                    <Shimmer text={LIVE_LABELS[done]} size={30} color={COLORS.muted} highlight={COLORS.ink} />
                    <span style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 22, fontVariantNumeric: 'tabular-nums'}}>
                      {Math.max(0, t - 1.4).toFixed(1)} 秒
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{alignItems: 'center', background: '#d9f2ea', borderRadius: 99, display: 'flex', height: 30, justifyContent: 'center', width: 30}}>
                      <Check size={18} color="#137a63" />
                    </span>
                    <span style={{color: COLORS.muted, fontFamily: FONTS.sans, fontSize: 30, fontWeight: 600}}>处理完成</span>
                    <span style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 24}}>·  4 个步骤  ·  用时 6.5 秒</span>
                    <span style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 26, transform: `rotate(${open ? 90 : 0}deg)`}}>›</span>
                  </>
                )}
              </div>

              {open && (
                <div
                  style={{
                    borderLeft: '2px solid #d5ddea',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                    marginLeft: 13,
                    opacity: listReveal,
                    paddingLeft: 30,
                  }}
                >
                  {STEPS.map((step, index) => {
                    const shown = !live || index < done
                    if (!shown) return null
                    const pop = live ? interpolate(t, [step.at, step.at + 0.3], [0, 1], clamp) : 1
                    return (
                      <div key={step.label} style={{alignItems: 'center', display: 'flex', gap: 16, opacity: pop, transform: `translateY(${(1 - pop) * 8}px)`}}>
                        <Check size={24} color="#137a63" />
                        <span style={{color: COLORS.ink, fontFamily: FONTS.sans, fontSize: 28}}>{step.label}</span>
                        {step.source && (
                          <span
                            style={{
                              background: COLORS.white,
                              border: '1px solid #d5ddea',
                              borderRadius: 8,
                              color: COLORS.muted,
                              fontFamily: FONTS.sans,
                              fontSize: 20,
                              padding: '2px 10px',
                            }}
                          >
                            {step.source}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  {live && (
                    <div style={{alignItems: 'center', display: 'flex', gap: 16, color: COLORS.muted, fontFamily: FONTS.sans, fontSize: 28}}>
                      <span style={{display: 'flex', justifyContent: 'center', width: 24}}>
                        <span style={{background: COLORS.cobalt, borderRadius: 99, height: 10, opacity: 0.5 + 0.5 * Math.sin(frame / 4), width: 10}} />
                      </span>
                      {LIVE_LABELS[done].replace(/^正在/, '')}
                    </div>
                  )}
                </div>
              )}

              {!live && (
                <div style={{display: 'flex', flexDirection: 'column', gap: 16, opacity: answer, transform: `translateY(${(1 - answer) * 12}px)`}}>
                  <div style={{color: COLORS.ink, fontFamily: FONTS.sans, fontSize: 30, lineHeight: 1.5}}>
                    预留 2000 元后，预期最低余额约 ¥4,422，仍高于必要支出缓冲；若收入延迟到账，月底可能出现缺口。
                  </div>
                  <div
                    style={{
                      alignItems: 'center',
                      background: COLORS.white,
                      border: '1px solid #d5ddea',
                      borderRadius: 16,
                      display: 'flex',
                      gap: 18,
                      padding: '18px 22px',
                      width: 560,
                    }}
                  >
                    <span style={{background: '#e3eaff', borderRadius: 12, height: 48, width: 48}} />
                    <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                      <span style={{color: COLORS.ink, fontFamily: FONTS.sans, fontSize: 24, fontWeight: 700}}>未来现金流测算</span>
                      <span style={{color: COLORS.muted, fontFamily: FONTS.sans, fontSize: 20}}>查看余额走势与可选方案</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{left: cursorX, opacity: cursorOpacity, position: 'absolute', top: cursorY}}>
          <div
            style={{
              border: `3px solid ${COLORS.cobalt}`,
              borderRadius: 99,
              height: 54,
              left: -27,
              opacity: 1 - click,
              position: 'absolute',
              top: -27,
              transform: `scale(${0.4 + click})`,
              width: 54,
            }}
          />
          <svg width="30" height="40" viewBox="0 0 22 30" aria-hidden="true">
            <path d="M2 1.5 19.5 17l-8.2 1.2 4.2 8.1-3.8 1.6-3.9-8.1-5.8 5.2Z" fill="#ffffff" stroke="#07111f" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </div>

        <Subtitles id="agent" />
      </AbsoluteFill>
    </Canvas>
  )
}
