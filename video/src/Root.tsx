import {Composition} from 'remotion'
import {FILM_FRAMES, VaultlineProduct} from './VaultlineProduct'
import {FPS, HEIGHT, WIDTH} from './theme'

export const RemotionRoot = () => (
  <Composition id="VaultlineProduct" component={VaultlineProduct} durationInFrames={FILM_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
)
