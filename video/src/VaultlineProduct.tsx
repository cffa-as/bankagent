import {Audio} from '@remotion/media'
import {AbsoluteFill, Sequence, interpolate, staticFile, useVideoConfig} from 'remotion'
import {clamp} from './components/brand'
import {SCENES, placeBeats, sceneSeconds, type FilmScene} from './film-plan'
import {RecordingScene} from './scenes/recording-scene'
import {CoverageScene, IntroScene, OutroScene, PassportScene, ProblemScene} from './scenes/title-scenes'
import {COLORS, FPS} from './theme'

type Placed = {scene: FilmScene; from: number; durationInFrames: number}

const PLACED: Placed[] = SCENES.reduce<Placed[]>((list, scene) => {
  const from = list.length ? list[list.length - 1].from + list[list.length - 1].durationInFrames : 0
  return [...list, {scene, from, durationInFrames: Math.round(sceneSeconds(scene) * FPS)}]
}, [])

export const FILM_FRAMES = PLACED[PLACED.length - 1].from + PLACED[PLACED.length - 1].durationInFrames

const SPEECH: [start: number, end: number][] = PLACED.flatMap(({scene, from}) =>
  placeBeats(scene).map((beat) => [from + beat.start * FPS, from + beat.end * FPS] as [number, number]),
)

function scoreVolume(frame: number) {
  const fade = interpolate(frame, [0, 45, FILM_FRAMES - 120, FILM_FRAMES], [0, 1, 1, 0], clamp)
  const distance = Math.min(...SPEECH.map(([start, end]) => (frame < start ? start - frame : frame > end ? frame - end : 0)))
  const duck = interpolate(distance, [0, 18], [0.3, 1], clamp)
  return 0.5 * fade * duck
}

const SceneBody = ({scene, durationInFrames}: {scene: FilmScene; durationInFrames: number}) => {
  switch (scene.kind) {
    case 'intro':
      return <IntroScene scene={scene} durationInFrames={durationInFrames} />
    case 'problem':
      return <ProblemScene scene={scene} durationInFrames={durationInFrames} />
    case 'passport':
      return <PassportScene scene={scene} durationInFrames={durationInFrames} />
    case 'coverage':
      return <CoverageScene scene={scene} durationInFrames={durationInFrames} />
    case 'outro':
      return <OutroScene scene={scene} durationInFrames={durationInFrames} />
    case 'recording':
      return <RecordingScene spec={scene} durationInFrames={durationInFrames} />
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
          {placeBeats(scene).map((beat) => (
            <Sequence key={beat.id} from={Math.round(beat.start * fps)} layout="none" name={beat.id}>
              <Audio src={staticFile(`audio/${beat.id}.mp3`)} />
            </Sequence>
          ))}
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
