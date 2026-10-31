import {Composition} from 'remotion'
import {ProductFilm} from './ProductFilm'

export const RemotionRoot = () => (
  <Composition
    id="VaultlinePreview"
    component={ProductFilm}
    durationInFrames={660}
    fps={30}
    width={1920}
    height={1080}
  />
)
