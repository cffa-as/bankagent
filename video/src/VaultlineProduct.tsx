import {Audio} from '@remotion/media'
import {AbsoluteFill, Sequence, interpolate, staticFile, useVideoConfig} from 'remotion'
import {clamp} from './components/brand'
import {NARRATION, NARRATION_DELAY, SCENES, sceneSeconds, type FilmScene} from './film-plan'
import {AgentScene} from './scenes/agent-scene'
import {RecordingScene} from './scenes/recording-scene'
import {IntroScene, OutroScene, PrinciplesScene, ProblemScene} from './scenes/title-scenes'
import {COLORS, FPS} from './theme'

type Placed = {scene: FilmScene; from: number; durationInFrames: number}

const PLACED: Placed[] = SCENES.reduce<Placed[]>((list, scene) => {
  const from = list.length ? list[list.length - 1].from + list[list.length - 1].durationInFrames : 0
  return [...list, {scene, from, durationInFrames: Math.round(sceneSeconds(scene) * FPS)}]
}, [])

export const FILM_FRAMES = PLACED[PLACED.length - 1].from + PLACED[PLACED.length - 1].durationInFrames

const SPEECH: [start: number, end: number][] = PLACED.flatMap(({scene, from}) => {
  const entry = NARRATION[scene.id]
  if (!entry) return []
  const start = from + NARRATION_DELAY * FPS
  return [[start, start + entry.duration * FPS] as [number, number]]
})

function scoreVolume(frame: number) {
  const fade = interpolate(frame, [0, 45, FILM_FRAMES - 120, FILM_FRAMES], [0, 1, 1, 0], clamp)
  const distance = Math.min(...SPEECH.map(([start, end]) => (frame < start ? start - frame : frame > end ? frame - end : 0)))
  const duck = interpolate(distance, [0, 18], [0.32, 1], clamp)
  return 0.55 * fade * duck
}

const SceneBody = ({scene, durationInFrames}: {scene: FilmScene; durationInFrames: number}) => {
  switch (scene.kind) {
    case 'intro':
      return <IntroScene durationInFrames={durationInFrames} />
    case 'problem':
      return <ProblemScene durationInFrames={durationInFrames} />
    case 'agent':
      return <AgentScene durationInFrames={durationInFrames} />
    case 'principles':
      return <PrinciplesScene durationInFrames={durationInFrames} />
    case 'outro':
      return <OutroScene durationInFrames={durationInFrames} />
    case 'recording':
      return <RecordingScene id={scene.id} chapter={scene.chapter} title={scene.title} camera={scene.camera} durationInFrames={durationInFrames} />
  }
}

export const VaultlineProduct = () => {
  const {fps} = useVideoConfig()
  return (
    <AbsoluteFill style={{background: COLORS.navy}}>
      <Audio src={staticFile('audio/score.wav')} volume={scoreVolume} />
      {PLACED.map(({scene, from, durationInFrames}) => (
        <Sequence key={scene.id} from={from} durationInFrames={durationInFrames} name={scene.id}>
          <SceneBody scene={scene} durationInFrames={durationInFrames} />
          {NARRATION[scene.id] && (
            <Sequence from={Math.round(NARRATION_DELAY * fps)} layout="none">
              <Audio src={staticFile(`audio/${scene.id}.mp3`)} />
            </Sequence>
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
