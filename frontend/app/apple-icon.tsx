import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F9' }}>
        <svg width="132" height="132" viewBox="0 0 48 48">
          <defs>
            <clipPath id="disc">
              <circle cx="24" cy="24" r="24" />
            </clipPath>
          </defs>
          <circle cx="24" cy="24" r="24" fill="#0B1423" />
          <path
            d="M9.5 1 24 33.5 38.5 1"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="5.5"
            strokeLinejoin="miter"
            strokeMiterlimit={10}
            clipPath="url(#disc)"
          />
          <rect x="30" y="29" width="5" height="5" fill="#315BFF" />
        </svg>
      </div>
    ),
    size,
  )
}
