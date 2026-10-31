import {Composition} from 'remotion'
import {PRODUCT_FILM_SECONDS, VaultlineProduct} from './VaultlineProduct'
import {FPS, HEIGHT, WIDTH} from './theme'

export const RemotionRoot = () => (
  <Composition
    id="VaultlineProduct"
    component={VaultlineProduct}
    durationInFrames={Math.round(PRODUCT_FILM_SECONDS * FPS)}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
)
